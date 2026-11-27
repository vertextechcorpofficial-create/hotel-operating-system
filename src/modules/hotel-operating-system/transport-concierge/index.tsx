"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Clock,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AvailabilityCalendar } from "./components/availability-calendar";
import { DispatchLedger } from "./components/dispatch-ledger";
import { FolioPostingsTab } from "./components/folio-postings-tab";
import { KpiCards } from "./components/kpi-cards";
import {
  BookingModal,
  type BookingFormPayload,
  CancelExceptionModal,
  FleetRosterModal,
  ManifestModal,
} from "./components/modals";
import {
  canActorManageBookings,
  canActorPerformTransition,
} from "./lib/dispatch-engine";
import type {
  BookingStatus,
  TransportBooking,
  TransportDispatchPayload,
  TransportRole,
} from "./types";

type ActiveTab = "dispatch" | "timeline" | "folios";

export default function TransportConciergeModule() {
  const [data, setData] = useState<TransportDispatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentRole, setCurrentRole] = useState<TransportRole>("Concierge");
  const [activeTab, setActiveTab] = useState<ActiveTab>("dispatch");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null
  );

  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterVehicle, setFilterVehicle] = useState<string>("ALL");
  const [filterSearch, setFilterSearch] = useState<string>("");

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] =
    useState<TransportBooking | null>(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<{
    bookingId: string;
    targetState: BookingStatus;
  } | null>(null);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const [manifestOpen, setManifestOpen] = useState(false);
  const [fleetOpen, setFleetOpen] = useState(false);
  const [togglingVehicleId, setTogglingVehicleId] = useState<string | null>(
    null
  );
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const fetchDispatchData = useCallback(async (showRefreshToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hos/transport-concierge", {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: TransportDispatchPayload;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Failed to load transport dispatch data.");
      }

      setData(json.data);
      setFilterDate((prev) => prev || json.data!.meta.businessDate);
      setSelectedBookingId((prev) => {
        if (prev && json.data!.bookings.some((b) => b.id === prev)) {
          return prev;
        }
        return json.data!.bookings[1]?.id || json.data!.bookings[0]?.id || null;
      });
      if (showRefreshToast) {
        toast.info("Dispatch ledger refreshed.");
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load transport dispatch data.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDispatchData(false);
  }, [fetchDispatchData]);

  const handleRoleChange = (nextRole: TransportRole) => {
    setCurrentRole(nextRole);
    toast.info(`Switched active session role to ${nextRole}`);
  };

  const handleOpenNewBooking = () => {
    if (!canActorManageBookings(currentRole)) {
      toast.error(`Role "${currentRole}" cannot create or edit bookings.`);
      return;
    }
    setEditingBooking(null);
    setBookingModalOpen(true);
  };

  const handleOpenEditBooking = (booking: TransportBooking) => {
    if (!canActorManageBookings(currentRole)) {
      toast.error(`Role "${currentRole}" cannot create or edit bookings.`);
      return;
    }
    setEditingBooking(booking);
    setBookingModalOpen(true);
  };

  const handleSaveBooking = async (
    payload: BookingFormPayload
  ): Promise<string | null> => {
    setSubmittingBooking(true);
    try {
      const isEdit = Boolean(editingBooking);
      const url = isEdit
        ? `/api/hos/transport-concierge/${encodeURIComponent(
            editingBooking!.id
          )}`
        : "/api/hos/transport-concierge";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { action: "update", role: currentRole, ...payload }
        : { role: currentRole, ...payload };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: TransportBooking;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        return json.error || "Failed to save transport booking.";
      }

      setBookingModalOpen(false);
      setSelectedBookingId(json.data.id);
      toast.success(
        isEdit
          ? `Booking ${json.data.id} updated & audit logged.`
          : `Created ${json.data.id} (${json.data.status}).`
      );
      await fetchDispatchData(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Network error saving booking.";
    } finally {
      setSubmittingBooking(false);
    }
  };

  const applyTransition = async (
    bookingId: string,
    targetState: BookingStatus,
    reason?: string
  ) => {
    setMutatingId(bookingId);
    try {
      const res = await fetch(
        `/api/hos/transport-concierge/${encodeURIComponent(bookingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "transition",
            role: currentRole,
            targetState,
            reason,
          }),
        }
      );
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to update booking status.");
        return;
      }
      toast.success(`${bookingId} updated to ${targetState}.`);
      await fetchDispatchData(false);
    } catch {
      toast.error("Network error updating status.");
    } finally {
      setMutatingId(null);
    }
  };

  const handleInitiateTransition = (
    booking: TransportBooking,
    targetState: BookingStatus
  ) => {
    if (!canActorPerformTransition(currentRole, targetState)) {
      toast.error(`Permission denied for ${currentRole}.`);
      return;
    }
    if (
      targetState === "Driver Assigned" &&
      (!booking.vehicleId || !booking.driverId)
    ) {
      toast.error(
        "Assign both vehicle and driver before setting Driver Assigned."
      );
      handleOpenEditBooking(booking);
      return;
    }
    if (targetState === "Cancelled" || targetState === "No-Show") {
      setCancelTarget({ bookingId: booking.id, targetState });
      return;
    }
    void applyTransition(booking.id, targetState, "Standard workflow update");
  };

  const handleConfirmCancelException = async (reason: string) => {
    if (!cancelTarget) return;
    setSubmittingCancel(true);
    try {
      await applyTransition(
        cancelTarget.bookingId,
        cancelTarget.targetState,
        reason
      );
      setCancelTarget(null);
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handlePostChargeToFolio = async (booking: TransportBooking) => {
    setMutatingId(booking.id);
    try {
      const res = await fetch(
        `/api/hos/transport-concierge/${encodeURIComponent(booking.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "post_folio",
            role: currentRole,
          }),
        }
      );
      const json = (await res.json()) as {
        success?: boolean;
        data?: { posting?: { targetAccount: string; amount: number } };
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to post charge to folio.");
        return;
      }
      toast.success(
        `Posted ₱${Number(booking.rate).toLocaleString()} to ${
          json.data?.posting?.targetAccount || "folio"
        }.`
      );
      await fetchDispatchData(false);
    } catch {
      toast.error("Network error posting charge.");
    } finally {
      setMutatingId(null);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    setMutatingId(bookingId);
    try {
      const res = await fetch(
        `/api/hos/transport-concierge/${encodeURIComponent(bookingId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: currentRole }),
        }
      );
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to delete booking.");
        return;
      }
      setSelectedBookingId(null);
      toast.info(`Unbilled record ${bookingId} deleted.`);
      await fetchDispatchData(false);
    } catch {
      toast.error("Network error deleting booking.");
    } finally {
      setMutatingId(null);
    }
  };

  const handleToggleVehicle = async (vehId: string) => {
    if (currentRole !== "Admin") {
      toast.error("Only Admin role can modify vehicle master status.");
      return;
    }
    setTogglingVehicleId(vehId);
    try {
      const res = await fetch("/api/hos/transport-concierge/fleet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: currentRole, vehicleId: vehId }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { name: string; active: boolean };
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || "Failed to update vehicle status.");
        return;
      }
      toast.info(
        `${json.data.name} marked as ${
          json.data.active ? "In Service" : "Maintenance"
        }.`
      );
      await fetchDispatchData(false);
    } catch {
      toast.error("Network error updating vehicle.");
    } finally {
      setTogglingVehicleId(null);
    }
  };

  const handleResetFilters = () => {
    setFilterDate(data?.meta.businessDate || "");
    setFilterStatus("ALL");
    setFilterVehicle("ALL");
    setFilterSearch("");
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-[#1a73e8] dark:text-blue-400" />
          <span>Loading Concierge &amp; Transport Dispatch...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto" />
        <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
          Unable to load Transport Dispatch
        </h2>
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void fetchDispatchData(false)}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const activeDate = filterDate || data.meta.businessDate;
  const dayBookings = data.bookings.filter(
    (b) => !activeDate || b.date === activeDate
  );
  const delayedFlights = dayBookings.filter((b) =>
    b.flightStatus?.includes("Delayed")
  );
  const canCreate = canActorManageBookings(currentRole);

  return (
    <div className="max-w-[1440px] w-full mx-auto px-2 sm:px-4 py-2 space-y-5">
      {/* Page Title & Primary Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Concierge &amp; Transport Dispatch
          </h1>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Business Date: {activeDate}</span>
            <span className="text-border">•</span>
            <span>
              {data.meta.turnaroundBufferMins}-min Turnaround Buffer Active
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentRole}
            onChange={(e) =>
              handleRoleChange(e.target.value as TransportRole)
            }
            aria-label="Switch HOS Role"
            className="rounded-lg border border-blue-200 dark:border-blue-800 bg-card text-xs font-semibold text-[#1a73e8] dark:text-blue-400 px-3 py-2 focus:outline-none cursor-pointer shadow-2xs"
          >
            <option value="Concierge">Role: Concierge / FD</option>
            <option value="Driver">Role: Driver</option>
            <option value="Billing">Role: Billing</option>
            <option value="Admin">Role: Admin / QA</option>
          </select>

          <button
            type="button"
            onClick={() => void fetchDispatchData(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-card text-foreground border border-border hover:bg-muted transition shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setManifestOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-card text-foreground border border-border hover:bg-muted transition shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
            Pickup Manifest
          </button>

          <button
            type="button"
            onClick={() => setFleetOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-card text-foreground border border-border hover:bg-muted transition shadow-2xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
            Fleet &amp; Roster
          </button>

          <button
            type="button"
            onClick={handleOpenNewBooking}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0] transition shadow-xs ${
              !canCreate ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New Transport Booking
          </button>
        </div>
      </div>

      {/* Status / Flight Alert Banner */}
      <div className="bg-[#fffbeb] dark:bg-amber-950/30 border border-[#fde68a] dark:border-amber-800/60 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-semibold border border-amber-300 dark:border-amber-700">
            Dispatch Active
          </span>
          <span className="text-foreground/90">
            Connected to{" "}
            <strong>
              reservations_hos ({data.meta.reservationsSource})
            </strong>
            , <strong>guest_charges_hos</strong>, and{" "}
            <strong>
              transport_bookings_hos ({data.meta.directusBookingsMode})
            </strong>
            .
            {delayedFlights.length > 0 ? (
              <>
                {" "}
                Flight alert:{" "}
                <strong>{delayedFlights[0].flightNo}</strong>{" "}
                {delayedFlights[0].flightStatus}.
              </>
            ) : null}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">
          Role: <strong className="text-foreground">{currentRole}</strong>
        </span>
      </div>

      {/* 3-Column KPI Cards */}
      <KpiCards dayBookings={dayBookings} />

      {/* Sub-view Navigation Tabs */}
      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-2xs overflow-hidden no-print">
        <div className="px-5 pt-3 border-b border-border flex items-center justify-between flex-wrap gap-4">
          <nav className="flex space-x-6" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setActiveTab("dispatch")}
              className={`border-b-2 pb-3 text-xs flex items-center gap-2 transition ${
                activeTab === "dispatch"
                  ? "border-[#1a73e8] dark:border-blue-400 font-semibold text-[#1a73e8] dark:text-blue-400"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Transport Dispatch Ledger</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  activeTab === "dispatch"
                    ? "bg-blue-50 dark:bg-blue-950/60 text-[#1a73e8] dark:text-blue-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {dayBookings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className={`border-b-2 pb-3 text-xs flex items-center gap-2 transition ${
                activeTab === "timeline"
                  ? "border-[#1a73e8] dark:border-blue-400 font-semibold text-[#1a73e8] dark:text-blue-400"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Vehicle &amp; Driver Availability Calendar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("folios")}
              className={`border-b-2 pb-3 text-xs flex items-center gap-2 transition ${
                activeTab === "folios"
                  ? "border-[#1a73e8] dark:border-blue-400 font-semibold text-[#1a73e8] dark:text-blue-400"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Posted Folio Charges (guest_charges_hos)</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  activeTab === "folios"
                    ? "bg-blue-50 dark:bg-blue-950/60 text-[#1a73e8] dark:text-blue-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {data.folioPostings.length}
              </span>
            </button>
          </nav>
        </div>

        {activeTab === "dispatch" ? (
          <DispatchLedger
            bookings={data.bookings}
            vehicles={data.vehicles}
            drivers={data.drivers}
            reservations={data.reservations}
            currentRole={currentRole}
            selectedBookingId={selectedBookingId}
            filterDate={activeDate}
            filterStatus={filterStatus}
            filterVehicle={filterVehicle}
            filterSearch={filterSearch}
            mutatingId={mutatingId}
            onFilterDateChange={setFilterDate}
            onFilterStatusChange={setFilterStatus}
            onFilterVehicleChange={setFilterVehicle}
            onFilterSearchChange={setFilterSearch}
            onResetFilters={handleResetFilters}
            onSelectBooking={setSelectedBookingId}
            onEditBooking={handleOpenEditBooking}
            onDeleteBooking={(id) => void handleDeleteBooking(id)}
            onInitiateTransition={handleInitiateTransition}
            onPostChargeToFolio={(b) => void handlePostChargeToFolio(b)}
          />
        ) : null}

        {activeTab === "timeline" ? (
          <AvailabilityCalendar
            filterDate={activeDate}
            vehicles={data.vehicles}
            bookings={data.bookings}
            onSelectBookingFromTimeline={(id) => {
              setSelectedBookingId(id);
              setActiveTab("dispatch");
            }}
          />
        ) : null}

        {activeTab === "folios" ? (
          <FolioPostingsTab folioPostings={data.folioPostings} />
        ) : null}
      </div>

      {/* Modals */}
      {bookingModalOpen ? (
        <BookingModal
          key={editingBooking?.id || "new"}
          open={bookingModalOpen}
          editingBooking={editingBooking}
          defaultDate={activeDate}
          reservations={data.reservations}
          vehicles={data.vehicles}
          drivers={data.drivers}
          bookings={data.bookings}
          submitting={submittingBooking}
          onClose={() => setBookingModalOpen(false)}
          onSubmit={handleSaveBooking}
        />
      ) : null}

      {cancelTarget ? (
        <CancelExceptionModal
          key={`${cancelTarget.bookingId}-${cancelTarget.targetState}`}
          open={Boolean(cancelTarget)}
          bookingId={cancelTarget.bookingId}
          targetState={cancelTarget.targetState}
          submitting={submittingCancel}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancelException}
        />
      ) : null}

      <ManifestModal
        open={manifestOpen}
        filterDate={activeDate}
        currentRole={currentRole}
        bookings={data.bookings}
        vehicles={data.vehicles}
        drivers={data.drivers}
        onClose={() => setManifestOpen(false)}
      />

      <FleetRosterModal
        open={fleetOpen}
        vehicles={data.vehicles}
        drivers={data.drivers}
        currentRole={currentRole}
        togglingVehicleId={togglingVehicleId}
        onClose={() => setFleetOpen(false)}
        onToggleVehicle={(vehId) => void handleToggleVehicle(vehId)}
      />
    </div>
  );
}
