"use client";

import {
  NEXT_LAUNDRY_TRANSITIONS,
  calculateLaundryOrderTotal,
} from "../lib/laundry-engine";
import type { LaundryOrder } from "../types";

interface TicketSummaryCardProps {
  order: LaundryOrder | null;
  mutating: boolean;
  onAdvanceStatus: (orderId: string) => void;
  onPostToFolio: (orderId: string) => void;
  onRequestOverride: (
    type: "reopen" | "damage_credit",
    orderId: string
  ) => void;
  onDeleteTicket: (orderId: string) => void;
}

export function TicketSummaryCard({
  order,
  mutating,
  onAdvanceStatus,
  onPostToFolio,
  onRequestOverride,
  onDeleteTicket,
}: TicketSummaryCardProps) {
  if (!order) {
    return (
      <div className="xl:col-span-4 bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5 text-xs text-muted-foreground text-center">
        Select a laundry ticket to view workflow and folio actions.
      </div>
    );
  }

  const total = calculateLaundryOrderTotal(order);
  const nextState = NEXT_LAUNDRY_TRANSITIONS[order.status];
  const isLinen = order.category === "LINEN";

  return (
    <div className="xl:col-span-4 xl:sticky xl:top-4 space-y-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5">
        <div className="flex items-center gap-2 text-foreground font-bold text-base pb-4 border-b border-border">
          <span className="text-muted-foreground text-xs font-bold">→</span>
          <span>Ticket Summary &amp; Workflow</span>
        </div>

        <div className="py-4 space-y-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ticket ID</span>
            <span className="font-mono font-bold text-foreground">
              {order.id}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Account / Dept</span>
            <span className="font-semibold text-foreground text-right">
              {order.roomOrDept}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Category</span>
            <span className="font-semibold text-foreground">
              {isLinen ? "Hotel Bulk Linen" : "Guest Valet (Billable)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Turnaround SLA</span>
            <span className="font-semibold text-foreground">{order.tier}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current State</span>
            <span className="font-bold text-[#1a68ff] dark:text-blue-400">
              {order.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Folio Billing</span>
            <span
              className={`font-semibold ${
                order.billedToFolio
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              {isLinen
                ? "Disabled (Bulk Linen)"
                : order.billedToFolio
                ? "Posted to folios_hos ✓"
                : "Pending Ready/Delivery"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/50 border border-border flex items-center justify-between mt-2">
            <span className="font-bold text-foreground">Total Valet Charge</span>
            <span className="text-lg font-extrabold text-[#1a68ff] dark:text-blue-400">
              {isLinen ? "₱0.00" : `₱${total.toLocaleString()}.00`}
            </span>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          {nextState ? (
            <button
              type="button"
              disabled={mutating}
              onClick={() => onAdvanceStatus(order.id)}
              className="w-full py-3 rounded-xl bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white text-xs font-semibold transition disabled:opacity-50"
            >
              Advance to &ldquo;{nextState}&rdquo; ✓
            </button>
          ) : null}

          {!isLinen &&
          !order.billedToFolio &&
          order.status !== "Cancelled" ? (
            <button
              type="button"
              disabled={mutating}
              onClick={() => onPostToFolio(order.id)}
              className="w-full py-2.5 rounded-xl bg-[#1a68ff] hover:bg-[#1557d6] text-white text-xs font-semibold transition disabled:opacity-50"
            >
              Post Charge to Guest Folio (folios_hos)
            </button>
          ) : null}

          {order.status === "Delivered" ? (
            <button
              type="button"
              disabled={mutating}
              onClick={() => onRequestOverride("reopen", order.id)}
              className="w-full py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition disabled:opacity-50"
            >
              Reopen Delivered Ticket (Supervisor)
            </button>
          ) : null}

          {!isLinen ? (
            <button
              type="button"
              disabled={mutating}
              onClick={() => onRequestOverride("damage_credit", order.id)}
              className="w-full py-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 text-xs font-semibold transition disabled:opacity-50"
            >
              Issue Damage / Lost Credit (/hos/guest-relations)
            </button>
          ) : null}

          <button
            type="button"
            disabled={mutating || order.billedToFolio}
            title={
              order.billedToFolio
                ? "Billed valet tickets cannot be deleted"
                : "Delete unbilled ticket"
            }
            onClick={() => onDeleteTicket(order.id)}
            className={`w-full py-2 rounded-xl border text-xs font-semibold transition ${
              order.billedToFolio
                ? "border-border bg-muted/50 text-muted-foreground cursor-not-allowed opacity-70"
                : "border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
            }`}
          >
            {order.billedToFolio
              ? "Delete Blocked (Posted to Folio)"
              : "Remove Unbilled Ticket"}
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground italic text-center mt-4 leading-relaxed">
          Valet charges auto-post to{" "}
          <code className="font-mono text-foreground">folios_hos</code> once
          marked Ready/Delivered. Billed tickets cannot be deleted.
        </p>
      </div>
    </div>
  );
}
