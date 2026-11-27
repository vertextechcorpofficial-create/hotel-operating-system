"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  checkResourceConflicts,
  DEFAULT_SERVICE_RATES,
} from "../lib/dispatch-engine";
import type {
  BookingStatus,
  DriverRoster,
  FlightStatus,
  ReservationSource,
  ServiceType,
  TransportBooking,
  TransportRole,
  VehicleMaster,
} from "../types";

export interface BookingFormPayload {
  reservationId: string;
  numericReservationId: number | null;
  guestName: string;
  room: string;
  folioId: string | null;
  serviceType: ServiceType;
  flightNo: string;
  flightStatus: FlightStatus;
  date: string;
  pickupTime: string;
  durationMins: number;
  pax: number;
  pickupLocation: string;
  dropoffLocation: string;
  vehicleId: string;
  driverId: string;
  rate: number;
  editReason?: string;
}

interface BookingModalProps {
  open: boolean;
  editingBooking: TransportBooking | null;
  defaultDate: string;
  reservations: ReservationSource[];
  vehicles: VehicleMaster[];
  drivers: DriverRoster[];
  bookings: TransportBooking[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: BookingFormPayload) => Promise<string | null>;
}

export function BookingModal({
  open,
  editingBooking,
  defaultDate,
  reservations,
  vehicles,
  drivers,
  bookings,
  submitting,
  onClose,
  onSubmit,
}: BookingModalProps) {
  const firstRes = reservations[0];
  const [reservationId, setReservationId] = useState(
    editingBooking?.reservationId || firstRes?.id || "WALK-IN"
  );
  const [guestName, setGuestName] = useState(
    editingBooking?.guestName ??
    (firstRes && firstRes.id !== "WALK-IN" ? firstRes.guestName : "")
  );
  const [serviceType, setServiceType] = useState<ServiceType>(
    editingBooking?.serviceType || "Airport Pickup"
  );
  const [flightNo, setFlightNo] = useState(
    editingBooking
      ? editingBooking.flightNo === "N/A"
        ? ""
        : editingBooking.flightNo
      : ""
  );
  const [flightStatus, setFlightStatus] = useState<FlightStatus>(
    editingBooking?.flightStatus || "On Time"
  );
  const [date, setDate] = useState(editingBooking?.date || defaultDate);
  const [pickupTime, setPickupTime] = useState(
    editingBooking?.pickupTime || "13:00"
  );
  const [durationMins, setDurationMins] = useState(
    editingBooking?.durationMins ?? 60
  );
  const [pax, setPax] = useState(editingBooking?.pax ?? 2);
  const [pickupLocation, setPickupLocation] = useState(
    editingBooking?.pickupLocation || ""
  );
  const [dropoffLocation, setDropoffLocation] = useState(
    editingBooking?.dropoffLocation || ""
  );
  const [vehicleId, setVehicleId] = useState(editingBooking?.vehicleId || "");
  const [driverId, setDriverId] = useState(editingBooking?.driverId || "");
  const [rate, setRate] = useState(
    editingBooking?.rate ?? DEFAULT_SERVICE_RATES["Airport Pickup"]
  );
  const [editReason, setEditReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!open) return null;

  const selectedRes = reservations.find((r) => r.id === reservationId);

  const handleReservationChange = (newResId: string) => {
    setReservationId(newResId);
    const found = reservations.find((r) => r.id === newResId);
    if (found) {
      setGuestName(found.id === "WALK-IN" ? "" : found.guestName);
    }
  };

  const handleServiceTypeChange = (nextType: ServiceType) => {
    setServiceType(nextType);
    if (!editingBooking) {
      setRate(DEFAULT_SERVICE_RATES[nextType] ?? 2500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const clientCheck = checkResourceConflicts({
      excludeBookingId: editingBooking?.id || null,
      date,
      pickupTime,
      durationMins,
      vehicleId: vehicleId || undefined,
      driverId: driverId || undefined,
      pax,
      bookings,
      vehicles,
      drivers,
    });

    if (!clientCheck.valid) {
      setValidationError(clientCheck.message || "Dispatch conflict detected.");
      return;
    }

    if (editingBooking && !editReason.trim()) {
      setValidationError("Please provide a Schedule Change Reason.");
      return;
    }

    const err = await onSubmit({
      reservationId,
      numericReservationId: selectedRes?.numericReservationId ?? null,
      guestName: guestName.trim(),
      room: selectedRes ? selectedRes.room : "N/A",
      folioId: selectedRes?.folioId ?? null,
      serviceType,
      flightNo: flightNo.trim().toUpperCase() || "N/A",
      flightStatus,
      date,
      pickupTime,
      durationMins,
      pax,
      pickupLocation: pickupLocation.trim(),
      dropoffLocation: dropoffLocation.trim(),
      vehicleId,
      driverId,
      rate,
      editReason: editReason.trim() || undefined,
    });

    if (err) {
      setValidationError(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-2xl w-full overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {editingBooking
                ? `Edit / Reschedule ${editingBooking.id}`
                : "New Transport Dispatch Booking"}
            </h2>
            <p className="text-xs text-gray-500">
              Enforces reservation folio linkage, vehicle capacity, and 30-min
              turnaround buffer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs"
        >
          {validationError ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 space-y-1">
              <div className="font-bold">Dispatch Conflict / Validation Error</div>
              <p>{validationError}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Reservation / Guest Source (reservations_hos)
              </label>
              <select
                value={reservationId}
                onChange={(e) => handleReservationChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              >
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} • {r.guestName} ({r.room}) [{r.status}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Guest Full Name *
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter guest name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex flex-wrap items-center justify-between gap-2">
            {!selectedRes ? (
              <span className="text-gray-600">
                Select a reservation or Walk-In Guest profile.
              </span>
            ) : selectedRes.id === "WALK-IN" ? (
              <>
                <span className="text-gray-600">
                  Walk-in guest: routes payment to Immediate Settlement instead of
                  room folio.
                </span>
                <span className="px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Immediate Settlement
                </span>
              </>
            ) : selectedRes.folioId ? (
              <>
                <span className="text-gray-600">
                  {selectedRes.room} • Stay: {selectedRes.arrival} to{" "}
                  {selectedRes.departure} • Active Folio: {selectedRes.folioId}
                </span>
                <span className="px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Folio Eligible ({selectedRes.folioId})
                </span>
              </>
            ) : (
              <>
                <span className="text-gray-600">
                  Reservation {selectedRes.id} is {selectedRes.status}. No active
                  folio available.
                </span>
                <span className="px-2 py-0.5 rounded font-semibold bg-red-50 text-red-700 border border-red-200">
                  No Active Folio
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Service Type *
              </label>
              <select
                value={serviceType}
                onChange={(e) =>
                  handleServiceTypeChange(e.target.value as ServiceType)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              >
                <option value="Airport Pickup">Airport Pickup</option>
                <option value="Airport Drop-off">Airport Drop-off</option>
                <option value="Chauffeur Charter">Chauffeur Charter</option>
                <option value="Local Tour">Local Tour</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Flight Number
              </label>
              <input
                type="text"
                value={flightNo}
                onChange={(e) => setFlightNo(e.target.value)}
                placeholder="e.g. PR 103"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs uppercase focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Flight Status
              </label>
              <select
                value={flightStatus}
                onChange={(e) =>
                  setFlightStatus(e.target.value as FlightStatus)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              >
                <option value="On Time">On Time</option>
                <option value="Delayed (+45m)">Delayed (+45m)</option>
                <option value="Diverted">Diverted</option>
                <option value="Landed">Landed</option>
                <option value="N/A (Local)">N/A (Local)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Pickup Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Pickup Time *
              </label>
              <input
                type="time"
                required
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Duration (Mins) *
              </label>
              <input
                type="number"
                required
                min={15}
                max={720}
                step={15}
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Passengers *
              </label>
              <input
                type="number"
                required
                min={1}
                max={15}
                value={pax}
                onChange={(e) => setPax(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Pickup Location *
              </label>
              <input
                type="text"
                required
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g. NAIA Terminal 1 VIP Bay"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Drop-off Location *
              </label>
              <input
                type="text"
                required
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                placeholder="e.g. VOS Grand Hotel Main Lobby"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800">
                Vehicle &amp; Chauffeur Assignment
              </span>
              <span className="text-[11px] text-[#1a73e8] font-medium">
                Checks overlap + 30m turnaround
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Vehicle
                </label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value="">-- Assign Later (Requested) --</option>
                  {vehicles.map((v) => {
                    const check = checkResourceConflicts({
                      excludeBookingId: editingBooking?.id || null,
                      date,
                      pickupTime,
                      durationMins,
                      vehicleId: v.id,
                      pax,
                      bookings,
                      vehicles,
                      drivers,
                    });
                    const tag = !v.active
                      ? " [MAINTENANCE]"
                      : pax > v.capacity
                        ? ` [CAP MAX ${v.capacity}]`
                        : !check.valid
                          ? " [CONFLICT]"
                          : "";

                    return (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.plate}) • Max {v.capacity} pax{tag}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Chauffeur (/hos/staff-roster)
                </label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
                >
                  <option value="">-- Assign Later --</option>
                  {drivers.map((d) => {
                    const check = checkResourceConflicts({
                      excludeBookingId: editingBooking?.id || null,
                      date,
                      pickupTime,
                      durationMins,
                      driverId: d.id,
                      bookings,
                      vehicles,
                      drivers,
                    });
                    const tag = !d.onDuty
                      ? " [OFF-DUTY]"
                      : !check.valid
                        ? " [CONFLICT / SHIFT]"
                        : "";

                    return (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.shiftStart}-{d.shiftEnd}){tag}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Transfer Rate (PHP) *
              </label>
              <input
                type="number"
                required
                min={0}
                step={50}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            {editingBooking ? (
              <div>
                <label className="block font-semibold text-amber-800 mb-1">
                  Schedule Change Reason *
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Flight PR 103 delayed +45m"
                  className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            ) : null}
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0] disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Transport Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CancelExceptionModalProps {
  open: boolean;
  bookingId: string | null;
  targetState: BookingStatus | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function CancelExceptionModal({
  open,
  bookingId,
  targetState,
  submitting,
  onClose,
  onConfirm,
}: CancelExceptionModalProps) {
  const [reason, setReason] = useState("");

  if (!open || !bookingId || !targetState) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    await onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            Mark {bookingId} as {targetState}
          </h2>
          <p className="text-xs text-gray-500">
            Mandatory audit log reason required for post-dispatch status
            exceptions.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Audit Reason *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for cancellation or no-show..."
              className="w-full rounded-lg border border-gray-300 p-3 focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Logging..." : "Confirm & Log Audit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ManifestModalProps {
  open: boolean;
  filterDate: string;
  currentRole: TransportRole;
  bookings: TransportBooking[];
  vehicles: VehicleMaster[];
  drivers: DriverRoster[];
  onClose: () => void;
}

export function ManifestModal({
  open,
  filterDate,
  currentRole,
  bookings,
  vehicles,
  drivers,
  onClose,
}: ManifestModalProps) {
  if (!open) return null;

  const list = bookings
    .filter(
      (b) => b.date === filterDate && !["Cancelled", "No-Show"].includes(b.status)
    )
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-4xl w-full overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between no-print">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Chronological Guest Pickup Manifest
            </h2>
            <p className="text-xs text-gray-500">
              Dispatch sheet for Concierge Desk &amp; Chauffeurs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-xs font-semibold text-white"
            >
              Print Manifest
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap justify-between items-end border-b border-gray-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                VOS Grand Hotel — Daily Guest Pickup &amp; Transfer Manifest
              </h3>
              <p className="text-xs text-gray-500">
                Service Date: <strong>{filterDate}</strong> • Generated by{" "}
                {currentRole}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-gray-100 text-gray-700">
              Active Trips: {list.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Guest / Room</th>
                  <th className="p-2.5">Flight #</th>
                  <th className="p-2.5">Route</th>
                  <th className="p-2.5">Vehicle &amp; Driver</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-400">
                      No active transfers scheduled for {filterDate}.
                    </td>
                  </tr>
                ) : (
                  list.map((b) => {
                    const veh = vehicles.find((v) => v.id === b.vehicleId);
                    const drv = drivers.find((d) => d.id === b.driverId);
                    return (
                      <tr key={b.id}>
                        <td className="p-2.5 font-bold">{b.pickupTime}</td>
                        <td className="p-2.5">
                          <strong>{b.guestName}</strong>
                          <br />
                          <span className="text-gray-500">
                            {b.room} ({b.pax} pax)
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold">
                          {b.flightNo}{" "}
                          <span className="text-gray-500">
                            ({b.flightStatus})
                          </span>
                        </td>
                        <td className="p-2.5">
                          {b.pickupLocation} →{" "}
                          <strong>{b.dropoffLocation}</strong>
                        </td>
                        <td className="p-2.5">
                          {veh ? `${veh.name} (${veh.plate})` : "TBD"}
                          <br />
                          <span className="text-gray-500">
                            {drv ? drv.name : "Unassigned"}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold">{b.status}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FleetRosterModalProps {
  open: boolean;
  vehicles: VehicleMaster[];
  drivers: DriverRoster[];
  currentRole: TransportRole;
  togglingVehicleId: string | null;
  onClose: () => void;
  onToggleVehicle: (vehId: string) => void;
}

export function FleetRosterModal({
  open,
  vehicles,
  drivers,
  currentRole,
  togglingVehicleId,
  onClose,
  onToggleVehicle,
}: FleetRosterModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-3xl w-full overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Fleet Master Data &amp; Staff Roster Sync
            </h2>
            <p className="text-xs text-gray-500">
              Connected to /hos/staff-roster • Admin role manages vehicle active
              status ({currentRole} active)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Hotel Fleet Master Registry
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-xl border border-gray-200 flex items-center justify-between bg-gray-50"
                >
                  <div>
                    <div className="font-bold text-xs text-gray-900">
                      {v.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {v.plate} • {v.type} • Max {v.capacity} pax
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={togglingVehicleId === v.id}
                    onClick={() => onToggleVehicle(v.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${v.active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                      } ${togglingVehicleId === v.id ? "opacity-50" : ""}`}
                  >
                    {v.active ? "In Service" : "Maintenance"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Chauffeur Shift Roster (/hos/staff-roster)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {drivers.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl border border-gray-200 flex items-center justify-between bg-gray-50"
                >
                  <div>
                    <div className="font-bold text-xs text-gray-900">
                      {d.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      License: {d.license} • Shift: {d.shiftStart}–{d.shiftEnd}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${d.onDuty
                        ? "bg-blue-50 text-[#1a73e8] border border-blue-200"
                        : "bg-gray-200 text-gray-600"
                      }`}
                  >
                    {d.onDuty ? "On Shift" : "Off Duty"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
