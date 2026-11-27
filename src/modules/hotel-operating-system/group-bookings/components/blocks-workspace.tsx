"use client";

import {
  ALL_GROUP_STATES,
  isCutoffExpiredForBlock,
} from "../lib/group-engine";
import type { GroupBlock, GroupBlockStatus } from "../types";

interface BlocksWorkspaceProps {
  groupBlocks: GroupBlock[];
  selectedGroupId: string;
  businessDate: string;
  searchQuery: string;
  arrivalFilter: string;
  statusFilter: string;
  mutating: boolean;
  onSearchChange: (val: string) => void;
  onArrivalFilterChange: (val: string) => void;
  onStatusFilterChange: (val: string) => void;
  onResetFilters: () => void;
  onSelectGroup: (groupId: string) => void;
  onTransitionState: (group: GroupBlock, nextState: GroupBlockStatus) => void;
  onToggleRoutingRule: (groupId: string) => void;
  onOpenCsvModal: () => void;
  onExtendCutoff: (group: GroupBlock) => void;
  onEnforceCutoff: (groupId: string) => void;
  onReopenReleased: (group: GroupBlock) => void;
  onMarkRoomClean: (groupId: string, resId: string) => void;
  onRemoveGuest: (groupId: string, resId: string) => void;
}

export function BlocksWorkspace({
  groupBlocks,
  selectedGroupId,
  businessDate,
  searchQuery,
  arrivalFilter,
  statusFilter,
  mutating,
  onSearchChange,
  onArrivalFilterChange,
  onStatusFilterChange,
  onResetFilters,
  onSelectGroup,
  onTransitionState,
  onToggleRoutingRule,
  onOpenCsvModal,
  onExtendCutoff,
  onEnforceCutoff,
  onReopenReleased,
  onMarkRoomClean,
  onRemoveGuest,
}: BlocksWorkspaceProps) {
  const q = searchQuery.toLowerCase().trim();
  const filtered = groupBlocks.filter((g) => {
    const matchesQuery =
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q);
    const matchesArrival = !arrivalFilter || g.arrivalDate === arrivalFilter;
    const matchesStatus = statusFilter === "ALL" || g.status === statusFilter;
    return matchesQuery && matchesArrival && matchesStatus;
  });

  const selectedGroup =
    groupBlocks.find((g) => g.id === selectedGroupId) || groupBlocks[0] || null;

  const unassignedOrDirtyCount = selectedGroup
    ? selectedGroup.roomingList.filter(
        (r) => !r.roomNumber || r.roomCleanStatus === "Dirty"
      ).length
    : 0;
  const isCutoffExpired = selectedGroup
    ? isCutoffExpiredForBlock(selectedGroup, businessDate)
    : false;
  const isClosedState = selectedGroup
    ? ["Released", "Cancelled", "Checked Out"].includes(selectedGroup.status)
    : false;

  return (
    <div className="xl:col-span-8 space-y-5">
      {/* Group Block Search, Arrival Date & Status Filter Card */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Active Group Allotments (group_blocks_hos)
            </h2>
            <p className="text-xs text-muted-foreground">
              Filter by company, arrival date, or block lifecycle state.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search company or block ID..."
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#1a68ff]"
            />
            <input
              type="date"
              value={arrivalFilter}
              onChange={(e) => onArrivalFilterChange(e.target.value)}
              title="Filter by Arrival Date"
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#1a68ff]"
            />
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
            >
              <option value="ALL">All States</option>
              {ALL_GROUP_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-2 py-8 text-center text-xs text-muted-foreground">
              No group blocks match your search, arrival date, or status filter.
            </div>
          ) : (
            filtered.map((g) => {
              const isSelected = g.id === selectedGroup?.id;
              const pickedUp = g.roomingList.length;
              const pct =
                g.allottedRooms > 0
                  ? Math.min(100, Math.round((pickedUp / g.allottedRooms) * 100))
                  : 0;
              const cutoffPassed = isCutoffExpiredForBlock(g, businessDate);

              const badgeCls =
                g.status === "Released" || g.status === "Cancelled"
                  ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                  : g.status === "In-House" || g.status === "Checked Out"
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                  : g.status === "Definite / Confirmed"
                  ? "bg-blue-100 dark:bg-blue-950/60 text-[#1a68ff] dark:text-blue-300"
                  : "bg-muted text-muted-foreground";

              return (
                <div
                  key={g.id}
                  onClick={() => onSelectGroup(g.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-[#1a68ff] bg-blue-50/30 dark:bg-blue-950/25 ring-1 ring-[#1a68ff]"
                      : "border-border hover:border-foreground/25 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-muted-foreground">
                          {g.id}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          • Arr: {g.arrivalDate}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-foreground mt-0.5">
                        {g.name}
                      </h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${badgeCls}`}
                    >
                      {g.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>
                        Pickup:{" "}
                        <strong className="text-foreground">
                          {pickedUp} / {g.allottedRooms} Rooms
                        </strong>
                      </span>
                      <span>
                        Cutoff:{" "}
                        <strong
                          className={
                            cutoffPassed
                              ? "text-red-600 dark:text-red-400"
                              : "text-foreground"
                          }
                        >
                          {g.cutoffDate}
                        </strong>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1a68ff] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected Group Block Workspace */}
      {selectedGroup ? (
        <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">
                  {selectedGroup.name}
                </h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  ({selectedGroup.id})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Stay:{" "}
                <strong className="text-foreground">
                  {selectedGroup.arrivalDate}
                </strong>{" "}
                to{" "}
                <strong className="text-foreground">
                  {selectedGroup.departureDate}
                </strong>{" "}
                • Mix:{" "}
                <strong className="text-foreground">
                  {selectedGroup.roomTypeMix || "Standard"}
                </strong>{" "}
                • Rate:{" "}
                <strong className="text-foreground">
                  ₱{selectedGroup.negotiatedRate.toLocaleString()}/night
                </strong>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-foreground/90 font-medium">
                  Split Rule: {selectedGroup.routingRule}
                </span>
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => onToggleRoutingRule(selectedGroup.id)}
                  className="text-[11px] text-[#1a68ff] dark:text-blue-400 hover:underline font-semibold"
                >
                  Switch Split Rule
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {selectedGroup.status === "Inquiry" ? (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() =>
                    onTransitionState(selectedGroup, "Tentative Hold")
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-[11px] font-semibold"
                >
                  Place Tentative Hold
                </button>
              ) : selectedGroup.status === "Tentative Hold" ? (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() =>
                    onTransitionState(selectedGroup, "Definite / Confirmed")
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                >
                  Confirm Definite Block
                </button>
              ) : selectedGroup.status === "In-House" ? (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() =>
                    onTransitionState(selectedGroup, "Checked Out")
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-semibold"
                >
                  Batch Check-Out Group
                </button>
              ) : null}

              {!isClosedState ? (
                <>
                  <button
                    type="button"
                    disabled={mutating}
                    onClick={onOpenCsvModal}
                    className="px-3 py-2 rounded-xl bg-[#1a68ff] hover:bg-[#1557d6] text-white text-xs font-semibold shadow-2xs transition"
                  >
                    ↑ Import CSV Rooming List
                  </button>
                  <button
                    type="button"
                    disabled={mutating}
                    onClick={() => onTransitionState(selectedGroup, "Cancelled")}
                    className="px-2.5 py-2 rounded-xl border border-border hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 text-muted-foreground text-xs font-semibold transition"
                  >
                    Cancel Block
                  </button>
                </>
              ) : selectedGroup.status === "Released" ? (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => onReopenReleased(selectedGroup)}
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs transition"
                >
                  Reopen Released Block
                </button>
              ) : null}
            </div>
          </div>

          {isCutoffExpired ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <div>
                <strong>
                  Cutoff Date Passed ({selectedGroup.cutoffDate}):
                </strong>{" "}
                {Math.max(
                  0,
                  selectedGroup.allottedRooms - selectedGroup.roomingList.length
                )}{" "}
                unassigned rooms are due to release back to general &amp; OTA
                inventory unless extended.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => onExtendCutoff(selectedGroup)}
                  className="px-3 py-1.5 rounded-lg bg-card border border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 font-semibold"
                >
                  Extend Cutoff
                </button>
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => onEnforceCutoff(selectedGroup.id)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  Release Unassigned
                </button>
              </div>
            </div>
          ) : null}

          {unassignedOrDirtyCount > 0 && !isClosedState ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
              <span>
                <strong>Batch Check-In Disabled:</strong>{" "}
                {unassignedOrDirtyCount} room(s) in the rooming list are marked{" "}
                <strong>Dirty</strong> or unassigned. Mark clean before batch
                check-in.
              </span>
            </div>
          ) : null}

          {["Inquiry", "Tentative Hold"].includes(selectedGroup.status) &&
          unassignedOrDirtyCount === 0 &&
          selectedGroup.roomingList.length > 0 ? (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 p-3 text-xs text-blue-800 dark:text-blue-200">
              <strong>Action Required:</strong> Confirm block status to{" "}
              <strong>Definite / Confirmed</strong> before executing Batch
              Check-In.
            </div>
          ) : null}

          {/* Rooming List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-[11px] font-bold text-muted-foreground uppercase">
                  <th className="py-2.5 px-3">Res ID</th>
                  <th className="py-2.5 px-3">Guest Name &amp; Email</th>
                  <th className="py-2.5 px-3">Room &amp; Housekeeping</th>
                  <th className="py-2.5 px-3">Stay Dates</th>
                  <th className="py-2.5 px-3">
                    Incidentals (Indiv. Folio)
                  </th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {selectedGroup.roomingList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No named guests imported yet. Click &ldquo;Import CSV
                      Rooming List&rdquo; to generate linked reservations_hos
                      entries.
                    </td>
                  </tr>
                ) : (
                  selectedGroup.roomingList.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                        {r.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-foreground">
                          {r.firstName} {r.lastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.email}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-foreground">
                          Rm {r.roomNumber}
                        </span>{" "}
                        <span className="text-muted-foreground text-[11px]">
                          ({r.roomType})
                        </span>
                        <span
                          className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            r.roomCleanStatus === "Clean"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                              : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                          }`}
                        >
                          {r.roomCleanStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                        {r.checkIn} → {r.checkOut}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        ₱{r.incidentals.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1">
                        {r.roomCleanStatus === "Dirty" ? (
                          <button
                            type="button"
                            disabled={mutating}
                            onClick={() =>
                              onMarkRoomClean(selectedGroup.id, r.id)
                            }
                            className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold"
                          >
                            Mark Clean
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={mutating}
                          onClick={() => onRemoveGuest(selectedGroup.id, r.id)}
                          className="px-2 py-1 rounded border border-border hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 text-muted-foreground text-[11px]"
                        >
                          Early Depart / Cancel
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
