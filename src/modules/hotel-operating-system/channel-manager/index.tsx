"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfigModal, type ChannelConfigDraft } from "./components/config-modal";
import { CHANNEL_ROLE_EVENT } from "./components/header-role-switcher";
import { MatrixWorkspace } from "./components/matrix-workspace";
import { SyncLogsTab } from "./components/sync-logs-tab";
import {
  WebhookSimulatorCard,
  type SimulateWebhookPayload,
} from "./components/webhook-simulator-card";
import {
  canRoleManageChannels,
  canRoleResolveOverbooking,
} from "./lib/channel-engine";
import type { ChannelManagerPayload, ChannelRole } from "./types";

type ChannelSubView = "matrix" | "logs";

export default function ChannelManagerModule() {
  const [data, setData] = useState<ChannelManagerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeRole, setActiveRole] = useState<ChannelRole>("Manager");
  const [subView, setSubView] = useState<ChannelSubView>("matrix");
  const [selectedMatrixChannelId, setSelectedMatrixChannelId] =
    useState("OTA-BKG");
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [mutating, setMutating] = useState(false);

  const retryTimersRef = useRef<number[]>([]);

  const fetchChannelData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hos/channel-manager", {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: ChannelManagerPayload;
        error?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "Failed to load OTA Channel Manager.");
      }
      setData(json.data);
      setSelectedMatrixChannelId((prev) => {
        if (prev && json.data!.channels.some((c) => c.id === prev)) {
          return prev;
        }
        return json.data!.channels[0]?.id || "OTA-BKG";
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load OTA Channel Manager."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChannelData();
  }, [fetchChannelData]);

  useEffect(() => {
    const onRoleChange = (e: Event) => {
      const next = (e as CustomEvent<ChannelRole>).detail;
      if (next) setActiveRole(next);
    };
    window.addEventListener(CHANNEL_ROLE_EVENT, onRoleChange);
    return () => window.removeEventListener(CHANNEL_ROLE_EVENT, onRoleChange);
  }, []);

  useEffect(() => {
    const timers = retryTimersRef.current;
    return () => {
      for (const timerId of timers) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const postChannelAction = useCallback(
    async (
      body: Record<string, unknown>,
      options?: { silentSuccess?: boolean }
    ): Promise<{
      success?: boolean;
      message?: string;
      tone?: "success" | "warning" | "info" | "error";
      nextSuggestedRef?: string;
      data?: Record<string, unknown>;
    } | null> => {
      setMutating(true);
      try {
        const res = await fetch("/api/hos/channel-manager", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: activeRole, ...body }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          error?: string;
          message?: string;
          tone?: "success" | "warning" | "info" | "error";
          nextSuggestedRef?: string;
          data?: Record<string, unknown>;
        };
        if (!res.ok || !json.success) {
          toast.error(json.error || "Channel sync action failed.");
          return null;
        }

        if (!options?.silentSuccess && json.message) {
          if (json.tone === "error") toast.error(json.message);
          else if (json.tone === "warning") toast.warning(json.message);
          else if (json.tone === "info") toast.info(json.message);
          else toast.success(json.message);
        }

        await fetchChannelData();
        return json;
      } catch {
        toast.error("Network error communicating with OTA Channel API.");
        return null;
      } finally {
        setMutating(false);
      }
    },
    [activeRole, fetchChannelData]
  );

  const handleCycleChannelStatus = (channelId: string) => {
    if (!canRoleManageChannels(activeRole)) {
      toast.error(
        "Permission Denied: Only Revenue Managers or System Administrators can toggle OTA channel connections."
      );
      return;
    }
    void postChannelAction({ action: "cycle_channel", channelId });
  };

  const handleUpdateCap = (roomType: string, dateStr: string, cap: number) => {
    if (!canRoleManageChannels(activeRole)) {
      toast.error(
        "Permission Denied: Only Revenue Managers can modify channel allocation caps."
      );
      void fetchChannelData();
      return;
    }
    void postChannelAction({ action: "update_cap", roomType, dateStr, cap });
  };

  const handleToggleStopSell = (roomType: string, dateStr: string) => {
    if (!canRoleManageChannels(activeRole)) {
      toast.error(
        "Permission Denied: Only Revenue Managers can toggle Stop-Sell overrides."
      );
      return;
    }
    void postChannelAction({ action: "toggle_stopsell", roomType, dateStr });
  };

  const handleManualSync = () => {
    if (!canRoleManageChannels(activeRole)) {
      toast.error(
        "Permission Denied: Only Revenue Managers or System Admins can force manual resyncs."
      );
      return;
    }
    void postChannelAction({ action: "manual_sync" });
  };

  const handleOpenConfigModal = () => {
    if (!canRoleManageChannels(activeRole)) {
      toast.error(
        "Permission Denied: Only System Administrators or Revenue Managers can configure OTA endpoints."
      );
      return;
    }
    setConfigModalOpen(true);
  };

  const handleSaveConfigs = (configs: ChannelConfigDraft[]) => {
    void (async () => {
      const res = await postChannelAction({
        action: "save_configs",
        configs: configs.map((c) => ({
          id: c.id,
          apiKeyValid: c.apiKeyValid,
          commissionPct: c.commissionPct,
          icalUrl: c.icalUrl,
        })),
      });
      if (res) {
        setConfigModalOpen(false);
      }
    })();
  };

  const handleSimulateWebhook = async (
    payload: SimulateWebhookPayload
  ): Promise<{ nextSuggestedRef?: string } | null> => {
    const res = await postChannelAction({
      action: "ingest_webhook",
      ...payload,
    });
    if (!res) return null;
    return { nextSuggestedRef: res.nextSuggestedRef };
  };

  const handleSimulateTimeout = (channelId: string) => {
    void (async () => {
      const res = await postChannelAction({
        action: "simulate_timeout",
        channelId,
      });
      const logId =
        typeof res?.data?.logId === "string" ? res.data.logId : null;
      const backoffMs =
        typeof res?.data?.backoffMs === "number" ? res.data.backoffMs : 2000;
      if (!logId) return;

      const timerId = window.setTimeout(() => {
        void postChannelAction({
          action: "complete_backoff_retry",
          logId,
        });
      }, Math.min(2500, Math.max(1200, backoffMs)));
      retryTimersRef.current.push(timerId);
    })();
  };

  const handleResolveOverbooking = () => {
    if (!canRoleResolveOverbooking(activeRole)) {
      toast.error(
        "Permission Denied: Only Front Desk Supervisors, Revenue Managers, or SysAdmins can resolve overbookings."
      );
      return;
    }
    void postChannelAction({ action: "resolve_overbooking" });
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-[#1a68ff] dark:text-blue-400" />
          <span>Loading OTA Channel &amp; Inventory Sync Manager...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-6 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-center space-y-3">
        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto" />
        <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
          Unable to load OTA Channel Manager
        </h2>
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void fetchChannelData()}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const anyValidChannel = data.channels.some(
    (c) => c.apiKeyValid && c.status === "Active"
  );

  return (
    <div className="max-w-[1440px] w-full mx-auto px-2 sm:px-4 py-2 space-y-6">
      {/* Page Title & Metadata Header (1-to-1 Canvas layout) */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 text-[#1a68ff] dark:text-blue-400 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              OTA Channel &amp; Inventory Sync Manager
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#1a68ff] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Priority: P1 • Phase 2
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Centralize room availability, rate parity, allocation caps,
            stop-sell restrictions, and idempotent webhook/iCal reservation
            ingestion across OTAs and Direct Booking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0 whitespace-nowrap">
          <div className="inline-flex items-center bg-muted p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setSubView("matrix")}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition ${
                subView === "matrix"
                  ? "font-semibold bg-card text-foreground shadow-2xs"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              Inventory &amp; Stop-Sell Matrix
            </button>
            <button
              type="button"
              onClick={() => setSubView("logs")}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition ${
                subView === "logs"
                  ? "font-semibold bg-card text-foreground shadow-2xs"
                  : "font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              Sync Logs &amp; Commissions ({data.syncLogs.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenConfigModal}
            className="bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-2xs transition"
          >
            ⚙ Configure Channels &amp; Webhooks
          </button>

          <button
            type="button"
            disabled={!anyValidChannel || mutating}
            onClick={handleManualSync}
            title={
              !anyValidChannel
                ? "Enable an active OTA channel with valid API credentials first"
                : "Push live availability & rate parity now"
            }
            className={`text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition ${
              !anyValidChannel
                ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                : "bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white shadow-2xs cursor-pointer"
            }`}
          >
            <span>↻ Sync Now</span>
          </button>
        </div>
      </div>

      {/* OVERBOOKING RACE-CONDITION ALERT BANNER */}
      {data.overbookingAlert ? (
        <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-red-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              !
            </span>
            <div className="text-xs text-red-900 dark:text-red-200 space-y-0.5">
              <div className="font-bold text-sm text-red-800 dark:text-red-100">
                Simultaneous Last-Room Race Condition Detected!
              </div>
              <p>
                Race Condition / Overbooking on{" "}
                {data.overbookingAlert.roomType} (
                {data.overbookingAlert.dateStr}):{" "}
                {data.overbookingAlert.channelName} ingested booking{" "}
                {data.overbookingAlert.externalId} for{" "}
                {data.overbookingAlert.guestName} while sellable OTA inventory
                hit 0. Front Desk resolution required.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={mutating}
            onClick={handleResolveOverbooking}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shrink-0 transition disabled:opacity-50"
          >
            Resolve &amp; Rebalance Inventory
          </button>
        </div>
      ) : null}

      {/* WORKSPACE VIEWS */}
      {subView === "matrix" ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <MatrixWorkspace
            channels={data.channels}
            dates={data.dates}
            roomInventory={data.roomInventory}
            ingestedReservations={data.ingestedReservations}
            selectedMatrixChannelId={selectedMatrixChannelId}
            mutating={mutating}
            onSelectMatrixChannel={setSelectedMatrixChannelId}
            onCycleChannelStatus={handleCycleChannelStatus}
            onUpdateCap={handleUpdateCap}
            onToggleStopSell={handleToggleStopSell}
          />

          <WebhookSimulatorCard
            channels={data.channels}
            dates={data.dates}
            roomInventory={data.roomInventory}
            ingestedReservations={data.ingestedReservations}
            mutating={mutating}
            onSimulateWebhook={handleSimulateWebhook}
            onSimulateTimeout={handleSimulateTimeout}
          />
        </div>
      ) : (
        <SyncLogsTab
          channels={data.channels}
          ingestedReservations={data.ingestedReservations}
          syncLogs={data.syncLogs}
          mutating={mutating}
          onRetryFailedJobs={() =>
            void postChannelAction({ action: "retry_failed" })
          }
        />
      )}

      {configModalOpen ? (
        <ConfigModal
          channels={data.channels}
          submitting={mutating}
          onClose={() => setConfigModalOpen(false)}
          onSave={handleSaveConfigs}
        />
      ) : null}
    </div>
  );
}
