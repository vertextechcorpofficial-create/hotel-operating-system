import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { AnalyticsReportData } from "../types";

export async function exportAnalyticsExcel(data: AnalyticsReportData): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "VOS Web - Hotel Operating System";
  workbook.created = new Date();

  const rangeLabel =
    data.startDate === data.endDate ? data.startDate : `${data.startDate}_to_${data.endDate}`;

  // Tab 1: Executive KPI Summary
  const kpiSheet = workbook.addWorksheet("Executive KPIs");
  kpiSheet.columns = [
    { header: "Metric", key: "metric", width: 32 },
    { header: "Value", key: "value", width: 22 },
    { header: "Variance vs Previous", key: "delta", width: 22 },
    { header: "Notes", key: "notes", width: 38 },
  ];
  kpiSheet.getRow(1).font = { bold: true };
  kpiSheet.addRows([
    {
      metric: "Report Period",
      value: rangeLabel,
      delta: data.auditStatusLabel,
      notes: `Gross Revenue: PHP ${data.grossRevenue.toFixed(2)}`,
    },
    {
      metric: "Occupancy Rate (%)",
      value: `${data.kpis.occupancyRate.value.toFixed(1)}%`,
      delta: `${data.kpis.occupancyRate.delta >= 0 ? "+" : ""}${data.kpis.occupancyRate.delta.toFixed(1)}%`,
      notes: data.kpis.occupancyRate.subtext,
    },
    {
      metric: "Average Daily Rate (ADR)",
      value: data.kpis.adr.value,
      delta: `${data.kpis.adr.delta >= 0 ? "+" : ""}${data.kpis.adr.delta.toFixed(1)}%`,
      notes: data.kpis.adr.subtext,
    },
    {
      metric: "RevPAR",
      value: data.kpis.revpar.value,
      delta: `${data.kpis.revpar.delta >= 0 ? "+" : ""}${data.kpis.revpar.delta.toFixed(1)}%`,
      notes: data.kpis.revpar.subtext,
    },
    {
      metric: "Average Length of Stay (ALOS)",
      value: `${data.kpis.alos.value.toFixed(1)} Nights`,
      delta: `${data.kpis.alos.delta >= 0 ? "+" : ""}${data.kpis.alos.delta.toFixed(1)} Nights`,
      notes: data.kpis.alos.subtext,
    },
  ]);

  // Tab 2: Revenue & Payment Reconciliation
  const mixSheet = workbook.addWorksheet("Payment & Revenue Mix");
  mixSheet.columns = [
    { header: "Section", key: "section", width: 24 },
    { header: "Category / Channel", key: "label", width: 28 },
    { header: "Share (%)", key: "pct", width: 16 },
    { header: "Transactions", key: "count", width: 16 },
    { header: "Amount (PHP)", key: "amount", width: 20 },
  ];
  mixSheet.getRow(1).font = { bold: true };
  mixSheet.addRow({
    section: "Revenue Stream",
    label: "Room Charges",
    pct: `${data.roomChargesPct.toFixed(1)}%`,
    count: "-",
    amount: data.roomChargesTotal,
  });
  mixSheet.addRow({
    section: "Revenue Stream",
    label: "Incidentals & Service",
    pct: `${data.incidentalsPct.toFixed(1)}%`,
    count: "-",
    amount: data.incidentalsTotal,
  });
  for (const ch of data.paymentMix) {
    mixSheet.addRow({
      section: "Payment Channel",
      label: ch.channel,
      pct: `${ch.percentage.toFixed(1)}%`,
      count: ch.count,
      amount: ch.amount,
    });
  }

  // Tab 3: Itemized Reconciliation Ledger
  const ledgerSheet = workbook.addWorksheet("Reconciliation Ledger");
  ledgerSheet.columns = [
    { header: "Folio ID", key: "folioId", width: 18 },
    { header: "Room #", key: "roomNumber", width: 12 },
    { header: "Guest", key: "guestName", width: 26 },
    { header: "Charge Description", key: "chargeTitle", width: 32 },
    { header: "Category", key: "category", width: 22 },
    { header: "Payment Method", key: "paymentMethod", width: 16 },
    { header: "Audit Status", key: "auditStatus", width: 14 },
    { header: "Amount (PHP)", key: "amount", width: 16 },
  ];
  ledgerSheet.getRow(1).font = { bold: true };
  for (const row of data.ledger) {
    ledgerSheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `HOS_Revenue_Analytics_${rangeLabel}.xlsx`);
}
