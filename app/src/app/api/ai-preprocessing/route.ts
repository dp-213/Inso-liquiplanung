import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import crypto from "crypto";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  getFileType,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_INTERPRETATION,
  type DocumentType
} from "@/lib/ai-preprocessing/types";

// =============================================================================
// SEMANTIC CLASSIFICATION HEURISTICS
// =============================================================================

/**
 * German financial terms mapped to inflow/outflow categories
 */
const INFLOW_KEYWORDS: { pattern: RegExp; category: string; certainty: 'SICHER' | 'WAHRSCHEINLICH' | 'UNSICHER' }[] = [
  // Revenue / Sales
  { pattern: /umsatz|erlo[e]?se?|einnahm|revenue|sales|ums\./i, category: 'NEUFORDERUNGEN', certainty: 'WAHRSCHEINLICH' },
  { pattern: /kv[\s-]?zahlung|kaufvertrag/i, category: 'KV_ZAHLUNGEN', certainty: 'SICHER' },
  { pattern: /hzv[\s-]?zahlung|handwerkervertrag|werkvertrag/i, category: 'HZV_ZAHLUNGEN', certainty: 'SICHER' },
  { pattern: /altforderung|alt[\s-]?debitor|vor[\s-]?er[o]?ffnung/i, category: 'ALTFORDERUNGEN', certainty: 'WAHRSCHEINLICH' },
  { pattern: /neuforderung|neu[\s-]?debitor|nach[\s-]?er[o]?ffnung/i, category: 'NEUFORDERUNGEN', certainty: 'WAHRSCHEINLICH' },
  { pattern: /miet[\s-]?einnahm|pacht[\s-]?einnahm|miete[\s-]?erhalt/i, category: 'SONSTIGE_ERLOESE', certainty: 'WAHRSCHEINLICH' },
  { pattern: /r[u]?ck[\s-]?erstatt|erstattung|gutschrift/i, category: 'EINMALIGE_SONDERZUFLUESSE', certainty: 'WAHRSCHEINLICH' },
  { pattern: /verkauf[\s-]?erl[o]?s|asset[\s-]?sale|verm[o]?gens[\s-]?verkauf/i, category: 'EINMALIGE_SONDERZUFLUESSE', certainty: 'WAHRSCHEINLICH' },
  { pattern: /einzahlung|zufluss|zugang|haben|credit/i, category: 'SONSTIGE_ERLOESE', certainty: 'UNSICHER' },
  { pattern: /debitor|forderung|receivable/i, category: 'NEUFORDERUNGEN', certainty: 'UNSICHER' },
];

const OUTFLOW_KEYWORDS: { pattern: RegExp; category: string; certainty: 'SICHER' | 'WAHRSCHEINLICH' | 'UNSICHER' }[] = [
  // Personnel
  { pattern: /personal|gehalt|lohn|l[o]?hne|salary|wages|entgelt/i, category: 'PERSONALKOSTEN', certainty: 'SICHER' },
  { pattern: /abfindung|severance|k[u]?ndigung/i, category: 'PERSONALKOSTEN', certainty: 'SICHER' },
  { pattern: /insolvenzgeld|inso[\s-]?geld/i, category: 'PERSONALKOSTEN', certainty: 'SICHER' },
  // Rent / Leasing
  { pattern: /miete|miet[\s-]?aufwand|rent|pacht/i, category: 'MIETE_LEASING', certainty: 'SICHER' },
  { pattern: /leasing|kfz[\s-]?rate|fahrzeug[\s-]?rate/i, category: 'MIETE_LEASING', certainty: 'SICHER' },
  // Suppliers
  { pattern: /lieferant|kreditor|supplier|vendor|wareneingang/i, category: 'LIEFERANTEN', certainty: 'WAHRSCHEINLICH' },
  { pattern: /material|rohstoff|waren[\s-]?einkauf/i, category: 'LIEFERANTEN', certainty: 'WAHRSCHEINLICH' },
  // Taxes / Social
  { pattern: /sozialversicherung|sv[\s-]?beitr|sozialabgabe/i, category: 'SOZIALABGABEN_STEUERN', certainty: 'SICHER' },
  { pattern: /lohnsteuer|lst|umsatzsteuer|ust|mwst|steuer/i, category: 'SOZIALABGABEN_STEUERN', certainty: 'SICHER' },
  { pattern: /finanzamt|steuerzahlung/i, category: 'SOZIALABGABEN_STEUERN', certainty: 'SICHER' },
  // Insolvency costs
  { pattern: /massekosten|verwalter[\s-]?verg[u]?t|gerichtskosten|inso[\s-]?kosten/i, category: 'MASSEKOSTEN', certainty: 'SICHER' },
  { pattern: /verfahrenskosten|insolvenz[\s-]?verwalter/i, category: 'MASSEKOSTEN', certainty: 'SICHER' },
  // Bank
  { pattern: /bank[\s-]?geb[u]?hr|konto[\s-]?f[u]?hr|kredit[\s-]?tilg/i, category: 'BANK_SICHERUNGSRECHTE', certainty: 'SICHER' },
  { pattern: /darlehen|kredit[\s-]?r[u]?ck|zins|interest/i, category: 'BANK_SICHERUNGSRECHTE', certainty: 'WAHRSCHEINLICH' },
  // Other operating
  { pattern: /versicherung|insurance|police/i, category: 'SONSTIGE_LAUFENDE_KOSTEN', certainty: 'WAHRSCHEINLICH' },
  { pattern: /energie|strom|gas|heizung|utility/i, category: 'SONSTIGE_LAUFENDE_KOSTEN', certainty: 'WAHRSCHEINLICH' },
  { pattern: /telefon|internet|kommunikation|it[\s-]?kosten/i, category: 'SONSTIGE_LAUFENDE_KOSTEN', certainty: 'WAHRSCHEINLICH' },
  { pattern: /beratung|rechtsanwalt|steuerberater|consulting/i, category: 'SONSTIGE_LAUFENDE_KOSTEN', certainty: 'WAHRSCHEINLICH' },
  // Generic outflow
  { pattern: /kosten|aufwand|ausgab|expense|cost|auszahlung|abfluss|soll|debit/i, category: 'SONSTIGE_LAUFENDE_KOSTEN', certainty: 'UNSICHER' },
  { pattern: /zahlung|payment|transfer/i, category: 'SONSTIGE_LAUFENDE_KOSTEN', certainty: 'UNSICHER' },
];

/**
 * Document type detection patterns
 */
const DOCUMENT_TYPE_PATTERNS: { type: DocumentType; patterns: RegExp[]; minMatches: number }[] = [
  {
    type: 'LIQUIDITAETSPLANUNG',
    patterns: [
      /liquidit[a]?t/i,
      /cash[\s-]?flow/i,
      /einzahlung.*auszahlung|auszahlung.*einzahlung/i,
      /woche\s*\d|kw\s*\d|w\d+/i,
      /13[\s-]?wochen|dreizehn[\s-]?wochen/i,
    ],
    minMatches: 2,
  },
  {
    type: 'GUV_PL',
    patterns: [
      /gewinn.*verlust|verlust.*gewinn/i,
      /guv|g\s*u\s*v|p[\s&]?l/i,
      /ergebnis[\s-]?rechnung/i,
      /umsatz[\s-]?erl[o]?se/i,
      /betriebsergebnis|jahres[u]?berschuss/i,
    ],
    minMatches: 2,
  },
  {
    type: 'BWA',
    patterns: [
      /bwa|betriebswirtschaftliche[\s-]?auswertung/i,
      /kurzfristige[\s-]?erfolgsrechnung/i,
      /monatsbericht|monatsauswertung/i,
      /vorl[a]?ufige[\s-]?ergebnis/i,
    ],
    minMatches: 1,
  },
  {
    type: 'SUSA',
    patterns: [
      /susa|summen[\s-]?.*[\s-]?saldenliste/i,
      /kontonummer|konto[\s-]?nr/i,
      /anfangssaldo|endsaldo/i,
      /soll[\s-]?.*[\s-]?haben|haben[\s-]?.*[\s-]?soll/i,
      /sachkonto|bilanzkonto/i,
    ],
    minMatches: 2,
  },
  {
    type: 'ZAHLUNGSTERMINE',
    patterns: [
      /zahlungstermin|f[a]?lligkeitsliste/i,
      /kv[\s-]?kalender|hzv[\s-]?kalender/i,
      /miet[\s-]?kalender|zahlungs[\s-]?kalender/i,
      /f[a]?lligkeit|due[\s-]?date/i,
    ],
    minMatches: 1,
  },
  {
    type: 'KONTOAUSZUG',
    patterns: [
      /kontoauszug|bank[\s-]?statement/i,
      /buchungstag|valuta|wertstellung/i,
      /verwendungszweck|zahlungsreferenz/i,
      /iban|bic|konto[\s-]?nummer/i,
      /saldo[\s-]?alt|saldo[\s-]?neu/i,
    ],
    minMatches: 2,
  },
];

/**
 * Detect document type from headers and content
 */
function detectDocumentType(
  headers: string[],
  rows: Record<string, string>[],
  fileName: string
): { type: DocumentType; explanation: string; confidence: number } {
  const allText = [
    fileName,
    ...headers,
    ...rows.slice(0, 10).flatMap(row => Object.values(row)),
  ].join(' ').toLowerCase();

  let bestMatch: { type: DocumentType; score: number; matches: string[] } = {
    type: 'UNBEKANNT',
    score: 0,
    matches: [],
  };

  for (const docType of DOCUMENT_TYPE_PATTERNS) {
    const matches: string[] = [];
    for (const pattern of docType.patterns) {
      if (pattern.test(allText)) {
        matches.push(pattern.source);
      }
    }
    if (matches.length >= docType.minMatches && matches.length > bestMatch.score) {
      bestMatch = { type: docType.type, score: matches.length, matches };
    }
  }

  // If no specific type detected, check for general financial document indicators
  if (bestMatch.type === 'UNBEKANNT') {
    const hasAmounts = rows.some(row =>
      Object.values(row).some(val => /[\d.,]+[\s]*(EUR|€|\$)?[\s]*$/.test(val) || /^\s*-?[\d.,]+\s*$/.test(val))
    );
    const hasDateColumn = headers.some(h => /datum|date|tag|monat|jahr/i.test(h));

    if (hasAmounts) {
      bestMatch = {
        type: 'GEMISCHTES_FINANZDOKUMENT',
        score: 1,
        matches: ['contains_amounts'],
      };
    }
  }

  const confidence = Math.min(bestMatch.score / 3, 1);
  const explanation = bestMatch.matches.length > 0
    ? `Erkannt anhand von: ${bestMatch.matches.slice(0, 3).join(', ')}`
    : 'Keine spezifischen Dokumenttyp-Indikatoren gefunden';

  return {
    type: bestMatch.type,
    explanation,
    confidence,
  };
}

/**
 * Classify a row as inflow or outflow based on text content
 */
function classifyRowByContent(
  rowData: Record<string, string>,
  headers: string[]
): {
  isInflow: boolean | null;
  category: string | null;
  certainty: 'SICHER' | 'WAHRSCHEINLICH' | 'UNSICHER' | 'UNBEKANNT';
  reasoning: string;
} {
  const rowText = Object.values(rowData).join(' ').toLowerCase();
  const headerText = headers.join(' ').toLowerCase();
  const combinedText = rowText + ' ' + headerText;

  // Check inflow patterns
  for (const { pattern, category, certainty } of INFLOW_KEYWORDS) {
    if (pattern.test(combinedText)) {
      return {
        isInflow: true,
        category,
        certainty,
        reasoning: `Erkannt als Einzahlung durch: "${pattern.source}"`,
      };
    }
  }

  // Check outflow patterns
  for (const { pattern, category, certainty } of OUTFLOW_KEYWORDS) {
    if (pattern.test(combinedText)) {
      return {
        isInflow: false,
        category,
        certainty,
        reasoning: `Erkannt als Auszahlung durch: "${pattern.source}"`,
      };
    }
  }

  return {
    isInflow: null,
    category: null,
    certainty: 'UNBEKANNT',
    reasoning: 'Keine eindeutigen Klassifikationsmerkmale gefunden',
  };
}

/**
 * Parse German number formats
 */
function parseGermanNumber(value: string): number | null {
  if (!value || typeof value !== 'string') return null;

  // Remove currency symbols and whitespace
  let cleaned = value.replace(/[€$£\s]/g, '').trim();

  // Handle empty string
  if (!cleaned) return null;

  // Detect format: German uses "1.234,56" vs English "1,234.56"
  const hasGermanFormat = /\d{1,3}(\.\d{3})*,\d{1,2}$/.test(cleaned) || /,\d{1,2}$/.test(cleaned);
  const hasEnglishFormat = /\d{1,3}(,\d{3})*\.\d{1,2}$/.test(cleaned);

  if (hasGermanFormat) {
    // German format: remove thousand separators (.), replace decimal comma with dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (!hasEnglishFormat) {
    // Ambiguous or simple number - try comma as decimal
    if (cleaned.includes(',') && !cleaned.includes('.')) {
      cleaned = cleaned.replace(',', '.');
    }
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Find all numeric columns in the data
 */
function findNumericColumns(
  headers: string[],
  rows: Record<string, string>[]
): { header: string; index: number; isAmountLike: boolean; sampleValues: number[] }[] {
  const numericColumns: { header: string; index: number; isAmountLike: boolean; sampleValues: number[] }[] = [];

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const values: number[] = [];
    let numericCount = 0;

    for (const row of rows.slice(0, 20)) {
      const val = row[header];
      const parsed = parseGermanNumber(val);
      if (parsed !== null) {
        values.push(parsed);
        numericCount++;
      }
    }

    // Consider a column numeric if at least 50% of values are numeric
    const sampleSize = Math.min(rows.length, 20);
    if (numericCount >= sampleSize * 0.5 && numericCount > 0) {
      // Check if it looks like an amount column (has typical amount patterns)
      const isAmountLike = /betrag|amount|summe|wert|eur|saldo|total|zahlung|preis|kosten|erloes/i.test(header) ||
        values.some(v => Math.abs(v) >= 10 && Math.abs(v) <= 10000000); // Typical financial range

      numericColumns.push({
        header,
        index: i,
        isAmountLike,
        sampleValues: values.slice(0, 5),
      });
    }
  }

  return numericColumns;
}

/**
 * Find date columns in the data
 */
function findDateColumn(headers: string[]): string | null {
  const datePatterns = [
    /^datum$/i,
    /date/i,
    /buchungstag/i,
    /valuta/i,
    /wertstellung/i,
    /faelligkeit/i,
    /termin/i,
    /monat/i,
    /periode/i,
    /zeitraum/i,
  ];

  for (const header of headers) {
    for (const pattern of datePatterns) {
      if (pattern.test(header)) {
        return header;
      }
    }
  }
  return null;
}

/**
 * Find description/label column
 */
function findDescriptionColumn(headers: string[]): string | null {
  const descPatterns = [
    /beschreibung/i,
    /bezeichnung/i,
    /text/i,
    /verwendungszweck/i,
    /buchungstext/i,
    /position/i,
    /name/i,
    /kontoname/i,
    /kategorie/i,
    /art/i,
  ];

  for (const header of headers) {
    for (const pattern of descPatterns) {
      if (pattern.test(header)) {
        return header;
      }
    }
  }

  // Fallback: first non-numeric, non-date column
  return headers.find(h =>
    !/datum|date|betrag|amount|summe|nummer|nr|id/i.test(h)
  ) || headers[0];
}

/**
 * Convert monthly value to weekly (pro rata for 13 weeks)
 */
function monthlyToWeekly(monthlyAmount: number): { weeklyAmounts: number[]; explanation: string } {
  // Simple pro rata: monthly / 4.33 weeks per month
  const weeklyAmount = monthlyAmount / 4.33;

  // Distribute across 13 weeks
  const weeklyAmounts = Array(13).fill(0).map(() => Math.round(weeklyAmount * 100) / 100);

  return {
    weeklyAmounts,
    explanation: `Monatswert ${monthlyAmount.toFixed(2)} EUR anteilig auf 13 Wochen verteilt (${weeklyAmount.toFixed(2)} EUR/Woche)`,
  };
}

/**
 * Get document-type specific instructions for AI
 */
function getDocumentTypeInstructions(docType: DocumentType): string {
  switch (docType) {
    case 'LIQUIDITAETSPLANUNG':
      return `Dies ist eine Liquiditätsplanung. Die Werte können direkt als Cashflows verwendet werden.
- Einzahlungen und Auszahlungen sind bereits getrennt
- Wochenbezug sollte aus Spaltenkoepfen ersichtlich sein
- valueType ist typischerweise PLAN`;

    case 'GUV_PL':
      return `Dies ist eine GuV/Gewinn- und Verlustrechnung. WICHTIG: Ertraege und Aufwendungen müssen in Cashflows umgewandelt werden.
- Ertraege (Umsatzerlöse, sonstige Erträge) -> EINZAHLUNGEN
- Aufwendungen (Personalaufwand, Materialaufwand, etc.) -> AUSZAHLUNGEN
- Typischerweise Monatswerte -> auf Wochen verteilen (÷ 4.33)
- Markiere alle Werte mit "aus GuV abgeleitet" in categoryReasoning
- valueType ist typischerweise IST`;

    case 'BWA':
      return `Dies ist eine BWA. Aehnlich wie GuV, aber kurzfristiger.
- Betriebseinnahmen -> EINZAHLUNGEN
- Betriebsausgaben -> AUSZAHLUNGEN
- Monatswerte auf Wochen verteilen
- valueType ist typischerweise IST`;

    case 'SUSA':
      return `Dies ist eine Summen- und Saldenliste. Konten müssen nach Art klassifiziert werden.
- Konten der Klasse 4 (Erlöse) -> EINZAHLUNGEN
- Konten der Klasse 5-7 (Aufwendungen) -> AUSZAHLUNGEN
- Salden repraesentieren oft Monats- oder Periodenwerte
- Beachte Soll/Haben-Logik: Haben bei Erloesen = positiv, Soll bei Aufwendungen = positiv`;

    case 'ZAHLUNGSTERMINE':
      return `Dies ist eine Zahlungsterminübersicht. Verwende die Fälligkeitsdaten direkt.
- KV-Termine -> KV_ZAHLUNGEN (EINZAHLUNG)
- HZV-Termine -> HZV_ZAHLUNGEN (EINZAHLUNG)
- Mietzahlungen -> MIETE_LEASING (AUSZAHLUNG)
- Faelligkeitsdatum bestimmt die Woche
- valueType ist PLAN`;

    case 'KONTOAUSZUG':
      return `Dies ist ein Kontoauszug. Transaktionen direkt als Cashflows verwenden.
- Gutschriften (positive Betraege, "Haben") -> EINZAHLUNGEN
- Belastungen (negative Betraege, "Soll") -> AUSZAHLUNGEN
- Buchungsdatum bestimmt die Woche
- valueType ist IST
- Verwendungszweck zur Kategorisierung nutzen`;

    case 'GEMISCHTES_FINANZDOKUMENT':
    default:
      return `Dokumenttyp ist gemischt oder unklar. Analysiere jede Zeile individuell.
- Suche nach Betraegen in allen Spalten
- Positive Werte ohne weitere Info -> SONSTIGE_ERLOESE (EINZAHLUNG)
- Negative Werte ohne weitere Info -> SONSTIGE_LAUFENDE_KOSTEN (AUSZAHLUNG)
- Markiere alle Klassifizierungen als UNSICHER wenn kein klarer Kontext`;
  }
}

// POST /api/ai-preprocessing - Create a new AI preprocessing job
export async function POST(request: NextRequest) {
  let stepInfo = "Initialisierung";
  try {
    // Step 1: Session validation
    stepInfo = "Sitzungsprüfung";
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Nicht autorisiert - bitte erneut anmelden" },
        { status: 401 }
      );
    }

    // Step 2: Parse form data
    stepInfo = "Formulardaten lesen";
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error("FormData parsing error:", formError);
      return NextResponse.json(
        { error: "Fehler beim Lesen der Formulardaten. Bitte erneut versuchen." },
        { status: 400 }
      );
    }

    const caseId = formData.get("caseId") as string;
    const files = formData.getAll("files") as File[];

    // Step 3: Validate required fields
    stepInfo = "Eingabevalidierung";
    if (!caseId) {
      return NextResponse.json(
        { error: "Fall-ID fehlt. Bitte einen Fall auswählen." },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Keine Dateien ausgewählt. Bitte mindestens eine Datei hochladen." },
        { status: 400 }
      );
    }

    // Validate file types
    const invalidFiles: string[] = [];
    for (const file of files) {
      if (!getFileType(file.name, file.type)) {
        invalidFiles.push(file.name);
      }
    }
    if (invalidFiles.length > 0) {
      return NextResponse.json(
        {
          error: `Nicht unterstuetzte Dateitypen: ${invalidFiles.join(", ")}. Erlaubt sind CSV, Excel und PDF.`,
        },
        { status: 400 }
      );
    }

    // Step 4: Verify case exists
    stepInfo = "Fall-Prüfung in Datenbank";
    let caseRecord;
    try {
      caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
      });
    } catch (dbError) {
      console.error("Database error during case lookup:", dbError);
      return NextResponse.json(
        { error: "Datenbankfehler bei der Fall-Prüfung. Bitte später erneut versuchen." },
        { status: 500 }
      );
    }

    if (!caseRecord) {
      return NextResponse.json(
        { error: `Fall mit ID "${caseId}" nicht gefunden.` },
        { status: 404 }
      );
    }

    // Step 5: Create the preprocessing job
    stepInfo = "Aufbereitungsvorgang erstellen";
    let job;
    try {
      job = await prisma.aiPreprocessingJob.create({
        data: {
          caseId,
          status: "CREATED",
          totalFiles: files.length,
          processedFiles: 0,
          iterationCount: 0,
          createdBy: session.username,
        },
      });
    } catch (jobError) {
      console.error("Error creating AI preprocessing job record:", jobError);
      return NextResponse.json(
        { error: "Fehler beim Anlegen des Aufbereitungsvorgangs in der Datenbank." },
        { status: 500 }
      );
    }

    // Step 6: Log the upload action
    stepInfo = "Protokolleintrag erstellen";
    try {
      await prisma.aiPreprocessingLog.create({
        data: {
          jobId: job.id,
          action: "UPLOAD",
          details: JSON.stringify({
            fileCount: files.length,
            fileNames: files.map((f) => f.name),
          }),
          userId: session.username,
        },
      });
    } catch (logError) {
      console.error("Error creating log entry (non-critical):", logError);
      // Continue - logging failure should not block the process
    }

    // Step 7: Process each file
    stepInfo = "Dateien verarbeiten";
    const fileRecords = [];
    for (const file of files) {
      const fileType = getFileType(file.name, file.type);
      if (!fileType) {
        continue; // Skip unsupported files (already validated above, but defensive)
      }

      let rawContent: string;
      let fileBuffer: Buffer;

      try {
        if (fileType === "CSV") {
          rawContent = await file.text();
          fileBuffer = Buffer.from(rawContent, "utf-8");
        } else {
          const arrayBuffer = await file.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
          rawContent = fileBuffer.toString("base64");
        }
      } catch (fileReadError) {
        console.error(`Error reading file ${file.name}:`, fileReadError);
        return NextResponse.json(
          { error: `Fehler beim Lesen der Datei "${file.name}".` },
          { status: 400 }
        );
      }

      const fileHash = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      try {
        const fileRecord = await prisma.aiPreprocessingFile.create({
          data: {
            jobId: job.id,
            fileName: file.name,
            fileType,
            fileSizeBytes: BigInt(file.size),
            fileHash,
            mimeType: file.type || "application/octet-stream",
            rawContent,
            status: "PENDING",
          },
        });
        fileRecords.push(fileRecord);
      } catch (fileDbError) {
        console.error(`Error saving file ${file.name} to database:`, fileDbError);
        return NextResponse.json(
          { error: `Fehler beim Speichern der Datei "${file.name}" in der Datenbank.` },
          { status: 500 }
        );
      }
    }

    if (fileRecords.length === 0) {
      return NextResponse.json(
        { error: "Keine gueltige Dateien konnten verarbeitet werden." },
        { status: 400 }
      );
    }

    // Step 8: Update job status to PROCESSING
    stepInfo = "Status aktualisieren";
    try {
      await prisma.aiPreprocessingJob.update({
        where: { id: job.id },
        data: { status: "PROCESSING" },
      });
    } catch (updateError) {
      console.error("Error updating job status:", updateError);
      // Continue - the job was created, processing can still happen
    }

    // Step 9: Process files with AI (synchronously for serverless)
    stepInfo = "KI-Verarbeitung durchführen";
    try {
      await processFilesWithAI(job.id, session.username);
    } catch (aiError) {
      console.error("AI processing error:", aiError);
      // Continue - job was created, user can retry
    }

    // Get final job status
    const finalJob = await prisma.aiPreprocessingJob.findUnique({
      where: { id: job.id },
      select: { status: true },
    });

    return NextResponse.json({
      jobId: job.id,
      fileCount: fileRecords.length,
      status: finalJob?.status || "REVIEW",
    });
  } catch (error) {
    console.error(`Error creating AI preprocessing job at step "${stepInfo}":`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json(
      {
        error: `Fehler beim Erstellen des Aufbereitungsvorgangs (${stepInfo}): ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

// GET /api/ai-preprocessing - List AI preprocessing jobs
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Nicht autorisiert - bitte erneut anmelden" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (status) where.status = status;

    let jobs;
    try {
      jobs = await prisma.aiPreprocessingJob.findMany({
        where,
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              debtorName: true,
            },
          },
          _count: {
            select: {
              rows: true,
              files: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    } catch (dbError) {
      console.error("Database error fetching AI preprocessing jobs:", dbError);
      return NextResponse.json(
        { error: "Datenbankfehler beim Laden der Aufbereitungsvorgänge. Bitte später erneut versuchen." },
        { status: 500 }
      );
    }

    // Get row stats for each job
    const jobsWithStats = await Promise.all(
      jobs.map(async (job) => {
        try {
          const rowStats = await prisma.aiPreprocessingRow.groupBy({
            by: ["status"],
            where: { jobId: job.id },
            _count: { status: true },
          });

          const stats = {
            pending: 0,
            approved: 0,
            rejected: 0,
            modified: 0,
            unclear: 0,
          };

          for (const stat of rowStats) {
            switch (stat.status) {
              case "PENDING":
                stats.pending = stat._count.status;
                break;
              case "APPROVED":
                stats.approved = stat._count.status;
                break;
              case "REJECTED":
                stats.rejected = stat._count.status;
                break;
              case "MODIFIED":
                stats.modified = stat._count.status;
                break;
              case "UNCLEAR":
                stats.unclear = stat._count.status;
                break;
            }
          }

          return {
            ...job,
            rowStats: stats,
          };
        } catch (statsError) {
          console.error(`Error fetching row stats for job ${job.id}:`, statsError);
          return {
            ...job,
            rowStats: {
              pending: 0,
              approved: 0,
              rejected: 0,
              modified: 0,
              unclear: 0,
            },
          };
        }
      })
    );

    return NextResponse.json(jobsWithStats);
  } catch (error) {
    console.error("Error fetching AI preprocessing jobs:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json(
      { error: `Fehler beim Laden der Aufbereitungsvorgänge: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Background function to process files with AI
async function processFilesWithAI(jobId: string, userId: string) {
  try {
    // Get job and files
    const job = await prisma.aiPreprocessingJob.findUnique({
      where: { id: jobId },
      include: {
        files: true,
        case: true,
      },
    });

    if (!job) return;

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await prisma.aiPreprocessingJob.update({
        where: { id: jobId },
        data: {
          status: "REVIEW",
          lastError: "ANTHROPIC_API_KEY nicht konfiguriert - Demo-Modus",
        },
      });

      // Create demo rows for testing
      for (const file of job.files) {
        await createDemoRows(jobId, file.id, file.fileName, file.fileType, file.rawContent);
        await prisma.aiPreprocessingFile.update({
          where: { id: file.id },
          data: { status: "COMPLETED" },
        });
      }

      await prisma.aiPreprocessingJob.update({
        where: { id: jobId },
        data: {
          processedFiles: job.files.length,
          status: "REVIEW",
        },
      });

      return;
    }

    // Process each file
    let processedCount = 0;
    for (const file of job.files) {
      try {
        await prisma.aiPreprocessingFile.update({
          where: { id: file.id },
          data: { status: "PROCESSING" },
        });

        // Extract data from file
        const extractedData = await extractFileData(file);

        // Detect document type
        const documentTypeResult = detectDocumentType(
          extractedData.headers,
          extractedData.rows,
          file.fileName
        );

        // Update file with detected document type
        await prisma.aiPreprocessingFile.update({
          where: { id: file.id },
          data: {
            documentType: documentTypeResult.type,
            documentTypeExplanation: documentTypeResult.explanation,
          },
        });

        // Pre-analyze document structure for context
        const numericColumns = findNumericColumns(extractedData.headers, extractedData.rows);
        const dateColumn = findDateColumn(extractedData.headers);
        const descriptionColumn = findDescriptionColumn(extractedData.headers);

        console.log(`File ${file.fileName}: Detected as ${documentTypeResult.type}, ${extractedData.rows.length} rows, ${numericColumns.length} numeric columns`);

        // Call Claude API to analyze the data
        const aiResults = await analyzeWithClaude(
          apiKey,
          file.fileName,
          extractedData,
          job.case.debtorName,
          documentTypeResult.type
        );

        // If AI returned no results but we have data, fall back to basic parsing
        if (aiResults.length === 0 && extractedData.rows.length > 0) {
          console.log(`AI returned no results for ${file.fileName}, falling back to enhanced basic parsing`);
          const context = {
            headers: extractedData.headers,
            documentType: documentTypeResult.type,
            numericColumns,
            dateColumn,
            descriptionColumn,
          };
          for (let i = 0; i < Math.min(extractedData.rows.length, 100); i++) {
            const row = extractedData.rows[i];
            const parsed = createBasicParsedRow(i + 1, row, context);
            // Only add rows that have some meaningful data
            if (parsed.suggestion.amount !== undefined || parsed.suggestion.category !== undefined) {
              aiResults.push(parsed);
            }
          }
        }

        // Create rows from AI results
        for (const result of aiResults) {
          await prisma.aiPreprocessingRow.create({
            data: {
              jobId,
              fileId: file.id,
              sourceLocation: result.sourceLocation,
              rawData: JSON.stringify(result.rawData),
              aiSuggestion: JSON.stringify(result.suggestion),
              aiExplanation: result.explanation,
              confidenceScore: result.confidence,
              confidenceDetails: JSON.stringify(result.fieldConfidences),
              status: "PENDING",
            },
          });
        }

        await prisma.aiPreprocessingFile.update({
          where: { id: file.id },
          data: { status: "COMPLETED" },
        });

        processedCount++;
        await prisma.aiPreprocessingJob.update({
          where: { id: jobId },
          data: { processedFiles: processedCount },
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.fileName}:`, fileError);
        await prisma.aiPreprocessingFile.update({
          where: { id: file.id },
          data: {
            status: "ERROR",
            errorMessage:
              fileError instanceof Error ? fileError.message : "Unbekannter Fehler",
          },
        });
      }
    }

    // Log the processing completion
    await prisma.aiPreprocessingLog.create({
      data: {
        jobId,
        action: "AI_PROCESS",
        details: JSON.stringify({
          processedFiles: processedCount,
          totalFiles: job.files.length,
        }),
        userId,
      },
    });

    // Update job status
    await prisma.aiPreprocessingJob.update({
      where: { id: jobId },
      data: {
        status: "REVIEW",
        processedFiles: processedCount,
      },
    });
  } catch (error) {
    console.error("AI processing error:", error);
    await prisma.aiPreprocessingJob.update({
      where: { id: jobId },
      data: {
        status: "REVIEW",
        lastError: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
    });
  }
}

// Extract data from file based on type
async function extractFileData(
  file: { fileType: string; rawContent: string | null; fileName: string }
): Promise<{ headers: string[]; rows: Record<string, string>[]; sheetInfo?: { name: string; rowCount: number }[] }> {
  if (!file.rawContent) {
    return { headers: [], rows: [] };
  }

  if (file.fileType === "CSV") {
    const parsed = Papa.parse<Record<string, string>>(file.rawContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });
    return {
      headers: parsed.meta.fields || [],
      rows: parsed.data,
    };
  }

  if (file.fileType === "EXCEL") {
    const buffer = Buffer.from(file.rawContent, "base64");
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // Try to find the best sheet (one with most data)
    let bestSheet = { name: workbook.SheetNames[0], rowCount: 0, headers: [] as string[], rows: [] as Record<string, string>[] };
    const sheetInfo: { name: string; rowCount: number }[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
        raw: false, // Get formatted values
      });

      // Skip empty sheets
      if (jsonData.length < 2) {
        sheetInfo.push({ name: sheetName, rowCount: 0 });
        continue;
      }

      // Find header row (first row with multiple non-empty cells)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
        const row = jsonData[i] as unknown[];
        const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
        if (nonEmptyCells >= 2) {
          headerRowIndex = i;
          break;
        }
      }

      const headerRow = jsonData[headerRowIndex] as unknown[];
      const headers = headerRow.map((h, idx) => {
        const headerStr = String(h || "").trim();
        return headerStr || `Spalte_${idx + 1}`;
      });

      const rows = jsonData.slice(headerRowIndex + 1)
        .filter(row => {
          // Filter out completely empty rows
          const cells = row as unknown[];
          return cells.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        })
        .map((row) => {
          const record: Record<string, string> = {};
          (row as unknown[]).forEach((cell, idx) => {
            // Handle dates specially
            if (cell instanceof Date) {
              record[headers[idx] || `col_${idx}`] = cell.toLocaleDateString('de-DE');
            } else {
              record[headers[idx] || `col_${idx}`] = String(cell ?? "");
            }
          });
          return record;
        });

      sheetInfo.push({ name: sheetName, rowCount: rows.length });

      if (rows.length > bestSheet.rowCount) {
        bestSheet = { name: sheetName, rowCount: rows.length, headers, rows };
      }
    }

    return {
      headers: bestSheet.headers,
      rows: bestSheet.rows,
      sheetInfo,
    };
  }

  // For PDF, we would need OCR - for now return empty
  if (file.fileType === "PDF") {
    return {
      headers: ["content"],
      rows: [{ content: "[PDF-Inhalt - OCR erforderlich]" }],
    };
  }

  return { headers: [], rows: [] };
}

// Analyze data with Claude API - ENHANCED version with document type awareness
async function analyzeWithClaude(
  apiKey: string,
  fileName: string,
  data: { headers: string[]; rows: Record<string, string>[] },
  debtorName: string,
  documentType: DocumentType = 'GEMISCHTES_FINANZDOKUMENT'
): Promise<
  Array<{
    sourceLocation: string;
    rawData: Record<string, string>;
    suggestion: Record<string, unknown>;
    explanation: string;
    confidence: number;
    fieldConfidences: Array<{ field: string; confidence: number; reason?: string }>;
  }>
> {
  const results: Array<{
    sourceLocation: string;
    rawData: Record<string, string>;
    suggestion: Record<string, unknown>;
    explanation: string;
    confidence: number;
    fieldConfidences: Array<{ field: string; confidence: number; reason?: string }>;
  }> = [];

  // Pre-analyze the document structure
  const numericColumns = findNumericColumns(data.headers, data.rows);
  const dateColumn = findDateColumn(data.headers);
  const descColumn = findDescriptionColumn(data.headers);
  const docInterpretation = DOCUMENT_TYPE_INTERPRETATION[documentType];

  // Process in batches to avoid token limits
  const batchSize = 20;
  for (let i = 0; i < data.rows.length; i += batchSize) {
    const batch = data.rows.slice(i, i + batchSize);

    const prompt = `Du bist ein Experte für die Analyse von Finanzdaten im Kontext eines deutschen Insolvenzverfahrens.

=== DOKUMENT-KONTEXT ===
Datei: "${fileName}"
Schuldner: "${debtorName}"
ERKANNTER DOKUMENTTYP: ${DOCUMENT_TYPE_LABELS[documentType]}
Interpretation: ${docInterpretation.conversionNote}
Zeitgranularitaet: ${docInterpretation.timeGranularity}
Werttyp: ${docInterpretation.valueNature}

=== DOKUMENTTYP-SPEZIFISCHE ANWEISUNGEN ===
${getDocumentTypeInstructions(documentType)}

=== STRUKTUR-ANALYSE ===
Spalten: ${data.headers.join(", ")}
${numericColumns.length > 0 ? `Numerische Spalten (Betraege): ${numericColumns.map(c => c.header + (c.isAmountLike ? ' [BETRAG]' : '')).join(", ")}` : 'ACHTUNG: Keine eindeutigen numerischen Spalten erkannt!'}
${dateColumn ? `Datum-Spalte: ${dateColumn}` : 'ACHTUNG: Keine Datum-Spalte erkannt!'}
${descColumn ? `Beschreibungs-Spalte: ${descColumn}` : ''}

=== PFLICHT-KATEGORIEN FUER EINZAHLUNGEN (isInflow: true) ===
1. ALTFORDERUNGEN - Forderungen VOR Verfahrenseröffnung (Debitoren aus Altgeschäft)
2. NEUFORDERUNGEN - Forderungen NACH Verfahrenseröffnung (laufende Umsätze)
3. KV_ZAHLUNGEN - Zahlungen aus Kaufvertraegen
4. HZV_ZAHLUNGEN - Zahlungen aus Handwerkervertraegen
5. SONSTIGE_ERLOESE - Andere Einnahmen (Mietertraege, Lizenzgebühren)
6. EINMALIGE_SONDERZUFLUESSE - Einmalige Zuflüsse (Verkäufe, Rückerstattungen)

=== PFLICHT-KATEGORIEN FUER AUSZAHLUNGEN (isInflow: false) ===
1. PERSONALKOSTEN - Loehne, Gehaelter, Abfindungen
2. MIETE_LEASING - Mieten, Leasing-Raten
3. LIEFERANTEN - Lieferantenzahlungen
4. SOZIALABGABEN_STEUERN - SV-Beitraege, Steuern
5. MASSEKOSTEN - Verfahrenskosten
6. BANK_SICHERUNGSRECHTE - Bankgebühren, Kredite
7. SONSTIGE_LAUFENDE_KOSTEN - Versicherungen, Energie, IT
8. EINMALIGE_SONDERABFLUESSE - Einmalige Sonderzahlungen

=== SEMANTISCHE ERKENNUNGSREGELN (WICHTIG!) ===
Diese Begriffe im Text MUESSEN zu folgenden Kategorien fuehren:
- "Umsatz", "Erloese", "Einnahmen" → NEUFORDERUNGEN oder SONSTIGE_ERLOESE (Einzahlung)
- "Personal", "Gehalt", "Lohn", "Abfindung" → PERSONALKOSTEN (Auszahlung)
- "Miete", "Leasing", "Pacht" → MIETE_LEASING (Auszahlung)
- "Lieferant", "Material", "Ware" → LIEFERANTEN (Auszahlung)
- "Steuer", "Sozialversicherung", "Finanzamt" → SOZIALABGABEN_STEUERN (Auszahlung)
- "Versicherung", "Strom", "Telefon" → SONSTIGE_LAUFENDE_KOSTEN (Auszahlung)
- Bei Kontoauszuegen: Positiv = Einzahlung, Negativ = Auszahlung

=== DATEN (Zeilen ${i + 1} bis ${i + batch.length}) ===
${batch.map((row, idx) => `Zeile ${i + idx + 1}: ${JSON.stringify(row)}`).join("\n")}

=== KRITISCHE AUSGABE-REGELN ===
1. JEDE Zeile mit einem erkennbaren Betrag MUSS verarbeitet werden
2. Wenn ein Betrag erkennbar ist (auch in unerwarteten Spalten), MUSS er extrahiert werden
3. NIEMALS 0 EUR zurückgeben wenn die Originaldaten einen Betrag enthalten
4. Bei fehlender Kategorie-Information: Basierend auf Vorzeichen klassifizieren
5. Bei monatlichen Werten: Pro-rata auf Wochen verteilen und "weekConversionNote" hinzufuegen

Antworte NUR mit validem JSON in dieser Struktur:
{
  "documentAnalysis": {
    "confirmedType": "${documentType}",
    "hasMonthlyValues": <true/false>,
    "conversionApplied": "<Beschreibung der angewandten Konvertierung>"
  },
  "rows": [
    {
      "rowIndex": <nummer>,
      "suggestion": {
        "date": "<datum>",
        "weekOffset": <0-12>,
        "amount": <positive Zahl in EUR, NIEMALS 0 wenn Originaldaten Betrag haben>,
        "amountRaw": "<original string>",
        "isInflow": <true/false>,
        "category": "<EINE Kategorie von oben>",
        "lineName": "<kurzer Name>",
        "estateType": "<ALTMASSE|NEUMASSE|NICHT_ZUORDENBAR>",
        "valueType": "<IST|PLAN|UNSICHER>",
        "categoryReasoning": "<PFLICHT: Warum diese Kategorie>",
        "estateTypeReasoning": "<PFLICHT: Warum diese Massezuordnung>",
        "categoryUncertainty": "<SICHER|WAHRSCHEINLICH|UNSICHER|UNBEKANNT>",
        "amountUncertainty": "<SICHER|WAHRSCHEINLICH|UNSICHER|UNBEKANNT>",
        "weekUncertainty": "<SICHER|WAHRSCHEINLICH|UNSICHER|UNBEKANNT>",
        "uncertaintyExplanation": "<bei Unsicherheit: Erklärung>",
        "weekConversionNote": "<falls monatlich zu woechentlich konvertiert>"
      },
      "explanation": "<Zusammenfassung>",
      "confidence": <0.0-1.0>,
      "fieldConfidences": [
        {"field": "category", "confidence": <0.0-1.0>, "reason": "<Grund>"},
        {"field": "amount", "confidence": <0.0-1.0>, "reason": "<Grund>"},
        {"field": "weekOffset", "confidence": <0.0-1.0>, "reason": "<Grund>"}
      ]
    }
  ]
}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Claude API error:", errorText);
        // Fall back to basic parsing for this batch
        for (let j = 0; j < batch.length; j++) {
          results.push(createBasicParsedRow(i + j + 1, batch[j]));
        }
        continue;
      }

      const claudeResponse = await response.json();
      const content = claudeResponse.content?.[0]?.text;

      if (content) {
        try {
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            for (const row of parsed.rows || []) {
              results.push({
                sourceLocation: `row:${row.rowIndex}`,
                rawData: batch[row.rowIndex - i - 1] || {},
                suggestion: row.suggestion || {},
                explanation: row.explanation || "Keine Erklärung verfügbar",
                confidence: row.confidence || 0.5,
                fieldConfidences: row.fieldConfidences || [],
              });
            }
          }
        } catch (parseError) {
          console.error("Error parsing Claude response:", parseError);
          // Fall back to basic parsing
          for (let j = 0; j < batch.length; j++) {
            results.push(createBasicParsedRow(i + j + 1, batch[j]));
          }
        }
      }
    } catch (apiError) {
      console.error("Claude API call failed:", apiError);
      // Fall back to basic parsing
      for (let j = 0; j < batch.length; j++) {
        results.push(createBasicParsedRow(i + j + 1, batch[j]));
      }
    }
  }

  return results;
}

// Create a basic parsed row when AI is not available - ENHANCED version
function createBasicParsedRow(
  rowIndex: number,
  rawData: Record<string, string>,
  context?: {
    headers: string[];
    documentType: DocumentType;
    numericColumns?: { header: string; index: number; isAmountLike: boolean }[];
    dateColumn?: string | null;
    descriptionColumn?: string | null;
  }
): {
  sourceLocation: string;
  rawData: Record<string, string>;
  suggestion: Record<string, unknown>;
  explanation: string;
  confidence: number;
  fieldConfidences: Array<{ field: string; confidence: number; reason?: string }>;
} {
  const suggestion: Record<string, unknown> = {};
  const fieldConfidences: Array<{ field: string; confidence: number; reason?: string }> = [];
  const headers = context?.headers || Object.keys(rawData);

  // Try to find amounts - prioritized search
  let foundAmount = false;
  let amountValue: number | null = null;
  let amountSource = '';

  // Strategy 1: Use known numeric/amount columns from context
  if (context?.numericColumns) {
    for (const col of context.numericColumns) {
      if (col.isAmountLike && rawData[col.header]) {
        const parsed = parseGermanNumber(rawData[col.header]);
        if (parsed !== null && parsed !== 0) {
          amountValue = parsed;
          amountSource = col.header;
          foundAmount = true;
          break;
        }
      }
    }
    // Fallback to any numeric column
    if (!foundAmount) {
      for (const col of context.numericColumns) {
        if (rawData[col.header]) {
          const parsed = parseGermanNumber(rawData[col.header]);
          if (parsed !== null && parsed !== 0) {
            amountValue = parsed;
            amountSource = col.header;
            foundAmount = true;
            break;
          }
        }
      }
    }
  }

  // Strategy 2: Look for columns with amount-like names
  if (!foundAmount) {
    const amountPatterns = [
      /^betrag$/i, /^amount$/i, /^summe$/i, /^wert$/i, /^eur$/i, /^euro$/i,
      /betrag/i, /amount/i, /summe/i, /saldo/i, /zahlung/i, /total/i,
      /soll$/i, /haben$/i, /debit/i, /credit/i,
    ];

    for (const pattern of amountPatterns) {
      for (const [key, value] of Object.entries(rawData)) {
        if (pattern.test(key) && value) {
          const parsed = parseGermanNumber(value);
          if (parsed !== null && parsed !== 0) {
            amountValue = parsed;
            amountSource = key;
            foundAmount = true;
            break;
          }
        }
      }
      if (foundAmount) break;
    }
  }

  // Strategy 3: Find ANY numeric value that looks like a financial amount
  if (!foundAmount) {
    for (const [key, value] of Object.entries(rawData)) {
      if (!value) continue;
      // Skip columns that are obviously not amounts
      if (/nummer|nr|id|index|zeile|row|konto.*nr|blz|bic|iban/i.test(key)) continue;

      const parsed = parseGermanNumber(value);
      if (parsed !== null && parsed !== 0) {
        // Check if this looks like a financial amount (reasonable range)
        const absValue = Math.abs(parsed);
        if (absValue >= 0.01 && absValue <= 100000000) {
          amountValue = parsed;
          amountSource = key;
          foundAmount = true;
          break;
        }
      }
    }
  }

  // Process the found amount
  if (foundAmount && amountValue !== null) {
    suggestion.amount = Math.abs(amountValue);
    suggestion.amountRaw = rawData[amountSource];

    // Determine inflow/outflow based on sign
    const isNegative = amountValue < 0;

    // Check if the column name indicates direction
    const sourceColLower = amountSource.toLowerCase();
    if (/soll|ausgab|auszahl|kosten|aufwand|debit/i.test(sourceColLower)) {
      suggestion.isInflow = false;
    } else if (/haben|einnah|einzahl|erloes|credit/i.test(sourceColLower)) {
      suggestion.isInflow = true;
    } else {
      // Use sign: negative = outflow, positive = inflow
      suggestion.isInflow = !isNegative;
    }

    suggestion.amountUncertainty = "WAHRSCHEINLICH";
    fieldConfidences.push({
      field: "amount",
      confidence: 0.7,
      reason: `Betrag aus Spalte "${amountSource}" erkannt`,
    });
  }

  // Try to classify by row content using semantic heuristics
  const classification = classifyRowByContent(rawData, headers);

  if (classification.category) {
    suggestion.category = classification.category;
    suggestion.isInflow = classification.isInflow;
    suggestion.categoryReasoning = classification.reasoning;
    suggestion.categoryUncertainty = classification.certainty;
    fieldConfidences.push({
      field: "category",
      confidence: classification.certainty === 'SICHER' ? 0.9 : classification.certainty === 'WAHRSCHEINLICH' ? 0.7 : 0.4,
      reason: classification.reasoning,
    });
  } else if (suggestion.amount !== undefined) {
    // Default category based on flow direction
    if (suggestion.isInflow) {
      suggestion.category = "SONSTIGE_ERLOESE";
      suggestion.categoryReasoning = "Positiver Betrag - als sonstiger Erloes klassifiziert";
    } else {
      suggestion.category = "SONSTIGE_LAUFENDE_KOSTEN";
      suggestion.categoryReasoning = "Negativer Betrag - als sonstige Kosten klassifiziert";
    }
    suggestion.categoryUncertainty = "UNSICHER";
    fieldConfidences.push({
      field: "category",
      confidence: 0.3,
      reason: "Standardkategorie basierend auf Vorzeichen - manuelle Prüfung erforderlich",
    });
  }

  // Find date if available
  const dateColumn = context?.dateColumn || findDateColumn(headers);
  if (dateColumn && rawData[dateColumn]) {
    suggestion.date = rawData[dateColumn];
    // Try to calculate week offset (simple approach)
    const dateStr = rawData[dateColumn];
    const parsedDate = parseGermanDate(dateStr);
    if (parsedDate) {
      const now = new Date();
      const diffDays = Math.floor((parsedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const weekOffset = Math.max(0, Math.min(12, Math.floor(diffDays / 7)));
      if (diffDays >= -7 && diffDays <= 91) {
        suggestion.weekOffset = weekOffset;
        suggestion.weekUncertainty = "WAHRSCHEINLICH";
      } else {
        suggestion.weekUncertainty = "UNSICHER";
        suggestion.uncertaintyExplanation = `Datum ${dateStr} liegt ausserhalb des 13-Wochen-Planungshorizonts`;
      }
    } else {
      suggestion.weekUncertainty = "UNBEKANNT";
    }
    fieldConfidences.push({
      field: "date",
      confidence: 0.6,
      reason: `Datum aus Spalte "${dateColumn}" erkannt`,
    });
  } else {
    suggestion.weekOffset = 0; // Default to first week
    suggestion.weekUncertainty = "UNBEKANNT";
    suggestion.uncertaintyExplanation = (suggestion.uncertaintyExplanation || "") + " Kein Datum gefunden, Woche 1 als Standard.";
  }

  // Find description/name
  const descColumn = context?.descriptionColumn || findDescriptionColumn(headers);
  if (descColumn && rawData[descColumn]) {
    const descValue = rawData[descColumn].trim();
    if (descValue) {
      suggestion.description = descValue;
      suggestion.lineName = descValue.substring(0, 50);
      fieldConfidences.push({
        field: "description",
        confidence: 0.6,
        reason: `Beschreibung aus Spalte "${descColumn}" erkannt`,
      });
    }
  }

  // Set defaults
  suggestion.estateType = suggestion.estateType || "NICHT_ZUORDENBAR";
  suggestion.estateTypeReasoning = suggestion.estateTypeReasoning || "Kann ohne weitere Informationen nicht bestimmt werden";
  suggestion.valueType = suggestion.valueType || "UNSICHER";

  if (!suggestion.categoryUncertainty) suggestion.categoryUncertainty = "UNSICHER";
  if (!suggestion.amountUncertainty) suggestion.amountUncertainty = "UNSICHER";
  if (!suggestion.uncertaintyExplanation) {
    suggestion.uncertaintyExplanation = "Automatische Erkennung ohne KI - manuelle Prüfung erforderlich";
  }

  // Calculate overall confidence
  const hasAmount = suggestion.amount !== undefined && suggestion.amount !== 0;
  const hasCategory = suggestion.category !== undefined;
  const hasWeek = suggestion.weekOffset !== undefined;
  const confidence = hasAmount ? (hasCategory ? 0.5 : 0.4) : 0.2;

  return {
    sourceLocation: `row:${rowIndex}`,
    rawData,
    suggestion,
    explanation: hasAmount
      ? `Automatisch erkannt: ${suggestion.isInflow ? 'Einzahlung' : 'Auszahlung'} ${suggestion.amount} EUR. Kategorie: ${suggestion.category || 'nicht bestimmt'}. Manuelle Prüfung empfohlen.`
      : "Kein Betrag erkannt - manuelle Eingabe erforderlich.",
    confidence,
    fieldConfidences,
  };
}

/**
 * Parse German date formats (DD.MM.YYYY, DD/MM/YYYY, etc.)
 */
function parseGermanDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try DD.MM.YYYY
  let match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    let year = parseInt(match[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  // Try YYYY-MM-DD
  match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  // Try DD/MM/YYYY
  match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    let year = parseInt(match[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  return null;
}

// Create demo rows for testing without API key - ENHANCED version
async function createDemoRows(
  jobId: string,
  fileId: string,
  fileName: string,
  fileType: string,
  rawContent: string | null
) {
  if (!rawContent) return;

  const data = await extractFileData({ fileType, rawContent, fileName });

  if (data.rows.length === 0) {
    console.log(`No rows extracted from ${fileName}`);
    return;
  }

  // Detect document type
  const documentTypeResult = detectDocumentType(data.headers, data.rows, fileName);

  // Update file with detected document type
  await prisma.aiPreprocessingFile.update({
    where: { id: fileId },
    data: {
      documentType: documentTypeResult.type,
      documentTypeExplanation: documentTypeResult.explanation + " (Demo-Modus)",
    },
  });

  // Pre-analyze document structure
  const numericColumns = findNumericColumns(data.headers, data.rows);
  const dateColumn = findDateColumn(data.headers);
  const descriptionColumn = findDescriptionColumn(data.headers);

  const context = {
    headers: data.headers,
    documentType: documentTypeResult.type,
    numericColumns,
    dateColumn,
    descriptionColumn,
  };

  console.log(`Demo mode - ${fileName}: Detected as ${documentTypeResult.type}, ${data.rows.length} rows, ${numericColumns.length} numeric columns (${numericColumns.map(c => c.header).join(', ')})`);

  let createdRows = 0;
  for (let i = 0; i < Math.min(data.rows.length, 100); i++) {
    const row = data.rows[i];
    const parsed = createBasicParsedRow(i + 1, row, context);

    // Only create rows that have meaningful data (an amount was found)
    if (parsed.suggestion.amount !== undefined && parsed.suggestion.amount !== 0) {
      await prisma.aiPreprocessingRow.create({
        data: {
          jobId,
          fileId,
          sourceLocation: parsed.sourceLocation,
          rawData: JSON.stringify(parsed.rawData),
          aiSuggestion: JSON.stringify(parsed.suggestion),
          aiExplanation: parsed.explanation + ` (Demo-Modus, Dokument: ${DOCUMENT_TYPE_LABELS[documentTypeResult.type]})`,
          confidenceScore: parsed.confidence,
          confidenceDetails: JSON.stringify(parsed.fieldConfidences),
          status: "PENDING",
        },
      });
      createdRows++;
    }
  }

  // If no rows with amounts were found, create at least one row for each data row
  // to show the user what was found (even if amounts couldn't be extracted)
  if (createdRows === 0 && data.rows.length > 0) {
    console.log(`No amounts found in ${fileName}, creating informational rows`);
    for (let i = 0; i < Math.min(data.rows.length, 20); i++) {
      const row = data.rows[i];
      const parsed = createBasicParsedRow(i + 1, row, context);

      await prisma.aiPreprocessingRow.create({
        data: {
          jobId,
          fileId,
          sourceLocation: parsed.sourceLocation,
          rawData: JSON.stringify(parsed.rawData),
          aiSuggestion: JSON.stringify({
            ...parsed.suggestion,
            categoryUncertainty: "UNBEKANNT",
            amountUncertainty: "UNBEKANNT",
            uncertaintyExplanation: "Kein numerischer Betrag in dieser Zeile erkannt. Bitte manuell prüfen.",
          }),
          aiExplanation: `Zeile ohne erkennbaren Betrag. Rohdaten: ${Object.values(row).slice(0, 3).join(', ')}... (Demo-Modus)`,
          confidenceScore: 0.1,
          confidenceDetails: JSON.stringify(parsed.fieldConfidences),
          status: "PENDING",
        },
      });
    }
  }

  console.log(`Demo mode - Created ${createdRows} rows with amounts from ${fileName}`);
}
