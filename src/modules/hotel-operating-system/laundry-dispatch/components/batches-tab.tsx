"use client";

import { BedDouble, Truck } from "lucide-react";
import type { LinenStockItem, VendorBatch } from "../types";

interface BatchesTabProps {
  vendorBatches: VendorBatch[];
  linenStock: LinenStockItem[];
  mutating: boolean;
  onDispatchVendorBatch: () => void;
}

export function BatchesTab({
  vendorBatches,
  linenStock,
  mutating,
  onDispatchVendorBatch,
}: BatchesTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#1a68ff] dark:text-blue-400" />
              <span>Internal &amp; Outsourced Vendor Batch Logs</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track off-site dry-cleaning vendor manifests and bulk hotel linen
              cycles
            </p>
          </div>
          <button
            type="button"
            disabled={mutating}
            onClick={onDispatchVendorBatch}
            className="px-3.5 py-2 rounded-xl bg-[#1a68ff] hover:bg-[#1557d6] text-white text-xs font-semibold transition self-start sm:self-center disabled:opacity-50"
          >
            + Log Vendor Manifest
          </button>
        </div>

        <div className="space-y-3">
          {vendorBatches.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No vendor manifests logged yet.
            </p>
          ) : (
            vendorBatches.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-bold text-foreground">
                    {b.id} • {b.vendor}
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    Dispatched: {b.dispatchedAt} • {b.itemCount} Garments • ETA:{" "}
                    {b.eta}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 self-start sm:self-center">
                  {b.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Housekeeping Linen Inventory Sync */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <BedDouble className="w-4 h-4 text-[#1a68ff] dark:text-blue-400" />
          <span>Housekeeping Linen Inventory Sync (/hos/linen-inventory)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {linenStock.map((l) => (
            <div
              key={l.item}
              className="p-3.5 rounded-xl bg-muted/50 border border-border text-xs"
            >
              <div className="font-bold text-foreground">{l.item}</div>
              <div className="mt-2 flex justify-between text-muted-foreground">
                <span>Clean Ready:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {l.clean}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>In Wash Cycle:</span>
                <span className="font-bold text-[#1a68ff] dark:text-blue-400">
                  {l.inWash}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Soiled Queue:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {l.soiled}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
