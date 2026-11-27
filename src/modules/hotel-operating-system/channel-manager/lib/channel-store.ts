import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import type {
  ChannelSyncLog,
  IngestedOtaReservation,
  OtaChannel,
  OverbookingAlert,
  RoomInventoryRow,
} from "../types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "";

export function getManilaBusinessDate(now: Date = new Date()): string {
  const manilaMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000;
  return new Date(manilaMs).toISOString().split("T")[0];
}

export function getManilaTimeLabel(now: Date = new Date()): string {
  const manilaMs = now.getTime() + 8 * 60 * 60 * 1000;
  const iso = new Date(manilaMs).toISOString();
  const hh = Number(iso.slice(11, 13));
  const mm = iso.slice(14, 16);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(h12).padStart(2, "0")}:${mm} ${ampm}`;
}

export function addDaysIso(baseDate: string, days: number): string {
  const d = new Date(`${baseDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export async function getAuthActor(fallbackRole = "Manager"): Promise<{
  authenticated: boolean;
  userId: number | null;
  actorName: string;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return { authenticated: false, userId: null, actorName: fallbackRole };
  }
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { authenticated: false, userId: null, actorName: fallbackRole };
  }

  const rawSub = payload.sub;
  const userId =
    typeof rawSub === "number"
      ? rawSub
      : typeof rawSub === "string" && /^\d+$/.test(rawSub)
      ? parseInt(rawSub, 10)
      : null;

  const first =
    (typeof payload.Firstname === "string" && payload.Firstname) ||
    (typeof payload.first_name === "string" && payload.first_name) ||
    "";
  const last =
    (typeof payload.LastName === "string" && payload.LastName) ||
    (typeof payload.last_name === "string" && payload.last_name) ||
    "";
  const name =
    [first, last].filter(Boolean).join(" ") ||
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.email === "string" && payload.email) ||
    "Staff User";

  return { authenticated: true, userId, actorName: name };
}

export function getDirectusHeaders(): Record<string, string> {
  const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
  return {
    "Content-Type": "application/json",
    ...(staticToken ? { Authorization: `Bearer ${staticToken}` } : {}),
  };
}

export interface ChannelMemoryStore {
  dates: string[];
  channels: OtaChannel[];
  roomInventory: RoomInventoryRow[];
  ingestedReservations: IngestedOtaReservation[];
  syncLogs: ChannelSyncLog[];
  overbookingAlert: OverbookingAlert | null;
  nextSyncNumber: number;
  nextResNumber: number;
}

const globalForChannels = globalThis as unknown as {
  __hosChannelManagerStore?: ChannelMemoryStore;
};

function buildInitialStore(today: string): ChannelMemoryStore {
  const d1 = addDaysIso(today, 1);
  const d2 = addDaysIso(today, 2);
  const d3 = addDaysIso(today, 3);
  const d4 = addDaysIso(today, 4);
  const d5 = addDaysIso(today, 5);
  const dates = [d1, d2, d3, d4, d5];

  return {
    dates,
    channels: [
      {
        id: "OTA-BKG",
        name: "Booking.com",
        status: "Active",
        commissionPct: 15,
        apiKeyValid: true,
        webhookSecret: "whsec_bkg_live_9821a",
        icalUrl: "https://ical.booking.com/v1/export/vtc-hos.ics",
        lastSync: "2 mins ago",
      },
      {
        id: "OTA-AGD",
        name: "Agoda",
        status: "Active",
        commissionPct: 18,
        apiKeyValid: true,
        webhookSecret: "whsec_agd_live_4410b",
        icalUrl: "https://ycs.agoda.com/ical/vtc-hos.ics",
        lastSync: "4 mins ago",
      },
      {
        id: "OTA-EXP",
        name: "Expedia",
        status: "Paused",
        commissionPct: 17,
        apiKeyValid: true,
        webhookSecret: "whsec_exp_live_7732c",
        icalUrl: "https://expediapartnercentral.com/ical/vtc.ics",
        lastSync: "35 mins ago",
      },
      {
        id: "OTA-ABB",
        name: "Airbnb",
        status: "Active",
        commissionPct: 14,
        apiKeyValid: true,
        webhookSecret: "whsec_abb_live_5590d",
        icalUrl: "https://www.airbnb.com/calendar/ical/99182.ics",
        lastSync: "1 min ago",
      },
    ],
    roomInventory: [
      {
        roomType: "Deluxe King",
        physicalRooms: 20,
        outOfOrder: 1,
        parityRate: 5200,
        dates: {
          [d1]: { confirmed: 9, groupHolds: 6, cap: 8, stopSell: false },
          [d2]: { confirmed: 10, groupHolds: 6, cap: 8, stopSell: false },
          [d3]: { confirmed: 7, groupHolds: 6, cap: 10, stopSell: false },
          [d4]: { confirmed: 5, groupHolds: 0, cap: 12, stopSell: false },
          [d5]: { confirmed: 4, groupHolds: 0, cap: 12, stopSell: false },
        },
      },
      {
        roomType: "Twin Executive",
        physicalRooms: 15,
        outOfOrder: 0,
        parityRate: 4800,
        dates: {
          [d1]: { confirmed: 8, groupHolds: 4, cap: 5, stopSell: false },
          [d2]: { confirmed: 9, groupHolds: 4, cap: 5, stopSell: false },
          [d3]: { confirmed: 6, groupHolds: 4, cap: 6, stopSell: false },
          [d4]: { confirmed: 4, groupHolds: 0, cap: 8, stopSell: false },
          [d5]: { confirmed: 3, groupHolds: 0, cap: 8, stopSell: false },
        },
      },
      {
        roomType: "Ocean Suite",
        physicalRooms: 6,
        outOfOrder: 0,
        parityRate: 8500,
        dates: {
          [d1]: { confirmed: 4, groupHolds: 1, cap: 2, stopSell: false },
          [d2]: { confirmed: 5, groupHolds: 0, cap: 2, stopSell: true },
          [d3]: { confirmed: 2, groupHolds: 0, cap: 4, stopSell: false },
          [d4]: { confirmed: 2, groupHolds: 0, cap: 4, stopSell: false },
          [d5]: { confirmed: 1, groupHolds: 0, cap: 4, stopSell: false },
        },
      },
    ],
    ingestedReservations: [
      {
        resId: "RES-8812",
        externalId: "BKG-994821",
        channelId: "OTA-BKG",
        channelName: "Booking.com",
        guestName: "Hannah Abbott",
        roomType: "Deluxe King",
        date: d1,
        grossAmount: 5200,
        commissionPct: 15,
        commissionAmount: 780,
        status: "Confirmed",
      },
      {
        resId: "RES-8813",
        externalId: "AGD-772104",
        channelId: "OTA-AGD",
        channelName: "Agoda",
        guestName: "Marco Polo",
        roomType: "Twin Executive",
        date: d1,
        grossAmount: 4800,
        commissionPct: 18,
        commissionAmount: 864,
        status: "Confirmed",
      },
      {
        resId: "RES-8814",
        externalId: "ABB-331902",
        channelId: "OTA-ABB",
        channelName: "Airbnb",
        guestName: "Chloe Morales",
        roomType: "Ocean Suite",
        date: d3,
        grossAmount: 8500,
        commissionPct: 14,
        commissionAmount: 1190,
        status: "Confirmed",
      },
    ],
    syncLogs: [
      {
        logId: "SYNC-504",
        channelName: "Booking.com",
        direction: "Outbound Push",
        action: "Availability & Rate Parity Sync (5-Day Horizon)",
        status: "Synced",
        actor: "System Scheduler",
        timestamp: "10:20 AM",
        attempts: 1,
      },
      {
        logId: "SYNC-503",
        channelName: "Agoda",
        direction: "Inbound Webhook",
        action: "Ingested Reservation AGD-772104 → RES-8813",
        status: "Synced",
        actor: "Webhook Endpoint",
        timestamp: "10:14 AM",
        attempts: 1,
      },
      {
        logId: "SYNC-502",
        channelName: "Expedia",
        direction: "Outbound Push",
        action: "Inventory Delta Push (Channel Paused)",
        status: "Failed",
        actor: "System Scheduler",
        timestamp: "09:45 AM",
        attempts: 2,
      },
      {
        logId: "SYNC-501",
        channelName: "Airbnb",
        direction: "iCal Feed Poll",
        action: "Synced iCal Reservations & Blocked Dates",
        status: "Synced",
        actor: "iCal Worker",
        timestamp: "09:30 AM",
        attempts: 1,
      },
    ],
    overbookingAlert: null,
    nextSyncNumber: 505,
    nextResNumber: 8815,
  };
}

export function getChannelStore(): ChannelMemoryStore {
  const today = getManilaBusinessDate();
  if (!globalForChannels.__hosChannelManagerStore) {
    globalForChannels.__hosChannelManagerStore = buildInitialStore(today);
  }
  return globalForChannels.__hosChannelManagerStore;
}

export function appendSyncLog(
  store: ChannelMemoryStore,
  entry: Omit<ChannelSyncLog, "logId" | "timestamp">
): ChannelSyncLog {
  const log: ChannelSyncLog = {
    logId: `SYNC-${store.nextSyncNumber++}`,
    timestamp: getManilaTimeLabel(),
    ...entry,
  };
  store.syncLogs.unshift(log);
  return log;
}
