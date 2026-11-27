"use client";

import { ArrowLeftRight, DollarSign, ShieldCheck } from "lucide-react";
import type { TransportBooking } from "../types";

interface KpiCardsProps {
  dayBookings: TransportBooking[];
}

function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function KpiCards({ dayBookings }: KpiCardsProps) {
  const postedRevenue = dayBookings
    .filter((b) => b.billed)
    .reduce((acc, b) => acc + Number(b.rate), 0);

  const unbilledPending = dayBookings
    .filter((b) => !["Cancelled", "No-Show"].includes(b.status) && !b.billed)
    .reduce((acc, b) => acc + Number(b.rate), 0);

  const activeTrips = dayBookings.filter((b) =>
    ["Confirmed", "Driver Assigned", "En Route / Picked Up"].includes(b.status)
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
      <div className="bg-card text-card-foreground rounded-xl border border-border p-5 shadow-2xs flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
            Posted Folio Revenue
          </span>
          <div className="text-2xl font-bold text-foreground mt-1.5 tracking-tight">
            {formatPhp(postedRevenue)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Synced to guest_charges_hos this shift
          </span>
        </div>
        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <DollarSign className="w-4 h-4" />
        </div>
      </div>

      <div className="bg-card text-card-foreground rounded-xl border border-border p-5 shadow-2xs flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 block">
            Pending Transfer Charges
          </span>
          <div className="text-2xl font-bold text-foreground mt-1.5 tracking-tight">
            {formatPhp(unbilledPending)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Awaiting trip completion / posting
          </span>
        </div>
        <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
      </div>

      <div className="bg-card text-card-foreground rounded-xl border border-border p-5 shadow-2xs flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-[#1a73e8] dark:text-blue-400 block">
            Active Dispatches
          </span>
          <div className="text-2xl font-bold text-foreground mt-1.5 tracking-tight">
            {activeTrips}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              / {dayBookings.length} trips
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Fleet units active on schedule
          </span>
        </div>
        <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#1a73e8] dark:text-blue-400 flex items-center justify-center shrink-0">
          <ArrowLeftRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
