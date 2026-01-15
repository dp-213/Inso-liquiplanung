"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ShareData {
  case: {
    caseNumber: string;
    debtorName: string;
    courtName: string;
    status: string;
    filingDate: string;
    openingDate: string | null;
  };
  administrator: string;
  plan: {
    name: string;
    planStartDate: string;
    versionNumber: number;
    versionDate: string | null;
  };
  calculation: {
    openingBalanceCents: string;
    totalInflowsCents: string;
    totalOutflowsCents: string;
    totalNetCashflowCents: string;
    finalClosingBalanceCents: string;
    dataHash: string;
    calculatedAt: string;
    weeks: {
      weekOffset: number;
      weekLabel: string;
      openingBalanceCents: string;
      totalInflowsCents: string;
      totalOutflowsCents: string;
      netCashflowCents: string;
      closingBalanceCents: string;
    }[];
    categories: {
      categoryName: string;
      flowType: string;
      estateType: string;
      totalCents: string;
      weeklyTotals: string[];
      lines: {
        lineName: string;
        totalCents: string;
        weeklyValues: {
          weekOffset: number;
          effectiveCents: string;
        }[];
      }[];
    }[];
  };
}

interface PDFExportButtonProps {
  data: ShareData;
  formatCurrency: (cents: bigint) => string;
}

export default function PDFExportButton({ data, formatCurrency }: PDFExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const formatCurrencyForPDF = (cents: string | bigint): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    const euros = Number(value) / 100;
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) + " EUR";
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
      // Create PDF in landscape for better table fit
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      // Header
      doc.setFillColor(30, 64, 175); // Primary blue
      doc.rect(0, 0, pageWidth, 25, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Liquiditätsplanung", margin, 12);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Insolvenzverfahren", margin, 18);

      // Report metadata
      const now = new Date();
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(
        `Erstellt: ${now.toLocaleDateString("de-DE")} ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`,
        pageWidth - margin,
        12,
        { align: "right" }
      );
      doc.text(
        `Version ${data.plan.versionNumber} | Hash: ${data.calculation.dataHash.substring(0, 8)}`,
        pageWidth - margin,
        18,
        { align: "right" }
      );

      // Case Information
      doc.setTextColor(15, 23, 42); // Foreground color
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(data.case.debtorName, margin, 35);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // Secondary color
      doc.text(
        `Aktenzeichen: ${data.case.caseNumber} | Gericht: ${data.case.courtName} | Status: ${getStatusLabel(data.case.status)}`,
        margin,
        42
      );

      // KPI Summary Box
      const kpiY = 48;
      doc.setFillColor(248, 250, 252); // Background color
      doc.setDrawColor(226, 232, 240); // Border color
      doc.roundedRect(margin, kpiY, pageWidth - 2 * margin, 22, 2, 2, "FD");

      // Calculate KPIs
      const weeks = data.calculation.weeks;
      const currentCash = BigInt(weeks[0]?.openingBalanceCents || "0");
      const minCash = weeks.reduce((min, week) => {
        const balance = BigInt(week.closingBalanceCents);
        return balance < min ? balance : min;
      }, currentCash);
      const runwayWeek = weeks.findIndex((week) => BigInt(week.closingBalanceCents) <= BigInt(0));

      // KPI Items
      const kpiWidth = (pageWidth - 2 * margin) / 4;
      const kpiItems = [
        { label: "Aktueller Bestand", value: formatCurrencyForPDF(currentCash) },
        { label: "Tiefster Stand", value: formatCurrencyForPDF(minCash) },
        { label: "Liquiditätsreichweite", value: runwayWeek >= 0 ? weeks[runwayWeek].weekLabel : "13+ Wochen" },
        { label: "Status", value: runwayWeek >= 0 ? "Kritisch" : "Stabil" },
      ];

      doc.setFontSize(8);
      kpiItems.forEach((kpi, idx) => {
        const x = margin + kpiWidth * idx + kpiWidth / 2;
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x, kpiY + 8, { align: "center" });
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(kpi.value, x, kpiY + 16, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      });

      // Period info
      const periodLabel = weeks.length > 0
        ? `Planungszeitraum: ${weeks[0].weekLabel} - ${weeks[weeks.length - 1].weekLabel}`
        : "";
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(periodLabel, margin, 78);

      // Main Table
      const tableData: (string | number)[][] = [];
      const headers = ["Position", ...weeks.map((w) => w.weekLabel), "Summe"];

      // Opening balance row
      const openingRow = ["Anfangsbestand"];
      weeks.forEach((week, idx) => {
        if (idx === 0) {
          openingRow.push(formatCurrencyForPDF(data.calculation.openingBalanceCents));
        } else {
          openingRow.push(formatCurrencyForPDF(weeks[idx - 1].closingBalanceCents));
        }
      });
      openingRow.push("-");
      tableData.push(openingRow);

      // Inflows
      const inflowCategories = data.calculation.categories.filter((c) => c.flowType === "INFLOW");
      inflowCategories.forEach((cat) => {
        const estateLabel = cat.estateType === "ALTMASSE" ? "(Alt)" : "(Neu)";
        const row = [`${cat.categoryName} ${estateLabel}`];
        cat.weeklyTotals.forEach((val) => row.push(formatCurrencyForPDF(val)));
        row.push(formatCurrencyForPDF(cat.totalCents));
        tableData.push(row);
      });

      // Total inflows
      const inflowTotalRow = ["Summe Einzahlungen"];
      weeks.forEach((w) => inflowTotalRow.push(formatCurrencyForPDF(w.totalInflowsCents)));
      inflowTotalRow.push(formatCurrencyForPDF(data.calculation.totalInflowsCents));
      tableData.push(inflowTotalRow);

      // Outflows
      const outflowCategories = data.calculation.categories.filter((c) => c.flowType === "OUTFLOW");
      outflowCategories.forEach((cat) => {
        const estateLabel = cat.estateType === "ALTMASSE" ? "(Alt)" : "(Neu)";
        const row = [`${cat.categoryName} ${estateLabel}`];
        cat.weeklyTotals.forEach((val) => {
          const value = BigInt(val);
          row.push(value > BigInt(0) ? `-${formatCurrencyForPDF(val)}` : formatCurrencyForPDF(val));
        });
        const total = BigInt(cat.totalCents);
        row.push(total > BigInt(0) ? `-${formatCurrencyForPDF(cat.totalCents)}` : formatCurrencyForPDF(cat.totalCents));
        tableData.push(row);
      });

      // Total outflows
      const outflowTotalRow = ["Summe Auszahlungen"];
      weeks.forEach((w) => outflowTotalRow.push(`-${formatCurrencyForPDF(w.totalOutflowsCents)}`));
      outflowTotalRow.push(`-${formatCurrencyForPDF(data.calculation.totalOutflowsCents)}`);
      tableData.push(outflowTotalRow);

      // Net cashflow
      const netRow = ["Netto-Cashflow"];
      weeks.forEach((w) => netRow.push(formatCurrencyForPDF(w.netCashflowCents)));
      netRow.push(formatCurrencyForPDF(data.calculation.totalNetCashflowCents));
      tableData.push(netRow);

      // Closing balance
      const closingRow = ["Endbestand"];
      weeks.forEach((w) => closingRow.push(formatCurrencyForPDF(w.closingBalanceCents)));
      closingRow.push(formatCurrencyForPDF(data.calculation.finalClosingBalanceCents));
      tableData.push(closingRow);

      // Generate table
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 82,
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 2,
          halign: "right",
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { halign: "left", cellWidth: 40 },
        },
        didParseCell: (hookData) => {
          // Style special rows
          const rowIndex = hookData.row.index;
          const totalRows = tableData.length;

          // Opening balance and closing balance rows
          if (rowIndex === 0 || rowIndex === totalRows - 1) {
            hookData.cell.styles.fillColor = [30, 64, 175];
            hookData.cell.styles.textColor = [255, 255, 255];
            hookData.cell.styles.fontStyle = "bold";
          }

          // Subtotal rows (after inflows, after outflows, net cashflow)
          const inflowSubtotalIdx = inflowCategories.length + 1;
          const outflowSubtotalIdx = inflowSubtotalIdx + outflowCategories.length + 1;
          const netCashflowIdx = outflowSubtotalIdx + 1;

          if (rowIndex === inflowSubtotalIdx || rowIndex === outflowSubtotalIdx || rowIndex === netCashflowIdx) {
            hookData.cell.styles.fillColor = [226, 232, 240];
            hookData.cell.styles.fontStyle = "bold";
          }
        },
      });

      // Footer
      const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Dieses Dokument wurde automatisch generiert. Datenstand: ${new Date(data.calculation.calculatedAt).toLocaleString("de-DE")}`,
        margin,
        finalY
      );
      doc.text(
        `Datenintegrität: ${data.calculation.dataHash}`,
        margin,
        finalY + 5
      );

      // Save PDF
      const fileName = `Liquiditaetsplan_${data.case.caseNumber.replace(/[^a-zA-Z0-9]/g, "_")}_v${data.plan.versionNumber}_${now.toISOString().split("T")[0]}.pdf`;
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
