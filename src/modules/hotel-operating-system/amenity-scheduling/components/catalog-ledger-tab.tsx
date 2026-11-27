"use client";

import type {
  AmenityFolioPosting,
  AmenityResource,
  AmenityRole,
} from "../types";

interface CatalogLedgerTabProps {
  resources: AmenityResource[];
  folioPostings: AmenityFolioPosting[];
  activeRole: AmenityRole;
  togglingId: string | null;
  onToggleResource: (resourceId: string) => void;
}

export function CatalogLedgerTab({
  resources,
  folioPostings,
  activeRole,
  togglingId,
  onToggleResource,
}: CatalogLedgerTabProps) {
  return (
    <div className="space-y-5">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-5">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Resource &amp; Therapist Catalog (amenity_resources_hos)
            </h2>
            <p className="text-xs text-muted-foreground">
              Deactivating a resource preserves all historical bookings while
              blocking new slot assignments ({activeRole} active).
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {resources.map((r) => (
            <div
              key={r.id}
              className="p-3.5 rounded-xl border border-border flex items-center justify-between bg-muted/40"
            >
              <div>
                <div className="text-xs font-bold text-foreground">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.category} • Shift: {r.shiftStart}:00–{r.shiftEnd}:00
                </div>
              </div>
              <button
                type="button"
                disabled={togglingId === r.id}
                onClick={() => onToggleResource(r.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                  r.active
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-700 dark:hover:text-red-300 hover:border-red-200 dark:hover:border-red-800"
                    : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300"
                } ${togglingId === r.id ? "opacity-50" : ""}`}
              >
                {r.active
                  ? "Active (Deactivate)"
                  : "Inactive (Reactivate)"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-5">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Automated Room Folio Postings (guest_charges_hos) &amp; POS
              Settlements
            </h2>
            <p className="text-xs text-muted-foreground">
              Completed sessions automatically post to guest room folios unless
              settled via immediate walk-in cash/POS.
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          {folioPostings.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No folio postings recorded yet.
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
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
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
