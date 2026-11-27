import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import type { GroupBlock, GroupFolioPosting } from "../types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "";

export function getManilaBusinessDate(now: Date = new Date()): string {
  const manilaMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000;
  return new Date(manilaMs).toISOString().split("T")[0];
}

export function getManilaTimestamp(now: Date = new Date()): string {
  const manilaMs = now.getTime() + 8 * 60 * 60 * 1000;
  const iso = new Date(manilaMs).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
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

interface GroupMemoryStore {
  groupBlocks: GroupBlock[];
  folioPostings: GroupFolioPosting[];
}

const globalForGroups = globalThis as unknown as {
  __hosGroupBookingsStore?: GroupMemoryStore;
};

function buildInitialStore(today: string): GroupMemoryStore {
  return {
    groupBlocks: [
      {
        id: "GRP-2026-01",
        name: "Vertex Tech Annual Leadership Retreat",
        status: "Definite / Confirmed",
        arrivalDate: "2026-11-28",
        departureDate: "2026-12-01",
        cutoffDate: "2026-11-29",
        allottedRooms: 10,
        roomTypeMix: "6 Deluxe King, 4 Twin Executive",
        depositPaid: 25000,
        negotiatedRate: 4800,
        routingRule:
          "Room & Tax → Master Folio | Incidentals → Individual Folio",
        masterFolioTotal: 43200,
        incidentalFolioTotal: 2450,
        auditLogs: [],
        roomingList: [
          {
            id: "RES-901",
            firstName: "Adrian",
            lastName: "Lim",
            email: "adrian.lim@vertextech.ph",
            roomType: "Deluxe King",
            roomNumber: "401",
            roomCleanStatus: "Clean",
            checkIn: "2026-11-28",
            checkOut: "2026-12-01",
            status: "Assigned",
            incidentals: 1250,
          },
          {
            id: "RES-902",
            firstName: "Bianca",
            lastName: "Soriano",
            email: "bianca.s@vertextech.ph",
            roomType: "Deluxe King",
            roomNumber: "402",
            roomCleanStatus: "Clean",
            checkIn: "2026-11-28",
            checkOut: "2026-12-01",
            status: "Assigned",
            incidentals: 1200,
          },
          {
            id: "RES-903",
            firstName: "Carlo",
            lastName: "Mendoza",
            email: "c.mendoza@vertextech.ph",
            roomType: "Twin Executive",
            roomNumber: "403",
            roomCleanStatus: "Dirty",
            checkIn: "2026-11-28",
            checkOut: "2026-12-01",
            status: "Assigned",
            incidentals: 0,
          },
        ],
      },
      {
        id: "GRP-2026-02",
        name: "Dizon–Alvarez Destination Wedding Party",
        status: "Tentative Hold",
        arrivalDate: "2026-12-12",
        departureDate: "2026-12-15",
        cutoffDate: "2026-11-25",
        allottedRooms: 15,
        roomTypeMix: "10 Ocean Deluxe, 5 Junior Suite",
        depositPaid: 10000,
        negotiatedRate: 4200,
        routingRule:
          "Room & Tax → Master Folio | Incidentals → Individual Folio",
        masterFolioTotal: 12600,
        incidentalFolioTotal: 0,
        auditLogs: [],
        roomingList: [
          {
            id: "RES-910",
            firstName: "Mateo",
            lastName: "Dizon",
            email: "mateo@family.com",
            roomType: "Ocean Suite",
            roomNumber: "601",
            roomCleanStatus: "Clean",
            checkIn: "2026-12-12",
            checkOut: "2026-12-15",
            status: "Assigned",
            incidentals: 0,
          },
        ],
      },
      {
        id: "GRP-2026-03",
        name: "Pacific Rim Tour & Travel Agency Delegation",
        status: "Inquiry",
        arrivalDate: "2026-12-18",
        departureDate: "2026-12-21",
        cutoffDate: "2026-12-10",
        allottedRooms: 25,
        roomTypeMix: "25 Standard Twin",
        depositPaid: 0,
        negotiatedRate: 3600,
        routingRule: "All Charges (Room + Incidentals) → Master Folio",
        masterFolioTotal: 0,
        incidentalFolioTotal: 0,
        auditLogs: [],
        roomingList: [],
      },
    ],
    folioPostings: [
      {
        folioId: "MFOL-8841",
        sourceBookingId: "GRP-2026-01",
        targetAccount: "Vertex Tech Annual Leadership Retreat (Master Folio)",
        description:
          "Contracted Deposit & Initial Room Hold (10 rooms • 3 nights)",
        amount: 25000,
        settlementType: "Master Folio Split Routed (folios_hos)",
        timestamp: `${today} 09:15`,
      },
    ],
  };
}

export function getGroupStore(): GroupMemoryStore {
  const today = getManilaBusinessDate();
  if (!globalForGroups.__hosGroupBookingsStore) {
    globalForGroups.__hosGroupBookingsStore = buildInitialStore(today);
  }
  return globalForGroups.__hosGroupBookingsStore;
}
