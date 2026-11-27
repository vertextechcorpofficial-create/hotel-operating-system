import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import type {
  AmenityBooking,
  AmenityFolioPosting,
  AmenityReservationOption,
  AmenityResource,
} from "../types";

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

export async function getAuthActor(fallbackRole = "Receptionist"): Promise<{
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

interface AmenityMemoryStore {
  resources: AmenityResource[];
  bookings: AmenityBooking[];
  folioPostings: AmenityFolioPosting[];
}

const globalForAmenity = globalThis as unknown as {
  __hosAmenityStore?: AmenityMemoryStore;
};

function buildInitialStore(today: string): AmenityMemoryStore {
  return {
    resources: [
      {
        id: "RES-SPA-01",
        name: "Hilot Suite 1 (Couples)",
        category: "Spa Room",
        capacity: 2,
        active: true,
        shiftStart: 9,
        shiftEnd: 18,
      },
      {
        id: "RES-SPA-02",
        name: "Serenity Massage Room 2",
        category: "Spa Room",
        capacity: 1,
        active: true,
        shiftStart: 9,
        shiftEnd: 18,
      },
      {
        id: "RES-REC-01",
        name: "Championship Tennis Court A",
        category: "Recreation",
        capacity: 4,
        active: true,
        shiftStart: 9,
        shiftEnd: 18,
      },
      {
        id: "RES-REC-02",
        name: "Poolside Gym Cabana #1",
        category: "Recreation",
        capacity: 2,
        active: true,
        shiftStart: 9,
        shiftEnd: 18,
      },
      {
        id: "RES-ENT-01",
        name: "VIP KTV Lounge Sapphire",
        category: "Entertainment",
        capacity: 8,
        active: true,
        shiftStart: 11,
        shiftEnd: 18,
      },
      {
        id: "STF-TH-01",
        name: "Therapist: Maya Santos",
        category: "Therapist",
        capacity: 1,
        active: true,
        shiftStart: 9,
        shiftEnd: 17,
      },
      {
        id: "STF-TH-02",
        name: "Therapist: Liam Cruz",
        category: "Therapist",
        capacity: 1,
        active: true,
        shiftStart: 10,
        shiftEnd: 18,
      },
      {
        id: "STF-TH-03",
        name: "Therapist: Sofia Reyes",
        category: "Therapist",
        capacity: 1,
        active: true,
        shiftStart: 9,
        shiftEnd: 16,
      },
    ],
    bookings: [
      {
        id: "AMN-2026-101",
        date: today,
        guest: "Room 305 — Marcus Vance",
        reservationId: "RES-305",
        numericReservationId: null,
        billingMode: "inhouse",
        packageId: "signature_massage",
        serviceName: "Signature Hilot Massage",
        resourceId: "RES-SPA-02",
        therapistIds: ["STF-TH-01"],
        startHour: 10,
        durationHours: 1,
        bufferHours: 1,
        bufferMins: 30,
        price: 3200,
        status: "In Session",
        billed: false,
        billingRef: null,
        auditLog: [],
      },
      {
        id: "AMN-2026-102",
        date: today,
        guest: "Room 512 — Clara Lindqvist",
        reservationId: "RES-512",
        numericReservationId: null,
        billingMode: "inhouse",
        packageId: "tennis_court",
        serviceName: "Floodlit Tennis Court Rental",
        resourceId: "RES-REC-01",
        therapistIds: [],
        startHour: 9,
        durationHours: 1,
        bufferHours: 0,
        bufferMins: 15,
        price: 1200,
        status: "Completed",
        billed: true,
        billingRef: "FOL-8841",
        auditLog: [],
      },
      {
        id: "AMN-2026-103",
        date: today,
        guest: "Walk-In — Jericho Rosales",
        reservationId: "WALK-IN",
        numericReservationId: null,
        billingMode: "walkin",
        packageId: "couples_retreat",
        serviceName: "Couples Aromatherapy Retreat",
        resourceId: "RES-SPA-01",
        therapistIds: ["STF-TH-02", "STF-TH-03"],
        startHour: 14,
        durationHours: 1,
        bufferHours: 1,
        bufferMins: 30,
        price: 6800,
        status: "Reserved",
        billed: false,
        billingRef: null,
        auditLog: [],
      },
    ],
    folioPostings: [
      {
        folioId: "FOL-8841",
        sourceBookingId: "AMN-2026-102",
        targetAccount: "Room 512 — Clara Lindqvist (Guest Folio)",
        description: "Amenity Charge: Floodlit Tennis Court Rental",
        amount: 1200,
        settlementType: "Auto-Posted to guest_charges_hos",
        timestamp: `${today} 10:05`,
      },
    ],
  };
}

export function getAmenityStore(): AmenityMemoryStore {
  const today = getManilaBusinessDate();
  if (!globalForAmenity.__hosAmenityStore) {
    globalForAmenity.__hosAmenityStore = buildInitialStore(today);
  }
  return globalForAmenity.__hosAmenityStore;
}

export const FALLBACK_AMENITY_RESERVATIONS: AmenityReservationOption[] = [
  {
    id: "RES-408",
    numericReservationId: null,
    guestName: "Elena Rostova",
    room: "Room 408",
    status: "In-House",
  },
  {
    id: "RES-305",
    numericReservationId: null,
    guestName: "Marcus Vance",
    room: "Room 305",
    status: "In-House",
  },
  {
    id: "RES-512",
    numericReservationId: null,
    guestName: "Clara Lindqvist",
    room: "Room 512",
    status: "In-House",
  },
];
