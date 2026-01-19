import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseDate } from "@/lib/ingestion/transformations";
import { parseGermanEuroToCents } from "@/lib/calculation-engine";
import { markAggregationStale } from "@/lib/ledger/aggregation";
import { classifyBatch, matchCounterpartyPatterns } from "@/lib/classification/engine";

interface Mappings {
  transactionDate: string;
  amount: string;
  description: string;
  bookingReference?: string;
  bookingSourceId?: string;
}

// POST /api/ingestion/[jobId]/to-ledger - Import direkt ins Ledger
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { jobId } = await params;
    const body = await request.json();
    const {
      mappings,
      valueType = "IST",
      dateFormat = "DD.MM.YYYY",
      decimalSeparator = ",",
      bankAccountId = null,
    } = body as {
      mappings: Mappings;
      valueType: "IST" | "PLAN";
      dateFormat: string;
      decimalSeparator: string;
      bankAccountId: string | null;
    };

    // Job laden
    const job = await prisma.ingestionJob.findUnique({
      where: { id: jobId },
      include: {
        case: true,
        records: {
          orderBy: { rowNumber: "asc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: "Importvorgang nicht gefunden" },
        { status: 404 }
      );
    }

    // Ergebnisse tracken
    let created = 0;
    let skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];

    console.log(`[to-ledger] Processing ${job.records.length} records with mappings:`, mappings);
    if (bankAccountId) {
      console.log(`[to-ledger] Bankkonto zugeordnet: ${bankAccountId}`);
    }

    // Jeden Record verarbeiten
    for (const record of job.records) {
      const rawData = JSON.parse(record.rawData) as Record<string, string | unknown>;

      // Mapping von Display-Namen zu kanonischen Pfaden
      const displayToCanonical: Record<string, string> = {
        "Datum": "datum",
        "Betrag": "betrag",
        "Bezeichnung": "bezeichnung",
        "Einzahlung": "einzahlung",
        "Auszahlung": "auszahlung",
        "Kategorie": "kategorie",
        "Zahlungsart": "zahlungsart",
        "Typ": "typ",
        "Alt/Neu": "alt_neu_forderung",
        "Massetyp": "massetyp",
        "Konto": "konto",
        "Gegenpartei": "gegenpartei",
        "Referenz": "referenz",
        "Kommentar": "kommentar",
        "Notiz": "notiz",
        "Unsicherheit": "unsicherheit",
        "Quelle": "quelle",
        "Werttyp": "werttyp",
      };

      // Hilfsfunktion um Werte sicher als String zu extrahieren
      // Unterstützt Display-Namen, direkte Keys und verschachtelte Strukturen
      const getValue = (key: string): string => {
        // Zuerst: Display-Name zu kanonischem Key auflösen
        const canonicalKey = displayToCanonical[key] || key;
        const lowerKey = canonicalKey.toLowerCase();

        // Direkt versuchen
        let val = rawData[key] ?? rawData[canonicalKey] ?? rawData[lowerKey];

        // Fallback: Case-insensitive in Top-Level suchen
        if (val === null || val === undefined) {
          for (const k of Object.keys(rawData)) {
            if (k.toLowerCase() === lowerKey) {
              val = rawData[k];
              break;
            }
          }
        }

        // Fallback: In verschachtelten Strukturen suchen (core, splitAmount, additional, standard)
        if (val === null || val === undefined) {
          // Spezielle Behandlung für splitAmount
          if (lowerKey === "einzahlung" || lowerKey === "auszahlung") {
            const splitAmount = rawData.splitAmount as Record<string, unknown> | null;
            if (splitAmount && splitAmount[lowerKey] !== undefined) {
              val = splitAmount[lowerKey];
            }
          }

          // core, additional, standard durchsuchen
          if (val === null || val === undefined) {
            for (const section of ["core", "additional", "standard"]) {
              const nested = rawData[section];
              if (nested && typeof nested === "object") {
                const nestedObj = nested as Record<string, unknown>;
                // Direkt, kanonisch, oder case-insensitive
                if (nestedObj[key] !== undefined) {
                  val = nestedObj[key];
                  break;
                }
                if (nestedObj[canonicalKey] !== undefined) {
                  val = nestedObj[canonicalKey];
                  break;
                }
                if (nestedObj[lowerKey] !== undefined) {
                  val = nestedObj[lowerKey];
                  break;
                }
                // Auch andere Varianten probieren
                for (const k of Object.keys(nestedObj)) {
                  if (k.toLowerCase() === lowerKey) {
                    val = nestedObj[k];
                    break;
                  }
                }
                if (val !== null && val !== undefined) break;
              }
            }
          }
        }

        if (val === null || val === undefined) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return String(val).trim();
      };

      // Werte extrahieren - mit Fallbacks für verschachtelte Strukturen
      let dateValue = getValue(mappings.transactionDate);
      let amountValue = getValue(mappings.amount);
      let descriptionValue = getValue(mappings.description);

      // Fallbacks für bekannte Aliase
      if (!dateValue) dateValue = getValue("datum") || getValue("date") || getValue("Buchungstag");
      if (!amountValue) amountValue = getValue("betrag") || getValue("amount") || getValue("Betrag");
      if (!descriptionValue) descriptionValue = getValue("bezeichnung") || getValue("Transaktionsinformation") || getValue("description");
      const bookingReference = mappings.bookingReference
        ? getValue(mappings.bookingReference)
        : null;
      const bookingSourceId = mappings.bookingSourceId
        ? getValue(mappings.bookingSourceId)
        : null;

      // Debug für erste paar Records
      if (record.rowNumber <= 3) {
        console.log(`[to-ledger] Row ${record.rowNumber} values:`, {
          dateValue,
          amountValue,
          descriptionValue: descriptionValue?.substring(0, 50),
        });
      }

      // Datum parsen - mehrere Formate probieren
      let transactionDate: Date | null = null;
      if (dateValue) {
        // Zuerst: Excel serial date (Zahl wie 45678) - häufig bei Excel-Exporten
        const numValue = parseFloat(dateValue);
        if (!isNaN(numValue) && numValue > 40000 && numValue < 60000) {
          // Excel serial date: Tage seit 30.12.1899
          transactionDate = new Date((numValue - 25569) * 86400 * 1000);
        }

        // Konfiguriertes Format versuchen
        if (!transactionDate || isNaN(transactionDate.getTime())) {
          transactionDate = parseDate(dateValue, dateFormat);
        }

        // Fallback: ISO Format (YYYY-MM-DD)
        if (!transactionDate || isNaN(transactionDate.getTime())) {
          const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (isoMatch) {
            transactionDate = new Date(dateValue);
          }
        }

        // Fallback: Deutsches Format mit 4-stelligem Jahr (DD.MM.YYYY)
        if (!transactionDate || isNaN(transactionDate.getTime())) {
          const deMatch = dateValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
          if (deMatch) {
            const [, day, month, year] = deMatch;
            transactionDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
        }

        // Fallback: Deutsches Format mit 2-stelligem Jahr (DD.MM.YY)
        if (!transactionDate || isNaN(transactionDate.getTime())) {
          const deShortMatch = dateValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
          if (deShortMatch) {
            const [, day, month, shortYear] = deShortMatch;
            const year = parseInt(shortYear) + (parseInt(shortYear) > 50 ? 1900 : 2000);
            transactionDate = new Date(year, parseInt(month) - 1, parseInt(day));
          }
        }

        // Fallback: Slash-Format mit 4-stelligem Jahr (DD/MM/YYYY)
        if (!transactionDate || isNaN(transactionDate.getTime())) {
          const slashMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (slashMatch) {
            const [, day, month, year] = slashMatch;
            transactionDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          }
        }

        // Slash-Format mit 2-stelligem Jahr - intelligent zwischen DD/MM/YY und MM/DD/YY wählen
        if (!transactionDate || isNaN(transactionDate.getTime())) {
          const slashShortMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
          if (slashShortMatch) {
            const [, first, second, shortYear] = slashShortMatch;
            const year = parseInt(shortYear) + (parseInt(shortYear) > 50 ? 1900 : 2000);
            const firstNum = parseInt(first);
            const secondNum = parseInt(second);

            // Intelligent wählen: Wenn first > 12, muss es DD/MM sein (first=Tag)
            // Wenn second > 12, muss es MM/DD sein (second=Tag)
            // Sonst: Bevorzuge MM/DD/YY (US-Format, häufiger bei Bank-Exporten)
            if (firstNum > 12 && secondNum <= 12) {
              // first ist Tag, second ist Monat -> DD/MM/YY
              transactionDate = new Date(year, secondNum - 1, firstNum);
            } else if (secondNum > 12 && firstNum <= 12) {
              // second ist Tag, first ist Monat -> MM/DD/YY
              transactionDate = new Date(year, firstNum - 1, secondNum);
            } else {
              // Beide <= 12: Bevorzuge MM/DD/YY (US) für Bank-Exporte
              transactionDate = new Date(year, firstNum - 1, secondNum);
            }
          }
        }

        if (!transactionDate || isNaN(transactionDate.getTime())) {
          errors.push({
            row: record.rowNumber,
            error: `Ungültiges Datum: "${dateValue}"`,
          });
          skipped++;
          continue;
        }
      } else {
        errors.push({
          row: record.rowNumber,
          error: "Kein Datum gefunden",
        });
        skipped++;
        continue;
      }

      // Betrag parsen
      let amountCents: bigint | null = null;
      if (amountValue) {
        const cleanValue = amountValue
          .replace(/\s/g, "")
          .replace(/[€$EUR]/gi, "")
          .replace(/"/g, "")
          .trim();

        // Auto-Detect: Format erkennen basierend auf Trennzeichen
        const hasComma = cleanValue.includes(",");
        const hasDot = cleanValue.includes(".");

        let effectiveSeparator = "."; // Default: Punkt ist Dezimal (englisch)

        if (hasComma && hasDot) {
          // Beide vorhanden: Das letzte Trennzeichen ist das Dezimaltrennzeichen
          const lastComma = cleanValue.lastIndexOf(",");
          const lastDot = cleanValue.lastIndexOf(".");
          effectiveSeparator = lastComma > lastDot ? "," : ".";
        } else if (hasComma && !hasDot) {
          // Nur Komma: Prüfe ob es Dezimal ist (1-2 Ziffern danach)
          const afterComma = cleanValue.split(",").pop() || "";
          if (afterComma.match(/^\d{1,2}$/)) {
            effectiveSeparator = ","; // Komma ist Dezimal (deutsch: 1,50)
          } else {
            effectiveSeparator = "."; // Komma ist Tausender (englisch: 1,000)
          }
        } else if (hasDot && !hasComma) {
          // Nur Punkt: Prüfe ob es Dezimal ist (1-2 Ziffern danach)
          const afterDot = cleanValue.split(".").pop() || "";
          if (afterDot.match(/^\d{1,2}$/)) {
            effectiveSeparator = "."; // Punkt ist Dezimal (englisch: 1.50)
          } else {
            effectiveSeparator = ","; // Punkt ist Tausender (deutsch: 1.000)
          }
        }

        if (effectiveSeparator === ",") {
          // Deutsches Format: 1.234,56
          const normalized = cleanValue
            .replace(/\./g, "")
            .replace(",", ".");
          const parsed = parseFloat(normalized);
          if (!isNaN(parsed)) {
            amountCents = BigInt(Math.round(parsed * 100));
          }
        } else {
          // Englisches Format: 1,234.56
          const normalized = cleanValue.replace(/,/g, "");
          const parsed = parseFloat(normalized);
          if (!isNaN(parsed)) {
            amountCents = BigInt(Math.round(parsed * 100));
          }
        }

        // Fallback: German Euro Parser
        if (amountCents === null) {
          amountCents = parseGermanEuroToCents(amountValue);
        }

        if (amountCents === null) {
          errors.push({
            row: record.rowNumber,
            error: `Ungültiger Betrag: "${amountValue}"`,
          });
          skipped++;
          continue;
        }
      } else {
        errors.push({
          row: record.rowNumber,
          error: "Kein Betrag gefunden",
        });
        skipped++;
        continue;
      }

      // Beschreibung
      const description = descriptionValue?.trim() || `Zeile ${record.rowNumber}`;

      // LedgerEntry erstellen
      await prisma.ledgerEntry.create({
        data: {
          caseId: job.caseId,
          transactionDate,
          amountCents,
          description,
          valueType,
          legalBucket: "UNKNOWN", // Wird im Review zugewiesen
          reviewStatus: "UNREVIEWED",
          createdBy: session.username || "Import",

          // Import-Herkunft
          importSource: job.fileName,
          importJobId: job.id,
          importFileHash: job.fileHashSha256,
          importRowNumber: record.rowNumber,

          // Optionale Booking-Infos
          bookingSource: job.sourceType === "BANK_STATEMENT" ? "BANK_ACCOUNT" : null,
          bookingSourceId: bookingSourceId || null,
          bookingReference: bookingReference || null,

          // Steuerungsdimension: Bankkonto (falls ausgewählt)
          bankAccountId: bankAccountId || null,
        },
      });

      created++;

      // Record als verarbeitet markieren
      await prisma.ingestionRecord.update({
        where: { id: record.id },
        data: {
          status: "READY",
          qualityTier: "TIER_1_VALID",
        },
      });
    }

    // Job-Status aktualisieren
    await prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: "COMMITTED",
        recordCountNormalized: created,
        errorCount: errors.length,
        completedAt: new Date(),
      },
    });

    // Aggregation als veraltet markieren (triggert Neuberechnung)
    if (created > 0) {
      await markAggregationStale(prisma, job.caseId);
    }

    // Klassifikation für neue Einträge durchführen
    let classified = 0;
    let counterpartyMatched = 0;
    if (created > 0) {
      try {
        const classificationResult = await classifyBatch(prisma, job.caseId);
        classified = classificationResult.classified;
        console.log(`[to-ledger] Classification: classified=${classified}, unchanged=${classificationResult.unchanged}`);

        // Counterparty Pattern Matching (schreibt nur Vorschläge!)
        const counterpartyResult = await matchCounterpartyPatterns(prisma, job.caseId);
        counterpartyMatched = counterpartyResult.matched;
        if (counterpartyMatched > 0) {
          console.log(`[to-ledger] Counterparty matching: matched=${counterpartyMatched}`);
        }
      } catch (classErr) {
        console.error("[to-ledger] Classification error (non-fatal):", classErr);
      }
    }

    console.log(`[to-ledger] Finished: created=${created}, classified=${classified}, counterpartyMatched=${counterpartyMatched}, skipped=${skipped}, errors=${errors.length}`);
    if (errors.length > 0) {
      console.log(`[to-ledger] First errors:`, errors.slice(0, 5));
    }

    // Message bauen
    let message = `${created} Zahlungen ins Ledger importiert`;
    const extras: string[] = [];
    if (classified > 0) extras.push(`${classified} klassifiziert`);
    if (counterpartyMatched > 0) extras.push(`${counterpartyMatched} Gegenparteien erkannt`);
    if (extras.length > 0) message += ` (${extras.join(", ")})`;

    return NextResponse.json({
      success: true,
      created,
      classified,
      counterpartyMatched,
      skipped,
      errors: errors.slice(0, 10), // Max 10 Fehler zurückgeben
      totalErrors: errors.length,
      message,
    });
  } catch (error) {
    console.error("Error importing to ledger:", error);
    return NextResponse.json(
      { error: "Fehler beim Import ins Ledger" },
      { status: 500 }
    );
  }
}
