import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canRoleManageChannels,
  canRoleResolveOverbooking,
  computeCommissionBreakdown,
  computeExponentialBackoffMs,
  computeSellableOtaInventory,
  findDuplicateExternalBooking,
} from "@/modules/hotel-operating-system/channel-manager/lib/channel-engine";
import {
  API_BASE_URL,
  appendSyncLog,
  getAuthActor,
  getChannelStore,
  getDirectusHeaders,
  getManilaBusinessDate,
} from "@/modules/hotel-operating-system/channel-manager/lib/channel-store";
import type {
  ChannelConnectionStatus,
  ChannelRole,
  IngestedOtaReservation,
} from "@/modules/hotel-operating-system/channel-manager/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roleSchema = z
  .enum(["Manager", "SysAdmin", "Supervisor", "Accounting"])
  .default("Manager");

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cycle_channel"),
    role: roleSchema,
    channelId: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("update_cap"),
    role: roleSchema,
    roomType: z.string().min(1).max(80),
    dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cap: z.coerce.number().int().min(0).max(500),
  }),
  z.object({
    action: z.literal("toggle_stopsell"),
    role: roleSchema,
    roomType: z.string().min(1).max(80),
    dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal("manual_sync"),
    role: roleSchema,
  }),
  z.object({
    action: z.literal("save_configs"),
    role: roleSchema,
    configs: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          apiKeyValid: z.boolean(),
          commissionPct: z.coerce.number().min(0).max(40),
          icalUrl: z.string().trim().min(5).max(300),
        })
      )
      .min(1)
      .max(20),
  }),
  z.object({
    action: z.literal("ingest_webhook"),
    role: roleSchema,
    channelId: z.string().min(1).max(40),
    eventType: z.enum([
      "NEW_BOOKING",
      "DUPLICATE_TEST",
      "RACE_OVERBOOK",
      "CANCELLATION",
    ]),
    externalId: z.string().trim().min(2).max(80),
    dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    roomType: z.string().min(1).max(80),
    guestName: z.string().trim().min(2).max(120),
  }),
  z.object({
    action: z.literal("simulate_timeout"),
    role: roleSchema,
    channelId: z.string().optional(),
  }),
  z.object({
    action: z.literal("complete_backoff_retry"),
    role: roleSchema,
    logId: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("retry_failed"),
    role: roleSchema,
  }),
  z.object({
    action: z.literal("resolve_overbooking"),
    role: roleSchema,
  }),
]);

async function probeDirectusCollection(
  collection: string
): Promise<"live" | "fallback"> {
  if (!API_BASE_URL) return "fallback";
  try {
    const res = await fetch(`${API_BASE_URL}/items/${collection}?limit=1`, {
      headers: getDirectusHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    return res.ok ? "live" : "fallback";
  } catch {
    return "fallback";
  }
}

export async function GET() {
  const auth = await getAuthActor();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getChannelStore();
  const [directusChannelsMode, directusLogsMode] = await Promise.all([
    probeDirectusCollection("ota_channels_hos"),
    probeDirectusCollection("channel_sync_logs_hos"),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      channels: store.channels,
      dates: store.dates,
      roomInventory: store.roomInventory,
      ingestedReservations: store.ingestedReservations,
      syncLogs: store.syncLogs,
      overbookingAlert: store.overbookingAlert,
      meta: {
        businessDate: getManilaBusinessDate(),
        directusChannelsMode,
        directusLogsMode,
      },
    },
  });
}

export async function POST(request: Request) {
  const auth = await getAuthActor();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const store = getChannelStore();
  const actorLabel = `${input.role} (${auth.actorName})`;

  switch (input.action) {
    case "cycle_channel": {
      if (!canRoleManageChannels(input.role as ChannelRole)) {
        return NextResponse.json(
          {
            error:
              "Permission Denied: Only Revenue Managers or System Administrators can toggle OTA channel connections.",
          },
          { status: 403 }
        );
      }
      const ch = store.channels.find((c) => c.id === input.channelId);
      if (!ch) {
        return NextResponse.json(
          { error: "Channel not found." },
          { status: 404 }
        );
      }
      if (!ch.apiKeyValid && ch.status !== "Active") {
        return NextResponse.json(
          {
            error: `Cannot activate ${ch.name}: API credentials are invalid. Update credentials first.`,
          },
          { status: 400 }
        );
      }
      const order: ChannelConnectionStatus[] = [
        "Active",
        "Paused",
        "Disconnected",
      ];
      const nextStatus =
        order[(order.indexOf(ch.status) + 1) % order.length] || "Active";
      ch.status = nextStatus;

      appendSyncLog(store, {
        channelName: ch.name,
        direction: "State Change",
        action: `Channel Connection transitioned to ${nextStatus}`,
        status: "Synced",
        actor: actorLabel,
        attempts: 1,
      });

      return NextResponse.json({
        success: true,
        message: `${ch.name} connection is now ${nextStatus}.`,
        tone: "info",
      });
    }

    case "update_cap": {
      if (!canRoleManageChannels(input.role as ChannelRole)) {
        return NextResponse.json(
          {
            error:
              "Permission Denied: Only Revenue Managers can modify channel allocation caps.",
          },
          { status: 403 }
        );
      }
      const room = store.roomInventory.find(
        (r) => r.roomType === input.roomType
      );
      if (!room || !room.dates[input.dateStr]) {
        return NextResponse.json(
          { error: "Room type or date cell not found." },
          { status: 404 }
        );
      }

      const capped = Math.min(room.physicalRooms, Math.max(0, input.cap));
      room.dates[input.dateStr].cap = capped;

      appendSyncLog(store, {
        channelName: "All Active OTAs",
        direction: "Allocation Cap Update",
        action: `Set ${room.roomType} allocation cap to ${capped} on ${input.dateStr}`,
        status: "Synced",
        actor: actorLabel,
        attempts: 1,
      });

      return NextResponse.json({
        success: true,
        message: `Updated ${room.roomType} allocation cap to ${capped} on ${input.dateStr}.`,
        tone: "success",
      });
    }

    case "toggle_stopsell": {
      if (!canRoleManageChannels(input.role as ChannelRole)) {
        return NextResponse.json(
          {
            error:
              "Permission Denied: Only Revenue Managers can toggle Stop-Sell overrides.",
          },
          { status: 403 }
        );
      }
      const room = store.roomInventory.find(
        (r) => r.roomType === input.roomType
      );
      if (!room || !room.dates[input.dateStr]) {
        return NextResponse.json(
          { error: "Room type or date cell not found." },
          { status: 404 }
        );
      }

      const nextStopSell = !room.dates[input.dateStr].stopSell;
      room.dates[input.dateStr].stopSell = nextStopSell;

      appendSyncLog(store, {
        channelName: "All Active OTAs",
        direction: "Stop-Sell Override",
        action: `${nextStopSell ? "ENABLED" : "LIFTED"} Stop-Sell for ${room.roomType} on ${input.dateStr}`,
        status: "Synced",
        actor: actorLabel,
        attempts: 1,
      });

      return NextResponse.json({
        success: true,
        message: nextStopSell
          ? `Enabled Stop-Sell (0 sellable inventory pushed) for ${room.roomType} on ${input.dateStr}.`
          : `Lifted Stop-Sell restriction for ${room.roomType} on ${input.dateStr}.`,
        tone: nextStopSell ? "warning" : "success",
      });
    }

    case "manual_sync": {
      if (!canRoleManageChannels(input.role as ChannelRole)) {
        return NextResponse.json(
          {
            error:
              "Permission Denied: Only Revenue Managers or System Admins can force manual resyncs.",
          },
          { status: 403 }
        );
      }
      const activeChannels = store.channels.filter(
        (c) => c.status === "Active" && c.apiKeyValid
      );
      if (activeChannels.length === 0) {
        return NextResponse.json(
          {
            error:
              "Sync Blocked: No Active OTA channels with valid API credentials.",
          },
          { status: 400 }
        );
      }

      for (const ch of activeChannels) {
        ch.lastSync = "Just now";
      }

      appendSyncLog(store, {
        channelName: activeChannels.map((c) => c.name).join(", "),
        direction: "Manual Sync Now",
        action:
          "Pushed full 5-day sellable inventory, stop-sell flags & parity rates",
        status: "Synced",
        actor: actorLabel,
        attempts: 1,
      });

      return NextResponse.json({
        success: true,
        message: `Synced live availability & rate parity across ${activeChannels.length} active OTA channels.`,
        tone: "success",
      });
    }

    case "save_configs": {
      if (!canRoleManageChannels(input.role as ChannelRole)) {
        return NextResponse.json(
          {
            error:
              "Permission Denied: Only System Administrators or Revenue Managers can configure OTA endpoints.",
          },
          { status: 403 }
        );
      }
      for (const cfg of input.configs) {
        const ch = store.channels.find((c) => c.id === cfg.id);
        if (!ch) continue;
        ch.apiKeyValid = cfg.apiKeyValid;
        ch.commissionPct = cfg.commissionPct;
        ch.icalUrl = cfg.icalUrl;
        if (!cfg.apiKeyValid) {
          ch.status = "Disconnected";
        }
      }

      appendSyncLog(store, {
        channelName: "Channel Configurations",
        direction: "Credentials & iCal",
        action:
          "Updated OTA API key validation states, commission %, and iCal feed endpoints",
        status: "Synced",
        actor: actorLabel,
        attempts: 1,
      });

      return NextResponse.json({
        success: true,
        message:
          "Updated OTA channel credentials, commission rates, and iCal endpoints.",
        tone: "success",
      });
    }

    case "ingest_webhook": {
      const ch = store.channels.find((c) => c.id === input.channelId);
      if (!ch) {
        return NextResponse.json(
          { error: "Source OTA channel not found." },
          { status: 404 }
        );
      }
      if (!ch.apiKeyValid || ch.status === "Disconnected") {
        return NextResponse.json(
          {
            error: `Webhook Rejected: ${ch.name} channel is Disconnected or has invalid credentials.`,
          },
          { status: 400 }
        );
      }

      const roomRow = store.roomInventory.find(
        (r) => r.roomType === input.roomType
      );
      if (!roomRow || !roomRow.dates[input.dateStr]) {
        return NextResponse.json(
          { error: "Mapped room type or target date not found." },
          { status: 404 }
        );
      }

      const existing = findDuplicateExternalBooking(
        store.ingestedReservations,
        input.externalId
      );

      if (input.eventType === "CANCELLATION") {
        if (!existing) {
          return NextResponse.json(
            {
              error: `No existing reservation found for external ID ${input.externalId} to cancel.`,
            },
            { status: 404 }
          );
        }
        if (existing.status === "Cancelled") {
          return NextResponse.json({
            success: true,
            message: `Idempotent Notice: ${input.externalId} is already cancelled. No duplicate folio reversal created.`,
            tone: "info",
          });
        }
        existing.status = "Cancelled";
        const targetRoom = store.roomInventory.find(
          (r) => r.roomType === existing.roomType
        );
        if (targetRoom && targetRoom.dates[existing.date]) {
          targetRoom.dates[existing.date].confirmed = Math.max(
            0,
            targetRoom.dates[existing.date].confirmed - 1
          );
        }

        appendSyncLog(store, {
          channelName: ch.name,
          direction: "Inbound Cancellation",
          action: `Cancelled ${input.externalId} (${existing.resId}) and restored +1 inventory`,
          status: "Synced",
          actor: "Webhook Endpoint",
          attempts: 1,
        });

        return NextResponse.json({
          success: true,
          message: `OTA Cancellation processed cleanly for ${input.externalId}; inventory restored.`,
          tone: "warning",
        });
      }

      if (existing) {
        appendSyncLog(store, {
          channelName: ch.name,
          direction: "Idempotency Guard",
          action: `Ignored duplicate webhook payload for external ID ${input.externalId} (${existing.resId})`,
          status: "Synced",
          actor: "Webhook Endpoint",
          attempts: 1,
        });

        return NextResponse.json({
          success: true,
          duplicateBlocked: true,
          message: `Idempotent Webhook Guard: External ID ${input.externalId} already exists (${existing.resId}). Duplicate blocked!`,
          tone: "info",
        });
      }

      const calc = computeSellableOtaInventory(roomRow, input.dateStr);
      if (input.eventType === "RACE_OVERBOOK" || calc.sellableToOta <= 0) {
        store.overbookingAlert = {
          externalId: input.externalId,
          channelName: ch.name,
          guestName: input.guestName,
          roomType: input.roomType,
          dateStr: input.dateStr,
        };

        appendSyncLog(store, {
          channelName: ch.name,
          direction: "Overbooking Flag",
          action: `Flagged last-room race condition on ${input.externalId} (${input.roomType} • ${input.dateStr})`,
          status: "Failed",
          actor: "Webhook Endpoint",
          attempts: 1,
        });

        return NextResponse.json({
          success: true,
          overbookingFlagged: true,
          message: `ALERT: Last-room race condition flagged for ${input.externalId}!`,
          tone: "error",
        });
      }

      const breakdown = computeCommissionBreakdown(
        roomRow.parityRate,
        ch.commissionPct
      );
      const newRes: IngestedOtaReservation = {
        resId: `RES-${store.nextResNumber++}`,
        externalId: input.externalId,
        channelId: ch.id,
        channelName: ch.name,
        guestName: input.guestName,
        roomType: input.roomType,
        date: input.dateStr,
        grossAmount: breakdown.grossAmount,
        commissionPct: breakdown.commissionPct,
        commissionAmount: breakdown.commissionAmount,
        status: "Confirmed",
      };

      store.ingestedReservations.unshift(newRes);
      roomRow.dates[input.dateStr].confirmed += 1;

      appendSyncLog(store, {
        channelName: ch.name,
        direction: "Inbound Webhook",
        action: `Ingested ${input.externalId} → ${newRes.resId} (${input.roomType} • Comm ₱${breakdown.commissionAmount.toLocaleString()})`,
        status: "Synced",
        actor: "Webhook Endpoint",
        attempts: 1,
      });

      const prefix = ch.id.split("-")[1] || "OTA";
      const nextSuggestedRef = `${prefix}-${Math.floor(100000 + Math.random() * 899999)}`;

      return NextResponse.json({
        success: true,
        nextSuggestedRef,
        message: `Ingested ${input.externalId} into reservations_hos (${newRes.resId}) and pushed updated availability!`,
        tone: "success",
      });
    }

    case "simulate_timeout": {
      const ch =
        store.channels.find((c) => c.id === input.channelId) ||
        store.channels[1] ||
        store.channels[0];
      const backoffMs = computeExponentialBackoffMs(2);
      const log = appendSyncLog(store, {
        channelName: ch.name,
        direction: "Inbound Webhook",
        action:
          "HTTP 504 Timeout on webhook payload — Exponential Backoff Retry #1",
        status: "Retrying",
        actor: "Retry Worker",
        attempts: 1,
      });

      return NextResponse.json({
        success: true,
        data: { logId: log.logId, backoffMs },
        message:
          "Webhook timeout detected! Retrying automatically with exponential backoff...",
        tone: "warning",
      });
    }

    case "complete_backoff_retry": {
      const targetLog = store.syncLogs.find((l) => l.logId === input.logId);
      if (!targetLog) {
        return NextResponse.json(
          { error: "Sync log job not found." },
          { status: 404 }
        );
      }
      targetLog.status = "Synced";
      targetLog.attempts = Math.max(2, targetLog.attempts + 1);
      targetLog.action =
        "Recovered via Exponential Backoff Retry #2 — Payload committed cleanly";

      return NextResponse.json({
        success: true,
        message: `Backoff recovery succeeded for ${targetLog.logId}!`,
        tone: "success",
      });
    }

    case "retry_failed": {
      let retried = 0;
      for (const log of store.syncLogs) {
        if (log.status === "Failed") {
          log.status = "Synced";
          log.attempts += 1;
          log.action += " (Manually Retried & Synced)";
          retried += 1;
        }
      }

      return NextResponse.json({
        success: true,
        retried,
        message:
          retried > 0
            ? `Retried and synced ${retried} failed job(s).`
            : "No failed sync jobs in queue.",
        tone: retried > 0 ? "success" : "info",
      });
    }

    case "resolve_overbooking": {
      if (!canRoleResolveOverbooking(input.role as ChannelRole)) {
        return NextResponse.json(
          {
            error:
              "Permission Denied: Only Front Desk Supervisors, Revenue Managers, or SysAdmins can resolve overbookings.",
          },
          { status: 403 }
        );
      }
      if (!store.overbookingAlert) {
        return NextResponse.json({
          success: true,
          message: "No active overbooking alert to resolve.",
          tone: "info",
        });
      }

      const alert = store.overbookingAlert;
      store.overbookingAlert = null;
      appendSyncLog(store, {
        channelName: alert.channelName,
        direction: "Overbooking Resolved",
        action: `Front Desk upgraded/rebalanced ${alert.externalId} (${alert.guestName})`,
        status: "Synced",
        actor: actorLabel,
        attempts: 1,
      });

      return NextResponse.json({
        success: true,
        message:
          "Overbooking alert resolved and inventory rebalanced across channels.",
        tone: "success",
      });
    }
  }
}
