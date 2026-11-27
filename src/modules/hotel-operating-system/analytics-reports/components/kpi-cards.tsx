"use client";

import {
  BedDouble,
  CalendarClock,
  DollarSign,
  Percent,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsKpis } from "../types";

interface KpiCardsProps {
  kpis: AnalyticsKpis | null;
  loading: boolean;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(val);
}

export function KpiCards({ kpis, loading }: KpiCardsProps) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden p-5 space-y-3"
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    );
  }

  const occPos = kpis.occupancyRate.delta >= 0;
  const adrPos = kpis.adr.delta >= 0;
  const revPos = kpis.revpar.delta >= 0;
  const alosPos = kpis.alos.delta >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1: Occupancy Rate % */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="h-1 bg-rose-500 w-full" />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
              <Percent className="w-3.5 h-3.5" />
              Occupancy Rate %
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                occPos ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {occPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {occPos && kpis.occupancyRate.delta > 0 ? "+" : ""}
              {kpis.occupancyRate.delta.toFixed(1)}%
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
            {kpis.occupancyRate.value.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">{kpis.occupancyRate.subtext}</div>
        </div>
      </div>

      {/* Card 2: ADR (Average Daily Rate) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="h-1 bg-amber-500 w-full" />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
              <DollarSign className="w-3.5 h-3.5" />
              ADR (Average Daily Rate)
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                adrPos ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {adrPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {adrPos && kpis.adr.delta > 0 ? "+" : ""}
              {kpis.adr.delta.toFixed(1)}%
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
            {formatCurrency(kpis.adr.value)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">{kpis.adr.subtext}</div>
        </div>
      </div>

      {/* Card 3: RevPAR */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="h-1 bg-emerald-500 w-full" />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <BedDouble className="w-3.5 h-3.5" />
              RevPAR (Rev / Avail Room)
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                revPos ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {revPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {revPos && kpis.revpar.delta > 0 ? "+" : ""}
              {kpis.revpar.delta.toFixed(1)}%
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
            {formatCurrency(kpis.revpar.value)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">{kpis.revpar.subtext}</div>
        </div>
      </div>

      {/* Card 4: ALOS (Average Length of Stay) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="h-1 bg-[#2563EB] w-full" />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB]">
              <CalendarClock className="w-3.5 h-3.5" />
              ALOS (Avg Length of Stay)
            </span>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                alosPos ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {alosPos && kpis.alos.delta > 0 ? "+" : ""}
              {kpis.alos.delta.toFixed(1)} Nights
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">
            {kpis.alos.value.toFixed(1)}{" "}
            <span className="text-base font-semibold text-slate-500">Nights</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">{kpis.alos.subtext}</div>
        </div>
      </div>
    </div>
  );
}
