import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

/**
 * Example File Generator API
 *
 * Generates example import files that demonstrate the canonical import schema.
 * These files show:
 * 1. Minimal required fields only
 * 2. Standard fields with common optional columns
 * 3. Extended files with additional custom columns (demonstrating extensibility)
 * 4. Split amount format (Einzahlung/Auszahlung instead of Betrag)
 * 5. Bank statement format (alternative column names)
 */

// =============================================================================
// EXAMPLE DATA DEFINITIONS
// =============================================================================

// Minimal example - only required fields
const MINIMAL_DATA = [
  { Datum: "15.01.2026", Betrag: "5.000,00", Bezeichnung: "Umsatzerloese Januar" },
  { Datum: "22.01.2026", Betrag: "-1.500,00", Bezeichnung: "Lohnzahlung KW4" },
  { Datum: "29.01.2026", Betrag: "-800,00", Bezeichnung: "Miete Februar" },
  { Datum: "05.02.2026", Betrag: "3.200,00", Bezeichnung: "Kundenzahlung Meier" },
  { Datum: "12.02.2026", Betrag: "-450,00", Bezeichnung: "Versicherungsbeitraege" },
  { Datum: "19.02.2026", Betrag: "-2.100,00", Bezeichnung: "Lieferantenrechnung Schmidt" },
  { Datum: "26.02.2026", Betrag: "1.800,00", Bezeichnung: "Teilzahlung Projekt A" },
  { Datum: "05.03.2026", Betrag: "-950,00", Bezeichnung: "Energiekosten" },
  { Datum: "12.03.2026", Betrag: "4.500,00", Bezeichnung: "Schlusszahlung Mueller" },
  { Datum: "19.03.2026", Betrag: "-1.200,00", Bezeichnung: "Lohnzahlung KW12" },
];

// Standard structure - required fields plus common optional fields
const STANDARD_DATA = [
  { Datum: "15.01.2026", Betrag: "5.000,00", Bezeichnung: "Umsatzerloese Januar", Kategorie: "Umsatzerloese", Konto: "DE89370400440532013000", Gegenpartei: "Diverse Kunden", Referenz: "RE-2026-001", Kommentar: "Sammelzahlung" },
  { Datum: "22.01.2026", Betrag: "-1.500,00", Bezeichnung: "Lohnzahlung KW4", Kategorie: "Loehne und Gehaelter", Konto: "DE89370400440532013000", Gegenpartei: "Mitarbeiter", Referenz: "LN-2026-004", Kommentar: "4 Mitarbeiter" },
  { Datum: "29.01.2026", Betrag: "-800,00", Bezeichnung: "Miete Februar", Kategorie: "Raumkosten", Konto: "DE89370400440532013000", Gegenpartei: "Immobilien GmbH", Referenz: "MI-2026-02", Kommentar: "Bueromiete" },
  { Datum: "05.02.2026", Betrag: "3.200,00", Bezeichnung: "Kundenzahlung Meier", Kategorie: "Umsatzerloese", Konto: "DE89370400440532013000", Gegenpartei: "Meier AG", Referenz: "RE-2025-089", Kommentar: "Restzahlung" },
  { Datum: "12.02.2026", Betrag: "-450,00", Bezeichnung: "Versicherungsbeitraege", Kategorie: "Versicherungen", Konto: "DE89370400440532013000", Gegenpartei: "Allianz", Referenz: "VS-2026-Q1", Kommentar: "Quartalsbeitrag" },
  { Datum: "19.02.2026", Betrag: "-2.100,00", Bezeichnung: "Lieferantenrechnung Schmidt", Kategorie: "Wareneinkauf", Konto: "DE89370400440532013000", Gegenpartei: "Schmidt GmbH", Referenz: "LI-2026-023", Kommentar: "Materiallieferung" },
  { Datum: "26.02.2026", Betrag: "1.800,00", Bezeichnung: "Teilzahlung Projekt A", Kategorie: "Umsatzerloese", Konto: "DE89370400440532013000", Gegenpartei: "Projekt A GmbH", Referenz: "PR-A-003", Kommentar: "2. Rate" },
  { Datum: "05.03.2026", Betrag: "-950,00", Bezeichnung: "Energiekosten", Kategorie: "Betriebskosten", Konto: "DE89370400440532013000", Gegenpartei: "Stadtwerke", Referenz: "EN-2026-03", Kommentar: "Strom + Gas" },
  { Datum: "12.03.2026", Betrag: "4.500,00", Bezeichnung: "Schlusszahlung Mueller", Kategorie: "Umsatzerloese", Konto: "DE89370400440532013000", Gegenpartei: "Mueller KG", Referenz: "RE-2025-102", Kommentar: "Projektabschluss" },
  { Datum: "19.03.2026", Betrag: "-1.200,00", Bezeichnung: "Lohnzahlung KW12", Kategorie: "Loehne und Gehaelter", Konto: "DE89370400440532013000", Gegenpartei: "Mitarbeiter", Referenz: "LN-2026-012", Kommentar: "4 Mitarbeiter" },
];

// Extended structure - includes additional custom columns (demonstrating extensibility)
// CRITICAL: These extra columns should NOT cause import errors - they are preserved as metadata
const EXTENDED_DATA = [
  { Datum: "15.01.2026", Betrag: "5.000,00", Bezeichnung: "Umsatzerloese Januar", Kategorie: "Umsatzerloese", Konto: "DE89370400440532013000", Gegenpartei: "Diverse Kunden", Referenz: "RE-2026-001", Kommentar: "Sammelzahlung", Alt_Neu: "Neu", Quelle: "Buchhaltung", Unsicherheit: "Nein", Zahlungsart: "Ueberweisung", Kostenstelle: "100", Projekt: "PRJ-001", Buchungskreis: "BK01", Sachbearbeiter: "Mueller" },
  { Datum: "22.01.2026", Betrag: "-1.500,00", Bezeichnung: "Lohnzahlung KW4", Kategorie: "Loehne und Gehaelter", Konto: "DE89370400440532013000", Gegenpartei: "Mitarbeiter", Referenz: "LN-2026-004", Kommentar: "4 Mitarbeiter", Alt_Neu: "Neu", Quelle: "HR", Unsicherheit: "Nein", Zahlungsart: "Ueberweisung", Kostenstelle: "200", Projekt: "ALLG", Buchungskreis: "BK01", Sachbearbeiter: "Schmidt" },
  { Datum: "29.01.2026", Betrag: "-800,00", Bezeichnung: "Miete Februar", Kategorie: "Raumkosten", Konto: "DE89370400440532013000", Gegenpartei: "Immobilien GmbH", Referenz: "MI-2026-02", Kommentar: "Bueromiete", Alt_Neu: "Alt", Quelle: "Buchhaltung", Unsicherheit: "Nein", Zahlungsart: "Lastschrift", Kostenstelle: "300", Projekt: "ALLG", Buchungskreis: "BK01", Sachbearbeiter: "Mueller" },
  { Datum: "05.02.2026", Betrag: "3.200,00", Bezeichnung: "Kundenzahlung Meier", Kategorie: "Umsatzerloese", Konto: "DE89370400440532013000", Gegenpartei: "Meier AG", Referenz: "RE-2025-089", Kommentar: "Restzahlung", Alt_Neu: "Alt", Quelle: "Mahnwesen", Unsicherheit: "Nein", Zahlungsart: "Ueberweisung", Kostenstelle: "100", Projekt: "PRJ-002", Buchungskreis: "BK01", Sachbearbeiter: "Weber" },
  { Datum: "12.02.2026", Betrag: "-450,00", Bezeichnung: "Versicherungsbeitraege", Kategorie: "Versicherungen", Konto: "DE89370400440532013000", Gegenpartei: "Allianz", Referenz: "VS-2026-Q1", Kommentar: "Quartalsbeitrag", Alt_Neu: "Neu", Quelle: "Buchhaltung", Unsicherheit: "Nein", Zahlungsart: "Lastschrift", Kostenstelle: "400", Projekt: "ALLG", Buchungskreis: "BK01", Sachbearbeiter: "Mueller" },
  { Datum: "19.02.2026", Betrag: "-2.100,00", Bezeichnung: "Lieferantenrechnung Schmidt", Kategorie: "Wareneinkauf", Konto: "DE89370400440532013000", Gegenpartei: "Schmidt GmbH", Referenz: "LI-2026-023", Kommentar: "Materiallieferung", Alt_Neu: "Neu", Quelle: "Einkauf", Unsicherheit: "Ja", Zahlungsart: "Ueberweisung", Kostenstelle: "500", Projekt: "PRJ-001", Buchungskreis: "BK01", Sachbearbeiter: "Fischer" },
  { Datum: "26.02.2026", Betrag: "1.800,00", Bezeichnung: "Teilzahlung Projekt A", Kategorie: "Umsatzerloese", Konto: "DE89370400440532013000", Gegenpartei: "Projekt A GmbH", Referenz: "PR-A-003", Kommentar: "2. Rate", Alt_Neu: "Neu", Quelle: "Vertrieb", Unsicherheit: "Nein", Zahlungsart: "Ueberweisung", Kostenstelle: "100", Projekt: "PRJ-003", Buchungskreis: "BK01", Sachbearbeiter: "Weber" },
  { Datum: "05.03.2026", Betrag: "-950,00", Bezeichnung: "Energiekosten", Kategorie: "Betriebskosten", Konto: "DE89370400440532013000", Gegenpartei: "Stadtwerke", Referenz: "EN-2026-03", Kommentar: "Strom + Gas", Alt_Neu: "Neu", Quelle: "Buchhaltung", Unsicherheit: "Ja", Zahlungsart: "Lastschrift", Kostenstelle: "300", Projekt: "ALLG", Buchungskreis: "BK01", Sachbearbeiter: "Mueller" },
  { Datum: "12.03.2026", Betrag: "4.500,00", Bezeichnung: "Schlusszahlung Mueller", Kategorie: "Umsatzerloese", Konto: "DE89370400440532013000", Gegenpartei: "Mueller KG", Referenz: "RE-2025-102", Kommentar: "Projektabschluss", Alt_Neu: "Alt", Quelle: "Vertrieb", Unsicherheit: "Nein", Zahlungsart: "Ueberweisung", Kostenstelle: "100", Projekt: "PRJ-002", Buchungskreis: "BK01", Sachbearbeiter: "Weber" },
  { Datum: "19.03.2026", Betrag: "-1.200,00", Bezeichnung: "Lohnzahlung KW12", Kategorie: "Loehne und Gehaelter", Konto: "DE89370400440532013000", Gegenpartei: "Mitarbeiter", Referenz: "LN-2026-012", Kommentar: "4 Mitarbeiter", Alt_Neu: "Neu", Quelle: "HR", Unsicherheit: "Nein", Zahlungsart: "Ueberweisung", Kostenstelle: "200", Projekt: "ALLG", Buchungskreis: "BK01", Sachbearbeiter: "Schmidt" },
];

// Split amount format - separate columns for Einzahlung and Auszahlung
const SPLIT_AMOUNT_DATA = [
  { Datum: "15.01.2026", Einzahlung: "5.000,00", Auszahlung: "", Bezeichnung: "Umsatzerloese Januar", Kategorie: "Umsatzerloese", Kommentar: "Sammelzahlung" },
  { Datum: "22.01.2026", Einzahlung: "", Auszahlung: "1.500,00", Bezeichnung: "Lohnzahlung KW4", Kategorie: "Loehne und Gehaelter", Kommentar: "4 Mitarbeiter" },
  { Datum: "29.01.2026", Einzahlung: "", Auszahlung: "800,00", Bezeichnung: "Miete Februar", Kategorie: "Raumkosten", Kommentar: "Bueromiete" },
  { Datum: "05.02.2026", Einzahlung: "3.200,00", Auszahlung: "", Bezeichnung: "Kundenzahlung Meier", Kategorie: "Umsatzerloese", Kommentar: "Restzahlung" },
  { Datum: "12.02.2026", Einzahlung: "", Auszahlung: "450,00", Bezeichnung: "Versicherungsbeitraege", Kategorie: "Versicherungen", Kommentar: "Quartalsbeitrag" },
  { Datum: "19.02.2026", Einzahlung: "", Auszahlung: "2.100,00", Bezeichnung: "Lieferantenrechnung Schmidt", Kategorie: "Wareneinkauf", Kommentar: "Materiallieferung" },
  { Datum: "26.02.2026", Einzahlung: "1.800,00", Auszahlung: "", Bezeichnung: "Teilzahlung Projekt A", Kategorie: "Umsatzerloese", Kommentar: "2. Rate" },
  { Datum: "05.03.2026", Einzahlung: "", Auszahlung: "950,00", Bezeichnung: "Energiekosten", Kategorie: "Betriebskosten", Kommentar: "Strom + Gas" },
  { Datum: "12.03.2026", Einzahlung: "4.500,00", Auszahlung: "", Bezeichnung: "Schlusszahlung Mueller", Kategorie: "Umsatzerloese", Kommentar: "Projektabschluss" },
  { Datum: "19.03.2026", Einzahlung: "", Auszahlung: "1.200,00", Bezeichnung: "Lohnzahlung KW12", Kategorie: "Loehne und Gehaelter", Kommentar: "4 Mitarbeiter" },
];

// Bank statement format - uses alternative column names typically found in bank exports
const BANK_STATEMENT_DATA = [
  { Buchungsdatum: "15.01.2026", Wertstellung: "16.01.2026", Betrag: "5.000,00", Verwendungszweck: "Zahlung RE-2026-001 Sammelzahlung", Auftraggeber: "Diverse Kunden", IBAN: "DE12345678901234567890", BIC: "COBADEFFXXX", Kundenreferenz: "RE-2026-001", Mandatsreferenz: "", Bankreferenz: "TRX20260115001" },
  { Buchungsdatum: "22.01.2026", Wertstellung: "22.01.2026", Betrag: "-1.500,00", Verwendungszweck: "Lohnzahlung Januar KW4", Auftraggeber: "Mitarbeiter", IBAN: "", BIC: "DEUTDEFF", Kundenreferenz: "LN-2026-004", Mandatsreferenz: "", Bankreferenz: "TRX20260122001" },
  { Buchungsdatum: "29.01.2026", Wertstellung: "01.02.2026", Betrag: "-800,00", Verwendungszweck: "Miete Februar Buerogebaeude", Auftraggeber: "Immobilien GmbH", IBAN: "DE98765432109876543210", BIC: "GENODEF1XXX", Kundenreferenz: "MI-2026-02", Mandatsreferenz: "SEPA-12345", Bankreferenz: "TRX20260129001" },
  { Buchungsdatum: "05.02.2026", Wertstellung: "06.02.2026", Betrag: "3.200,00", Verwendungszweck: "Restzahlung Rechnung 2025-089", Auftraggeber: "Meier AG", IBAN: "DE11223344556677889900", BIC: "DRESDEFF", Kundenreferenz: "RE-2025-089", Mandatsreferenz: "", Bankreferenz: "TRX20260205001" },
  { Buchungsdatum: "12.02.2026", Wertstellung: "12.02.2026", Betrag: "-450,00", Verwendungszweck: "Versicherungsbeitrag Q1/2026", Auftraggeber: "Allianz Versicherung", IBAN: "DE99887766554433221100", BIC: "ALLIDEFXXX", Kundenreferenz: "VS-2026-Q1", Mandatsreferenz: "SEPA-67890", Bankreferenz: "TRX20260212001" },
  { Buchungsdatum: "19.02.2026", Wertstellung: "20.02.2026", Betrag: "-2.100,00", Verwendungszweck: "Materiallieferung Bestellung B-023", Auftraggeber: "Schmidt GmbH", IBAN: "DE55443322116677889900", BIC: "GENODED1XXX", Kundenreferenz: "LI-2026-023", Mandatsreferenz: "", Bankreferenz: "TRX20260219001" },
  { Buchungsdatum: "26.02.2026", Wertstellung: "27.02.2026", Betrag: "1.800,00", Verwendungszweck: "Teilzahlung Projekt A Rate 2", Auftraggeber: "Projekt A GmbH", IBAN: "DE66778899001122334455", BIC: "COBADEFFXXX", Kundenreferenz: "PR-A-003", Mandatsreferenz: "", Bankreferenz: "TRX20260226001" },
  { Buchungsdatum: "05.03.2026", Wertstellung: "06.03.2026", Betrag: "-950,00", Verwendungszweck: "Energiekosten Maerz Strom Gas", Auftraggeber: "Stadtwerke", IBAN: "DE44332211009988776655", BIC: "MARKDEF1XXX", Kundenreferenz: "EN-2026-03", Mandatsreferenz: "SEPA-11111", Bankreferenz: "TRX20260305001" },
  { Buchungsdatum: "12.03.2026", Wertstellung: "13.03.2026", Betrag: "4.500,00", Verwendungszweck: "Projektabschluss Rechnung 2025-102", Auftraggeber: "Mueller KG", IBAN: "DE22334455667788990011", BIC: "DRESDEFF", Kundenreferenz: "RE-2025-102", Mandatsreferenz: "", Bankreferenz: "TRX20260312001" },
  { Buchungsdatum: "19.03.2026", Wertstellung: "19.03.2026", Betrag: "-1.200,00", Verwendungszweck: "Lohnzahlung Maerz KW12", Auftraggeber: "Mitarbeiter", IBAN: "", BIC: "DEUTDEFF", Kundenreferenz: "LN-2026-012", Mandatsreferenz: "", Bankreferenz: "TRX20260319001" },
];

// =============================================================================
// FILE CONFIGURATION
// =============================================================================

interface FileConfig {
  data: Record<string, string>[];
  format: "xlsx" | "csv";
  displayName: string;
  description: string;
}

const AVAILABLE_FILES: Record<string, FileConfig> = {
  // Minimal examples
  "minimal-import.xlsx": {
    data: MINIMAL_DATA,
    format: "xlsx",
    displayName: "Minimalbeispiel (Excel)",
    description: "Nur Pflichtfelder: Datum, Betrag, Bezeichnung",
  },
  "minimal-import.csv": {
    data: MINIMAL_DATA,
    format: "csv",
    displayName: "Minimalbeispiel (CSV)",
    description: "Nur Pflichtfelder: Datum, Betrag, Bezeichnung",
  },

  // Standard examples
  "standard-import.xlsx": {
    data: STANDARD_DATA,
    format: "xlsx",
    displayName: "Standardstruktur (Excel)",
    description: "Pflichtfelder plus Kategorie, Konto, Gegenpartei, Referenz, Kommentar",
  },
  "standard-import.csv": {
    data: STANDARD_DATA,
    format: "csv",
    displayName: "Standardstruktur (CSV)",
    description: "Pflichtfelder plus Kategorie, Konto, Gegenpartei, Referenz, Kommentar",
  },

  // Extended examples (demonstrating extensibility)
  "extended-import.xlsx": {
    data: EXTENDED_DATA,
    format: "xlsx",
    displayName: "Erweitert mit Zusatzspalten (Excel)",
    description: "Alle Standardfelder plus Kostenstelle, Projekt, Buchungskreis, Sachbearbeiter",
  },
  "extended-import.csv": {
    data: EXTENDED_DATA,
    format: "csv",
    displayName: "Erweitert mit Zusatzspalten (CSV)",
    description: "Alle Standardfelder plus Kostenstelle, Projekt, Buchungskreis, Sachbearbeiter",
  },

  // Split amount format
  "split-amount-import.xlsx": {
    data: SPLIT_AMOUNT_DATA,
    format: "xlsx",
    displayName: "Einzahlung/Auszahlung getrennt (Excel)",
    description: "Getrennte Spalten für Einzahlung und Auszahlung statt einzelnem Betrag",
  },
  "split-amount-import.csv": {
    data: SPLIT_AMOUNT_DATA,
    format: "csv",
    displayName: "Einzahlung/Auszahlung getrennt (CSV)",
    description: "Getrennte Spalten für Einzahlung und Auszahlung statt einzelnem Betrag",
  },

  // Bank statement format
  "bank-statement.xlsx": {
    data: BANK_STATEMENT_DATA,
    format: "xlsx",
    displayName: "Kontoauszug-Format (Excel)",
    description: "Typisches Bank-Export-Format mit Buchungsdatum, Verwendungszweck, IBAN, etc.",
  },
  "bank-statement.csv": {
    data: BANK_STATEMENT_DATA,
    format: "csv",
    displayName: "Kontoauszug-Format (CSV)",
    description: "Typisches Bank-Export-Format mit Buchungsdatum, Verwendungszweck, IBAN, etc.",
  },

  // Legacy names for backwards compatibility
  "minimal-beispiel.xlsx": {
    data: MINIMAL_DATA,
    format: "xlsx",
    displayName: "Minimalbeispiel (Excel) [Legacy]",
    description: "Nur Pflichtfelder: Datum, Betrag, Bezeichnung",
  },
  "empfohlene-struktur.xlsx": {
    data: STANDARD_DATA,
    format: "xlsx",
    displayName: "Empfohlene Struktur (Excel) [Legacy]",
    description: "Pflichtfelder plus Kategorie, Konto, Gegenpartei, Referenz, Kommentar",
  },
  "empfohlene-struktur.csv": {
    data: STANDARD_DATA,
    format: "csv",
    displayName: "Empfohlene Struktur (CSV) [Legacy]",
    description: "Pflichtfelder plus Kategorie, Konto, Gegenpartei, Referenz, Kommentar",
  },
};

// =============================================================================
// API HANDLERS
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  const fileConfig = AVAILABLE_FILES[filename];

  if (!fileConfig) {
    return NextResponse.json(
      {
        error: "Datei nicht gefunden",
        availableFiles: Object.keys(AVAILABLE_FILES).filter(f => !f.includes("[Legacy]")),
      },
      { status: 404 }
    );
  }

  try {
    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(fileConfig.data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daten");

    // Set column widths for better readability
    const colWidths = Object.keys(fileConfig.data[0]).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    worksheet["!cols"] = colWidths;

    if (fileConfig.format === "xlsx") {
      // Generate Excel file
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } else {
      // Generate CSV with UTF-8 BOM and semicolon separator (German Excel default)
      const csvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: ";" });
      const bom = "\uFEFF";
      const csvWithBom = bom + csvContent;

      return new NextResponse(csvWithBom, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  } catch (error) {
    console.error("Error generating example file:", error);
    return NextResponse.json(
      { error: "Fehler beim Generieren der Beispieldatei" },
      { status: 500 }
    );
  }
}

// List available example files
export async function OPTIONS() {
  // Filter out legacy files for the OPTIONS response
  const files = Object.entries(AVAILABLE_FILES)
    .filter(([, config]) => !config.displayName.includes("[Legacy]"))
    .map(([filename, config]) => ({
      filename,
      displayName: config.displayName,
      description: config.description,
      format: config.format,
      downloadUrl: `/api/examples/${filename}`,
    }));

  return NextResponse.json({
    files,
    schemaInfo: {
      requiredFields: ["Datum", "Betrag (oder Einzahlung/Auszahlung)", "Bezeichnung"],
      optionalStandardFields: [
        "Kategorie",
        "Konto",
        "Gegenpartei",
        "Referenz",
        "Kommentar",
        "Alt_Neu / Massetyp",
        "Quelle",
        "Zahlungsart",
        "Unsicherheit",
        "Werttyp",
      ],
      extensibilityNote: "Zusaetzliche Spalten werden akzeptiert und als Metadaten gespeichert.",
    },
  });
}
