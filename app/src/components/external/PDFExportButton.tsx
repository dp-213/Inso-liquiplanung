"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CaseDashboardData, getPeriods } from "@/types/dashboard";

interface PDFTextConfig {
  legalDisclaimers?: string[];
  dataSources?: string[];
  liquidityPlanningContext?: string[];
  declarationText?: string[];
  confidentialityNotice?: string;
  pdfFooterText?: string;
}

interface PDFExportButtonProps {
  data: CaseDashboardData;
  formatCurrency: (cents: bigint) => string;
  pdfTexts?: PDFTextConfig;
}

// Risk level symbols and colors - muted professional tones
const RISK_CONFIG: Record<string, { symbol: string; label: string; color: [number, number, number] }> = {
  conservative: { symbol: "○", label: "Konservativ", color: [71, 85, 105] },   // Slate - neutral
  low: { symbol: "◐", label: "Gering", color: [71, 85, 105] },                 // Slate
  medium: { symbol: "◑", label: "Mittel", color: [100, 116, 139] },            // Slate-500
  high: { symbol: "●", label: "Hoch", color: [120, 113, 108] },                // Stone-500
  aggressive: { symbol: "●●", label: "Aggressiv", color: [153, 27, 27] },      // Muted red
};

// Professional muted colors
const PRIMARY: [number, number, number] = [51, 65, 85];      // Slate-700 - dark professional gray
const PRIMARY_LIGHT: [number, number, number] = [71, 85, 105]; // Slate-600
const ACCENT: [number, number, number] = [100, 116, 139];    // Slate-500 - subtle accent
const TEXT_DARK: [number, number, number] = [30, 41, 59];    // Slate-800
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // Slate-500
const BG_LIGHT: [number, number, number] = [248, 250, 252];  // Slate-50
const BG_SUBTLE: [number, number, number] = [241, 245, 249]; // Slate-100
const BORDER: [number, number, number] = [226, 232, 240];    // Slate-200

// Default PDF texts (used when no config provided)
const DEFAULT_PDF_TEXTS: Required<PDFTextConfig> = {
  legalDisclaimers: [
    "Die vorliegende Liquiditätsplanung wurde mit der gebotenen Sorgfalt auf Basis der vom Auftraggeber zur Verfügung gestellten Informationen und Unterlagen erstellt.",
    "",
    "Folgende Punkte sind zu beachten:",
    "",
    "1. Prognosecharakter",
    "   Die Liquiditätsplanung stellt eine in die Zukunft gerichtete Prognose dar. Die tatsächliche Entwicklung kann aufgrund von Unsicherheiten und externen Faktoren von den dargestellten Planwerten abweichen.",
    "",
    "2. Datengrundlage",
    "   Die Planung basiert auf den zum Erstellungszeitpunkt verfügbaren Informationen. Für die Richtigkeit und Vollständigkeit der Ausgangsdaten ist der Auftraggeber verantwortlich.",
    "",
    "3. Keine Prüfung",
    "   Es wurde keine prüferische Durchsicht oder Prüfung im Sinne der IDW-Standards durchgeführt. Die Plausibilisierung der Angaben erfolgte auf Basis der übermittelten Informationen.",
    "",
    "4. Verwendungszweck",
    "   Die Liquiditätsplanung dient ausschließlich der Unterstützung des Insolvenzverfahrens und ist nicht zur Weitergabe an Dritte ohne Zustimmung des Erstellers bestimmt.",
    "",
    "5. Keine Gewährleistung",
    "   Eine Gewährleistung für den Eintritt der dargestellten Planwerte wird nicht übernommen. Die Haftung ist auf Vorsatz und grobe Fahrlässigkeit beschränkt.",
  ],
  dataSources: [
    "Bankstand vom {{planStartDate}} (Buchungsschluss)",
    "Offene-Posten-Listen (Debitoren und Kreditoren)",
    "Unternehmensplanung und betriebswirtschaftliche Auswertungen",
  ],
  liquidityPlanningContext: [
    "Die Liquiditätsplanung ist ein zentrales Instrument zur Steuerung und Überwachung der Zahlungsfähigkeit im Insolvenzverfahren. Sie ermöglicht eine vorausschauende Beurteilung der finanziellen Situation und unterstützt den Insolvenzverwalter bei strategischen Entscheidungen.",
    "",
    "Aufbau der Planung",
    "",
    "Die Liquiditätsplanung unterscheidet zwischen:",
    "",
    "• Operative Zahlungsströme",
    "  Einzahlungen und Auszahlungen aus dem laufenden Geschäftsbetrieb, unabhängig von insolvenzspezifischen Effekten.",
    "",
    "• Insolvenzspezifische Effekte",
    "  Zahlungsströme, die unmittelbar aus dem Insolvenzverfahren resultieren, wie z.B. Anfechtungserlöse, Halteprämien oder Verfahrenskosten.",
    "",
    "Diese Trennung ermöglicht eine differenzierte Betrachtung und erleichtert die Beurteilung der operativen Leistungsfähigkeit des Unternehmens.",
  ],
  declarationText: [
    "Hiermit bestätigen wir, dass die in dieser Liquiditätsplanung verwendeten Daten und Informationen nach bestem Wissen und Gewissen vollständig und zutreffend sind.",
    "",
    "Die Planung basiert auf den folgenden Grundlagen:",
    "",
    "• Bankguthaben zum Stichtag {{planStartDate}}",
    "• Offene-Posten-Listen (Debitoren und Kreditoren) zum Stichtag",
    "• Unternehmensplanung und interne Forecasts",
    "• Insolvenzspezifische Planungsannahmen und Schätzungen",
    "",
    "Die Verantwortung für die Richtigkeit und Vollständigkeit der Ausgangsdaten liegt beim Auftraggeber.",
  ],
  confidentialityNotice: "Dieses Dokument enthält vertrauliche Informationen und ist ausschließlich für den Adressaten bestimmt. Eine Weitergabe an Dritte bedarf der schriftlichen Zustimmung.",
  pdfFooterText: "Gradify",
};

export default function PDFExportButton({ data, pdfTexts }: PDFExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  // Merge provided pdfTexts with defaults
  const texts: Required<PDFTextConfig> = {
    legalDisclaimers: pdfTexts?.legalDisclaimers || DEFAULT_PDF_TEXTS.legalDisclaimers,
    dataSources: pdfTexts?.dataSources || DEFAULT_PDF_TEXTS.dataSources,
    liquidityPlanningContext: pdfTexts?.liquidityPlanningContext || DEFAULT_PDF_TEXTS.liquidityPlanningContext,
    declarationText: pdfTexts?.declarationText || DEFAULT_PDF_TEXTS.declarationText,
    confidentialityNotice: pdfTexts?.confidentialityNotice || DEFAULT_PDF_TEXTS.confidentialityNotice,
    pdfFooterText: pdfTexts?.pdfFooterText || DEFAULT_PDF_TEXTS.pdfFooterText,
  };

  // Helper to replace placeholders in text
  const replacePlaceholders = (text: string, planStartDate: Date): string => {
    return text
      .replace(/\{\{debtorName\}\}/g, data.case.debtorName)
      .replace(/\{\{caseNumber\}\}/g, data.case.caseNumber)
      .replace(/\{\{planStartDate\}\}/g, planStartDate.toLocaleDateString("de-DE"))
      .replace(/\{\{administrator\}\}/g, data.administrator);
  };

  const formatCurrencyForPDF = (cents: string | bigint): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    const euros = Number(value) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €";
  };

  const formatCurrencyShort = (cents: string | bigint): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    const euros = Number(value) / 100;
    if (Math.abs(euros) >= 1000) {
      return (euros / 1000).toFixed(0) + " T€";
    }
    return euros.toFixed(0) + " €";
  };

  const formatCurrencyThousands = (cents: string | bigint): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    const euros = Number(value) / 100;
    return (euros / 1000).toFixed(0) + " T€";
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "PRELIMINARY": return "Vorläufiges Verfahren";
      case "OPENED": return "Eröffnetes Verfahren";
      case "CLOSED": return "Geschlossen";
      default: return status;
    }
  };

  const generatePDF = async () => {
    setExporting(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const now = new Date();
      const weeks = data.calculation.weeks;
      const periodType = data.calculation.periodType || data.plan.periodType || "WEEKLY";
      const planStartDate = new Date(data.plan.planStartDate);

      let currentPage = 0;

      // Helper to add ENTWURF watermark
      const addWatermark = () => {
        doc.setTextColor(240, 240, 240);
        doc.setFontSize(70);
        doc.setFont("helvetica", "bold");
        doc.text("ENTWURF", pageWidth / 2, pageHeight / 2, {
          align: "center",
          angle: 45,
        });
      };

      // Helper to add page footer
      const addFooter = (pageNum: number, totalPages?: number) => {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Seite ${pageNum}${totalPages ? ` von ${totalPages}` : ""}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
        doc.text(
          `${texts.pdfFooterText} | ${now.toLocaleDateString("de-DE")}`,
          pageWidth - margin,
          pageHeight - 10,
          { align: "right" }
        );
      };

      // Helper to add page header (except title page)
      const addHeader = (title: string) => {
        doc.setFillColor(...PRIMARY);
        doc.rect(0, 0, pageWidth, 18, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, 12);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(data.case.debtorName, pageWidth - margin, 12, { align: "right" });
      };

      // Calculate insolvency effects per period
      const insolvencyEffects = data.insolvencyEffects?.effects || [];
      const effectsPerPeriod: bigint[] = new Array(weeks.length).fill(BigInt(0));
      insolvencyEffects.forEach((effect) => {
        effect.periods.forEach((period) => {
          const amount = BigInt(period.amountCents);
          if (period.periodIndex < weeks.length) {
            effectsPerPeriod[period.periodIndex] += effect.effectType === "INFLOW" ? amount : -amount;
          }
        });
      });

      // Calculate key metrics
      const totalInflows = BigInt(data.calculation.totalInflowsCents);
      const totalOutflows = BigInt(data.calculation.totalOutflowsCents);
      const openingBalance = BigInt(data.calculation.openingBalanceCents);
      const finalBalance = BigInt(data.calculation.finalClosingBalanceCents);
      const totalEffects = effectsPerPeriod.reduce((a, b) => a + b, BigInt(0));
      const finalBalanceAfterEffects = finalBalance + totalEffects;

      // Find minimum balance
      let minBalance = openingBalance;
      let minBalanceWeek = weeks[0]?.periodLabel || weeks[0]?.weekLabel || "";
      weeks.forEach((w) => {
        const bal = BigInt(w.closingBalanceCents);
        if (bal < minBalance) {
          minBalance = bal;
          minBalanceWeek = w.periodLabel || w.weekLabel || "";
        }
      });

      // ============================================
      // PAGE 1: TITELSEITE
      // ============================================
      currentPage = 1;
      addWatermark();

      // Logo area (simple text logo since we can't easily embed images)
      doc.setFillColor(...PRIMARY);
      doc.rect(margin, margin, 45, 12, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(texts.pdfFooterText.toUpperCase(), margin + 22.5, margin + 8, { align: "center" });

      // ENTWURF badge - subtle gray
      doc.setFillColor(...ACCENT);
      doc.roundedRect(pageWidth - margin - 35, margin, 35, 10, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text("ENTWURF", pageWidth - margin - 17.5, margin + 7, { align: "center" });

      // Main title
      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Insolvenzspezifische", margin, 65);
      doc.text("Liquiditätsplanung", margin, 77);

      // Subtitle with date
      doc.setFontSize(14);
      doc.setTextColor(...PRIMARY);
      doc.text(`Aufsatzpunkt ${planStartDate.toLocaleDateString("de-DE")}`, margin, 92);

      // Debtor name (large)
      doc.setFontSize(20);
      doc.setTextColor(...TEXT_DARK);
      doc.setFont("helvetica", "bold");
      doc.text(data.case.debtorName, margin, 115);

      // Case details box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, 125, pageWidth - 2 * margin, 55, 3, 3, "FD");

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);

      const detailsY = 135;
      const labelX = margin + 5;
      const valueX = margin + 55;

      doc.text("Aktenzeichen:", labelX, detailsY);
      doc.text("Amtsgericht:", labelX, detailsY + 9);
      doc.text("Verfahrensstatus:", labelX, detailsY + 18);
      doc.text("Insolvenzverwalter:", labelX, detailsY + 27);
      doc.text("Planungszeitraum:", labelX, detailsY + 36);
      doc.text("Planungsart:", labelX, detailsY + 45);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      doc.text(data.case.caseNumber, valueX, detailsY);
      doc.text(data.case.courtName, valueX, detailsY + 9);
      doc.text(getStatusLabel(data.case.status), valueX, detailsY + 18);
      doc.text(data.administrator, valueX, detailsY + 27);
      doc.text(
        weeks.length > 0 ? `${weeks[0].periodLabel || weeks[0].weekLabel || ""} - ${weeks[weeks.length - 1].periodLabel || weeks[weeks.length - 1].weekLabel || ""}` : "-",
        valueX, detailsY + 36
      );
      doc.text(periodType === "WEEKLY" ? `Wöchentlich (${weeks.length} Wochen)` : `Monatlich (${weeks.length} Monate)`, valueX, detailsY + 45);

      // Version and date info at bottom
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(`Version ${data.plan.versionNumber}`, margin, 195);
      doc.text(`Erstellt: ${now.toLocaleDateString("de-DE")}`, margin, 202);

      // Confidentiality notice - subtle gray styling
      doc.setFillColor(...BG_SUBTLE);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(margin, 215, pageWidth - 2 * margin, 20, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setTextColor(...PRIMARY);
      doc.setFont("helvetica", "bold");
      doc.text("VERTRAULICH", margin + 5, 223);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_MUTED);
      // Split confidentiality notice into lines
      const confidentialityLines = doc.splitTextToSize(
        replacePlaceholders(texts.confidentialityNotice, planStartDate),
        pageWidth - 2 * margin - 10
      );
      doc.text(confidentialityLines, margin + 5, 229);

      addFooter(currentPage);

      // ============================================
      // PAGE 2: VORBEMERKUNGEN (RECHTLICH)
      // ============================================
      doc.addPage();
      currentPage = 2;
      addWatermark();
      addHeader("1. Vorbemerkungen");

      let yPos = 30;

      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Rechtliche Hinweise und Haftungsausschluss", margin, yPos);
      yPos += 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      // Use configurable legal disclaimers
      texts.legalDisclaimers.forEach((line) => {
        const processedLine = replacePlaceholders(line, planStartDate);
        doc.text(processedLine, margin, yPos);
        yPos += 5;
      });

      yPos += 10;

      // Datenquellen box - subtle gray
      doc.setFillColor(...BG_SUBTLE);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 2, 2, "FD");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      doc.text("Verwendete Datenquellen:", margin + 5, yPos + 8);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_MUTED);
      // Use configurable data sources
      let sourceY = yPos + 16;
      texts.dataSources.forEach((source) => {
        const processedSource = replacePlaceholders(source, planStartDate);
        doc.text(`• ${processedSource}`, margin + 5, sourceY);
        sourceY += 6;
      });

      addFooter(currentPage);

      // ============================================
      // PAGE 3: INHALTSVERZEICHNIS
      // ============================================
      doc.addPage();
      currentPage = 3;
      addWatermark();
      addHeader("Inhaltsverzeichnis");

      yPos = 35;

      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(11);

      const tocItems = [
        { num: "1.", title: "Vorbemerkungen", page: 2 },
        { num: "2.", title: "Inhaltsverzeichnis", page: 3 },
        { num: "3.", title: "Vorbemerkungen zur Liquiditätsplanung", page: 4 },
        { num: "4.", title: "Liquiditätsübersicht", page: 5 },
        { num: "5.", title: "Bankenspiegel", page: 6 },
        { num: "6.", title: "Detaillierte Liquiditätstabelle", page: 7 },
      ];

      if (data.assumptions && data.assumptions.length > 0) {
        tocItems.push({ num: "7.", title: "Planungsprämissen", page: 8 });
        tocItems.push({ num: "8.", title: "Vollständigkeitserklärung", page: 9 });
      } else {
        tocItems.push({ num: "7.", title: "Vollständigkeitserklärung", page: 8 });
      }

      tocItems.forEach((item, idx) => {
        const y = yPos + idx * 12;
        doc.setFont("helvetica", "bold");
        doc.text(item.num, margin, y);
        doc.setFont("helvetica", "normal");
        doc.text(item.title, margin + 10, y);

        // Dots
        const titleWidth = doc.getTextWidth(item.title);
        const dotsStart = margin + 10 + titleWidth + 2;
        const dotsEnd = pageWidth - margin - 15;
        let dotX = dotsStart;
        doc.setTextColor(200, 200, 200);
        while (dotX < dotsEnd) {
          doc.text(".", dotX, y);
          dotX += 2;
        }

        doc.setTextColor(...TEXT_DARK);
        doc.text(String(item.page), pageWidth - margin, y, { align: "right" });
      });

      addFooter(currentPage);

      // ============================================
      // PAGE 4: VORBEMERKUNGEN ZUR LIQUIDITÄTSPLANUNG
      // ============================================
      doc.addPage();
      currentPage = 4;
      addWatermark();
      addHeader("3. Vorbemerkungen zur Liquiditätsplanung");

      yPos = 30;

      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Bedeutung der Liquiditätsplanung im Insolvenzverfahren", margin, yPos);
      yPos += 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      // Use configurable context text
      texts.liquidityPlanningContext.forEach((line) => {
        const processedLine = replacePlaceholders(line, planStartDate);
        doc.text(processedLine, margin, yPos);
        yPos += 5;
      });

      // Add dynamic planning horizon info
      yPos += 5;
      doc.setFont("helvetica", "bold");
      doc.text("Planungshorizont", margin, yPos);
      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.text(
        `Die vorliegende Planung umfasst einen Zeitraum von ${weeks.length} ${periodType === "WEEKLY" ? "Wochen" : "Monaten"} und deckt`,
        margin, yPos
      );
      yPos += 5;
      doc.text(
        `den Zeitraum von ${weeks[0]?.periodLabel || weeks[0]?.weekLabel || "-"} bis ${weeks[weeks.length - 1]?.periodLabel || weeks[weeks.length - 1]?.weekLabel || "-"} ab.`,
        margin, yPos
      );
      yPos += 10;
      doc.text("Planungsannahmen", margin, yPos);
      yPos += 8;
      doc.setFont("helvetica", "normal");
      doc.text("Alle wesentlichen Planungsannahmen sind im Abschnitt 'Planungsprämissen' dokumentiert", margin, yPos);
      yPos += 5;
      doc.text("und mit einer Risikobewertung versehen. Dies gewährleistet Transparenz und Nachvollziehbarkeit.", margin, yPos);

      addFooter(currentPage);

      // ============================================
      // PAGE 5: LIQUIDITÄTSÜBERSICHT
      // ============================================
      doc.addPage();
      currentPage = 5;
      addWatermark();
      addHeader("4. Liquiditätsübersicht");

      yPos = 30;

      // Key metrics boxes - professional gray tones
      doc.setFillColor(...BG_SUBTLE);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(margin, yPos, 50, 25, 2, 2, "FD");
      doc.roundedRect(margin + 55, yPos, 50, 25, 2, 2, "FD");
      doc.roundedRect(margin + 110, yPos, 50, 25, 2, 2, "FD");

      doc.setTextColor(...TEXT_MUTED);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("Anfangsbestand", margin + 25, yPos + 8, { align: "center" });
      doc.text("Saldo operativ", margin + 80, yPos + 8, { align: "center" });
      doc.text("Endbestand", margin + 135, yPos + 8, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TEXT_DARK);
      doc.text(formatCurrencyThousands(openingBalance), margin + 25, yPos + 19, { align: "center" });
      doc.text(formatCurrencyThousands(data.calculation.totalNetCashflowCents), margin + 80, yPos + 19, { align: "center" });
      doc.text(formatCurrencyThousands(finalBalanceAfterEffects), margin + 135, yPos + 19, { align: "center" });

      yPos += 35;

      // Simple bar chart simulation using rectangles
      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Liquiditätsverlauf", margin, yPos);
      yPos += 8;

      const chartHeight = 50;
      const chartWidth = pageWidth - 2 * margin;
      const barWidth = (chartWidth - 20) / weeks.length;

      // Find max value for scaling
      const maxBalance = Math.max(
        ...weeks.map(w => Math.abs(Number(BigInt(w.closingBalanceCents)) / 100))
      );
      const scale = chartHeight / maxBalance;

      // Draw baseline
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos + chartHeight, margin + chartWidth, yPos + chartHeight);

      // Draw bars - muted professional colors
      weeks.forEach((week, idx) => {
        const balance = Number(BigInt(week.closingBalanceCents)) / 100;
        const barHeight = Math.abs(balance) * scale;
        const x = margin + 10 + idx * barWidth;

        if (balance >= 0) {
          doc.setFillColor(...PRIMARY_LIGHT); // Muted slate
          doc.rect(x, yPos + chartHeight - barHeight, barWidth - 2, barHeight, "F");
        } else {
          doc.setFillColor(180, 83, 83); // Muted red for negative
          doc.rect(x, yPos + chartHeight, barWidth - 2, barHeight, "F");
        }
      });

      // X-axis labels (every 2nd week)
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      weeks.forEach((week, idx) => {
        if (idx % 2 === 0) {
          const x = margin + 10 + idx * barWidth + barWidth / 2;
          doc.text(week.periodLabel || week.weekLabel || "", x, yPos + chartHeight + 8, { align: "center" });
        }
      });

      yPos += chartHeight + 20;

      // Key findings
      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Wesentliche Erkenntnisse", margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      const findings = [
        `• Liquidity-Plan startet bei: ${formatCurrencyForPDF(openingBalance)} (Cashflow-basierte Planung; reale Kontostände siehe Bankenspiegel)`,
        `• Operative Einzahlungen: ${formatCurrencyForPDF(totalInflows)} (Summe Planungszeitraum)`,
        `• Operative Auszahlungen: ${formatCurrencyForPDF(totalOutflows)} (Summe Planungszeitraum)`,
        `• Operativer Cash-Flow: ${formatCurrencyForPDF(data.calculation.totalNetCashflowCents)}`,
        `• Niedrigster Stand: ${formatCurrencyForPDF(minBalance)} in ${minBalanceWeek}`,
      ];

      if (insolvencyEffects.length > 0) {
        findings.push(`• Insolvenzeffekte (netto): ${formatCurrencyForPDF(totalEffects)}`);
        findings.push(`• Endbestand nach Insolvenzeffekten: ${formatCurrencyForPDF(finalBalanceAfterEffects)}`);
      } else {
        findings.push(`• Endbestand: ${formatCurrencyForPDF(finalBalance)}`);
      }

      // Zahlungsfähigkeit assessment
      if (finalBalanceAfterEffects > BigInt(0)) {
        findings.push("");
        findings.push("→ Die Zahlungsfähigkeit ist im Planungszeitraum durchgehend gewährleistet.");
      } else {
        findings.push("");
        findings.push("→ ACHTUNG: Im Planungszeitraum droht Zahlungsunfähigkeit!");
      }

      findings.forEach((line) => {
        doc.text(line, margin, yPos);
        yPos += 6;
      });

      addFooter(currentPage);

      // ============================================
      // PAGE 6: BANKENSPIEGEL
      // ============================================
      doc.addPage();
      currentPage = 6;
      addWatermark();
      addHeader("5. Bankenspiegel");

      yPos = 30;

      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Kontenübersicht zum ${planStartDate.toLocaleDateString("de-DE")}`, margin, yPos);
      yPos += 8;

      if (data.bankAccounts && data.bankAccounts.accounts.length > 0) {
        const bankHeaders = ["Kreditinstitut", "Kontobezeichnung", "IBAN", "Aktueller Saldo", "Status"];
        const bankData = data.bankAccounts.accounts.map((acc) => [
          acc.bankName,
          acc.accountName,
          acc.iban || "-",
          formatCurrencyForPDF(acc.currentBalanceCents || "0"),
          acc.status === "available" ? "Verfügbar" : acc.securityHolder ? `Sicherung: ${acc.securityHolder}` : "Gesperrt",
        ]);

        // Add totals row
        bankData.push([
          "SUMME",
          "",
          "",
          formatCurrencyForPDF(data.bankAccounts.summary.totalBalanceCents),
          `${data.bankAccounts.summary.accountCount} Konten`,
        ]);

        autoTable(doc, {
          head: [bankHeaders],
          body: bankData,
          startY: yPos,
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 32 },
            2: { cellWidth: 45, fontSize: 7 },
            3: { halign: "right", cellWidth: 25 },
            4: { halign: "right", cellWidth: 25 },
            5: { cellWidth: 25 },
          },
          didParseCell: (hookData) => {
            if (hookData.row.index === bankData.length - 1) {
              hookData.cell.styles.fontStyle = "bold";
              hookData.cell.styles.fillColor = [241, 245, 249];
            }
          },
        });

        yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

        // Bank notes
        const accountsWithNotes = data.bankAccounts.accounts.filter(acc => acc.notes);
        if (accountsWithNotes.length > 0) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...TEXT_DARK);
          doc.text("Anmerkungen:", margin, yPos);
          yPos += 6;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          accountsWithNotes.forEach((acc) => {
            doc.text(`• ${acc.bankName} (${acc.accountName}): ${acc.notes}`, margin + 5, yPos);
            yPos += 5;
          });
        }
      } else {
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text("Keine Bankkonten erfasst.", margin, yPos);
      }

      addFooter(currentPage);

      // ============================================
      // PAGE 7: DETAILLIERTE LIQUIDITÄTSTABELLE
      // ============================================
      doc.addPage("landscape");
      currentPage = 7;
      addWatermark();

      // Landscape header
      const landscapeWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(...PRIMARY);
      doc.rect(0, 0, landscapeWidth, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("6. Detaillierte Liquiditätstabelle", margin, 12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(data.case.debtorName, landscapeWidth - margin, 12, { align: "right" });

      // Build table data
      const tableData: (string | number)[][] = [];
      const headers = ["Position", ...weeks.map((w) => w.periodLabel || w.weekLabel || ""), "Summe"];

      // Opening balance
      const openingRow = ["ANFANGSBESTAND"];
      weeks.forEach((week, idx) => {
        if (idx === 0) {
          openingRow.push(formatCurrencyShort(data.calculation.openingBalanceCents));
        } else {
          openingRow.push(formatCurrencyShort(weeks[idx - 1].closingBalanceCents));
        }
      });
      openingRow.push("-");
      tableData.push(openingRow);

      // Inflows
      const inflowCategories = data.calculation.categories.filter(
        (c) => c.flowType === "INFLOW" && BigInt(c.totalCents) !== BigInt(0)
      );
      inflowCategories.forEach((cat) => {
        const row = [`  ${cat.categoryName}`];
        cat.weeklyTotals.forEach((val) => row.push(formatCurrencyShort(val)));
        row.push(formatCurrencyShort(cat.totalCents));
        tableData.push(row);
      });

      // Total inflows
      const inflowTotalRow = ["Summe Einzahlungen"];
      weeks.forEach((w) => inflowTotalRow.push(formatCurrencyShort(w.totalInflowsCents)));
      inflowTotalRow.push(formatCurrencyShort(data.calculation.totalInflowsCents));
      tableData.push(inflowTotalRow);

      // Outflows
      const outflowCategories = data.calculation.categories.filter(
        (c) => c.flowType === "OUTFLOW" && BigInt(c.totalCents) !== BigInt(0)
      );
      outflowCategories.forEach((cat) => {
        const row = [`  ${cat.categoryName}`];
        cat.weeklyTotals.forEach((val) => {
          const value = BigInt(val);
          row.push(value > BigInt(0) ? `-${formatCurrencyShort(val)}` : formatCurrencyShort(val));
        });
        const total = BigInt(cat.totalCents);
        row.push(total > BigInt(0) ? `-${formatCurrencyShort(cat.totalCents)}` : formatCurrencyShort(cat.totalCents));
        tableData.push(row);
      });

      // Total outflows
      const outflowTotalRow = ["Summe Auszahlungen"];
      weeks.forEach((w) => outflowTotalRow.push(`-${formatCurrencyShort(w.totalOutflowsCents)}`));
      outflowTotalRow.push(`-${formatCurrencyShort(data.calculation.totalOutflowsCents)}`);
      tableData.push(outflowTotalRow);

      // Net cashflow
      const netRow = ["SALDO OPERATIVE TÄTIGKEIT"];
      weeks.forEach((w) => netRow.push(formatCurrencyShort(w.netCashflowCents)));
      netRow.push(formatCurrencyShort(data.calculation.totalNetCashflowCents));
      tableData.push(netRow);

      // Closing balance before effects
      const closingBeforeRow = ["GUTHABEN VOR INSO-EFFEKTEN"];
      weeks.forEach((w) => closingBeforeRow.push(formatCurrencyShort(w.closingBalanceCents)));
      closingBeforeRow.push(formatCurrencyShort(data.calculation.finalClosingBalanceCents));
      tableData.push(closingBeforeRow);

      // Insolvency effects section
      if (insolvencyEffects.length > 0) {
        const generalEffects = insolvencyEffects.filter((e) => e.effectGroup === "GENERAL");
        const procedureEffects = insolvencyEffects.filter((e) => e.effectGroup === "PROCEDURE_COST");

        if (generalEffects.length > 0) {
          tableData.push(["INSOLVENZSPEZ. EFFEKTE", ...weeks.map(() => ""), ""]);
          generalEffects.forEach((effect) => {
            const row = [`  ${effect.name}`];
            for (let i = 0; i < weeks.length; i++) {
              const period = effect.periods.find((p) => p.periodIndex === i);
              if (period) {
                const amt = BigInt(period.amountCents);
                row.push(effect.effectType === "OUTFLOW" ? `-${formatCurrencyShort(amt)}` : formatCurrencyShort(amt));
              } else {
                row.push("-");
              }
            }
            const total = effect.periods.reduce((sum, p) => sum + BigInt(p.amountCents), BigInt(0));
            row.push(effect.effectType === "OUTFLOW" ? `-${formatCurrencyShort(total)}` : formatCurrencyShort(total));
            tableData.push(row);
          });
        }

        if (procedureEffects.length > 0) {
          tableData.push(["VERFAHRENSKOSTEN", ...weeks.map(() => ""), ""]);
          procedureEffects.forEach((effect) => {
            const row = [`  ${effect.name}`];
            for (let i = 0; i < weeks.length; i++) {
              const period = effect.periods.find((p) => p.periodIndex === i);
              if (period) {
                const amt = BigInt(period.amountCents);
                row.push(`-${formatCurrencyShort(amt)}`);
              } else {
                row.push("-");
              }
            }
            const total = effect.periods.reduce((sum, p) => sum + BigInt(p.amountCents), BigInt(0));
            row.push(`-${formatCurrencyShort(total)}`);
            tableData.push(row);
          });
        }

        // Total effects per period
        const effectsTotalRow = ["Saldo Insolvenzeffekte"];
        let totalEffectsSum = BigInt(0);
        effectsPerPeriod.forEach((effect) => {
          effectsTotalRow.push(formatCurrencyShort(effect));
          totalEffectsSum += effect;
        });
        effectsTotalRow.push(formatCurrencyShort(totalEffectsSum));
        tableData.push(effectsTotalRow);

        // Cumulative effects
        const cumulativeRow = ["Kumulierter Effekt"];
        let cumulative = BigInt(0);
        effectsPerPeriod.forEach((effect) => {
          cumulative += effect;
          cumulativeRow.push(formatCurrencyShort(cumulative));
        });
        cumulativeRow.push("-");
        tableData.push(cumulativeRow);
      }

      // Final closing balance (after effects)
      const closingAfterRow = ["GUTHABEN NACH INSO-EFFEKTEN"];
      let cumEffect = BigInt(0);
      weeks.forEach((w, idx) => {
        cumEffect += effectsPerPeriod[idx];
        const balanceAfter = BigInt(w.closingBalanceCents) + cumEffect;
        closingAfterRow.push(formatCurrencyShort(balanceAfter));
      });
      closingAfterRow.push(formatCurrencyShort(finalBalanceAfterEffects));
      tableData.push(closingAfterRow);

      // Generate table
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 25,
        theme: "grid",
        styles: {
          fontSize: 6,
          cellPadding: 1.5,
          halign: "right",
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: PRIMARY,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          fontSize: 6,
        },
        columnStyles: {
          0: { halign: "left", cellWidth: 45 },
        },
        didParseCell: (hookData) => {
          const cellText = String(hookData.cell.raw || "");

          // Header rows (uppercase at start) - professional muted colors
          if (cellText.startsWith("ANFANGSBESTAND") ||
              cellText.startsWith("GUTHABEN") ||
              cellText.startsWith("INSOLVENZSPEZ") ||
              cellText.startsWith("VERFAHRENSKOSTEN") ||
              cellText.startsWith("SALDO OPERATIVE")) {
            hookData.cell.styles.fontStyle = "bold";
            if (cellText.startsWith("GUTHABEN NACH")) {
              hookData.cell.styles.fillColor = PRIMARY; // Dark slate for final balance
              hookData.cell.styles.textColor = [255, 255, 255];
            } else if (cellText.startsWith("GUTHABEN VOR")) {
              hookData.cell.styles.fillColor = PRIMARY_LIGHT; // Lighter slate
              hookData.cell.styles.textColor = [255, 255, 255];
            } else if (cellText.startsWith("ANFANGSBESTAND")) {
              hookData.cell.styles.fillColor = PRIMARY;
              hookData.cell.styles.textColor = [255, 255, 255];
            } else if (cellText.startsWith("INSOLVENZSPEZ") || cellText.startsWith("VERFAHRENSKOSTEN")) {
              hookData.cell.styles.fillColor = ACCENT; // Muted accent
              hookData.cell.styles.textColor = [255, 255, 255];
            } else {
              hookData.cell.styles.fillColor = BG_SUBTLE;
            }
          }

          // Subtotal rows
          if (cellText.startsWith("Summe") || cellText.startsWith("Saldo") || cellText.startsWith("Kumulierter")) {
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.fillColor = BG_LIGHT;
          }

          // Negative values - muted red
          if (hookData.section === "body" && hookData.column.index > 0) {
            const text = String(hookData.cell.raw || "");
            if (text.startsWith("-")) {
              hookData.cell.styles.textColor = [153, 27, 27]; // Muted dark red
            }
          }
        },
      });

      // Footer for landscape page
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Seite ${currentPage}`,
        landscapeWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
      doc.text(
        `${texts.pdfFooterText} | ${now.toLocaleDateString("de-DE")} | Hash: ${data.calculation.dataHash.substring(0, 8)}`,
        landscapeWidth - margin,
        doc.internal.pageSize.getHeight() - 10,
        { align: "right" }
      );

      // ============================================
      // PAGE 8: PLANUNGSPRÄMISSEN (if available)
      // ============================================
      if (data.assumptions && data.assumptions.length > 0) {
        doc.addPage("portrait");
        currentPage = 8;
        addWatermark();
        addHeader("7. Planungsprämissen");

        yPos = 28;

        // Risk legend
        doc.setTextColor(...TEXT_DARK);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Risiko-Bewertungsskala:", margin, yPos);
        yPos += 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        Object.entries(RISK_CONFIG).forEach(([, config], idx) => {
          const x = margin + (idx * 33);
          doc.setTextColor(...config.color);
          doc.text(`${config.symbol} ${config.label}`, x, yPos);
        });

        yPos += 10;

        // Assumptions table
        const assumptionHeaders = ["Annahme", "Quelle", "Beschreibung", "Status"];
        const STATUS_LABELS: Record<string, string> = {
          ANNAHME: "○ Annahme",
          VERIFIZIERT: "✓ Verifiziert",
          WIDERLEGT: "✗ Widerlegt",
        };
        const assumptionData = data.assumptions.map((a) => {
          return [
            a.title || "",
            a.source,
            a.description,
            STATUS_LABELS[a.status || "ANNAHME"] || "–",
          ];
        });

        autoTable(doc, {
          head: [assumptionHeaders],
          body: assumptionData,
          startY: yPos,
          theme: "grid",
          styles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: [15, 23, 42],
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: PRIMARY,
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 35, fontStyle: "bold" },
            1: { cellWidth: 40 },
            2: { cellWidth: 75 },
            3: { cellWidth: 25, halign: "center" },
          },
          didParseCell: (hookData) => {
            // All risk levels use professional muted colors
            if (hookData.section === "body" && hookData.column.index === 3) {
              const text = String(hookData.cell.raw || "");
              if (text.includes("Konservativ") || text.includes("Gering")) {
                hookData.cell.styles.textColor = PRIMARY_LIGHT; // Neutral slate
              } else if (text.includes("Mittel")) {
                hookData.cell.styles.textColor = ACCENT; // Slightly lighter
              } else if (text.includes("Hoch") || text.includes("Aggressiv")) {
                hookData.cell.styles.textColor = [153, 27, 27]; // Muted dark red for higher risks
              }
            }
          },
        });

        addFooter(currentPage);
      }

      // ============================================
      // FINAL PAGE: VOLLSTÄNDIGKEITSERKLÄRUNG
      // ============================================
      doc.addPage("portrait");
      currentPage = data.assumptions && data.assumptions.length > 0 ? 9 : 8;
      addWatermark();
      addHeader(data.assumptions && data.assumptions.length > 0 ? "8. Vollständigkeitserklärung" : "7. Vollständigkeitserklärung");

      yPos = 35;

      doc.setTextColor(...TEXT_DARK);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      // Use configurable declaration text
      texts.declarationText.forEach((line) => {
        const processedLine = replacePlaceholders(line, planStartDate);
        doc.text(processedLine, margin, yPos);
        yPos += 6;
      });

      // Signature lines (always added after declaration)
      yPos += 12;
      doc.text("_______________________________          _______________________________", margin, yPos);
      yPos += 6;
      doc.text("Ort, Datum                                                Unterschrift", margin, yPos);
      yPos += 12;
      doc.text(`                                                             ${data.administrator}`, margin, yPos);

      // Document info box at bottom
      yPos = pageHeight - 55;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 2, 2, "FD");

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.text("Dokumentinformationen", margin + 5, yPos + 8);

      doc.setFont("helvetica", "normal");
      doc.text(`Erstellt:    ${now.toLocaleDateString("de-DE")} um ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`, margin + 5, yPos + 16);
      doc.text(`Version:     ${data.plan.versionNumber}`, margin + 5, yPos + 22);
      doc.text(`Prüfsumme:   ${data.calculation.dataHash}`, margin + 5, yPos + 28);

      addFooter(currentPage);

      // Save PDF
      const safeFileName = data.case.caseNumber.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, "_");
      const fileName = `Liquiditätsplanung_${safeFileName}_v${data.plan.versionNumber}_ENTWURF_${now.toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("PDF-Export fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={exporting}
      className="btn-primary flex items-center shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {exporting ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
          Wird erstellt...
        </>
      ) : (
        <>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF exportieren
        </>
      )}
    </button>
  );
}
