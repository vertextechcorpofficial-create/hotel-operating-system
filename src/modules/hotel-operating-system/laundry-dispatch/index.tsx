"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Loader2,
  Plus,
  Receipt,
  Shirt,
} from "lucide-react";
import { toast } from "sonner";
import { BatchesTab } from "./components/batches-tab";
import { LAUNDRY_ROLE_EVENT } from "./components/header-role-switcher";
import {
  FoliosDrawerModal,
  NewLaundryModal,
  type NewLaundryPayload,
  OverrideReasonModal,
} from "./components/modals";
import { TicketSummaryCard } from "./components/ticket-summary-card";
import { TicketsWorkspace } from "./components/tickets-workspace";
import {
  canRoleCreateLaundryOrder,
  canRolePerformSupervisorOverride,
  canRoleTransitionLaundryStatus,
} from "./lib/laundry-engine";
import type { LaundryDispatchPayload, LaundryRole } from "./types";

type LaundrySubView = "tickets" | "batches";

interface OverrideRequest {
  type: "reopen" | "damage_credit";
  orderId: string;
  title: string;
  description: string;
}

export default function LaundryDispatchModule() {
  const [data, setData] = useState<LaundryDispatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRole, setActiveRole] =
    useState<LaundryRole>("Laundry Supervisor");
  const [subView, setSubView] = useState<LaundrySubView>("tickets");
  const [selectedOrderId, setSelectedOrderId] = useState("LND-8041");

  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expressOnly, setExpressOnly] = useState(false);

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [foliosOpen, setFoliosOpen] = useState(false);
  const [overrideReq, setOverrideReq] = useState<OverrideRequest | null>(null);
  const [mutating, setMutating] = useState(false);

  const fetchLaundryData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hos/laundry-dispatch", {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: LaundryDispatchPayload;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(
          json.error || "Failed to load Laundry & Valet Dispatch."
        );
      }
      setData(json.data);
      setSelectedOrderId((prev) => {
        if (prev && json.data!.orders.some((o) => o.id === prev)) {
          return prev;
        }
        return json.data!.orders[0]?.id || "";
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Laundry & Valet Dispatch."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLaundryData();
  }, [fetchLaundryData]);

  useEffect(() => {
    const onRoleChange = (e: Event) => {
      const next = (e as CustomEvent<LaundryRole>).detail;
      if (next) setActiveRole(next);
    };
    window.addEventListener(LAUNDRY_ROLE_EVENT, onRoleChange);
    return () => window.removeEventListener(LAUNDRY_ROLE_EVENT, onRoleChange);
  }, []);

  const patchOrder = async (
    orderId: string,
    body: Record<string, unknown>
  ): Promise<boolean> => {
    setMutating(true);
    try {
      const res = await fetch(
        `/api/hos/laundry-dispatch/${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: activeRole, ...body }),
        }
      );
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        tone?: "success" | "info" | "error";
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Laundry action failed.");
        return false;
      }
      if (json.message) {
        if (json.tone === "info") toast.info(json.message);
        else toast.success(json.message);
      }
      await fetchLaundryData();
      return true;
    } catch {
      toast.error("Network error updating laundry ticket.");
      return false;
    } finally {
      setMutating(false);
    }
  };

  const postBatchOrAlertAction = async (action: string) => {
    setMutating(true);
    try {
      const res = await fetch("/api/hos/laundry-dispatch/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        tone?: "success" | "info" | "error";
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Action failed.");
        return;
      }
      if (json.message) {
        if (json.tone === "error") toast.error(json.message);
        else if (json.tone === "info") toast.info(json.message);
        else toast.success(json.message);
      }
      await fetchLaundryData();
    } catch {
      toast.error("Network error communicating with Laundry API.");
    } finally {
      setMutating(false);
    }
  };

  const handleCreateOrder = async (payload: NewLaundryPayload) => {
    if (!canRoleCreateLaundryOrder(activeRole)) {
      toast.error(
        `Role "${activeRole}" is not permitted to create laundry tickets.`
      );
      return;
    }
    setMutating(true);
    try {
      const res = await fetch("/api/hos/laundry-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: activeRole, ...payload }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { id: string };
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error || "Failed to create ticket.");
        return;
      }
      setSelectedOrderId(json.data.id);
      setNewModalOpen(false);
      toast.success(json.message || `Created ticket ${json.data.id}.`);
      await fetchLaundryData();
    } catch {
      toast.error("Network error creating ticket.");
    } finally {
      setMutating(false);
    }
  };

  const handleRequestOverride = (
    type: "reopen" | "damage_credit",
    orderId: string
  ) => {
    if (!canRolePerformSupervisorOverride(activeRole)) {
      toast.error(
        `Role "${activeRole}" cannot perform supervisor overrides.`
      );
      return;
    }
    setOverrideReq({
      type,
      orderId,
      title: "Supervisor Audit Approval Required",
      description: `Provide an audit reason for action "${type}" on ${orderId} as ${activeRole}.`,
    });
  };

  const handleConfirmOverride = async (reason: string) => {
    if (!overrideReq) return;
    const ok = await patchOrder(overrideReq.orderId, {
      action: overrideReq.type,
      reason,
    });
    if (ok) {
      setOverrideReq(null);
    }
  };

  const handleDeleteTicket = async (orderId: string) => {
    if (!canRolePerformSupervisorOverride(activeRole)) {
      toast.error("Only Supervisors or System Admins can delete tickets.");
      return;
    }
    setMutating(true);
    try {
      const res = await fetch(
        `/api/hos/laundry-dispatch/${encodeURIComponent(orderId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: activeRole }),
        }
      );
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.success) {
        toast.error(json.error || "Failed to delete ticket.");
        return;
      }
      toast.info(json.message || `Ticket ${orderId} deleted.`);
      await fetchLaundryData();
    } catch {
      toast.error("Network error deleting ticket.");
    } finally {
      setMutating(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-[#1a68ff] dark:text-blue-400" />
          <span>Loading Laundry &amp; Valet Dry-Cleaning Tracker...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto" />
        <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
          Unable to load Laundry &amp; Valet Tracker
        </h2>
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void fetchLaundryData()}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const selectedOrder =
    data.orders.find((o) => o.id === selectedOrderId) || data.orders[0] || null;

  return (
    <div className="max-w-[1440px] w-full mx-auto px-2 sm:px-4 py-2 space-y-6">
      {/* Page Title & Metadata Header (Aligned 1-to-1 with HOS Modules) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 text-[#1a68ff] dark:text-blue-400 flex items-center justify-center">
              <Shirt className="w-4 h-4" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Laundry &amp; Valet Dry-Cleaning Tracker
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              P2 • Phase 3
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Track billable guest valet garments, Express/Standard SLA timers,
            outsourced vendor batches, and bulk hotel linen processing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0 whitespace-nowrap">
          <div className="inline-flex items-center bg-muted p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setSubView("tickets")}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition ${
                subView === "tickets"
                  ? "font-semibold bg-card text-foreground shadow-2xs"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              Tickets &amp; SLA Queue ({data.orders.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView("batches")}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition ${
                subView === "batches"
                  ? "font-semibold bg-card text-foreground shadow-2xs"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              Vendor Batches &amp; Linen
            </button>
          </div>

          <button
            type="button"
            onClick={() => setFoliosOpen(true)}
            className="inline-flex items-center gap-1.5 bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-2xs transition"
          >
            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Folios ({data.folios.length})</span>
          </button>

          <button
            type="button"
            disabled={mutating}
            onClick={() => void postBatchOrAlertAction("trigger_checkout_alert")}
            className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-2xs transition"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Test Early Checkout Alert</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canRoleCreateLaundryOrder(activeRole)) {
                toast.error(
                  `Role "${activeRole}" is not permitted to create laundry tickets.`
                );
                return;
              }
              setNewModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Laundry Ticket</span>
          </button>
        </div>
      </div>

      {/* Urgent Early-Checkout Guest Banner */}
      {data.checkoutAlert ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/90 dark:bg-red-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-red-900 dark:text-red-200">
                Urgent Front Desk Checkout Alert: Unreturned Guest Garments!
              </div>
              <p className="text-xs text-red-800 dark:text-red-300 mt-0.5">
                {data.checkoutAlert.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={mutating}
              onClick={() =>
                void patchOrder(data.checkoutAlert!.ticketId, {
                  action: "expedite",
                })
              }
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition"
            >
              Expedite &amp; Notify Runner
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={() =>
                void postBatchOrAlertAction("dismiss_checkout_alert")
              }
              className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-card text-red-700 dark:text-red-300 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {/* 2-Column Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8">
          {subView === "tickets" ? (
            <TicketsWorkspace
              orders={data.orders}
              selectedOrderId={selectedOrder?.id || ""}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              expressOnly={expressOnly}
              onTypeFilterChange={setTypeFilter}
              onStatusFilterChange={setStatusFilter}
              onExpressOnlyChange={setExpressOnly}
              onSelectOrder={setSelectedOrderId}
            />
          ) : (
            <BatchesTab
              vendorBatches={data.vendorBatches}
              linenStock={data.linenStock}
              mutating={mutating}
              onDispatchVendorBatch={() =>
                void postBatchOrAlertAction("dispatch_vendor_batch")
              }
            />
          )}
        </div>

        <TicketSummaryCard
          order={selectedOrder}
          mutating={mutating}
          onAdvanceStatus={(id) => {
            if (!canRoleTransitionLaundryStatus(activeRole)) {
              toast.error(
                `Role "${activeRole}" cannot transition laundry order states.`
              );
              return;
            }
            void patchOrder(id, { action: "advance" });
          }}
          onPostToFolio={(id) => {
            if (!canRoleTransitionLaundryStatus(activeRole)) {
              toast.error(
                `Role "${activeRole}" cannot post valet charges.`
              );
              return;
            }
            void patchOrder(id, { action: "post_folio" });
          }}
          onRequestOverride={handleRequestOverride}
          onDeleteTicket={(id) => void handleDeleteTicket(id)}
        />
      </div>

      {newModalOpen ? (
        <NewLaundryModal
          submitting={mutating}
          onClose={() => setNewModalOpen(false)}
          onSubmit={(payload) => void handleCreateOrder(payload)}
        />
      ) : null}

      {overrideReq ? (
        <OverrideReasonModal
          key={`${overrideReq.orderId}-${overrideReq.type}`}
          title={overrideReq.title}
          description={overrideReq.description}
          submitting={mutating}
          onClose={() => setOverrideReq(null)}
          onConfirm={(reason) => void handleConfirmOverride(reason)}
        />
      ) : null}

      {foliosOpen ? (
        <FoliosDrawerModal
          folios={data.folios}
          onClose={() => setFoliosOpen(false)}
        />
      ) : null}
    </div>
  );
}
