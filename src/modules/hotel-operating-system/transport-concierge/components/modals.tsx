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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-2xl w-full overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {editingBooking
                ? `Edit / Reschedule ${editingBooking.id}`
                : "New Transport Dispatch Booking"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Enforces reservation folio linkage, vehicle capacity, and 30-min
              turnaround buffer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs"
        >
          {validationError ? (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 space-y-1">
              <div className="font-bold">Dispatch Conflict / Validation Error</div>
              <p>{validationError}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Reservation / Guest Source (reservations_hos)
              </label>
              <select
                value={reservationId}
                onChange={(e) => handleReservationChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              >
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} • {r.guestName} ({r.room}) [{r.status}]
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Guest Full Name *
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter guest name"
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border flex flex-wrap items-center justify-between gap-2">
            {!selectedRes ? (
              <span className="text-muted-foreground">
                Select a reservation or Walk-In Guest profile.
              </span>
            ) : selectedRes.id === "WALK-IN" ? (
              <>
                <span className="text-muted-foreground">
                  Walk-in guest: routes payment to Immediate Settlement instead of
                  room folio.
                </span>
                <span className="px-2 py-0.5 rounded font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                  Immediate Settlement
                </span>
              </>
            ) : selectedRes.folioId ? (
              <>
                <span className="text-muted-foreground">
                  {selectedRes.room} • Stay: {selectedRes.arrival} to{" "}
                  {selectedRes.departure} • Active Folio: {selectedRes.folioId}
                </span>
                <span className="px-2 py-0.5 rounded font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Folio Eligible ({selectedRes.folioId})
                </span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">
                  Reservation {selectedRes.id} is {selectedRes.status}. No active
                  folio available.
                </span>
                <span className="px-2 py-0.5 rounded font-semibold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                  No Active Folio
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Service Type *
              </label>
              <select
                value={serviceType}
                onChange={(e) =>
                  handleServiceTypeChange(e.target.value as ServiceType)
                }
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              >
                <option value="Airport Pickup">Airport Pickup</option>
                <option value="Airport Drop-off">Airport Drop-off</option>
                <option value="Chauffeur Charter">Chauffeur Charter</option>
                <option value="Local Tour">Local Tour</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Flight Number
              </label>
              <input
                type="text"
                value={flightNo}
                onChange={(e) => setFlightNo(e.target.value)}
                placeholder="e.g. PR 103"
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs uppercase focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Flight Status
              </label>
              <select
                value={flightStatus}
                onChange={(e) =>
                  setFlightStatus(e.target.value as FlightStatus)
                }
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
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
              <label className="block font-semibold text-foreground mb-1">
                Pickup Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Pickup Time *
              </label>
              <input
                type="time"
                required
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
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
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Passengers *
              </label>
              <input
                type="number"
                required
                min={1}
                max={15}
                value={pax}
                onChange={(e) => setPax(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Pickup Location *
              </label>
              <input
                type="text"
                required
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g. NAIA Terminal 1 VIP Bay"
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            <div>
              <label className="block font-semibold text-foreground mb-1">
                Drop-off Location *
              </label>
              <input
                type="text"
                required
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                placeholder="e.g. VOS Grand Hotel Main Lobby"
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">
                Vehicle &amp; Chauffeur Assignment
              </span>
              <span className="text-[11px] text-[#1a73e8] dark:text-blue-400 font-medium">
                Checks overlap + 30m turnaround
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Vehicle
                </label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
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
                <label className="block font-semibold text-foreground mb-1">
                  Chauffeur (/hos/staff-roster)
                </label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs focus:outline-none focus:border-[#1a73e8]"
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
              <label className="block font-semibold text-foreground mb-1">
                Transfer Rate (PHP) *
              </label>
              <input
                type="number"
                required
                min={0}
                step={50}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#1a73e8]"
              />
            </div>
            {editingBooking ? (
              <div>
                <label className="block font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  Schedule Change Reason *
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Flight PR 103 delayed +45m"
                  className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-foreground px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            ) : null}
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-muted-foreground hover:bg-muted"
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">
            Mark {bookingId} as {targetState}
          </h2>
          <p className="text-xs text-muted-foreground">
            Mandatory audit log reason required for post-dispatch status
            exceptions.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">
              Audit Reason *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for cancellation or no-show..."
              className="w-full rounded-lg border border-border bg-background text-foreground p-3 focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-muted-foreground hover:bg-muted"
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-4xl w-full overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between no-print">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Chronological Guest Pickup Manifest
            </h2>
            <p className="text-xs text-muted-foreground">
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
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap justify-between items-end border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                VOS Grand Hotel — Daily Guest Pickup &amp; Transfer Manifest
              </h3>
              <p className="text-xs text-muted-foreground">
                Service Date: <strong className="text-foreground">{filterDate}</strong> • Generated by{" "}
                {currentRole}
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-muted text-foreground">
              Active Trips: {list.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border text-foreground font-semibold">
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5">Guest / Room</th>
                  <th className="p-2.5">Flight #</th>
                  <th className="p-2.5">Route</th>
                  <th className="p-2.5">Vehicle &amp; Driver</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No active transfers scheduled for {filterDate}.
                    </td>
                  </tr>
                ) : (
                  list.map((b) => {
                    const veh = vehicles.find((v) => v.id === b.vehicleId);
                    const drv = drivers.find((d) => d.id === b.driverId);
                    return (
                      <tr key={b.id}>
                        <td className="p-2.5 font-bold text-foreground">{b.pickupTime}</td>
                        <td className="p-2.5">
                          <strong className="text-foreground">{b.guestName}</strong>
                          <br />
                          <span className="text-muted-foreground">
                            {b.room} ({b.pax} pax)
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold text-foreground">
                          {b.flightNo}{" "}
                          <span className="text-muted-foreground">
                            ({b.flightStatus})
                          </span>
                        </td>
                        <td className="p-2.5 text-muted-foreground">
                          {b.pickupLocation} →{" "}
                          <strong className="text-foreground">{b.dropoffLocation}</strong>
                        </td>
                        <td className="p-2.5 text-foreground">
                          {veh ? `${veh.name} (${veh.plate})` : "TBD"}
                          <br />
                          <span className="text-muted-foreground">
                            {drv ? drv.name : "Unassigned"}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold text-foreground">{b.status}</td>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xl max-w-3xl w-full overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Fleet Master Data &amp; Staff Roster Sync
            </h2>
            <p className="text-xs text-muted-foreground">
              Connected to /hos/staff-roster • Admin role manages vehicle active
              status ({currentRole} active)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Hotel Fleet Master Registry
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-xl border border-border flex items-center justify-between bg-muted/40"
                >
                  <div>
                    <div className="font-bold text-xs text-foreground">
                      {v.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {v.plate} • {v.type} • Max {v.capacity} pax
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={togglingVehicleId === v.id}
                    onClick={() => onToggleVehicle(v.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                      v.active
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900"
                    } ${togglingVehicleId === v.id ? "opacity-50" : ""}`}
                  >
                    {v.active ? "In Service" : "Maintenance"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Chauffeur Shift Roster (/hos/staff-roster)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {drivers.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl border border-border flex items-center justify-between bg-muted/40"
                >
                  <div>
                    <div className="font-bold text-xs text-foreground">
                      {d.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      License: {d.license} • Shift: {d.shiftStart}–{d.shiftEnd}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                      d.onDuty
                        ? "bg-blue-50 dark:bg-blue-950/60 text-[#1a73e8] dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        : "bg-muted text-muted-foreground"
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
