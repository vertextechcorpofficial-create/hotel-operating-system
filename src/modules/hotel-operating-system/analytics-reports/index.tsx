"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { KpiCards } from "./components/kpi-cards";
import { ChartsPanel } from "./components/charts-panel";
import { LedgerTable } from "./components/ledger-table";
import { exportAnalyticsExcel } from "./lib/export-excel";
import { exportNightAuditPdf } from "./lib/export-pdf";
import type { AnalyticsReportData, ReportPeriodPreset } from "./types";

function getTodayManilaStr(): string {
  const now = new Date();
  const manilaMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000;
  return new Date(manilaMs).toISOString().split("T")[0];
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(val);
}

export default function AnalyticsReportsModule() {
  const todayStr = getTodayManilaStr();
  const [period, setPeriod] = useState<ReportPeriodPreset>("today");
  const [customStart, setCustomStart] = useState<string>(`${todayStr.slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  const [data, setData] = useState<AnalyticsReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [signedOffLocally, setSignedOffLocally] = useState(false);
  const [exportToast, setExportToast] = useState<{ title: string; message: string } | null>(null);

  const fetchAnalytics = useCallback(
    async (selectedPeriod: ReportPeriodPreset, sDate: string, eDate: string) => {
      if (selectedPeriod === "custom" && (!sDate || !eDate || eDate < sDate)) {
        toast.error("Please select a valid custom date range (Start <= End).");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ period: selectedPeriod });
        if (selectedPeriod === "custom") {
          params.set("startDate", sDate);
          params.set("endDate", eDate);
        }

        const res = await fetch(`/api/hos/analytics-reports?${params.toString()}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load revenue analytics.");
        }
        setData(json.data as AnalyticsReportData);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load analytics report.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchAnalytics(period, customStart, customEnd);
  }, [period, customStart, customEnd, fetchAnalytics]);

  const recordAuditAction = async (
    action: "export_excel" | "export_pdf" | "night_audit_signoff"
  ) => {
    if (!data) return;
    try {
      await fetch("/api/hos/analytics-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          startDate: data.startDate,
          endDate: data.endDate,
        }),
      });
    } catch {
      // Non-blocking audit log attempt
    }
  };

  const hasExportableData = Boolean(
    data && (data.grossRevenue > 0 || data.ledger.length > 0 || data.kpis.occupancyRate.value > 0)
  );

  const showFloatingToast = (title: string, message: string) => {
    setExportToast({ title, message });
    setTimeout(() => setExportToast(null), 4500);
  };

  const handleExportExcel = async () => {
    if (!data || !hasExportableData) return;
    setExporting("excel");
    try {
      await exportAnalyticsExcel(data);
      await recordAuditAction("export_excel");
      const rangeLabel =
        data.startDate === data.endDate ? data.startDate : `${data.startDate}_to_${data.endDate}`;
      showFloatingToast(
        "Excel Workbook Generated",
        `Exported "HOS_Revenue_Analytics_${rangeLabel}.xlsx" using ExcelJS engine (${data.ledger.length} folio records included).`
      );
    } catch {
      toast.error("Failed to generate Excel workbook.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!data || !hasExportableData) return;
    setExporting("pdf");
    try {
      exportNightAuditPdf(data);
      await recordAuditAction("export_pdf");
      const fileRange =
        data.startDate === data.endDate ? data.startDate : `${data.startDate}_${data.endDate}`;
      showFloatingToast(
        "Night Audit PDF Generated",
        `Exported "HOS_Night_Audit_${fileRange}.pdf" using jsPDF engine (${data.ledger.length} folio records included).`
      );
    } catch {
      toast.error("Failed to generate Night Audit PDF.");
    } finally {
      setExporting(null);
    }
  };

  const handleConfirmSignOff = async () => {
    if (!data) return;
    setSigningOff(true);
    try {
      await recordAuditAction("night_audit_signoff");
      if (hasExportableData) {
        exportNightAuditPdf(data);
        const fileRange =
          data.startDate === data.endDate ? data.startDate : `${data.startDate}_${data.endDate}`;
        showFloatingToast(
          "Night Audit PDF Generated",
          `Exported "HOS_Night_Audit_${fileRange}.pdf" using jsPDF engine (${data.ledger.length} folio records included).`
        );
      }
      setSignedOffLocally(true);
      setSignOffOpen(false);
    } catch {
      toast.error("Failed to record Night Audit sign-off.");
    } finally {
      setSigningOff(false);
    }
  };

  const effectiveStatusLabel = signedOffLocally
    ? "Closed (Audited & Locked)"
    : data?.auditStatusLabel || "Open (Current Business Day)";

  return (
    <div className="p-2 sm:p-4 space-y-5 max-w-[1600px] w-full mx-auto text-slate-800">
      {/* Floating Export Toast (Matching Canvas Reference) */}
      {exportToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-start gap-3 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-white">{exportToast.title}</div>
            <div className="text-slate-300 mt-0.5">{exportToast.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setExportToast(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Title & One-Click Export Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#2563EB] shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Revenue Analytics &amp; Manager Reports
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Monitor core hospitality KPIs (ADR, RevPAR, Occupancy, ALOS), reconcile folio &amp; PayMongo settlements, and export Night Audit summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSignOffOpen(true)}
            disabled={loading || !data}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition-all disabled:opacity-60"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Night Audit Sign-Off
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || !hasExportableData || exporting !== null}
            title={!hasExportableData ? "No records available to export for this period" : "Export Excel (.xlsx)"}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-all disabled:opacity-60"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting === "excel" ? "Building Excel..." : "Export Excel (.xlsx)"}
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={loading || !hasExportableData || exporting !== null}
            title={!hasExportableData ? "No records available to export for this period" : "One-Click Night Audit PDF"}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 transition-all disabled:opacity-60"
          >
            <FileText className="w-3.5 h-3.5" />
            {exporting === "pdf" ? "Generating PDF..." : "One-Click Night Audit PDF"}
          </button>
        </div>
      </div>

      {/* 4 Top-Accented Executive KPI Cards */}
      <KpiCards kpis={data?.kpis ?? null} loading={loading} />

      {/* Filter Queue Bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Report Period:
          </span>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            {(
              [
                { id: "today", label: "Night Audit (Today)" },
                { id: "mtd", label: "Month-to-Date" },
                { id: "custom", label: "Custom Range" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  period === opt.id
                    ? "bg-white text-slate-900 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                max={customEnd || todayStr}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={todayStr}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
            Status: {effectiveStatusLabel}
          </span>
          <span className="font-semibold text-slate-700">
            Gross Revenue:{" "}
            <span className="text-slate-900 font-bold">
              {formatCurrency(data?.grossRevenue ?? 0)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => fetchAnalytics(period, customStart, customEnd)}
            disabled={loading}
            title="Refresh analytics"
            className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* API Error Banner */}
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchAnalytics(period, customStart, customEnd)}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 font-semibold hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Recharts Visualizations */}
      <ChartsPanel data={data} loading={loading} />

      {/* Night Audit Folio & Payment Reconciliation Ledger */}
      <LedgerTable rows={data?.ledger ?? []} loading={loading} />

      {/* Executive Night Audit Summary Modal */}
      {signOffOpen && data && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Executive Night Audit Summary
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {data.startDate === data.endDate
                      ? `Night Audit (${data.startDate})`
                      : `${data.startDate} to ${data.endDate}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSignOffOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Occupancy Rate:</span>
                <span className="font-bold text-slate-900">
                  {data.kpis.occupancyRate.value.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ADR / RevPAR:</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(data.kpis.adr.value)} / {formatCurrency(data.kpis.revpar.value)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Room Charges vs. Incidentals:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(data.roomChargesTotal)} /{" "}
                  {formatCurrency(data.incidentalsTotal)}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-sm">
                <span className="font-bold text-slate-700">Total Reconciled Revenue:</span>
                <span className="font-extrabold text-[#2563EB]">
                  {formatCurrency(data.grossRevenue)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSignOffOpen(false)}
                disabled={signingOff}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSignOff}
                disabled={signingOff}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-60"
              >
                {signingOff ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Sign Off &amp; Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
