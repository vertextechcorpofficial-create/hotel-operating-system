"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsReportData } from "../types";

interface ChartsPanelProps {
  data: AnalyticsReportData | null;
  loading: boolean;
}

const CHANNEL_COLORS: Record<string, string> = {
  PayMongo: "#2563EB",
  Card: "#10B981",
  Cash: "#F59E0B",
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(val);
}

export function ChartsPanel({ data, loading }: ChartsPanelProps) {
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    );
  }

  const periodBadge =
    data.startDate === data.endDate
      ? `Night Audit (${data.startDate})`
      : `${data.startDate} to ${data.endDate}`;

  return (
    <div className="space-y-4">
      {/* Row 1: 7 Cols Revenue Breakdown + 5 Cols Payment Channel Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Revenue Breakdown: Room Charges vs. Incidentals
              </h2>
              <p className="text-[11px] text-slate-500">
                Aggregated from non-voided{" "}
                <code className="text-slate-700 bg-slate-100 px-1 rounded">guest_charges_hos</code>{" "}
                line items
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">
                  Room Charges ({data.roomChargesPct.toFixed(1)}%)
                </span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(data.roomChargesTotal)}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px]">
                  Incidentals &amp; F&amp;B ({data.incidentalsPct.toFixed(1)}%)
                </span>
                <span className="font-bold text-emerald-600">
                  {formatCurrency(data.incidentalsTotal)}
                </span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.revenueBreakdown}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={{ stroke: "#E2E8F0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₱${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value) || 0)}
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Bar
                  dataKey="roomCharges"
                  name="Room Charges"
                  stackId="rev"
                  fill="#2563EB"
                  radius={[0, 0, 4, 4]}
                  barSize={36}
                />
                <Bar
                  dataKey="incidentals"
                  name="Incidental / Service Charges"
                  stackId="rev"
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  barSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Payment Channel Settlement Mix</h2>
            <p className="text-[11px] text-slate-500">
              PayMongo online gateways vs. Physical POS Card vs. Cash Drawer
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-2 my-2">
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.paymentMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={4}
                    dataKey="amount"
                    nameKey="channel"
                  >
                    {data.paymentMix.map((entry) => (
                      <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2.5">
              {data.paymentMix.map((pm) => (
                <div
                  key={pm.channel}
                  className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CHANNEL_COLORS[pm.channel] }}
                      />
                      {pm.channel}
                    </span>
                    <span className="text-[11px] font-bold text-slate-600">
                      {pm.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    {formatCurrency(pm.amount)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {pm.count} settled {pm.count === 1 ? "transaction" : "transactions"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Dual-Axis ADR vs Occupancy Trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Rate Yield &amp; Occupancy Performance Trend (ADR vs. Occupancy %)
            </h2>
            <p className="text-[11px] text-slate-500">
              Dual-axis comparison tracking Average Daily Rate against room occupancy velocity
            </p>
          </div>
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md font-medium">
            Period: {periodBadge}
          </span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data.performanceTrend}
              margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748B" }}
                axisLine={{ stroke: "#E2E8F0" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₱${v}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value, name) => {
                  const num = Number(value) || 0;
                  if (String(name).includes("Occupancy")) return `${num.toFixed(1)}%`;
                  return formatCurrency(num);
                }}
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                yAxisId="left"
                dataKey="adr"
                name="ADR (₱)"
                fill="#93C5FD"
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
              <Bar
                yAxisId="left"
                dataKey="revpar"
                name="RevPAR (₱)"
                fill="#2563EB"
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="occupancyRate"
                name="Occupancy Rate (%)"
                stroke="#F59E0B"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#F59E0B" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
