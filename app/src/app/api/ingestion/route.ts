import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import crypto from "crypto";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  parseFile,
  detectColumns,
  generateSchemaMetadata,
  serializeRecord,
} from "@/lib/ingestion/canonical-parser";
import { CANONICAL_SCHEMA_VERSION } from "@/lib/ingestion/canonical-schema";

// =============================================================================
// ERROR MESSAGE HELPER
// =============================================================================

/**
 * Creates detailed error messages in German.
 * For required field validation only - never for unknown columns.
 */
function createDetailedError(
  stage: string,
  error: unknown,
  context?: Record<string, unknown>
): { userMessage: string; technicalDetails: string } {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log full technical details to console
  console.error(`[Ingestion Error] Stage: ${stage}`, {
    error: errorMessage,
    stack: errorStack,
    context,
  });

  // Map common errors to German user-friendly messages
  const userMessages: Record<string, string> = {
    // Database errors
    "Foreign key constraint failed": "Der ausgewählte Fall existiert nicht in der Datenbank",
    "Unique constraint failed": "Diese Datei wurde bereits importiert (Duplikat erkannt)",
    "Connection refused": "Datenbankverbindung fehlgeschlagen. Bitte versuchen Sie es später erneut",
    "SQLITE_BUSY": "Datenbank ist beschaeftigt. Bitte versuchen Sie es erneut",
    "relation": "Datenbankfehler: Tabelle oder Beziehung nicht gefunden",
    // File errors
    "File corrupted": "Die Datei ist beschädigt oder in einem ungültigen Format",
    "password protected": "Passwortgeschützte Excel-Dateien werden nicht unterstützt",
    "encrypted": "Verschlüsselte Dateien werden nicht unterstützt",
  };

  // Find matching user message
  let userMessage = `Fehler beim ${stage}`;
  for (const [key, message] of Object.entries(userMessages)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      userMessage = message;
      break;
    }
  }

  return {
    userMessage,
    technicalDetails: errorMessage,
  };
}

// =============================================================================
// POST /api/ingestion - Upload and process a file
// =============================================================================

export async function POST(request: NextRequest) {
  let stage = "Initialisierung";
  let fileNameForError = "unbekannt";

  try {
    // Stage 1: Authentication
    stage = "Authentifizierung";
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nicht angemeldet - bitte zuerst einloggen" }, { status: 401 });
    }

    // Stage 2: Parse form data
    stage = "Lesen der Formulardaten";
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (e) {
      console.error("FormData parsing error:", e);
      return NextResponse.json(
        { error: "Formulardaten konnten nicht gelesen werden. Bitte versuchen Sie es erneut." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File;
    const caseId = formData.get("caseId") as string;
    const sourceType = formData.get("sourceType") as string;

    // Stage 3: Validate inputs
    stage = "Validierung der Eingaben";
    if (!file) {
      return NextResponse.json(
        { error: "Keine Datei ausgewählt. Bitte wählen Sie eine CSV- oder Excel-Datei aus." },
        { status: 400 }
      );
    }
    if (!caseId) {
      return NextResponse.json(
        { error: "Kein Fall ausgewählt. Bitte wählen Sie einen Fall aus der Liste." },
        { status: 400 }
      );
    }
    if (!sourceType) {
      return NextResponse.json(
        { error: "Kein Dateityp angegeben." },
        { status: 400 }
      );
    }

    fileNameForError = file.name;

    // Stage 4: Verify case exists
    stage = "Prüfen des Falls";
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, caseNumber: true },
    });

    if (!caseExists) {
      return NextResponse.json(
        { error: `Der ausgewählte Fall (ID: ${caseId.substring(0, 8)}...) existiert nicht. Bitte aktualisieren Sie die Seite.` },
        { status: 400 }
      );
    }

    // Stage 5: Detect file type and read content
    stage = "Erkennen des Dateityps";
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    let fileContent: string;
    let fileBuffer: Buffer;
    let rawRecords: Record<string, string>[] = [];
    let headers: string[] = [];
    let parseError: string | null = null;
    let parseErrorDetails: string | null = null;
    let sheetNames: string[] = [];
    let mimeType: string;

    // Stage 6: Read file content
    stage = "Lesen der Datei";
    if (isExcel) {
      // Read Excel file
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await file.arrayBuffer();
      } catch (e) {
        console.error("Error reading Excel file as ArrayBuffer:", e);
        return NextResponse.json(
          { error: `Die Datei '${file.name}' konnte nicht gelesen werden. Bitte stellen Sie sicher, dass die Datei nicht beschaedigt ist.` },
          { status: 400 }
        );
      }

      fileBuffer = Buffer.from(arrayBuffer);
      fileContent = fileBuffer.toString("base64");
      mimeType = fileName.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.ms-excel";

      // Stage 7: Parse Excel
      stage = "Verarbeiten der Excel-Datei";
      try {
        // cellDates: true converts Excel date serials to JS Date objects
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
        sheetNames = workbook.SheetNames;

        if (sheetNames.length === 0) {
          parseError = "Die Excel-Datei enthält keine Tabellenblaetter.";
          parseErrorDetails = "SheetNames array is empty";
        } else {
          const firstSheet = workbook.Sheets[sheetNames[0]];

          if (!firstSheet) {
            parseError = `Das Tabellenblatt '${sheetNames[0]}' konnte nicht gelesen werden.`;
            parseErrorDetails = "First sheet is null or undefined";
          } else {
            const jsonData = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
              header: 1,
              defval: "",
            });

            if (jsonData.length === 0) {
              parseError = `Das Tabellenblatt '${sheetNames[0]}' ist leer.`;
              parseErrorDetails = "sheet_to_json returned empty array";
            } else if (jsonData.length === 1) {
              parseError = "Die Datei enthält nur eine Kopfzeile, aber keine Daten. Bitte fuegen Sie mindestens eine Datenzeile hinzu.";
              parseErrorDetails = "Only header row found, no data rows";
            } else {
              // First row is headers
              const firstRow = jsonData[0] as unknown[];

              if (firstRow.length === 0 || firstRow.every((h) => !h)) {
                parseError = "Die erste Zeile (Kopfzeile) ist leer. Bitte stellen Sie sicher, dass die Spaltenüberschriften in der ersten Zeile stehen.";
                parseErrorDetails = "Header row is empty";
              } else {
                // Extract headers - preserve original names for mapping
                headers = firstRow.map((h, idx) =>
                  String(h || `spalte_${idx + 1}`).trim()
                );

                // Check for duplicate headers
                const headerLower = headers.map(h => h.toLowerCase());
                const headerCounts: Record<string, number> = {};
                for (const h of headerLower) {
                  headerCounts[h] = (headerCounts[h] || 0) + 1;
                }
                const duplicates = Object.entries(headerCounts)
                  .filter(([, count]) => count > 1)
                  .map(([name]) => name);

                if (duplicates.length > 0) {
                  parseError = `Doppelte Spaltenüberschriften gefunden: ${duplicates.join(", ")}. Jede Spalte muss einen eindeutigen Namen haben.`;
                  parseErrorDetails = `Duplicate headers: ${duplicates.join(", ")}`;
                } else {
                  // Helper to format cell values (especially dates)
                  const formatCellValue = (value: unknown): string => {
                    if (value === null || value === undefined || value === "") return "";
                    if (value instanceof Date) {
                      // Format as DD.MM.YYYY (German format)
                      const day = String(value.getDate()).padStart(2, "0");
                      const month = String(value.getMonth() + 1).padStart(2, "0");
                      const year = value.getFullYear();
                      return `${day}.${month}.${year}`;
                    }
                    return String(value);
                  };

                  // Convert to records using original header names
                  rawRecords = jsonData
                    .slice(1)
                    .filter((row) => (row as unknown[]).some((cell) => cell !== ""))
                    .map((row) => {
                      const rowArr = row as unknown[];
                      const record: Record<string, string> = {};
                      headers.forEach((header, idx) => {
                        record[header] = formatCellValue(rowArr[idx]);
                      });
                      return record;
                    });

                  if (rawRecords.length === 0) {
                    parseError = "Alle Datenzeilen sind leer. Bitte stellen Sie sicher, dass die Datei Daten enthält.";
                    parseErrorDetails = "All data rows filtered out as empty";
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("Excel parsing error:", e);

        if (errorMsg.includes("password")) {
          parseError = "Die Excel-Datei ist passwortgeschuetzt. Bitte entfernen Sie den Passwortschutz und versuchen Sie es erneut.";
        } else if (errorMsg.includes("encrypt")) {
          parseError = "Die Excel-Datei ist verschlüsselt. Bitte speichern Sie die Datei ohne Verschlüsselung.";
        } else if (errorMsg.includes("CFB")) {
          parseError = "Das Excel-Format wird nicht unterstützt. Bitte speichern Sie die Datei im XLSX-Format.";
        } else {
          parseError = `Excel-Datei konnte nicht gelesen werden: ${errorMsg}`;
        }
        parseErrorDetails = errorMsg;
      }
    } else {
      // Read CSV file
      stage = "Lesen der CSV-Datei";
      try {
        fileContent = await file.text();
      } catch (e) {
        console.error("Error reading CSV file as text:", e);
        return NextResponse.json(
          { error: `Die Datei '${file.name}' konnte nicht als Text gelesen werden. Bitte ueberprüfen Sie die Zeichenkodierung (UTF-8 empfohlen).` },
          { status: 400 }
        );
      }

      fileBuffer = Buffer.from(fileContent, "utf-8");
      mimeType = "text/csv";

      // Stage 8: Parse CSV
      stage = "Verarbeiten der CSV-Datei";
      try {
        const parsed = Papa.parse<Record<string, string>>(fileContent, {
          header: true,
          skipEmptyLines: true,
          // DO NOT transform headers here - preserve original names for column detection
          transformHeader: (header) => header.trim(),
        });

        if (parsed.errors.length > 0) {
          const firstError = parsed.errors[0];
          if (firstError.type === "Delimiter") {
            parseError = "CSV-Trennzeichen nicht erkannt. Bitte verwenden Sie Komma (,) oder Semikolon (;) als Trennzeichen.";
          } else if (firstError.type === "Quotes") {
            parseError = `CSV-Formatfehler in Zeile ${firstError.row}: Ungueltige Anfuehrungszeichen. ${firstError.message}`;
          } else if (firstError.type === "FieldMismatch") {
            parseError = `CSV-Formatfehler in Zeile ${firstError.row}: Unterschiedliche Anzahl von Spalten. Erwartet: ${parsed.meta.fields?.length || "unbekannt"}, gefunden: anders.`;
          } else {
            parseError = `CSV-Fehler in Zeile ${firstError.row || "?"}: ${firstError.message}`;
          }
          parseErrorDetails = JSON.stringify(firstError);
        } else if (!parsed.data || parsed.data.length === 0) {
          parseError = "Die CSV-Datei enthält keine Daten nach der Kopfzeile.";
          parseErrorDetails = "parsed.data is empty";
        } else if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
          parseError = "Keine Spalten in der CSV-Datei erkannt. Bitte stellen Sie sicher, dass die erste Zeile Spaltenüberschriften enthält.";
          parseErrorDetails = "No fields detected";
        } else {
          rawRecords = parsed.data;
          headers = parsed.meta.fields;
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error("CSV parsing error:", e);
        parseError = `CSV-Datei konnte nicht verarbeitet werden: ${errorMsg}`;
        parseErrorDetails = errorMsg;
      }
    }

    // Stage 9: Calculate file hash
    stage = "Berechnen der Datei-Pruefsumme";
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Stage 10: Create ingestion job in database
    stage = "Erstellen des Importvorgangs in der Datenbank";
    let job;
    try {
      job = await prisma.ingestionJob.create({
        data: {
          caseId,
          sourceType: isExcel ? "EXCEL_GENERIC" : sourceType,
          fileName: file.name,
          fileHashSha256: fileHash,
          fileSizeBytes: BigInt(file.size),
          rawFileContent: fileContent,
          mimeType,
          status: parseError ? "REJECTED" : "PARSING",
          createdBy: session.username,
        },
      });
    } catch (e) {
      const { userMessage, technicalDetails } = createDetailedError(
        "Erstellen des Importvorgangs",
        e,
        { caseId, fileName: file.name, fileSize: file.size }
      );
      return NextResponse.json(
        {
          error: userMessage,
          details: process.env.NODE_ENV === "development" ? technicalDetails : undefined,
        },
        { status: 500 }
      );
    }

    // If there was a parse error, update status and return
    if (parseError) {
      try {
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: "REJECTED",
            errorCount: 1,
            completedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error("Error updating rejected job status:", updateError);
      }

      return NextResponse.json(
        {
          error: parseError,
          jobId: job.id,
          details: process.env.NODE_ENV === "development" ? parseErrorDetails : undefined,
        },
        { status: 400 }
      );
    }

    // ==========================================================================
    // CANONICAL SCHEMA VALIDATION
    // Stage 11: Validate against canonical schema (ONLY REQUIRED FIELDS)
    // ==========================================================================

    stage = "Validierung gegen kanonisches Schema";

    // Detect columns and validate structure
    const columnMapping = detectColumns(headers);

    // Generate schema metadata for the job
    const schemaMetadata = generateSchemaMetadata(headers, columnMapping);

    // Parse and validate all records
    const validationResult = parseFile(
      rawRecords,
      headers,
      isExcel && sheetNames.length > 0 ? sheetNames[0] : null
    );

    // If there are file-level structural errors (missing required columns)
    if (!validationResult.valid && validationResult.errors.some(e => e.rowNumber === 0)) {
      const structuralErrors = validationResult.errors
        .filter(e => e.rowNumber === 0)
        .flatMap(e => e.errors)
        .map(e => e.message);

      try {
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: "REJECTED",
            errorCount: structuralErrors.length,
            completedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error("Error updating rejected job status:", updateError);
      }

      return NextResponse.json(
        {
          error: structuralErrors.join(" "),
          jobId: job.id,
          missingColumns: validationResult.errors.flatMap(e => e.errors).map(e => e.field),
          detectedColumns: validationResult.detectedColumns,
        },
        { status: 400 }
      );
    }

    // Stage 12: Create ingestion records with canonical structure
    stage = "Speichern der einzelnen Zeilen";
    try {
      // Store both valid and invalid records, but track status
      const batchSize = 100;

      for (let i = 0; i < rawRecords.length; i += batchSize) {
        const batch = rawRecords.slice(i, i + batchSize);
        await Promise.all(
          batch.map((record, batchIndex) => {
            const index = i + batchIndex;
            const rowNumber = index + 1;

            // Find if this row had validation errors
            const rowErrors = validationResult.errors.find(e => e.rowNumber === rowNumber);
            const rowWarnings = validationResult.warnings.find(w => w.rowNumber === rowNumber);

            // Find the canonical record if it was valid
            const canonicalRecord = validationResult.records.find(r => r._meta.rowNumber === rowNumber);

            // Determine status based on validation
            let status: string;
            let qualityTier: string | null = null;

            if (rowErrors && rowErrors.errors.length > 0) {
              status = "QUARANTINED";
              qualityTier = "TIER_3_QUARANTINED";
            } else if (rowWarnings && rowWarnings.warnings.length > 0) {
              status = "REVIEW";
              qualityTier = "TIER_2_REVIEWABLE";
            } else {
              status = "STAGING";
              qualityTier = "TIER_1_VALID";
            }

            // Build rawData JSON - include schema metadata
            const rawData = canonicalRecord
              ? serializeRecord(canonicalRecord)
              : JSON.stringify({
                  ...record,
                  _schemaVersion: CANONICAL_SCHEMA_VERSION,
                  _validationErrors: rowErrors?.errors || [],
                });

            return prisma.ingestionRecord.create({
              data: {
                jobId: job.id,
                rowNumber,
                sheetName: isExcel && sheetNames.length > 0 ? sheetNames[0] : null,
                rawData,
                status,
                qualityTier,
                validationErrors: rowErrors ? JSON.stringify(rowErrors.errors) : null,
                validationWarnings: rowWarnings ? JSON.stringify(rowWarnings.warnings) : null,
              },
            });
          })
        );
      }
    } catch (e) {
      const { userMessage, technicalDetails } = createDetailedError(
        "Speichern der Zeilen",
        e,
        { jobId: job.id, recordCount: rawRecords.length }
      );

      // Try to mark job as failed
      try {
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: "REJECTED",
            errorCount: 1,
            completedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error("Error marking job as rejected:", updateError);
      }

      return NextResponse.json(
        {
          error: `${userMessage}. Der Importvorgang wurde abgebrochen.`,
          jobId: job.id,
          details: process.env.NODE_ENV === "development" ? technicalDetails : undefined,
        },
        { status: 500 }
      );
    }

    // Stage 13: Update job status with quality metrics
    stage = "Aktualisieren des Importstatus";
    try {
      const qualityScore = rawRecords.length > 0
        ? (validationResult.validRows / rawRecords.length) * 100
        : 0;

      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: "STAGING",
          recordCountRaw: rawRecords.length,
          recordCountValid: validationResult.validRows,
          errorCount: validationResult.errorRows,
          warningCount: validationResult.warningRows,
          qualityScore,
        },
      });
    } catch (e) {
      console.error("Error updating job status to STAGING:", e);
      // Continue anyway, the records are saved
    }

    // ==========================================================================
    // SUCCESS RESPONSE
    // ==========================================================================

    return NextResponse.json({
      jobId: job.id,
      recordCount: rawRecords.length,
      validRecords: validationResult.validRows,
      errorRecords: validationResult.errorRows,
      warningRecords: validationResult.warningRows,
      headers,
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      detectedColumns: validationResult.detectedColumns,
      schemaMetadata,
      preview: validationResult.records.slice(0, 5).map(r => ({
        rowNumber: r._meta.rowNumber,
        coreFields: r.coreFields,
        standardFields: r.standardFields,
        additionalFieldCount: Object.keys(r.additionalFields).length,
      })),
      sheetNames: isExcel ? sheetNames : undefined,
    });
  } catch (error) {
    // Outer catch for any unexpected errors
    const { userMessage, technicalDetails } = createDetailedError(stage, error, {
      fileName: fileNameForError,
    });

    return NextResponse.json(
      {
        error: `${userMessage} (bei: ${stage})`,
        details: process.env.NODE_ENV === "development" ? technicalDetails : undefined,
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/ingestion - List ingestion jobs
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (caseId) where.caseId = caseId;
    if (status) where.status = status;

    const jobs = await prisma.ingestionJob.findMany({
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
            records: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    // Calculate reviewable count for each job
    const jobsWithReviewCount = await Promise.all(
      jobs.map(async (job) => {
        const reviewableCount = await prisma.stagedCashflowEntry.count({
          where: {
            jobId: job.id,
            requiresReview: true,
            status: "STAGED",
          },
        });

        return {
          ...job,
          fileSizeBytes: job.fileSizeBytes.toString(),
          reviewableCount,
          // Don't include raw file content in list view
          rawFileContent: undefined,
        };
      })
    );

    return NextResponse.json(jobsWithReviewCount);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Importvorgänge" },
      { status: 500 }
    );
  }
}
