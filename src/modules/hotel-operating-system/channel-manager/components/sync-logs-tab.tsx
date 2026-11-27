"use client";

import type {
  ChannelSyncLog,
  IngestedOtaReservation,
  OtaChannel,
} from "../types";

interface SyncLogsTabProps {
  channels: OtaChannel[];
  ingestedReservations: IngestedOtaReservation[];
  syncLogs: ChannelSyncLog[];
  mutating: boolean;
  onRetryFailedJobs: () => void;
}

const LOG_STATUS_BADGE: Record<string, string> = {
  Synced:
    "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  Failed:
    "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  Retrying:
    "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Queued:
    "bg-muted text-muted-foreground border-border",
};

export function SyncLogsTab({
  channels,
  ingestedReservations,
  syncLogs,
  mutating,
  onRetryFailedJobs,
}: SyncLogsTabProps) {
  return (
    <div className="space-y-5">
      {/* Per-Channel Commission Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {channels.map((ch) => {
          const channelBookings = ingestedReservations.filter(
            (r) => r.channelId === ch.id && r.status === "Confirmed"
          );
          const gross = channelBookings.reduce((s, r) => s + r.grossAmount, 0);
          const comm = channelBookings.reduce(
            (s, r) => s + r.commissionAmount,
            0
          );

          return (
            <div
              key={ch.id}
              className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-4 space-y-1"
            >
              <div className="text-xs font-bold text-foreground">
                {ch.name} ({ch.commissionPct}%)
              </div>
              <div className="text-lg font-extrabold text-[#1a68ff] dark:text-blue-400">
                ₱{gross.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {channelBookings.length} active bookings • Comm:{" "}
                <strong className="text-amber-700 dark:text-amber-300">
                  ₱{comm.toLocaleString()}
                </strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync Audit Logs List */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Channel Sync Audit Logs (channel_sync_logs_hos)
            </h2>
            <p className="text-xs text-muted-foreground">
              Tracks Queued → Synced / Failed / Retrying states, stop-sell
              overrides, and exponential backoff retries.
            </p>
          </div>
          <button
            type="button"
            disabled={mutating}
            onClick={onRetryFailedJobs}
            className="px-3 py-1.5 rounded-lg bg-[#1a68ff] hover:bg-[#1557d6] text-white text-xs font-semibold self-start sm:self-center disabled:opacity-50"
          >
            ↻ Retry Failed Jobs
          </button>
        </div>

        {syncLogs.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No sync audit logs recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {syncLogs.map((l) => (
              <div
                key={l.logId}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-foreground">
                      {l.logId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        LOG_STATUS_BADGE[l.status] || ""
                      }`}
                    >
                      {l.status}
                    </span>
                    <span className="font-bold text-foreground">
                      {l.channelName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      • {l.direction}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{l.action}</div>
                </div>

                <div className="text-[11px] text-muted-foreground shrink-0">
                  Actor:{" "}
                  <strong className="text-foreground">{l.actor}</strong> •
                  Attempts: {l.attempts} • {l.timestamp}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
