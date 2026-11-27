"use client";

import { Filter, ListChecks } from "lucide-react";
import {
  calculateLaundryOrderTotal,
  formatSlaCountdown,
} from "../lib/laundry-engine";
import type { LaundryOrder } from "../types";

interface TicketsWorkspaceProps {
  orders: LaundryOrder[];
  selectedOrderId: string;
  typeFilter: string;
  statusFilter: string;
  expressOnly: boolean;
  onTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onExpressOnlyChange: (value: boolean) => void;
  onSelectOrder: (orderId: string) => void;
}

export function TicketsWorkspace({
  orders,
  selectedOrderId,
  typeFilter,
  statusFilter,
  expressOnly,
  onTypeFilterChange,
  onStatusFilterChange,
  onExpressOnlyChange,
  onSelectOrder,
}: TicketsWorkspaceProps) {
  const filtered = orders.filter((o) => {
    if (typeFilter !== "ALL" && o.category !== typeFilter) return false;
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (expressOnly && o.tier !== "Express") return false;
    return true;
  });

  const activeCount = orders.filter(
    (o) => !["Delivered", "Cancelled"].includes(o.status)
  ).length;
  const expressAlertCount = orders.filter(
    (o) =>
      o.tier === "Express" && !["Delivered", "Cancelled"].includes(o.status)
  ).length;
  const outsourcedCount = orders.filter(
    (o) => o.status === "Outsourced"
  ).length;
  const billedTotal = orders
    .filter((o) => o.billedToFolio)
    .reduce((sum, o) => sum + calculateLaundryOrderTotal(o), 0);

  const selected =
    orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#1a68ff] dark:text-blue-400" />
              <span>Valet &amp; Linen Ticket Queue</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Filter by order type, processing status, or Express priority SLA
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              aria-label="Filter by Ticket Type"
              className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
            >
              <option value="ALL">All Types (Valet &amp; Linen)</option>
              <option value="VALET">Guest Valet (Billable)</option>
              <option value="LINEN">Hotel Bulk Linen (Non-Billable)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              aria-label="Filter by Status"
              className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
            >
              <option value="ALL">All Statuses</option>
              <option value="Collected">Collected</option>
              <option value="Tagged / In Processing">
                Tagged / In Processing
              </option>
              <option value="Outsourced">Outsourced (Vendor)</option>
              <option value="Quality Check / Ready">
                Quality Check / Ready
              </option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/60 text-xs font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={expressOnly}
                onChange={(e) => onExpressOnlyChange(e.target.checked)}
                className="rounded accent-[#1a68ff]"
              />
              <span>Express Only</span>
            </label>
          </div>
        </div>

        {/* KPI Mini Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <div className="text-[11px] text-muted-foreground font-medium">
              Active Tickets
            </div>
            <div className="text-lg font-extrabold text-foreground mt-0.5">
              {activeCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/70">
            <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
              Express SLA Alerts
            </div>
            <div className="text-lg font-extrabold text-amber-900 dark:text-amber-200 mt-0.5">
              {expressAlertCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/35 border border-purple-200/80 dark:border-purple-800/70">
            <div className="text-[11px] text-purple-800 dark:text-purple-300 font-medium">
              Outsourced Vendor
            </div>
            <div className="text-lg font-extrabold text-purple-900 dark:text-purple-200 mt-0.5">
              {outsourcedCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/70">
            <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              Folio Auto-Posted
            </div>
            <div className="text-lg font-extrabold text-emerald-900 dark:text-emerald-200 mt-0.5">
              ₱{billedTotal.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-left border-collapse min-w-[740px]">
            <thead>
              <tr className="bg-muted/60 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
                <th className="py-2.5 px-3">Ticket / Tag ID</th>
                <th className="py-2.5 px-3">Room / Dept</th>
                <th className="py-2.5 px-3">Type &amp; Turnaround</th>
                <th className="py-2.5 px-3">SLA Countdown</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No laundry tickets match your current filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const isSelected = o.id === (selected?.id || "");
                  const total = calculateLaundryOrderTotal(o);
                  const sla = formatSlaCountdown(o);

                  return (
                    <tr
                      key={o.id}
                      onClick={() => onSelectOrder(o.id)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-50/70 dark:bg-blue-950/40"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-foreground">
                        {o.id}
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground">
                        {o.roomOrDept}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            o.category === "VALET"
                              ? "bg-blue-50 dark:bg-blue-950/60 text-[#1a68ff] dark:text-blue-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {o.category}
                        </span>
                        <span
                          className={`ml-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            o.tier === "Express"
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {o.tier}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-3 ${
                          sla.urgent
                            ? "text-red-700 dark:text-red-400 font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {sla.label}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-foreground">
                        {o.category === "LINEN"
                          ? "Non-Billable"
                          : `₱${total.toLocaleString()}`}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-foreground border border-border/60">
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Ticket Garment Breakdown */}
      {selected ? (
        <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-[#1a68ff] dark:text-blue-400" />
                <span>
                  Garment Breakdown • {selected.id} ({selected.roomOrDept})
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pre-existing garment conditions are logged at tagging time to
                prevent guest disputes
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-muted text-foreground font-mono text-[11px] font-semibold self-start sm:self-center">
              {selected.vendorBatchId
                ? `Vendor Batch: ${selected.vendorBatchId}`
                : `Channel: ${selected.channel}`}
            </span>
          </div>

          <div className="space-y-3">
            <div className="border border-border rounded-xl divide-y divide-border">
              {selected.items.map((it, idx) => (
                <div
                  key={`${it.name}-${idx}`}
                  className="p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-foreground">
                      {it.qty}x {it.name}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      ({it.service})
                    </span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {selected.category === "LINEN"
                      ? "Non-Billable"
                      : `₱${(it.qty * it.unitPrice).toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold">Intake / Inspection Notes:</span>{" "}
              {selected.damageNotes || "None recorded."}
            </div>

            {selected.auditLogs.length > 0 ? (
              <div className="p-3 rounded-xl bg-muted/50 border border-border text-[11px] text-muted-foreground space-y-1">
                <div className="font-bold text-foreground">
                  Ticket Audit History
                </div>
                {selected.auditLogs.slice(0, 3).map((log, i) => (
                  <div key={`${log.timestamp}-${i}`}>
                    {log.timestamp} — <strong>{log.actor}</strong>:{" "}
                    {log.action} ({log.prev} → {log.next})
                    {log.reason ? ` • "${log.reason}"` : ""}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
