import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import crypto from "crypto";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// POST /api/ingestion - Upload and process a file
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const caseId = formData.get("caseId") as string;
    const sourceType = formData.get("sourceType") as string;

    if (!file || !caseId || !sourceType) {
      return NextResponse.json(
        { error: "Datei, Fall-ID und Quellentyp erforderlich" },
        { status: 400 }
      );
    }

    // Detect file type and read content
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    let fileContent: string;
    let fileBuffer: Buffer;
    let records: Record<string, string>[] = [];
    let parseError: string | null = null;
    let sheetNames: string[] = [];
    let mimeType: string;

    if (isExcel) {
      // Read Excel file
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileContent = fileBuffer.toString("base64"); // Store as base64 for Excel
      mimeType = fileName.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.ms-excel";

      try {
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        sheetNames = workbook.SheetNames;

        // Use first sheet by default
        const firstSheet = workbook.Sheets[sheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
          header: 1,
          defval: "",
        });

        if (jsonData.length > 0) {
          // First row is headers
          const firstRow = jsonData[0] as unknown[];
          const headers = firstRow.map((h, idx) =>
            String(h || `spalte_${idx + 1}`).trim().toLowerCase()
          );

          // Convert to records
          records = jsonData.slice(1)
            .filter(row => (row as unknown[]).some(cell => cell !== ""))
            .map(row => {
              const rowArr = row as unknown[];
              const record: Record<string, string> = {};
              headers.forEach((header, idx) => {
                record[header] = String(rowArr[idx] ?? "");
              });
              return record;
            });
        }
      } catch (e) {
        parseError = e instanceof Error ? e.message : "Excel-Datei konnte nicht gelesen werden";
      }
    } else {
      // Read CSV file
      fileContent = await file.text();
      fileBuffer = Buffer.from(fileContent, "utf-8");
      mimeType = "text/csv";

      try {
        const parsed = Papa.parse<Record<string, string>>(fileContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim().toLowerCase(),
        });

        if (parsed.errors.length > 0) {
          parseError = parsed.errors[0].message;
        } else {
          records = parsed.data;
        }
      } catch (e) {
        parseError = e instanceof Error ? e.message : "Unbekannter Fehler";
      }
    }

    // Calculate file hash
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Create ingestion job
    const job = await prisma.ingestionJob.create({
      data: {
        caseId,
        sourceType: isExcel ? "EXCEL_GENERIC" : sourceType,
        fileName: file.name,
        fileHashSha256: fileHash,
        fileSizeBytes: BigInt(file.size),
        rawFileContent: fileContent, // Store content for re-run capability
        mimeType,
        status: parseError ? "REJECTED" : "PARSING",
        createdBy: session.username,
      },
    });

    if (parseError) {
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: "REJECTED",
          errorCount: 1,
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: parseError, jobId: job.id },
        { status: 400 }
      );
    }

    // Create ingestion records
    await Promise.all(
      records.map(async (record, index) => {
        return prisma.ingestionRecord.create({
          data: {
            jobId: job.id,
            rowNumber: index + 1,
            sheetName: isExcel && sheetNames.length > 0 ? sheetNames[0] : null,
            rawData: JSON.stringify(record),
            status: "STAGING",
          },
        });
      })
    );

    // Calculate quality metrics
    const validRecords = records.filter(r =>
      Object.values(r).some(v => v && v.trim() !== "")
    ).length;

    // Update job status
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: "STAGING",
        recordCountRaw: records.length,
        recordCountValid: validRecords,
        qualityScore: records.length > 0 ? (validRecords / records.length) * 100 : 0,
      },
    });

    return NextResponse.json({
      jobId: job.id,
      recordCount: records.length,
      validRecords,
      headers: records.length > 0 ? Object.keys(records[0]) : [],
      preview: records.slice(0, 5),
      sheetNames: isExcel ? sheetNames : undefined,
    });
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten der Datei" },
      { status: 500 }
    );
  }
}

// GET /api/ingestion - List ingestion jobs
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
      { error: "Fehler beim Laden der Importvorgaenge" },
      { status: 500 }
    );
  }
}
