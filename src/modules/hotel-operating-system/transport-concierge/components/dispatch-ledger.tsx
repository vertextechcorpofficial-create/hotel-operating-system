"use client";

import { Search, Trash2 } from "lucide-react";
import {
  ALL_BOOKING_STATUSES,
  canActorManageBookings,
  canActorPerformTransition,
  canActorPostFolio,
  getStatusBadgeClasses,
  STATUS_TRANSITIONS,
} from "../lib/dispatch-engine";
import type {
  BookingStatus,
  DriverRoster,
  ReservationSource,
  TransportBooking,
  TransportRole,
  VehicleMaster,
} from "../types";

interface DispatchLedgerProps {
  bookings: TransportBooking[];
  vehicles: VehicleMaster[];
  drivers: DriverRoster[];
  reservations: ReservationSource[];
  currentRole: TransportRole;
  selectedBookingId: string | null;
  filterDate: string;
  filterStatus: string;
  filterVehicle: string;
  filterSearch: string;
  mutatingId: string | null;
  onFilterDateChange: (val: string) => void;
  onFilterStatusChange: (val: string) => void;
  onFilterVehicleChange: (val: string) => void;
  onFilterSearchChange: (val: string) => void;
  onResetFilters: () => void;
  onSelectBooking: (id: string) => void;
  onEditBooking: (booking: TransportBooking) => void;
  onDeleteBooking: (id: string) => void;
  onInitiateTransition: (booking: TransportBooking, targetState: BookingStatus) => void;
  onPostChargeToFolio: (booking: TransportBooking) => void;
}

export function DispatchLedger({
  bookings,
  vehicles,
  drivers,
  reservations,
  currentRole,
  selectedBookingId,
  filterDate,
  filterStatus,
  filterVehicle,
  filterSearch,
  mutatingId,
  onFilterDateChange,
  onFilterStatusChange,
  onFilterVehicleChange,
  onFilterSearchChange,
  onResetFilters,
  onSelectBooking,
  onEditBooking,
  onDeleteBooking,
  onInitiateTransition,
  onPostChargeToFolio,
}: DispatchLedgerProps) {
  const q = filterSearch.toLowerCase().trim();
  const filtered = bookings
    .filter((b) => {
      if (filterDate && b.date !== filterDate) return false;
      if (filterStatus !== "ALL" && b.status !== filterStatus) return false;
      if (filterVehicle !== "ALL" && b.vehicleId !== filterVehicle) return false;
      if (q) {
        const hay =
          `${b.id} ${b.guestName} ${b.flightNo} ${b.reservationId} ${b.room}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));

  const selectedBooking =
    bookings.find((item) => item.id === selectedBookingId) || null;

  return (
    <section className="p-5 space-y-5">
      {/* Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Service Date
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => onFilterDateChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-[#1a73e8]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Booking Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-[#1a73e8]"
          >
            <option value="ALL">All Statuses</option>
            {ALL_BOOKING_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Assigned Vehicle
          </label>
          <select
            value={filterVehicle}
            onChange={(e) => onFilterVehicleChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-[#1a73e8]"
          >
            <option value="ALL">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plate})
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            Search Guest, Flight #, or Booking ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => onFilterSearchChange(e.target.value)}
              placeholder="Search PR 103, Alexander Vance, RES-8841..."
              className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-[#1a73e8]"
            />
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Split Table + Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Ledger Table */}
        <div className="xl:col-span-8 border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border text-xs font-semibold text-foreground">
                  <th className="py-3 px-4">Time / ID</th>
                  <th className="py-3 px-4">Guest &amp; Folio</th>
                  <th className="py-3 px-4">Service &amp; Flight</th>
                  <th className="py-3 px-4">Fleet &amp; Driver</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {filtered.map((b) => {
                  const veh = vehicles.find((v) => v.id === b.vehicleId);
                  const drv = drivers.find((d) => d.id === b.driverId);
                  const isSelected = b.id === selectedBookingId;
                  const isDelayed = b.flightStatus?.includes("Delayed");

                  return (
                    <tr
                      key={b.id}
                      onClick={() => onSelectBooking(b.id)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-50/70 dark:bg-blue-950/35"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-foreground">
                          {b.pickupTime}{" "}
                          <span className="font-normal text-muted-foreground">
                            ({b.durationMins}m)
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {b.id}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-foreground">
                          {b.guestName}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {b.room} • {b.reservationId}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-foreground">
                          {b.serviceType} ({b.pax} pax)
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {b.flightNo && b.flightNo !== "N/A" ? (
                            <>
                              Flight: <strong>{b.flightNo}</strong>
                            </>
                          ) : (
                            "Local Transfer"
                          )}
                          {isDelayed ? (
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                              {b.flightStatus}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        {veh ? (
                          <div className="font-medium text-foreground">
                            {veh.name}
                          </div>
                        ) : (
                          <span className="italic text-amber-600 dark:text-amber-400">
                            Unassigned
                          </span>
                        )}
                        {drv ? (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {drv.name}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">
                            No Driver
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadgeClasses(
                            b.status
                          )}`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top text-right">
                        <div className="font-semibold text-foreground">
                          ₱{Number(b.rate).toLocaleString()}
                        </div>
                        {b.billed ? (
                          <span className="inline-block mt-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            Posted
                          </span>
                        ) : (
                          <span className="inline-block mt-0.5 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Unbilled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-xs text-muted-foreground">
                No transport bookings match your active filters.
              </p>
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-3 px-3 py-1.5 text-xs font-medium text-[#1a73e8] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                Reset Filters
              </button>
            </div>
          ) : null}
        </div>

        {/* Right Detail Inspector Card */}
        <div className="xl:col-span-4 border border-border rounded-xl p-4 bg-card text-card-foreground sticky top-20">
          {!selectedBooking ? (
            <div className="text-center py-12">
              <p className="text-xs font-medium text-muted-foreground">
                Select a booking row
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Inspect flight info, update trip status, post to guest_charges_hos,
                or view audit logs.
              </p>
            </div>
          ) : (
            <DetailInspector
              booking={selectedBooking}
              vehicles={vehicles}
              drivers={drivers}
              reservations={reservations}
              currentRole={currentRole}
              isMutating={mutatingId === selectedBooking.id}
              onEdit={() => onEditBooking(selectedBooking)}
              onDelete={() => onDeleteBooking(selectedBooking.id)}
              onTransition={(nextState) =>
                onInitiateTransition(selectedBooking, nextState)
              }
              onPostFolio={() => onPostChargeToFolio(selectedBooking)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

interface DetailInspectorProps {
  booking: TransportBooking;
  vehicles: VehicleMaster[];
  drivers: DriverRoster[];
  reservations: ReservationSource[];
  currentRole: TransportRole;
  isMutating: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTransition: (target: BookingStatus) => void;
  onPostFolio: () => void;
}

function DetailInspector({
  booking: b,
  vehicles,
  drivers,
  reservations,
  currentRole,
  isMutating,
  onEdit,
  onDelete,
  onTransition,
  onPostFolio,
}: DetailInspectorProps) {
  const veh = vehicles.find((v) => v.id === b.vehicleId);
  const drv = drivers.find((d) => d.id === b.driverId);
  const res = reservations.find((r) => r.id === b.reservationId);

  const possibleNext = STATUS_TRANSITIONS[b.status] || [];
  const isWalkIn = b.reservationId === "WALK-IN" || !b.folioId;
  const hasActiveFolio =
    res &&
    !res.status.toLowerCase().includes("checked-out") &&
    !res.status.toLowerCase().includes("cancelled") &&
    Boolean(b.folioId);
  const isCompleted = b.status === "Completed";
  const roleCanBill = canActorPostFolio(currentRole);

  let postBtnDisabled = isMutating;
  let postBtnLabel = isWalkIn
    ? "Settle Immediate Receipt"
    : `Post to Folio (${b.folioId || "None"})`;
  let postHelperText = "";

  if (b.billed) {
    postBtnDisabled = true;
    postBtnLabel = `Billed (${b.billingRef})`;
    postHelperText = "Duplicate posting prevented by folio rule.";
  } else if (!isCompleted) {
    postBtnDisabled = true;
    postHelperText = "Trip must reach Completed status before posting charges.";
  } else if (!isWalkIn && !hasActiveFolio) {
    postBtnDisabled = true;
    postHelperText = "Blocked: Reservation is closed or has no active folio.";
  } else if (!roleCanBill) {
    postBtnDisabled = true;
    postHelperText = `Role "${currentRole}" cannot post folio charges.`;
  } else if (isWalkIn) {
    postHelperText = "Non-resident booking routes to Immediate Settlement.";
  } else {
    postHelperText = `Ready to post ₱${Number(b.rate).toLocaleString()} to active folio ${b.folioId}.`;
  }

  const canEdit =
    canActorManageBookings(currentRole) &&
    !["Completed", "Cancelled", "No-Show"].includes(b.status);
  const canDelete = currentRole === "Admin" && !b.billed;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-[#1a73e8] dark:text-blue-400">
              {b.id}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadgeClasses(
                b.status
              )}`}
            >
              {b.status}
            </span>
          </div>
          <h3 className="text-sm font-bold text-foreground mt-1">
            {b.guestName}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {b.room} • Ref: {b.reservationId}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {canEdit ? (
            <button
              type="button"
              disabled={isMutating}
              onClick={onEdit}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={isMutating}
              onClick={onDelete}
              title="Delete unbilled record"
              className="p-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="bg-muted/50 rounded-xl p-3 border border-border space-y-2 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Schedule:</span>
          <span className="font-semibold text-foreground text-right">
            {b.serviceType} • {b.pickupTime} ({b.durationMins}m)
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Flight Info:</span>
          <span className="font-semibold text-foreground text-right">
            {b.flightNo || "N/A"}{" "}
            <span className="text-amber-700 dark:text-amber-400">
              ({b.flightStatus})
            </span>
          </span>
        </div>
        <div className="pt-1.5 border-t border-border space-y-1">
          <div>
            <span className="text-muted-foreground">From:</span>{" "}
            <strong className="text-foreground">{b.pickupLocation}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">To:</span>{" "}
            <strong className="text-foreground">{b.dropoffLocation}</strong>
          </div>
        </div>
        <div className="pt-1.5 border-t border-border flex justify-between gap-2">
          <span className="text-muted-foreground">Vehicle / Driver:</span>
          <span className="font-semibold text-foreground text-right">
            {veh ? veh.plate : "TBD"} • {drv ? drv.name : "Unassigned"}
          </span>
        </div>
      </div>

      <div>
        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Workflow Transitions ({currentRole})
        </span>
        {possibleNext.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {possibleNext.map((nextState) => {
              const allowed = canActorPerformTransition(currentRole, nextState);
              const isDanger =
                nextState === "Cancelled" || nextState === "No-Show";
              const btnStyle = isDanger
                ? "bg-card text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40"
                : "bg-[#1a73e8] text-white hover:bg-[#1557b0]";

              return (
                <button
                  key={nextState}
                  type="button"
                  disabled={!allowed || isMutating}
                  title={
                    !allowed
                      ? "Role not authorized for this transition"
                      : undefined
                  }
                  onClick={() => onTransition(nextState)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${btnStyle} ${
                    !allowed || isMutating ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                >
                  → {nextState}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            Terminal state ({b.status}).
          </p>
        )}
      </div>

      <div
        className={`p-3.5 rounded-xl border space-y-2 ${
          b.billed
            ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
            : "bg-muted/50 border-border"
        }`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-foreground">
            Folio &amp; Settlement
          </span>
          <span className="font-bold text-foreground">
            ₱{Number(b.rate).toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          onClick={onPostFolio}
          disabled={postBtnDisabled}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
            b.billed
              ? "bg-emerald-600 text-white cursor-default"
              : postBtnDisabled
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          <span>{postBtnLabel}</span>
        </button>
        <p className="text-[11px] text-muted-foreground">{postHelperText}</p>
      </div>

      <div>
        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Audit Log
        </span>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {b.auditLog
            .slice()
            .reverse()
            .map((log, i) => (
              <div
                key={`${log.timestamp}-${i}`}
                className="p-2 rounded-lg bg-muted/50 border border-border text-[11px]"
              >
                <div className="flex justify-between font-semibold text-foreground">
                  <span>{log.action}</span>
                  <span className="text-muted-foreground font-normal">
                    {log.timestamp}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Actor: <strong className="text-foreground">{log.actor}</strong>{" "}
                  • {log.prev} →{" "}
                  <strong className="text-foreground">{log.next}</strong>
                </div>
                {log.reason ? (
                  <div className="text-muted-foreground italic">
                    &ldquo;{log.reason}&rdquo;
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
