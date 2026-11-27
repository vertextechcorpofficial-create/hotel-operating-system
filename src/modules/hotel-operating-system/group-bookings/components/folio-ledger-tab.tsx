"use client";

import type { GroupFolioPosting } from "../types";

interface FolioLedgerTabProps {
  folioPostings: GroupFolioPosting[];
}

export function FolioLedgerTab({ folioPostings }: FolioLedgerTabProps) {
  return (
    <div className="space-y-5">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Master Folio &amp; Split-Billing Ledger (folios_hos)
            </h2>
            <p className="text-xs text-muted-foreground">
              Tracks Master Folio room/tax settlements, individual incidental
              routing, and OTA channel deductions.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {folioPostings.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No Master Folio reconciliations recorded yet.
            </p>
          ) : (
            folioPostings.map((f) => (
              <div
                key={f.folioId}
                className="p-3.5 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/20"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#1a68ff] dark:text-blue-400">
                      {f.folioId}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {f.targetAccount}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-[#1a68ff] dark:text-blue-300 font-semibold">
                      {f.settlementType}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {f.description} • Ref: {f.sourceBookingId} • {f.timestamp}
                  </div>
                </div>
                <div className="text-sm font-extrabold text-foreground">
                  ₱
                  {f.amount.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
