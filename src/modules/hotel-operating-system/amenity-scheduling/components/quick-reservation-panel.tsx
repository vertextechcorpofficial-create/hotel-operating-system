"use client";

import type { RefObject } from "react";
import {
  AMENITY_HOURS,
  AMENITY_PACKAGES,
  validateSlotReservation,
} from "../lib/slot-engine";
import type {
  AmenityBooking,
  AmenityReservationOption,
  AmenityResource,
  AmenityRole,
  GuestBillingMode,
} from "../types";

interface QuickReservationPanelProps {
  guestInputRef: RefObject<HTMLInputElement | null>;
  dateFilter: string;
  resources: AmenityResource[];
  bookings: AmenityBooking[];
  reservations: AmenityReservationOption[];
  activeRole: AmenityRole;
  billingMode: GuestBillingMode;
  selectedReservationId: string;
  guestText: string;
  packageId: string;
  resourceId: string;
  startHour: number;
  therapist1Id: string;
  therapist2Id: string;
  submitting: boolean;
  onBillingModeChange: (mode: GuestBillingMode) => void;
  onReservationSelect: (resId: string) => void;
  onGuestTextChange: (val: string) => void;
  onPackageChange: (pkgId: string) => void;
  onResourceChange: (resId: string) => void;
  onStartHourChange: (hour: number) => void;
  onTherapist1Change: (id: string) => void;
  onTherapist2Change: (id: string) => void;
  onReset: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function QuickReservationPanel({
  guestInputRef,
  dateFilter,
  resources,
  bookings,
  reservations,
  activeRole,
  billingMode,
  selectedReservationId,
  guestText,
  packageId,
  resourceId,
  startHour,
  therapist1Id,
  therapist2Id,
  submitting,
  onBillingModeChange,
  onReservationSelect,
  onGuestTextChange,
  onPackageChange,
  onResourceChange,
  onStartHourChange,
  onTherapist1Change,
  onTherapist2Change,
  onReset,
  onSubmit,
}: QuickReservationPanelProps) {
  const pkg =
    AMENITY_PACKAGES.find((p) => p.id === packageId) || AMENITY_PACKAGES[0];
  const physicalRooms = resources.filter(
    (r) => r.category !== "Therapist" && r.active
  );
  const therapists = resources.filter(
    (r) => r.category === "Therapist" && r.active
  );

  const selectedTherapists: string[] = [];
  if (pkg.requiredTherapists >= 1 && therapist1Id) {
    selectedTherapists.push(therapist1Id);
  }
  if (pkg.requiredTherapists === 2 && therapist2Id) {
    selectedTherapists.push(therapist2Id);
  }

  const validation = validateSlotReservation({
    date: dateFilter,
    startHour,
    packageId: pkg.id,
    resourceId,
    therapistIds: selectedTherapists,
    resources,
    bookings,
  });

  const resObj = resources.find((r) => r.id === resourceId);
  const t1Obj = resources.find((r) => r.id === therapist1Id);
  const t2Obj = resources.find((r) => r.id === therapist2Id);
  const lockedNames = [resObj?.name || ""];
  if (pkg.requiredTherapists >= 1 && t1Obj) {
    lockedNames.push(t1Obj.name.replace("Therapist: ", ""));
  }
  if (pkg.requiredTherapists === 2 && t2Obj) {
    lockedNames.push(t2Obj.name.replace("Therapist: ", ""));
  }

  const isTherapistRole = activeRole === "Therapist";

  return (
    <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs p-6 sticky top-20 space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <span className="text-muted-foreground font-bold text-sm">→</span>
        <h2 className="text-base font-bold text-foreground">
          Quick Slot Reservation
        </h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2 bg-muted p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onBillingModeChange("inhouse")}
            className={`py-1.5 text-xs rounded-lg transition ${
              billingMode === "inhouse"
                ? "font-semibold bg-card text-foreground shadow-2xs"
                : "font-medium text-muted-foreground hover:text-foreground"
            }`}
          >
            In-House Room
          </button>
          <button
            type="button"
            onClick={() => onBillingModeChange("walkin")}
            className={`py-1.5 text-xs rounded-lg transition ${
              billingMode === "walkin"
                ? "font-semibold bg-card text-foreground shadow-2xs"
                : "font-medium text-muted-foreground hover:text-foreground"
            }`}
          >
            Walk-In (POS)
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-foreground">
              Guest Name &amp; Room ID <span className="text-red-500">*</span>
            </label>
            {billingMode === "inhouse" && reservations.length > 0 ? (
              <select
                value={selectedReservationId}
                onChange={(e) => onReservationSelect(e.target.value)}
                aria-label="Quick pick reservation"
                className="text-[11px] font-medium text-[#1a68ff] dark:text-blue-400 bg-transparent focus:outline-none cursor-pointer max-w-[145px] truncate dark:[&>option]:bg-card dark:[&>option]:text-foreground"
              >
                {reservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}: {r.guestName}
                  </option>
                ))}
                <option value="CUSTOM">Custom Guest</option>
              </select>
            ) : null}
          </div>
          <input
            ref={guestInputRef}
            type="text"
            required
            value={guestText}
            onChange={(e) => onGuestTextChange(e.target.value)}
            placeholder="e.g. Room 302 — Carlos Mendoza"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-[#1a68ff]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Package / Treatment Service <span className="text-red-500">*</span>
          </label>
          <select
            value={packageId}
            onChange={(e) => onPackageChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
          >
            {AMENITY_PACKAGES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.requiredTherapists === 2 ? " [2 Therapists]" : ""} (
                {p.durationMins}m + {p.bufferMins}m buffer) — ₱
                {p.price.toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Physical Resource <span className="text-red-500">*</span>
            </label>
            <select
              value={resourceId}
              onChange={(e) => onResourceChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
            >
              {physicalRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Start Hour <span className="text-red-500">*</span>
            </label>
            <select
              value={startHour}
              onChange={(e) => onStartHourChange(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
            >
              {AMENITY_HOURS.map((h) => {
                const label =
                  h < 12
                    ? `${String(h).padStart(2, "0")}:00 AM`
                    : h === 12
                    ? "12:00 PM"
                    : `${String(h - 12).padStart(2, "0")}:00 PM`;
                return (
                  <option key={h} value={h}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {pkg.requiredTherapists >= 1 ? (
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Primary Therapist / Attendant
              </label>
              <select
                value={therapist1Id}
                onChange={(e) => onTherapist1Change(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
              >
                <option value="">None / Select Therapist</option>
                {therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {pkg.requiredTherapists === 2 ? (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Second Therapist (Couples/Group Lock){" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={therapist2Id}
                  onChange={(e) => onTherapist2Change(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-[#1a68ff]"
                >
                  <option value="">Select Second Therapist</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Summary Breakdown Box */}
        <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-2.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Billing Routing</span>
            <span className="font-semibold text-foreground">
              {billingMode === "inhouse"
                ? "Auto-Post to guest_charges_hos"
                : "POS Cash/Card Walk-In"}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Treatment + Buffer Lock</span>
            <span className="font-semibold text-foreground">
              {pkg.durationMins}m + {pkg.bufferMins}m buffer
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Locked Resources</span>
            <span className="font-semibold text-foreground text-right max-w-[170px] truncate">
              {lockedNames.filter(Boolean).join(" + ")}
            </span>
          </div>
          <div className="pt-2.5 border-t border-border flex items-center justify-between">
            <span className="font-bold text-foreground text-sm">
              Package Total
            </span>
            <span className="font-extrabold text-lg text-[#1a68ff] dark:text-blue-400">
              ₱
              {pkg.price.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {!validation.valid ? (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300 font-medium space-y-1">
            {validation.errors.map((err, idx) => (
              <div key={`${err}-${idx}`}>• {err}</div>
            ))}
          </div>
        ) : null}

        <div className="space-y-2 pt-1">
          <button
            type="submit"
            disabled={submitting || isTherapistRole}
            className="w-full bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>
              {submitting ? "Locking Slot..." : "Confirm & Lock Slot"}
            </span>
            <span>✓</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="w-full bg-card hover:bg-muted text-foreground font-semibold text-xs py-2.5 px-4 rounded-xl border border-border transition flex items-center justify-center gap-1.5"
          >
            <span>↺ Clear Selection</span>
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground italic text-center leading-relaxed">
          Submitting locks physical rooms &amp; staff in{" "}
          <code className="font-mono text-foreground/80">
            amenity_bookings_hos
          </code>{" "}
          and queues charge routing to{" "}
          <code className="font-mono text-foreground/80">guest_charges_hos</code>.
        </p>
      </form>
    </div>
  );
}
