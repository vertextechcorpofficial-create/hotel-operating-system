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
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Service Date
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => onFilterDateChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#1a73e8]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Booking Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#1a73e8]"
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
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Assigned Vehicle
          </label>
          <select
            value={filterVehicle}
            onChange={(e) => onFilterVehicleChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#1a73e8]"
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
          <label className="block text-[11px] font-medium text-gray-500 mb-1">
            Search Guest, Flight #, or Booking ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => onFilterSearchChange(e.target.value)}
              placeholder="Search PR 103, Alexander Vance, RES-8841..."
              className="w-full rounded-lg border border-gray-200 pl-8 pr-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#1a73e8]"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Split Table + Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Ledger Table */}
        <div className="xl:col-span-8 border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-700">
                  <th className="py-3 px-4">Time / ID</th>
                  <th className="py-3 px-4">Guest &amp; Folio</th>
                  <th className="py-3 px-4">Service &amp; Flight</th>
                  <th className="py-3 px-4">Fleet &amp; Driver</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
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
                        isSelected ? "bg-blue-50/70" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-gray-900">
                          {b.pickupTime}{" "}
                          <span className="font-normal text-gray-400">
                            ({b.durationMins}m)
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-gray-400 mt-0.5">
                          {b.id}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-semibold text-gray-900">
                          {b.guestName}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {b.room} • {b.reservationId}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="font-medium text-gray-800">
                          {b.serviceType} ({b.pax} pax)
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {b.flightNo && b.flightNo !== "N/A" ? (
                            <>
                              Flight: <strong>{b.flightNo}</strong>
                            </>
                          ) : (
                            "Local Transfer"
                          )}
                          {isDelayed ? (
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800">
                              {b.flightStatus}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        {veh ? (
                          <div className="font-medium text-gray-800">
                            {veh.name}
                          </div>
                        ) : (
                          <span className="italic text-amber-600">Unassigned</span>
                        )}
                        {drv ? (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {drv.name}
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400">No Driver</div>
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
                        <div className="font-semibold text-gray-900">
                          ₱{Number(b.rate).toLocaleString()}
                        </div>
                        {b.billed ? (
                          <span className="inline-block mt-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Posted
                          </span>
                        ) : (
                          <span className="inline-block mt-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
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
              <p className="text-xs text-gray-400">
                No transport bookings match your active filters.
              </p>
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-3 px-3 py-1.5 text-xs font-medium text-[#1a73e8] bg-blue-50 rounded-lg hover:bg-blue-100"
              >
                Reset Filters
              </button>
            </div>
          ) : null}
        </div>

        {/* Right Detail Inspector Card */}
        <div className="xl:col-span-4 border border-gray-200 rounded-xl p-4 bg-white sticky top-20">
          {!selectedBooking ? (
            <div className="text-center py-12">
              <p className="text-xs font-medium text-gray-500">
                Select a booking row
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
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
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-[#1a73e8]">
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
          <h3 className="text-sm font-bold text-gray-900 mt-1">{b.guestName}</h3>
          <p className="text-[11px] text-gray-500">
            {b.room} • Ref: {b.reservationId}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {canEdit ? (
            <button
              type="button"
              disabled={isMutating}
              onClick={onEdit}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/80 space-y-2 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">Schedule:</span>
          <span className="font-semibold text-gray-900 text-right">
            {b.serviceType} • {b.pickupTime} ({b.durationMins}m)
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">Flight Info:</span>
          <span className="font-semibold text-gray-900 text-right">
            {b.flightNo || "N/A"}{" "}
            <span className="text-amber-700">({b.flightStatus})</span>
          </span>
        </div>
        <div className="pt-1.5 border-t border-gray-200/70 space-y-1">
          <div>
            <span className="text-gray-400">From:</span>{" "}
            <strong className="text-gray-800">{b.pickupLocation}</strong>
          </div>
          <div>
            <span className="text-gray-400">To:</span>{" "}
            <strong className="text-gray-800">{b.dropoffLocation}</strong>
          </div>
        </div>
        <div className="pt-1.5 border-t border-gray-200/70 flex justify-between gap-2">
          <span className="text-gray-500">Vehicle / Driver:</span>
          <span className="font-semibold text-gray-900 text-right">
            {veh ? veh.plate : "TBD"} • {drv ? drv.name : "Unassigned"}
          </span>
        </div>
      </div>

      <div>
        <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
          Workflow Transitions ({currentRole})
        </span>
        {possibleNext.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {possibleNext.map((nextState) => {
              const allowed = canActorPerformTransition(currentRole, nextState);
              const isDanger =
                nextState === "Cancelled" || nextState === "No-Show";
              const btnStyle = isDanger
                ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
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
          <p className="text-[11px] text-gray-400 italic">
            Terminal state ({b.status}).
          </p>
        )}
      </div>

      <div
        className={`p-3.5 rounded-xl border space-y-2 ${
          b.billed
            ? "bg-emerald-50/60 border-emerald-200"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-800">Folio &amp; Settlement</span>
          <span className="font-bold text-gray-900">
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
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          <span>{postBtnLabel}</span>
        </button>
        <p className="text-[11px] text-gray-500">{postHelperText}</p>
      </div>

      <div>
        <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
          Audit Log
        </span>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {b.auditLog
            .slice()
            .reverse()
            .map((log, i) => (
              <div
                key={`${log.timestamp}-${i}`}
                className="p-2 rounded-lg bg-gray-50 border border-gray-200/70 text-[11px]"
              >
                <div className="flex justify-between font-semibold text-gray-800">
                  <span>{log.action}</span>
                  <span className="text-gray-400 font-normal">
                    {log.timestamp}
                  </span>
                </div>
                <div className="text-gray-600">
                  Actor: <strong>{log.actor}</strong> • {log.prev} →{" "}
                  <strong>{log.next}</strong>
                </div>
                {log.reason ? (
                  <div className="text-gray-400 italic">&ldquo;{log.reason}&rdquo;</div>
                ) : null}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
