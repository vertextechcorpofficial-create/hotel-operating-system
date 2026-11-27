"use client";

import { calcStayNights } from "../lib/group-engine";
import type { GroupBlock } from "../types";

interface GroupSummaryCardProps {
  group: GroupBlock | null;
  mutating: boolean;
  onExecuteBatchCheckIn: (groupId: string) => void;
  onSettleMasterFolio: (groupId: string) => void;
}

export function GroupSummaryCard({
  group,
  mutating,
  onExecuteBatchCheckIn,
  onSettleMasterFolio,
}: GroupSummaryCardProps) {
  if (!group) return null;

  const nights = calcStayNights(group.arrivalDate, group.departureDate);
  const unassignedOrDirtyCount = group.roomingList.filter(
    (r) => !r.roomNumber || r.roomCleanStatus === "Dirty"
  ).length;
  const canBatchCheckIn =
    group.roomingList.length > 0 &&
    unassignedOrDirtyCount === 0 &&
    group.status === "Definite / Confirmed";

  const isAllMaster = group.routingRule.startsWith("All Charges");
  const totalIncidentals = group.roomingList.reduce(
    (acc, r) => acc + r.incidentals,
    0
  );
  const masterFolioGrandTotal = isAllMaster
    ? group.masterFolioTotal + totalIncidentals
    : group.masterFolioTotal;
  const individualFoliosTotal = isAllMaster ? 0 : totalIncidentals;
  const balanceDue = Math.max(
    0,
    masterFolioGrandTotal - (group.depositPaid || 0)
  );

  return (
    <div className="xl:col-span-4 bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-6 sticky top-20 space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <span className="text-muted-foreground font-bold text-sm">→</span>
        <h2 className="text-base font-bold text-foreground">
          Group Folio &amp; Batch Summary
        </h2>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Block Lifecycle State</span>
          <span className="font-bold text-foreground">{group.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Allotment Utilization</span>
          <span className="font-bold text-foreground">
            {group.roomingList.length} / {group.allottedRooms} Rooms ({nights}{" "}
            Nights)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">OTA Channel Inventory</span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            -{Math.max(0, group.allottedRooms - group.roomingList.length)} Held
            Rooms
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Confirmed Deposit</span>
          <span className="font-semibold text-foreground">
            ₱
            {(group.depositPaid || 0).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-2.5 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>Master Folio (Room &amp; Tax)</span>
          <span className="font-bold text-foreground">
            ₱
            {masterFolioGrandTotal.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Individual Folios (Incidentals)</span>
          <span className="font-bold text-foreground">
            ₱
            {individualFoliosTotal.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
        <div className="pt-2.5 border-t border-border flex items-center justify-between">
          <span className="font-bold text-foreground text-sm">
            Master Balance Due
          </span>
          <span className="font-extrabold text-lg text-[#1a68ff] dark:text-blue-400">
            ₱
            {balanceDue.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onExecuteBatchCheckIn(group.id)}
          disabled={!canBatchCheckIn || mutating}
          className={`w-full py-3 px-4 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 ${
            canBatchCheckIn && !mutating
              ? "bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white shadow-2xs cursor-pointer"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          <span>
            Execute Batch Check-In ({group.roomingList.length} Rooms)
          </span>
          <span>✓</span>
        </button>
        <button
          type="button"
          disabled={mutating}
          onClick={() => onSettleMasterFolio(group.id)}
          className="w-full bg-card hover:bg-muted text-foreground font-semibold text-xs py-2.5 px-4 rounded-xl border border-border transition disabled:opacity-50"
        >
          Reconcile &amp; Post to folios_hos
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground italic text-center leading-relaxed">
        Individual early departures adjust only the departing guest&apos;s stay
        without corrupting contracted Master Folio totals.
      </p>
    </div>
  );
}
