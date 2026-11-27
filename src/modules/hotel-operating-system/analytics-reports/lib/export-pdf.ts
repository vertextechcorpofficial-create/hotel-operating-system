import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnalyticsReportData } from "../types";

function formatPhp(n: number): string {
  return `PHP ${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function exportNightAuditPdf(data: AnalyticsReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const rangeLabel =
    data.startDate === data.endDate ? data.startDate : `${data.startDate} to ${data.endDate}`;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Vertex Hotel Operating System — Night Audit Report", 14, 18);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Period: ${rangeLabel}   |   Status: ${data.auditStatusLabel}`, 14, 25);
  doc.text(`Generated: ${new Date().toLocaleString("en-PH")}   |   Gross Revenue: ${formatPhp(data.grossRevenue)}`, 14, 30);
  doc.setTextColor(0);

  // Section 1: KPIs
  autoTable(doc, {
    startY: 36,
    head: [["KPI Metric", "Value", "Variance", "Details"]],
    body: [
      [
        "Occupancy Rate",
        `${data.kpis.occupancyRate.value.toFixed(1)}%`,
        `${data.kpis.occupancyRate.delta >= 0 ? "+" : ""}${data.kpis.occupancyRate.delta.toFixed(1)}%`,
        data.kpis.occupancyRate.subtext,
      ],
      [
        "Average Daily Rate (ADR)",
        formatPhp(data.kpis.adr.value),
        `${data.kpis.adr.delta >= 0 ? "+" : ""}${data.kpis.adr.delta.toFixed(1)}%`,
        data.kpis.adr.subtext,
      ],
      [
        "RevPAR",
        formatPhp(data.kpis.revpar.value),
        `${data.kpis.revpar.delta >= 0 ? "+" : ""}${data.kpis.revpar.delta.toFixed(1)}%`,
        data.kpis.revpar.subtext,
      ],
      [
        "Average Length of Stay (ALOS)",
        `${data.kpis.alos.value.toFixed(1)} Nights`,
        `${data.kpis.alos.delta >= 0 ? "+" : ""}${data.kpis.alos.delta.toFixed(1)} Nights`,
        data.kpis.alos.subtext,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
    styles: { fontSize: 8.5 },
  });

  // Section 2: Payment Channels
  const afterKpiY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 80;
  autoTable(doc, {
    startY: afterKpiY + 8,
    head: [["Payment Channel", "Transactions", "Share", "Settled Amount"]],
    body: data.paymentMix.map((ch) => [
      ch.channel,
      String(ch.count),
      `${ch.percentage.toFixed(1)}%`,
      formatPhp(ch.amount),
    ]),
    theme: "grid",
    headStyles: { fillColor: [5, 150, 105], fontSize: 9 },
    styles: { fontSize: 8.5 },
  });

  // Section 3: Ledger Details
  const afterMixY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 125;
  autoTable(doc, {
    startY: afterMixY + 8,
    head: [["Room", "Folio ID", "Guest", "Category", "Method", "Status", "Amount"]],
    body: data.ledger.slice(0, 40).map((row) => [
      row.roomNumber,
      row.folioId,
      row.guestName,
      row.category,
      row.paymentMethod,
      row.auditStatus,
      formatPhp(row.amount),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
    styles: { fontSize: 8 },
  });

  // Signature Blocks
  const finalY = Math.min(
    260,
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200) + 18
  );
  doc.setFontSize(9);
  doc.line(14, finalY, 80, finalY);
  doc.text("Prepared By (Night Auditor)", 14, finalY + 5);

  doc.line(120, finalY, 190, finalY);
  doc.text("Approved By (General Manager / Finance)", 120, finalY + 5);

  const fileRange = data.startDate === data.endDate ? data.startDate : `${data.startDate}_${data.endDate}`;
  doc.save(`HOS_Night_Audit_${fileRange}.pdf`);
}
