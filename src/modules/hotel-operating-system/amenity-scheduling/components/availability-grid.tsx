"use client";

import { Calendar } from "lucide-react";
import {
  AMENITY_HOURS,
  canActorTransition,
  getAmenityStatusBadgeClasses,
  getSlotOccupancy,
} from "../lib/slot-engine";
import type {
  AmenityBooking,
  AmenityBookingStatus,
  AmenityResource,
  AmenityRole,
  ResourceCategory,
} from "../types";

interface AvailabilityGridProps {
  dateFilter: string;
  categoryFilter: string;
  statusFilter: string;
  resources: AmenityResource[];
  bookings: AmenityBooking[];
  activeRole: AmenityRole;
  mutatingId: string | null;
  onDateFilterChange: (val: string) => void;
  onCategoryFilterChange: (val: string) => void;
  onStatusFilterChange: (val: string) => void;
  onFocusQuickBooking: () => void;
  onSelectOpenSlot: (
    entityId: string,
    category: ResourceCategory,
    hour: number
  ) => void;
  onAdvanceStatus: (
    booking: AmenityBooking,
    targetState: AmenityBookingStatus
  ) => void;
}

export function AvailabilityGrid({
  dateFilter,
  categoryFilter,
  statusFilter,
  resources,
  bookings,
  activeRole,
  mutatingId,
  onDateFilterChange,
  onCategoryFilterChange,
  onStatusFilterChange,
  onFocusQuickBooking,
  onSelectOpenSlot,
  onAdvanceStatus,
}: AvailabilityGridProps) {
  const filteredResources = resources.filter(
    (r) => categoryFilter === "ALL" || r.category === categoryFilter
  );

  const visibleBookings = bookings.filter((b) => {
    if (dateFilter && b.date !== dateFilter) return false;
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Filter & Date Controls Card */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">
              Resource &amp; Therapist Availability Matrix
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-400 dark:border-emerald-700" />{" "}
              Open Slot
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Reserved /
              In Session
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-700" />{" "}
              Sanitization Buffer
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" />{" "}
              Off Shift / Inactive
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4">
          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              Schedule Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              Facility Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
            >
              <option value="ALL">All Facilities &amp; Staff</option>
              <option value="Spa Room">Massage &amp; Spa Suites</option>
              <option value="Therapist">Spa Therapists</option>
              <option value="Recreation">Tennis &amp; Gym Cabanas</option>
              <option value="Entertainment">VIP KTV Rooms</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              Booking Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Reserved">Reserved</option>
              <option value="Checked In">Checked In</option>
              <option value="In Session">In Session</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={onFocusQuickBooking}
              className="w-full bg-[#1a68ff] hover:bg-[#1557d6] text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <span>+ New Slot Booking</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Time-Slot Grid Card */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-muted/50 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Click any open slot to lock room + therapist simultaneously
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            Collection: amenity_bookings_hos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 w-52 sticky left-0 bg-muted/95 z-10 border-r border-border">
                  Resource / Therapist
                </th>
                {AMENITY_HOURS.map((h) => (
                  <th key={h} className="py-3 px-2 text-center">
                    {String(h).padStart(2, "0")}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredResources.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No resources match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => (
                  <tr
                    key={res.id}
                    className="hover:bg-muted/30 transition"
                  >
                    <td className="py-2.5 px-4 sticky left-0 bg-card z-10 border-r border-border">
                      <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                        <span>{res.name}</span>
                        {!res.active ? (
                          <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded text-[9px]">
                            Inactive
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {res.category} • Cap: {res.capacity}
                      </div>
                    </td>

                    {AMENITY_HOURS.map((h) => {
                      const occ = getSlotOccupancy(
                        res.id,
                        dateFilter,
                        h,
                        resources,
                        bookings
                      );

                      if (
                        statusFilter !== "ALL" &&
                        occ.state === "booked" &&
                        occ.booking?.status !== statusFilter
                      ) {
                        return (
                          <td key={h} className="p-1.5 text-center">
                            <div className="h-10 rounded-lg bg-muted/30 border border-border/50 opacity-40" />
                          </td>
                        );
                      }

                      if (occ.state === "open") {
                        return (
                          <td key={h} className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                onSelectOpenSlot(res.id, res.category, h)
                              }
                              title={occ.label}
                              className="w-full h-10 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition flex items-center justify-center"
                            >
                              Open
                            </button>
                          </td>
                        );
                      }

                      if (occ.state === "booked" && occ.booking) {
                        return (
                          <td key={h} className="p-1.5 text-center">
                            <div
                              title={occ.label}
                              className="w-full h-10 rounded-lg bg-[#1a68ff] text-white px-1.5 flex flex-col items-center justify-center leading-tight cursor-not-allowed shadow-2xs"
                            >
                              <span className="text-[10px] font-bold truncate w-full">
                                {occ.booking.status}
                              </span>
                              <span className="text-[9px] opacity-85 truncate w-full">
                                {occ.booking.guest.split("—")[0]}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      if (occ.state === "buffer") {
                        return (
                          <td key={h} className="p-1.5 text-center">
                            <div
                              title={occ.label}
                              className="w-full h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 px-1 flex items-center justify-center text-[10px] font-semibold cursor-not-allowed"
                            >
                              Buffer
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={h} className="p-1.5 text-center">
                          <div
                            title={occ.label}
                            className="w-full h-10 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center text-[10px] font-medium cursor-not-allowed"
                          >
                            {occ.state === "offshift" ? "Off Shift" : "Inactive"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Slot Reservations & Lifecycle Execution */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Active Slot Reservations &amp; Lifecycle Execution
            </h3>
            <p className="text-xs text-muted-foreground">
              Enforces valid state transitions: Reserved → Checked In → In Session
              → Completed (Auto-posts to guest_charges_hos)
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#1a68ff] dark:text-blue-300">
            Atomic Slot Locking Active
          </span>
        </div>

        <div className="divide-y divide-border mt-2">
          {visibleBookings.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No amenity reservations match your active filters.
            </div>
          ) : (
            visibleBookings.map((b) => {
              const resObj = resources.find((r) => r.id === b.resourceId);
              const therapistNames = (b.therapistIds || [])
                .map((tid) =>
                  resources
                    .find((r) => r.id === tid)
                    ?.name.replace("Therapist: ", "")
                )
                .filter(Boolean)
                .join(", ");
              const isBusy = mutatingId === b.id;

              return (
                <div
                  key={b.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {b.id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getAmenityStatusBadgeClasses(
                          b.status
                        )}`}
                      >
                        {b.status}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {b.guest}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/90">
                        {b.serviceName}
                      </span>{" "}
                      • {resObj ? resObj.name : b.resourceId}
                      {therapistNames ? (
                        <>
                          {" "}
                          • Staff:{" "}
                          <span className="text-foreground/90 font-medium">
                            {therapistNames}
                          </span>
                        </>
                      ) : null}{" "}
                      • {String(b.startHour).padStart(2, "0")}:00 (+
                      {b.bufferMins}m buffer)
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-xs font-bold text-foreground">
                      ₱{b.price.toLocaleString()}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {b.status === "Reserved" ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              isBusy ||
                              !canActorTransition(activeRole, "Checked In")
                            }
                            onClick={() => onAdvanceStatus(b, "Checked In")}
                            className="px-2.5 py-1 rounded-lg bg-[#1a68ff] hover:bg-[#1557d6] text-white text-[11px] font-semibold transition disabled:opacity-50"
                          >
                            Check In
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onAdvanceStatus(b, "Cancelled")}
                            className="px-2.5 py-1 rounded-lg border border-border hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 dark:hover:text-red-400 text-muted-foreground text-[11px] font-semibold transition disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : b.status === "Checked In" ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              isBusy ||
                              !canActorTransition(activeRole, "In Session")
                            }
                            onClick={() => onAdvanceStatus(b, "In Session")}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition disabled:opacity-50"
                          >
                            Start Session
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onAdvanceStatus(b, "No-Show")}
                            className="px-2.5 py-1 rounded-lg border border-border hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 dark:hover:text-amber-300 text-muted-foreground text-[11px] font-semibold transition disabled:opacity-50"
                          >
                            No-Show
                          </button>
                        </>
                      ) : b.status === "In Session" ? (
                        <button
                          type="button"
                          disabled={
                            isBusy ||
                            !canActorTransition(activeRole, "Completed")
                          }
                          onClick={() => onAdvanceStatus(b, "Completed")}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition disabled:opacity-50"
                        >
                          Complete &amp; Post Folio
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Closed State
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
