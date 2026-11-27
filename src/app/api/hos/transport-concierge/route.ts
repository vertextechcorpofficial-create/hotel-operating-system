import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canActorManageBookings,
  checkResourceConflicts,
} from "@/modules/hotel-operating-system/transport-concierge/lib/dispatch-engine";
import {
  API_BASE_URL,
  FALLBACK_RESERVATIONS,
  getAuthActor,
  getDirectusHeaders,
  getManilaBusinessDate,
  getManilaTimestamp,
  getTransportStore,
} from "@/modules/hotel-operating-system/transport-concierge/lib/transport-store";
import type {
  BookingStatus,
  FlightStatus,
  FolioPostingEntry,
  ReservationSource,
  ServiceType,
  TransportBooking,
  TransportRole,
} from "@/modules/hotel-operating-system/transport-concierge/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBookingSchema = z.object({
  role: z.enum(["Concierge", "Driver", "Billing", "Admin"]).default("Concierge"),
  reservationId: z.string().min(1),
  numericReservationId: z.number().int().nullable().optional(),
  guestName: z.string().min(1).max(160),
  room: z.string().max(120).default("N/A"),
  folioId: z.string().nullable().optional(),
  serviceType: z.enum([
    "Airport Pickup",
    "Airport Drop-off",
    "Chauffeur Charter",
    "Local Tour",
  ]),
  flightNo: z.string().max(40).default("N/A"),
  flightStatus: z
    .enum(["On Time", "Delayed (+45m)", "Diverted", "Landed", "N/A (Local)"])
    .default("On Time"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMins: z.coerce.number().int().min(15).max(720),
  pax: z.coerce.number().int().min(1).max(50),
  pickupLocation: z.string().min(1).max(200),
  dropoffLocation: z.string().min(1).max(200),
  vehicleId: z.string().default(""),
  driverId: z.string().default(""),
  rate: z.coerce.number().min(0).max(500000),
});

function extractNumericId(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string" && /^\d+$/.test(val)) return parseInt(val, 10);
  if (val && typeof val === "object" && "id" in val) {
    return extractNumericId((val as { id: unknown }).id);
  }
  return null;
}

function normalizeDateOnly(raw?: string | null): string {
  if (!raw) return "";
  return raw.split("T")[0].split(" ")[0];
}

async function fetchDirectusJson<T>(
  path: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; status: number; data: T[] }> {
  if (!API_BASE_URL) {
    return { ok: false, status: 500, data: [] };
  }
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, data: [] };
    }
    const json = (await res.json()) as { data?: T[] };
    return { ok: true, status: res.status, data: Array.isArray(json.data) ? json.data : [] };
  } catch {
    return { ok: false, status: 502, data: [] };
  }
}

export async function GET() {
  const auth = await getAuthActor();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getTransportStore();
  const headers = getDirectusHeaders();
  const today = getManilaBusinessDate();

  const [resResult, guestsResult, itemsResult, roomsResult, chargesResult, tbResult] =
    await Promise.all([
      fetchDirectusJson<Record<string, unknown>>(
        "/items/reservations_hos?limit=50&sort=-id",
        headers
      ),
      fetchDirectusJson<Record<string, unknown>>("/items/guests_hos?limit=200", headers),
      fetchDirectusJson<Record<string, unknown>>(
        "/items/reservation_items_hos?limit=200",
        headers
      ),
      fetchDirectusJson<Record<string, unknown>>("/items/rooms_hos?limit=100", headers),
      fetchDirectusJson<Record<string, unknown>>(
        "/items/guest_charges_hos?limit=50&sort=-id",
        headers
      ),
      fetchDirectusJson<Record<string, unknown>>(
        "/items/transport_bookings_hos?limit=100&sort=-id",
        headers
      ),
    ]);

  let reservations: ReservationSource[] = [];
  let reservationsSource: "live" | "fallback" = "fallback";

  if (resResult.ok && resResult.data.length > 0) {
    reservationsSource = "live";
    const guestMap = new Map<number, string>();
    for (const g of guestsResult.data) {
      const id = extractNumericId(g.id);
      if (id !== null) {
        const full = `${String(g.first_name || "")} ${String(g.last_name || "")}`.trim();
        if (full) guestMap.set(id, full);
      }
    }

    const roomMap = new Map<number, string>();
    for (const rm of roomsResult.data) {
      const id = extractNumericId(rm.id);
      if (id !== null) {
        roomMap.set(id, `Room ${String(rm.room_number || id)}`);
      }
    }

    const resRoomMap = new Map<number, string>();
    for (const item of itemsResult.data) {
      const resId = extractNumericId(item.reservation_id);
      const roomId = extractNumericId(item.room_id);
      if (resId !== null && roomId !== null && !resRoomMap.has(resId)) {
        resRoomMap.set(resId, roomMap.get(roomId) || `Room #${roomId}`);
      }
    }

    reservations = resResult.data.slice(0, 30).map((r) => {
      const idNum = extractNumericId(r.id) ?? 0;
      const guestId = extractNumericId(r.guest_id);
      const guestName =
        (guestId !== null ? guestMap.get(guestId) : undefined) ||
        `Guest #${guestId ?? idNum}`;
      const status = String(r.status || "Confirmed");
      const isClosed =
        status.toLowerCase().includes("checked-out") ||
        status.toLowerCase().includes("checked out") ||
        status.toLowerCase().includes("cancelled");

      return {
        id: `RES-${idNum}`,
        numericReservationId: idNum,
        guestName,
        room: resRoomMap.get(idNum) || "Unassigned Room",
        status,
        folioId: isClosed ? null : `FOL-${idNum}`,
        arrival: normalizeDateOnly(String(r.check_in || today)) || today,
        departure: normalizeDateOnly(String(r.check_out || today)) || today,
      };
    });

    reservations.push({
      id: "WALK-IN",
      numericReservationId: null,
      guestName: "Walk-In / Non-Resident Guest",
      room: "N/A (Direct Settlement)",
      status: "Walk-In",
      folioId: null,
      arrival: today,
      departure: today,
    });
  } else {
    reservations = FALLBACK_RESERVATIONS;
  }

  let bookings: TransportBooking[] = store.bookings;
  const directusBookingsMode: "live" | "fallback" = tbResult.ok ? "live" : "fallback";

  if (tbResult.ok && tbResult.data.length > 0) {
    bookings = tbResult.data.map((row, idx) => ({
      id: String(row.booking_code || row.id || `TRN-LIVE-${idx + 1}`),
      reservationId: String(row.reservation_id || "WALK-IN"),
      numericReservationId: extractNumericId(row.reservation_id),
      guestName: String(row.guest_name || "Guest"),
      room: String(row.room || "N/A"),
      folioId: row.folio_id ? String(row.folio_id) : null,
      serviceType: (row.service_type as ServiceType) || "Airport Pickup",
      flightNo: String(row.flight_no || "N/A"),
      flightStatus: (row.flight_status as FlightStatus) || "On Time",
      date: normalizeDateOnly(String(row.date || today)) || today,
      pickupTime: String(row.pickup_time || "09:00").slice(0, 5),
      durationMins: Number(row.duration_mins || 60),
      pax: Number(row.pax || 1),
      pickupLocation: String(row.pickup_location || "Hotel Lobby"),
      dropoffLocation: String(row.dropoff_location || "Airport"),
      vehicleId: String(row.vehicle_id || ""),
      driverId: String(row.driver_id || ""),
      rate: Number(row.rate || 0),
      status: (row.status as BookingStatus) || "Confirmed",
      billed: Boolean(row.billed),
      billingRef: row.billing_ref ? String(row.billing_ref) : null,
      auditLog: Array.isArray(row.audit_log) ? row.audit_log : [],
    }));
  }

  const liveTransportCharges: FolioPostingEntry[] = [];
  if (chargesResult.ok) {
    for (const ch of chargesResult.data) {
      const cType = String(ch.charge_type || "").toLowerCase();
      if (cType.includes("transport") || cType.includes("shuttle") || cType.includes("transfer")) {
        const resId = extractNumericId(ch.reservation_id);
        liveTransportCharges.push({
          postingId: `CHG-${String(ch.id)}`,
          bookingId: resId ? `RES-${resId}` : "DIRECTUS",
          targetAccount: resId ? `FOL-${resId} (guest_charges_hos)` : "guest_charges_hos",
          description: String(ch.description || "Transport Transfer"),
          postedBy: "Directus Ledger",
          timestamp: String(ch.charge_date || ch.created_at || today).slice(0, 16).replace("T", " "),
          amount: Number(ch.amount || 0),
          source: "guest_charges_hos",
        });
      }
    }
  }

  const seenPostingIds = new Set(store.folioPostings.map((p) => p.postingId));
  const combinedPostings = [
    ...store.folioPostings,
    ...liveTransportCharges.filter((p) => !seenPostingIds.has(p.postingId)),
  ];

  return NextResponse.json({
    success: true,
    data: {
      bookings,
      reservations,
      vehicles: store.vehicles,
      drivers: store.drivers,
      folioPostings: combinedPostings,
      meta: {
        businessDate: today,
        directusBookingsMode,
        reservationsSource,
        turnaroundBufferMins: 30,
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

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const role = input.role as TransportRole;
  if (!canActorManageBookings(role)) {
    return NextResponse.json(
      { error: `Role "${role}" cannot create transport bookings.` },
      { status: 403 }
    );
  }

  const store = getTransportStore();
  const conflict = checkResourceConflicts({
    date: input.date,
    pickupTime: input.pickupTime,
    durationMins: input.durationMins,
    vehicleId: input.vehicleId || undefined,
    driverId: input.driverId || undefined,
    pax: input.pax,
    bookings: store.bookings,
    vehicles: store.vehicles,
    drivers: store.drivers,
  });

  if (!conflict.valid) {
    return NextResponse.json({ error: conflict.message }, { status: 409 });
  }

  const nextNumber = store.bookings.length + 1;
  const newId = `TRN-${input.date.slice(2, 4)}${input.date.slice(5, 7)}-${String(
    nextNumber
  ).padStart(3, "0")}`;

  const initialStatus: BookingStatus =
    input.vehicleId && input.driverId ? "Driver Assigned" : "Confirmed";

  const newBooking: TransportBooking = {
    id: newId,
    reservationId: input.reservationId,
    numericReservationId: input.numericReservationId ?? null,
    guestName: input.guestName.trim(),
    room: input.room,
    folioId: input.folioId ?? null,
    serviceType: input.serviceType as ServiceType,
    flightNo: input.flightNo.trim().toUpperCase() || "N/A",
    flightStatus: input.flightStatus as FlightStatus,
    date: input.date,
    pickupTime: input.pickupTime,
    durationMins: input.durationMins,
    pax: input.pax,
    pickupLocation: input.pickupLocation.trim(),
    dropoffLocation: input.dropoffLocation.trim(),
    vehicleId: input.vehicleId,
    driverId: input.driverId,
    rate: input.rate,
    status: initialStatus,
    billed: false,
    billingRef: null,
    auditLog: [
      {
        timestamp: getManilaTimestamp(),
        actor: `${role} (${auth.actorName})`,
        action: "Created Booking",
        prev: "—",
        next: initialStatus,
        reason: `Scheduled ${input.serviceType}`,
      },
    ],
  };

  store.bookings.push(newBooking);

  return NextResponse.json({ success: true, data: newBooking }, { status: 201 });
}
