"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  CreditCard,
  Search,
  SlidersHorizontal,
  Smartphone,
  Wallet,
} from "lucide-react";
import type { ReconciliationLedgerRow } from "../types";

interface LedgerTableProps {
  rows: ReconciliationLedgerRow[];
  loading: boolean;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(val);
}

export function LedgerTable({ rows, loading }: LedgerTableProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (methodFilter !== "all" && row.paymentMethod !== methodFilter) return false;
      if (!q) return true;
      return (
        row.roomNumber.toLowerCase().includes(q) ||
        row.guestName.toLowerCase().includes(q) ||
        row.folioId.toLowerCase().includes(q) ||
        row.chargeTitle.toLowerCase().includes(q)
      );
    });
  }, [rows, search, categoryFilter, methodFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedRows = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePageIndex, pageSize]);

  return (
    <div className="space-y-3">
      {/* Section Banner Bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Clock className="w-4 h-4 text-[#2563EB]" />
          <span>Night Audit Folio &amp; Payment Reconciliation Ledger</span>
        </div>
        <span className="text-[11px] text-slate-500">
          Showing verified <code className="bg-slate-100 px-1 rounded">guest_charges_hos</code> &amp;{" "}
          <code className="bg-slate-100 px-1 rounded">payments_hos</code>
        </span>
      </div>

      {/* Search & Category Filters Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
            placeholder="Search room #, guest, or folio ID..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPageIndex(0);
            }}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Charge Categories</option>
            <option value="Room Charge">Room Charges Only</option>
            <option value="Incidental / Service">Incidental / Service Charges</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPageIndex(0);
            }}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Payment Methods</option>
            <option value="PayMongo">PayMongo</option>
            <option value="Card">POS Card</option>
            <option value="Cash">Cash</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setCategoryFilter("all");
              setMethodFilter("all");
              setSearch("");
              setPageIndex(0);
            }}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            Reset View
          </button>
        </div>
      </div>

      {/* Clean Ledger Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 bg-slate-50/60">
                <th className="py-3.5 px-4">Room #</th>
                <th className="py-3.5 px-4">Folio Charge &amp; Guest</th>
                <th className="py-3.5 px-4">Charge Category</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Audit Status</th>
                <th className="py-3.5 px-4 text-right">Settled Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Loading folio reconciliation records...
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No folio transactions match your active filter criteria.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      Room {row.roomNumber}
                      <div className="text-[10px] font-normal text-slate-400">{row.folioId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{row.chargeTitle}</div>
                      <div className="text-[11px] text-slate-400">
                        Guest: {row.guestName} • {row.timeLabel}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          row.category === "Room Charge"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                        {row.paymentMethod === "PayMongo" && (
                          <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        {row.paymentMethod === "Card" && (
                          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        {row.paymentMethod === "Cash" && (
                          <Wallet className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        {row.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          row.auditStatus === "Settled" ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {row.auditStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table Pagination Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-slate-500">
        <div>
          Showing {filtered.length === 0 ? 0 : safePageIndex * pageSize + 1} to{" "}
          {Math.min((safePageIndex + 1) * pageSize, filtered.length)} of {filtered.length} entries
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-700 font-medium"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <span className="font-medium text-slate-700">
            Page {safePageIndex + 1} of {pageCount}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePageIndex === 0}
              onClick={() => setPageIndex(0)}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:text-slate-400 disabled:opacity-50"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safePageIndex === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:text-slate-400 disabled:opacity-50"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:text-slate-400 disabled:opacity-50"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => setPageIndex(pageCount - 1)}
              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 disabled:text-slate-400 disabled:opacity-50"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
