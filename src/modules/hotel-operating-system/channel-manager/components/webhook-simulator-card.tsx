"use client";

import { useState } from "react";
import {
  computeCommissionBreakdown,
  computeSellableOtaInventory,
  formatMatrixDateHeader,
} from "../lib/channel-engine";
import type {
  IngestedOtaReservation,
  OtaChannel,
  RoomInventoryRow,
} from "../types";

export type WebhookEventType =
  | "NEW_BOOKING"
  | "DUPLICATE_TEST"
  | "RACE_OVERBOOK"
  | "CANCELLATION";

export interface SimulateWebhookPayload {
  channelId: string;
  eventType: WebhookEventType;
  externalId: string;
  dateStr: string;
  roomType: string;
  guestName: string;
}

interface WebhookSimulatorCardProps {
  channels: OtaChannel[];
  dates: string[];
  roomInventory: RoomInventoryRow[];
  ingestedReservations: IngestedOtaReservation[];
  mutating: boolean;
  onSimulateWebhook: (
    payload: SimulateWebhookPayload
  ) => Promise<{ nextSuggestedRef?: string } | null>;
  onSimulateTimeout: (channelId: string) => void;
}

export function WebhookSimulatorCard({
  channels,
  dates,
  roomInventory,
  ingestedReservations,
  mutating,
  onSimulateWebhook,
  onSimulateTimeout,
}: WebhookSimulatorCardProps) {
  const [channelId, setChannelId] = useState(channels[0]?.id || "OTA-BKG");
  const [eventType, setEventType] = useState<WebhookEventType>("NEW_BOOKING");
  const [externalId, setExternalId] = useState("BKG-995104");
  const [dateStr, setDateStr] = useState(dates[0] || "2026-11-28");
  const [roomType, setRoomType] = useState(
    roomInventory[0]?.roomType || "Deluxe King"
  );
  const [guestName, setGuestName] = useState("Kenji Takahashi");

  const activeChannel =
    channels.find((c) => c.id === channelId) || channels[0];
  const activeRoom =
    roomInventory.find((r) => r.roomType === roomType) || roomInventory[0];

  const calc = activeRoom
    ? computeSellableOtaInventory(activeRoom, dateStr)
    : { netPhysicalAvailable: 0, sellableToOta: 0, stopSell: false, cap: 0 };

  const breakdown = computeCommissionBreakdown(
    activeRoom?.parityRate || 0,
    activeChannel?.commissionPct || 0
  );

  const handleEventTypeChange = (nextEvent: WebhookEventType) => {
    setEventType(nextEvent);
    if (
      (nextEvent === "DUPLICATE_TEST" || nextEvent === "CANCELLATION") &&
      ingestedReservations.length > 0
    ) {
      const existingMatch = ingestedReservations.find(
        (r) => nextEvent === "DUPLICATE_TEST" || r.status === "Confirmed"
      );
      if (existingMatch) {
        setExternalId(existingMatch.externalId);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSimulateWebhook({
      channelId,
      eventType,
      externalId: externalId.trim(),
      dateStr,
      roomType,
      guestName: guestName.trim(),
    });
    if (res?.nextSuggestedRef) {
      setExternalId(res.nextSuggestedRef);
    }
  };

  return (
    <div className="xl:col-span-4 bg-card text-card-foreground rounded-2xl border border-border shadow-2xs p-6 sticky top-4 space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <span className="text-foreground font-bold text-sm">→</span>
        <h2 className="text-base font-bold text-foreground">
          Webhook &amp; iCal Ingestion Simulator
        </h2>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="simOtaChannel"
              className="block font-semibold text-foreground mb-1"
            >
              Source OTA Channel <span className="text-red-500">*</span>
            </label>
            <select
              id="simOtaChannel"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 font-medium text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
            >
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name} ({ch.commissionPct}% Comm • {ch.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="simOtaEventType"
              className="block font-semibold text-foreground mb-1"
            >
              Event Action <span className="text-red-500">*</span>
            </label>
            <select
              id="simOtaEventType"
              value={eventType}
              onChange={(e) =>
                handleEventTypeChange(e.target.value as WebhookEventType)
              }
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 font-medium text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
            >
              <option value="NEW_BOOKING">New Reservation</option>
              <option value="DUPLICATE_TEST">
                Duplicate Booking ID (Idempotency Test)
              </option>
              <option value="RACE_OVERBOOK">
                Last-Room Race Condition Test
              </option>
              <option value="CANCELLATION">OTA-Initiated Cancellation</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="simExternalId"
              className="block font-semibold text-foreground mb-1"
            >
              External OTA Ref ID <span className="text-red-500">*</span>
            </label>
            <input
              id="simExternalId"
              type="text"
              required
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-foreground focus:outline-none focus:border-[#1a68ff]"
            />
          </div>

          <div>
            <label
              htmlFor="simStayDate"
              className="block font-semibold text-foreground mb-1"
            >
              Target Date <span className="text-red-500">*</span>
            </label>
            <select
              id="simStayDate"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 font-medium text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {formatMatrixDateHeader(d)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="simRoomType"
              className="block font-semibold text-foreground mb-1"
            >
              Room Type <span className="text-red-500">*</span>
            </label>
            <select
              id="simRoomType"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 font-medium text-foreground focus:outline-none focus:border-[#1a68ff] dark:[&>option]:bg-card dark:[&>option]:text-foreground"
            >
              {roomInventory.map((r) => (
                <option key={r.roomType} value={r.roomType}>
                  {r.roomType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="simGuestName"
              className="block font-semibold text-foreground mb-1"
            >
              Guest Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="simGuestName"
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:border-[#1a68ff]"
            />
          </div>
        </div>

        {/* Summary Breakdown Box */}
        <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-2.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Parity Gross Rate</span>
            <span className="font-bold text-foreground">
              ₱
              {breakdown.grossAmount.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Channel Commission</span>
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              -₱
              {breakdown.commissionAmount.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}{" "}
              ({breakdown.commissionPct}%)
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Sellable Pool Remaining</span>
            <span
              className={`font-bold ${
                calc.stopSell || calc.sellableToOta === 0
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {calc.stopSell
                ? "0 (Stop-Sell Active)"
                : `${calc.sellableToOta} Rooms Open`}
            </span>
          </div>
          <div className="pt-2.5 border-t border-border flex items-center justify-between">
            <span className="font-bold text-foreground text-sm">
              Net Hotel Payout
            </span>
            <span className="font-extrabold text-lg text-[#1a68ff] dark:text-blue-400">
              ₱
              {breakdown.netPayout.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="submit"
            disabled={mutating}
            className="w-full bg-slate-950 hover:bg-slate-800 dark:bg-[#1a68ff] dark:hover:bg-[#1557d6] text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-2xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>Ingest Webhook Payload</span>
            <span>✓</span>
          </button>
          <button
            type="button"
            disabled={mutating}
            onClick={() => onSimulateTimeout(channelId)}
            className="w-full bg-card hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold text-xs py-2.5 px-4 rounded-xl border border-amber-200 dark:border-amber-800 transition disabled:opacity-50"
          >
            ⚡ Simulate Webhook Timeout &amp; Retry Backoff
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground italic text-center leading-relaxed">
          Validates auth tokens, room mappings, and external IDs before writing
          to <code className="font-mono text-foreground">reservations_hos</code>{" "}
          &amp;{" "}
          <code className="font-mono text-foreground">
            channel_sync_logs_hos
          </code>
          .
        </p>
      </form>
    </div>
  );
}
