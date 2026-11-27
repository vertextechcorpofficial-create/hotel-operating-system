"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  List,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AvailabilityGrid } from "./components/availability-grid";
import { CatalogLedgerTab } from "./components/catalog-ledger-tab";
import { AMENITY_ROLE_EVENT } from "./components/header-role-switcher";
import { OverrideModal } from "./components/override-modal";
import { QuickReservationPanel } from "./components/quick-reservation-panel";
import {
  AMENITY_PACKAGES,
  canActorManageCatalog,
  canActorTransition,
  validateSlotReservation,
} from "./lib/slot-engine";
import type {
  AmenityBooking,
  AmenityBookingStatus,
  AmenityRole,
  AmenitySchedulingPayload,
  GuestBillingMode,
  ResourceCategory,
} from "./types";

type SubView = "grid" | "catalog";

export default function AmenitySchedulingModule() {
  const [data, setData] = useState<AmenitySchedulingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRole, setActiveRole] = useState<AmenityRole>("Receptionist");
  const [subView, setSubView] = useState<SubView>("grid");

  const [dateFilter, setDateFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Quick Reservation state
  const guestInputRef = useRef<HTMLInputElement | null>(null);
  const [billingMode, setBillingMode] = useState<GuestBillingMode>("inhouse");
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [guestText, setGuestText] = useState("Room 408 — Elena Rostova");
  const [packageId, setPackageId] = useState("signature_massage");
  const [resourceId, setResourceId] = useState("RES-SPA-01");
  const [startHour, setStartHour] = useState(13);
  const [therapist1Id, setTherapist1Id] = useState("STF-TH-01");
  const [therapist2Id, setTherapist2Id] = useState("STF-TH-02");
  const [submitting, setSubmitting] = useState(false);

  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<{
    bookingId: string;
    targetState: AmenityBookingStatus;
  } | null>(null);
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const fetchAmenityData = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hos/amenity-scheduling", {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: AmenitySchedulingPayload;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Failed to load amenity schedule.");
      }

      const payload = json.data;
      setData(payload);
      setDateFilter((prev) => prev || payload.meta.businessDate);

      if (payload.reservations.length > 0) {
        setSelectedReservationId((prev) => {
          if (prev) return prev;
          const first = payload.reservations[0];
          setGuestText(`${first.room} — ${first.guestName}`);
          return first.id;
        });
      }

      if (showToast) {
        toast.info("Amenity schedule refreshed.");
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load amenity schedule.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAmenityData(false);
  }, [fetchAmenityData]);

  useEffect(() => {
    const onRoleChange = (e: Event) => {
      const next = (e as CustomEvent<AmenityRole>).detail;
      if (next) setActiveRole(next);
    };
    window.addEventListener(AMENITY_ROLE_EVENT, onRoleChange);
    return () => window.removeEventListener(AMENITY_ROLE_EVENT, onRoleChange);
  }, []);

  const handleBillingModeChange = (mode: GuestBillingMode) => {
    setBillingMode(mode);
    if (mode === "inhouse") {
      const resObj = data?.reservations.find(
        (r) => r.id === selectedReservationId
      );
      setGuestText(
        resObj
          ? `${resObj.room} — ${resObj.guestName}`
          : "Room 408 — Elena Rostova"
      );
    } else {
      setGuestText("Walk-In Guest — Miguel Tan");
    }
  };

  const handleReservationSelect = (resId: string) => {
    setSelectedReservationId(resId);
    if (resId === "CUSTOM") {
      setGuestText("");
      guestInputRef.current?.focus();
      return;
    }
    const found = data?.reservations.find((r) => r.id === resId);
    if (found) {
      setGuestText(`${found.room} — ${found.guestName}`);
    }
  };

  const handlePackageChange = (nextPkgId: string) => {
    setPackageId(nextPkgId);
    const pkg = AMENITY_PACKAGES.find((p) => p.id === nextPkgId);
    if (pkg && data) {
      const matchingRoom = data.resources.find(
        (r) => r.category === pkg.resourceCategory && r.active
      );
      if (matchingRoom) {
        setResourceId(matchingRoom.id);
      }
    }
  };

  const handleSelectOpenSlot = (
    entityId: string,
    category: ResourceCategory,
    hour: number
  ) => {
    setStartHour(hour);
    if (category === "Therapist") {
      setTherapist1Id(entityId);
    } else {
      setResourceId(entityId);
    }
    toast.info(
      `Pre-filled ${String(hour).padStart(
        2,
        "0"
      )}:00 slot in Quick Reservation panel.`
    );
  };

  const handleResetForm = () => {
    setPackageId("signature_massage");
    setResourceId("RES-SPA-01");
    setStartHour(13);
    setTherapist1Id("STF-TH-01");
    setTherapist2Id("STF-TH-02");
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const activeDate = dateFilter || data.meta.businessDate;
    const pkg =
      AMENITY_PACKAGES.find((p) => p.id === packageId) || AMENITY_PACKAGES[0];
    const therapistIds: string[] = [];
    if (pkg.requiredTherapists >= 1 && therapist1Id) {
      therapistIds.push(therapist1Id);
    }
    if (pkg.requiredTherapists === 2 && therapist2Id) {
      therapistIds.push(therapist2Id);
    }

    const check = validateSlotReservation({
      date: activeDate,
      startHour,
      packageId,
      resourceId,
      therapistIds,
      resources: data.resources,
      bookings: data.bookings,
    });

    if (!check.valid) {
      toast.error(
        "Cannot lock slot: Resolve resource or buffer conflict first."
      );
      return;
    }

    const resMatch =
      billingMode === "inhouse"
        ? data.reservations.find((r) => r.id === selectedReservationId)
        : undefined;

    setSubmitting(true);
    try {
      const res = await fetch("/api/hos/amenity-scheduling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          date: activeDate,
          guest: guestText.trim(),
          reservationId:
            billingMode === "walkin" ? "WALK-IN" : resMatch?.id || "CUSTOM",
          numericReservationId: resMatch?.numericReservationId ?? null,
          billingMode,
          packageId,
          resourceId,
          therapistIds,
          startHour,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: AmenityBooking;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || "Failed to create slot reservation.");
        return;
      }

      toast.success(
        `Confirmed ${json.data.id}: Locked room, staff & ${json.data.bufferMins}m buffer.`
      );
      await fetchAmenityData(false);
    } catch {
      toast.error("Network error creating slot reservation.");
    } finally {
      setSubmitting(false);
    }
  };

  const applyStatusTransition = async (
    bookingId: string,
    targetState: AmenityBookingStatus,
    reason?: string
  ) => {
    setMutatingId(bookingId);
    try {
      const res = await fetch(
        `/api/hos/amenity-scheduling/${encodeURIComponent(bookingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: activeRole,
            targetState,
            reason,
          }),
        }
      );
      const json = (await res.json()) as {
        success?: boolean;
        data?: AmenityBooking;
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to update booking status.");
        return;
      }

      if (targetState === "Completed" && json.data) {
        const isWalkIn = json.data.billingMode === "walkin";
        toast.success(
          `Session Completed! ₱${json.data.price.toLocaleString()} ${
            isWalkIn ? "settled via POS" : "auto-posted to guest_charges_hos"
          }.`
        );
      } else {
        toast.info(`${bookingId} transitioned to ${targetState}.`);
      }

      await fetchAmenityData(false);
    } catch {
      toast.error("Network error updating booking status.");
    } finally {
      setMutatingId(null);
    }
  };

  const handleAdvanceStatus = (
    booking: AmenityBooking,
    targetState: AmenityBookingStatus
  ) => {
    if (!canActorTransition(activeRole, targetState)) {
      toast.error(
        `Permission Denied: Role "${activeRole}" cannot set "${targetState}".`
      );
      return;
    }

    if (targetState === "Cancelled" || targetState === "No-Show") {
      setOverrideTarget({ bookingId: booking.id, targetState });
      return;
    }

    void applyStatusTransition(booking.id, targetState);
  };

  const handleConfirmOverride = async (reason: string) => {
    if (!overrideTarget) return;
    setSubmittingOverride(true);
    try {
      await applyStatusTransition(
        overrideTarget.bookingId,
        overrideTarget.targetState,
        reason
      );
      setOverrideTarget(null);
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleToggleResource = async (resId: string) => {
    if (!canActorManageCatalog(activeRole)) {
      toast.error(
        "Only HOS Operations Managers can activate/deactivate catalog resources."
      );
      return;
    }

    setTogglingId(resId);
    try {
      const res = await fetch("/api/hos/amenity-scheduling/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          resourceId: resId,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { name: string; active: boolean };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || "Failed to update resource status.");
        return;
      }

      toast.info(
        `${json.data.name} is now ${
          json.data.active
            ? "Active"
            : "Deactivated (Historical bookings preserved)"
        }.`
      );
      await fetchAmenityData(false);
    } catch {
      toast.error("Network error updating resource.");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-[#1a68ff] dark:text-blue-400" />
          <span>Loading Spa, Wellness &amp; Amenity Scheduling...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto" />
        <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
          Unable to load Amenity Scheduling
        </h2>
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void fetchAmenityData(false)}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const activeDate = dateFilter || data.meta.businessDate;

  return (
    <div className="max-w-[1440px] w-full mx-auto px-2 sm:px-4 py-2 space-y-6">
      {/* Page Title & Metadata Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 text-[#1a68ff] dark:text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Spa, Wellness &amp; Amenity Slot Booking
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-muted text-muted-foreground border border-border">
              Priority: P3 • Phase 4
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Reserve capacity-limited spa therapists, massage suites, cabanas,
            tennis courts, and KTV rooms with atomic locking, sanitization
            buffers, and automated folio billing.
          </p>
        </div>

        <div className="inline-flex items-center bg-muted p-1 rounded-xl border border-border self-start lg:self-center shrink-0 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setSubView("grid")}
            className={`px-3.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
              subView === "grid"
                ? "font-semibold bg-card text-foreground shadow-2xs"
                : "font-medium text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar
              className={`w-3.5 h-3.5 ${
                subView === "grid" ? "text-[#1a68ff] dark:text-blue-400" : ""
              }`}
            />
            Resource &amp; Therapist Grid
          </button>
          <button
            type="button"
            onClick={() => setSubView("catalog")}
            className={`px-3.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
              subView === "catalog"
                ? "font-semibold bg-card text-foreground shadow-2xs"
                : "font-medium text-muted-foreground hover:text-foreground"
            }`}
          >
            <List
              className={`w-3.5 h-3.5 ${
                subView === "catalog" ? "text-[#1a68ff] dark:text-blue-400" : ""
              }`}
            />
            Catalog &amp; Folio Ledger ({data.folioPostings.length})
          </button>
        </div>
      </div>

      {/* Two-Column Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-5">
          {subView === "grid" ? (
            <AvailabilityGrid
              dateFilter={activeDate}
              categoryFilter={categoryFilter}
              statusFilter={statusFilter}
              resources={data.resources}
              bookings={data.bookings}
              activeRole={activeRole}
              mutatingId={mutatingId}
              onDateFilterChange={setDateFilter}
              onCategoryFilterChange={setCategoryFilter}
              onStatusFilterChange={setStatusFilter}
              onFocusQuickBooking={() => {
                guestInputRef.current?.focus();
                toast.info(
                  "Configure guest, package, and slot in the Quick Reservation panel on the right."
                );
              }}
              onSelectOpenSlot={handleSelectOpenSlot}
              onAdvanceStatus={handleAdvanceStatus}
            />
          ) : (
            <CatalogLedgerTab
              resources={data.resources}
              folioPostings={data.folioPostings}
              activeRole={activeRole}
              togglingId={togglingId}
              onToggleResource={(id) => void handleToggleResource(id)}
            />
          )}
        </div>

        <div className="xl:col-span-4">
          <QuickReservationPanel
            guestInputRef={guestInputRef}
            dateFilter={activeDate}
            resources={data.resources}
            bookings={data.bookings}
            reservations={data.reservations}
            activeRole={activeRole}
            billingMode={billingMode}
            selectedReservationId={selectedReservationId}
            guestText={guestText}
            packageId={packageId}
            resourceId={resourceId}
            startHour={startHour}
            therapist1Id={therapist1Id}
            therapist2Id={therapist2Id}
            submitting={submitting}
            onBillingModeChange={handleBillingModeChange}
            onReservationSelect={handleReservationSelect}
            onGuestTextChange={setGuestText}
            onPackageChange={handlePackageChange}
            onResourceChange={setResourceId}
            onStartHourChange={setStartHour}
            onTherapist1Change={setTherapist1Id}
            onTherapist2Change={setTherapist2Id}
            onReset={handleResetForm}
            onSubmit={handleSubmitBooking}
          />
        </div>
      </div>

      {overrideTarget ? (
        <OverrideModal
          key={`${overrideTarget.bookingId}-${overrideTarget.targetState}`}
          bookingId={overrideTarget.bookingId}
          targetState={overrideTarget.targetState}
          submitting={submittingOverride}
          onClose={() => setOverrideTarget(null)}
          onConfirm={handleConfirmOverride}
        />
      ) : null}
    </div>
  );
}
