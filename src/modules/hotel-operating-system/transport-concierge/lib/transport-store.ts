import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import type {
  DriverRoster,
  FolioPostingEntry,
  ReservationSource,
  TransportBooking,
  VehicleMaster,
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

export async function getAuthActor(fallbackRole = "Concierge"): Promise<{
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

interface TransportMemoryStore {
  seededDate: string;
  vehicles: VehicleMaster[];
  drivers: DriverRoster[];
  bookings: TransportBooking[];
  folioPostings: FolioPostingEntry[];
}

const globalForTransport = globalThis as unknown as {
  __hosTransportStore?: TransportMemoryStore;
};

function buildInitialStore(today: string): TransportMemoryStore {
  return {
    seededDate: today,
    vehicles: [
      {
        id: "VEH-01",
        name: "Mercedes-Benz S-Class",
        plate: "VOS-101",
        type: "Executive Sedan",
        capacity: 3,
        active: true,
      },
      {
        id: "VEH-02",
        name: "Toyota Alphard Executive",
        plate: "VOS-204",
        type: "Luxury MPV",
        capacity: 6,
        active: true,
      },
      {
        id: "VEH-03",
        name: "Hyundai Staria Lounge",
        plate: "VOS-308",
        type: "Shuttle Van",
        capacity: 9,
        active: true,
      },
      {
        id: "VEH-04",
        name: "Toyota Coaster VIP",
        plate: "VOS-412",
        type: "Group Shuttle",
        capacity: 15,
        active: true,
      },
    ],
    drivers: [
      {
        id: "DRV-01",
        name: "Roberto Cruz",
        license: "PRO-88219",
        shiftStart: "06:00",
        shiftEnd: "18:00",
        onDuty: true,
      },
      {
        id: "DRV-02",
        name: "Dante Navarro",
        license: "PRO-77410",
        shiftStart: "08:00",
        shiftEnd: "20:00",
        onDuty: true,
      },
      {
        id: "DRV-03",
        name: "Miguel Santos",
        license: "PRO-91044",
        shiftStart: "12:00",
        shiftEnd: "23:59",
        onDuty: true,
      },
      {
        id: "DRV-04",
        name: "Carlos Mendoza",
        license: "PRO-65201",
        shiftStart: "06:00",
        shiftEnd: "14:00",
        onDuty: false,
      },
    ],
    bookings: [
      {
        id: "TRN-2611-001",
        reservationId: "RES-8841",
        numericReservationId: null,
        guestName: "Alexander Vance",
        room: "Suite 1402",
        folioId: "FOL-9012",
        serviceType: "Airport Drop-off",
        flightNo: "JL 746",
        flightStatus: "On Time",
        date: today,
        pickupTime: "08:30",
        durationMins: 60,
        pax: 2,
        pickupLocation: "VOS Grand Hotel Main Lobby",
        dropoffLocation: "NAIA Terminal 1 Departure",
        vehicleId: "VEH-01",
        driverId: "DRV-01",
        rate: 3200,
        status: "Completed",
        billed: true,
        billingRef: "CHG-7701 (FOL-9012)",
        auditLog: [
          {
            timestamp: `${today} 07:10`,
            actor: "Concierge (A. Reyes)",
            action: "Created Booking",
            prev: "—",
            next: "Confirmed",
            reason: "Morning departure transfer",
          },
          {
            timestamp: `${today} 09:28`,
            actor: "Driver (Roberto Cruz)",
            action: "Trip Completed",
            prev: "En Route / Picked Up",
            next: "Completed",
            reason: "Dropped at NAIA T1",
          },
          {
            timestamp: `${today} 09:35`,
            actor: "Billing (L. Gomez)",
            action: "Posted to guest_charges_hos",
            prev: "Unbilled",
            next: "FOL-9012 (₱3,200.00)",
            reason: "Verified completed transfer",
          },
        ],
      },
      {
        id: "TRN-2611-002",
        reservationId: "RES-8894",
        numericReservationId: null,
        guestName: "Dr. Clarissa Lim",
        room: "Deluxe 809",
        folioId: "FOL-9045",
        serviceType: "Airport Pickup",
        flightNo: "PR 103",
        flightStatus: "Delayed (+45m)",
        date: today,
        pickupTime: "11:15",
        durationMins: 75,
        pax: 1,
        pickupLocation: "NAIA Terminal 2 Arrival Bay 4",
        dropoffLocation: "VOS Grand Hotel Main Lobby",
        vehicleId: "VEH-02",
        driverId: "DRV-02",
        rate: 2800,
        status: "Driver Assigned",
        billed: false,
        billingRef: null,
        auditLog: [
          {
            timestamp: `${today} 08:20`,
            actor: "Concierge (M. Cruz)",
            action: "Created Booking",
            prev: "—",
            next: "Confirmed",
            reason: "VIP Arrival Pickup",
          },
          {
            timestamp: `${today} 09:50`,
            actor: "Concierge (M. Cruz)",
            action: "Rescheduled Flight Delay",
            prev: "10:30 (On Time)",
            next: "11:15 (Delayed +45m)",
            reason: "Airline advisory: PR 103 delayed 45 mins",
          },
        ],
      },
      {
        id: "TRN-2611-003",
        reservationId: "RES-8902",
        numericReservationId: null,
        guestName: "Kenji Takahashi",
        room: "Exec 1105",
        folioId: "FOL-9051",
        serviceType: "Chauffeur Charter",
        flightNo: "N/A",
        flightStatus: "N/A (Local)",
        date: today,
        pickupTime: "14:00",
        durationMins: 180,
        pax: 3,
        pickupLocation: "VOS Grand Hotel Porte-Cochère",
        dropoffLocation: "BGC Financial District & Makati",
        vehicleId: "VEH-01",
        driverId: "DRV-01",
        rate: 6500,
        status: "Confirmed",
        billed: false,
        billingRef: null,
        auditLog: [
          {
            timestamp: `${today} 08:15`,
            actor: "Concierge (A. Reyes)",
            action: "Created Booking",
            prev: "—",
            next: "Confirmed",
            reason: "3-hour executive business charter",
          },
        ],
      },
      {
        id: "TRN-2611-004",
        reservationId: "WALK-IN",
        numericReservationId: null,
        guestName: "Elena Rostova (Walk-In)",
        room: "N/A (Direct Settlement)",
        folioId: null,
        serviceType: "Local Tour",
        flightNo: "N/A",
        flightStatus: "N/A (Local)",
        date: today,
        pickupTime: "15:30",
        durationMins: 120,
        pax: 4,
        pickupLocation: "VOS Grand Hotel Concierge Desk",
        dropoffLocation: "Intramuros Heritage Tour",
        vehicleId: "VEH-03",
        driverId: "DRV-03",
        rate: 4200,
        status: "Completed",
        billed: false,
        billingRef: null,
        auditLog: [
          {
            timestamp: `${today} 12:00`,
            actor: "Concierge (A. Reyes)",
            action: "Created Walk-In Tour",
            prev: "—",
            next: "Confirmed",
            reason: "Non-resident tour; immediate settlement",
          },
          {
            timestamp: `${today} 17:35`,
            actor: "Driver (Miguel Santos)",
            action: "Trip Completed",
            prev: "En Route / Picked Up",
            next: "Completed",
            reason: "Returned to hotel lobby",
          },
        ],
      },
      {
        id: "TRN-2611-005",
        reservationId: "RES-8910",
        numericReservationId: null,
        guestName: "Sofia & Mateo Reyes",
        room: "Villa 03",
        folioId: "FOL-9060",
        serviceType: "Airport Pickup",
        flightNo: "SQ 916",
        flightStatus: "On Time",
        date: today,
        pickupTime: "18:30",
        durationMins: 60,
        pax: 4,
        pickupLocation: "NAIA Terminal 3 VIP Arrival",
        dropoffLocation: "VOS Grand Hotel Villa Wing",
        vehicleId: "",
        driverId: "",
        rate: 3000,
        status: "Requested",
        billed: false,
        billingRef: null,
        auditLog: [
          {
            timestamp: `${today} 10:05`,
            actor: "Reservations Sync",
            action: "Auto-Requested Transfer",
            prev: "—",
            next: "Requested",
            reason: "Imported from reservations_hos",
          },
        ],
      },
    ],
    folioPostings: [
      {
        postingId: "CHG-7701",
        bookingId: "TRN-2611-001",
        targetAccount: "FOL-9012 (Suite 1402 - Alexander Vance)",
        description: "Airport Drop-off (JL 746) • Mercedes-Benz S-Class",
        postedBy: "Billing (L. Gomez)",
        timestamp: `${today} 09:35`,
        amount: 3200,
        source: "fallback",
      },
    ],
  };
}

export function getTransportStore(): TransportMemoryStore {
  const today = getManilaBusinessDate();
  if (!globalForTransport.__hosTransportStore) {
    globalForTransport.__hosTransportStore = buildInitialStore(today);
  }
  return globalForTransport.__hosTransportStore;
}

export const FALLBACK_RESERVATIONS: ReservationSource[] = [
  {
    id: "RES-8841",
    numericReservationId: null,
    guestName: "Alexander Vance",
    room: "Suite 1402",
    status: "In-House",
    folioId: "FOL-9012",
    arrival: "2026-11-24",
    departure: "2026-11-28",
  },
  {
    id: "RES-8894",
    numericReservationId: null,
    guestName: "Dr. Clarissa Lim",
    room: "Deluxe 809",
    status: "Guaranteed Arrival",
    folioId: "FOL-9045",
    arrival: "2026-11-26",
    departure: "2026-11-30",
  },
  {
    id: "RES-8902",
    numericReservationId: null,
    guestName: "Kenji Takahashi",
    room: "Exec 1105",
    status: "In-House",
    folioId: "FOL-9051",
    arrival: "2026-11-25",
    departure: "2026-11-27",
  },
  {
    id: "RES-8910",
    numericReservationId: null,
    guestName: "Sofia & Mateo Reyes",
    room: "Villa 03",
    status: "Guaranteed Arrival",
    folioId: "FOL-9060",
    arrival: "2026-11-26",
    departure: "2026-12-01",
  },
  {
    id: "RES-8799",
    numericReservationId: null,
    guestName: "Marcus Sterling",
    room: "Checked-Out",
    status: "Checked-Out (Closed)",
    folioId: null,
    arrival: "2026-11-20",
    departure: "2026-11-25",
  },
  {
    id: "WALK-IN",
    numericReservationId: null,
    guestName: "Walk-In / Non-Resident Guest",
    room: "N/A (Direct Settlement)",
    status: "Walk-In",
    folioId: null,
    arrival: getManilaBusinessDate(),
    departure: getManilaBusinessDate(),
  },
];
