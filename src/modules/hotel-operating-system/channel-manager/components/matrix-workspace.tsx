"use client";

import { useState } from "react";
import {
  computeSellableOtaInventory,
  formatMatrixDateHeader,
} from "../lib/channel-engine";
import type {
  IngestedOtaReservation,
  OtaChannel,
  RoomInventoryRow,
} from "../types";

interface MatrixWorkspaceProps {
  channels: OtaChannel[];
  dates: string[];
  roomInventory: RoomInventoryRow[];
  ingestedReservations: IngestedOtaReservation[];
  selectedMatrixChannelId: string;
  mutating: boolean;
  onSelectMatrixChannel: (channelId: string) => void;
  onCycleChannelStatus: (channelId: string) => void;
  onUpdateCap: (roomType: string, dateStr: string, cap: number) => void;
  onToggleStopSell: (roomType: string, dateStr: string) => void;
}

const CHANNEL_STATUS_BADGE: Record<string, string> = {
  Active:
    "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  Paused:
    "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Disconnected:
    "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
};

interface CapInputCellProps {
  initialCap: number;
  maxCap: number;
  disabled: boolean;
  onCommitCap: (nextCap: number) => void;
}

function CapInputCell({
  initialCap,
  maxCap,
  disabled,
  onCommitCap,
}: CapInputCellProps) {
  const [draft, setDraft] = useState(String(initialCap));

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isNaN(parsed)) {
      setDraft(String(initialCap));
      return;
    }
    const clamped = Math.max(0, Math.min(maxCap, Math.floor(parsed)));
    setDraft(String(clamped));
    if (clamped !== initialCap) {
      onCommitCap(clamped);
    }
  };

  return (
    <input
      type="number"
      min={0}
      max={maxCap}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      aria-label="Channel allocation cap"
      className="w-12 rounded border border-border bg-background px-1.5 py-0.5 text-center font-bold text-foreground focus:outline-none focus:border-[#1a68ff] disabled:opacity-60"
    />
  );
}

export function MatrixWorkspace({
  channels,
  dates,
  roomInventory,
  ingestedReservations,
  selectedMatrixChannelId,
  mutating,
  onSelectMatrixChannel,
  onCycleChannelStatus,
  onUpdateCap,
  onToggleStopSell,
}: MatrixWorkspaceProps) {
  const selectedChannel =
    channels.find((c) => c.id === selectedMatrixChannelId) || channels[0];
  const isChannelInactive = selectedChannel?.status !== "Active";

  return (
    <div className="xl:col-span-8 space-y-5">
      {/* Connected OTA Channels Strip */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Connected Distribution Channels (ota_channels_hos)
            </h2>
            <p className="text-xs text-muted-foreground">
              Toggle channel status (Active / Paused / Disconnected) and monitor
              commission rates &amp; credentials.
            </p>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Rate Parity: Dynamic Rates Synced
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="rounded-xl border border-border p-3.5 bg-muted/40 flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">
                    {ch.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Comm: <strong className="text-foreground">{ch.commissionPct}%</strong>{" "}
                    • {ch.lastSync}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
                    CHANNEL_STATUS_BADGE[ch.status] || ""
                  }`}
                >
                  {ch.status}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/70">
                <span
                  className={`text-[10px] font-mono ${
                    ch.apiKeyValid
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400 font-bold"
                  }`}
                >
                  {ch.apiKeyValid ? "● Token Valid" : "✕ Invalid Key"}
                </span>
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => onCycleChannelStatus(ch.id)}
                  className="text-[11px] font-semibold text-[#1a68ff] dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  {ch.status === "Active"
                    ? "Pause"
                    : ch.status === "Paused"
                    ? "Disconnect"
                    : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Date-by-Room-Type Inventory & Stop-Sell Matrix */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Sellable OTA Inventory, Allocation Caps &amp; Stop-Sell Matrix
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Formula:{" "}
              <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground">
                Physical − Confirmed − Group Holds (M3) − Out-of-Order
              </code>
              , capped by channel limit.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="otaMatrixChannelSelect"
              className="text-[11px] font-semibold text-muted-foreground"
            >
              Channel View:
            </label>
            <select
              id="otaMatrixChannelSelect"
              value={selectedChannel?.id || ""}
              onChange={(e) => onSelectMatrixChannel(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
            >
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name} ({ch.commissionPct}% Comm • {ch.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {roomInventory.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No mapped room types found for OTA distribution.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4 w-48 sticky left-0 bg-muted/95 dark:bg-muted z-10 border-r border-border">
                    Room Type &amp; Parity Rate
                  </th>
                  {dates.map((dateStr) => (
                    <th key={dateStr} className="py-3 px-3 text-center">
                      {formatMatrixDateHeader(dateStr)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {roomInventory.map((room) => (
                  <tr key={room.roomType}>
                    <td className="py-3 px-4 sticky left-0 bg-card z-10 border-r border-border align-top">
                      <div className="font-bold text-foreground text-xs">
                        {room.roomType}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Physical: {room.physicalRooms} • OOO: {room.outOfOrder}
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-[#1a68ff] dark:text-blue-300 font-bold text-[11px]">
                        ₱{room.parityRate.toLocaleString()} / night
                      </div>
                    </td>

                    {dates.map((dateStr) => {
                      const calc = computeSellableOtaInventory(room, dateStr);
                      const cell = room.dates[dateStr];
                      if (!cell) {
                        return (
                          <td
                            key={dateStr}
                            className="p-2.5 text-center text-muted-foreground"
                          >
                            —
                          </td>
                        );
                      }

                      return (
                        <td key={dateStr} className="p-2.5 align-top">
                          <div
                            className={`rounded-xl border p-2.5 space-y-2 transition ${
                              calc.stopSell
                                ? "bg-red-50/70 dark:bg-red-950/35 border-red-200 dark:border-red-900"
                                : isChannelInactive
                                ? "bg-muted/50 border-border opacity-75"
                                : "bg-card border-border"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-[11px] font-bold ${
                                  calc.stopSell
                                    ? "text-red-700 dark:text-red-300"
                                    : calc.sellableToOta === 0
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                {calc.stopSell
                                  ? "0 (STOP-SELL)"
                                  : `${calc.sellableToOta} Sellable`}
                              </span>
                              <span
                                className="text-[10px] text-muted-foreground"
                                title={`Physical (${room.physicalRooms}) - OOO (${room.outOfOrder}) - Confirmed (${cell.confirmed}) - Group Holds (${cell.groupHolds})`}
                              >
                                Pool: {calc.netPhysicalAvailable}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1.5 text-[10px] text-muted-foreground">
                              <span>Cap:</span>
                              <CapInputCell
                                key={`${room.roomType}-${dateStr}-${cell.cap}`}
                                initialCap={cell.cap}
                                maxCap={room.physicalRooms}
                                disabled={mutating}
                                onCommitCap={(nextCap) =>
                                  onUpdateCap(room.roomType, dateStr, nextCap)
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-border/70">
                              <span
                                className={`text-[10px] font-semibold ${
                                  calc.stopSell
                                    ? "text-red-700 dark:text-red-300"
                                    : "text-muted-foreground"
                                }`}
                              >
                                Stop-Sell
                              </span>
                              <button
                                type="button"
                                disabled={mutating}
                                onClick={() =>
                                  onToggleStopSell(room.roomType, dateStr)
                                }
                                aria-label={`Toggle Stop-Sell for ${room.roomType} on ${dateStr}`}
                                className={`w-8 h-4 rounded-full transition relative disabled:opacity-50 ${
                                  calc.stopSell
                                    ? "bg-red-600"
                                    : "bg-slate-300 dark:bg-slate-700"
                                }`}
                              >
                                <span
                                  className={`block w-3 h-3 rounded-full bg-white shadow-2xs transform transition ${
                                    calc.stopSell
                                      ? "translate-x-4"
                                      : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inbound OTA Reservations Feed (reservations_hos) */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Ingested OTA Reservations &amp; Modifications (reservations_hos)
            </h3>
            <p className="text-xs text-muted-foreground">
              Idempotent external booking ID checks prevent duplicate entries and
              lock commission percentages at ingestion.
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start sm:self-center">
            Idempotency Guard Active
          </span>
        </div>

        {ingestedReservations.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No OTA bookings ingested yet. Run a simulated webhook on the right to
            ingest one.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {ingestedReservations.map((r) => (
              <div
                key={`${r.resId}-${r.externalId}`}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-foreground">
                      {r.resId}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {r.externalId}
                    </span>
                    <span className="font-bold text-foreground">
                      {r.guestName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.status === "Confirmed"
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                          : "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Channel:{" "}
                    <strong className="text-foreground">{r.channelName}</strong>{" "}
                    • {r.roomType} • Date: {r.date}
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <div className="font-bold text-foreground">
                    Gross: ₱{r.grossAmount.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    Comm ({r.commissionPct}%): -₱
                    {r.commissionAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
