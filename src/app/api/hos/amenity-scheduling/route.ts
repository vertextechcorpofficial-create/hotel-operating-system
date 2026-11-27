import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AMENITY_PACKAGES,
  validateSlotReservation,
} from "@/modules/hotel-operating-system/amenity-scheduling/lib/slot-engine";
import {
  API_BASE_URL,
  FALLBACK_AMENITY_RESERVATIONS,
  getAmenityStore,
  getAuthActor,
  getDirectusHeaders,
  getManilaBusinessDate,
  getManilaTimestamp,
} from "@/modules/hotel-operating-system/amenity-scheduling/lib/amenity-store";
import type {
  AmenityBooking,
  AmenityFolioPosting,
  AmenityReservationOption,
} from "@/modules/hotel-operating-system/amenity-scheduling/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBookingSchema = z.object({
  role: z.enum(["Receptionist", "Manager", "Therapist"]).default("Receptionist"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guest: z.string().min(1).max(180),
  reservationId: z.string().min(1).default("WALK-IN"),
  numericReservationId: z.number().int().nullable().optional(),
  billingMode: z.enum(["inhouse", "walkin"]),
  packageId: z.string().min(1),
  resourceId: z.string().min(1),
  therapistIds: z.array(z.string()).default([]),
  startHour: z.coerce.number().int().min(9).max(17),
});

function extractNumericId(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string" && /^\d+$/.test(val)) return parseInt(val, 10);
  if (val && typeof val === "object" && "id" in val) {
    return extractNumericId((val as { id: unknown }).id);
  }
  return null;
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
    return {
      ok: true,
      status: res.status,
      data: Array.isArray(json.data) ? json.data : [],
    };
  } catch {
    return { ok: false, status: 502, data: [] };
  }
}

export async function GET() {
  const auth = await getAuthActor();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getAmenityStore();
  const headers = getDirectusHeaders();
  const today = getManilaBusinessDate();

  const [resResult, guestsResult, itemsResult, roomsResult, chargesResult, abResult] =
    await Promise.all([
      fetchDirectusJson<Record<string, unknown>>(
        "/items/reservations_hos?limit=40&sort=-id",
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
        "/items/amenity_bookings_hos?limit=50",
        headers
      ),
    ]);

  let reservations: AmenityReservationOption[] = [];
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

    reservations = resResult.data.slice(0, 25).map((r) => {
      const idNum = extractNumericId(r.id) ?? 0;
      const guestId = extractNumericId(r.guest_id);
      const guestName =
        (guestId !== null ? guestMap.get(guestId) : undefined) ||
        `Guest #${guestId ?? idNum}`;
      return {
        id: `RES-${idNum}`,
        numericReservationId: idNum,
        guestName,
        room: resRoomMap.get(idNum) || "Unassigned Room",
        status: String(r.status || "Confirmed"),
      };
    });
  } else {
    reservations = FALLBACK_AMENITY_RESERVATIONS;
  }

  const liveAmenityCharges: AmenityFolioPosting[] = [];
  if (chargesResult.ok) {
    for (const ch of chargesResult.data) {
      const cType = String(ch.charge_type || "").toLowerCase();
      if (cType.includes("amenity") || cType.includes("spa") || cType.includes("wellness")) {
        const resId = extractNumericId(ch.reservation_id);
        liveAmenityCharges.push({
          folioId: `CHG-${String(ch.id)}`,
          sourceBookingId: resId ? `RES-${resId}` : "DIRECTUS",
          targetAccount: resId ? `FOL-${resId} (guest_charges_hos)` : "guest_charges_hos",
          description: String(ch.description || "Amenity Session"),
          amount: Number(ch.amount || 0),
          settlementType: "Auto-Posted to guest_charges_hos",
          timestamp: String(ch.charge_date || ch.created_at || today)
            .slice(0, 16)
            .replace("T", " "),
        });
      }
    }
  }

  const seenIds = new Set(store.folioPostings.map((p) => p.folioId));
  const combinedPostings = [
    ...store.folioPostings,
    ...liveAmenityCharges.filter((p) => !seenIds.has(p.folioId)),
  ];

  return NextResponse.json({
    success: true,
    data: {
      resources: store.resources,
      bookings: store.bookings,
      folioPostings: combinedPostings,
      reservations,
      meta: {
        businessDate: today,
        directusAmenityMode: abResult.ok ? "live" : "fallback",
        reservationsSource,
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
  if (input.role === "Therapist") {
    return NextResponse.json(
      { error: 'Role "Therapist" cannot create new amenity reservations.' },
      { status: 403 }
    );
  }

  const pkg = AMENITY_PACKAGES.find((p) => p.id === input.packageId);
  if (!pkg) {
    return NextResponse.json({ error: "Unknown service package." }, { status: 400 });
  }

  const store = getAmenityStore();
  const validation = validateSlotReservation({
    date: input.date,
    startHour: input.startHour,
    packageId: input.packageId,
    resourceId: input.resourceId,
    therapistIds: input.therapistIds,
    resources: store.resources,
    bookings: store.bookings,
  });

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors.join(" ") },
      { status: 409 }
    );
  }

  const durationHours = Math.ceil(pkg.durationMins / 60);
  const bufferHours = pkg.bufferMins > 0 ? 1 : 0;

  const newBooking: AmenityBooking = {
    id: `AMN-2026-${104 + store.bookings.length}`,
    date: input.date,
    guest: input.guest.trim(),
    reservationId: input.reservationId,
    numericReservationId: input.numericReservationId ?? null,
    billingMode: input.billingMode,
    packageId: pkg.id,
    serviceName: pkg.name,
    resourceId: input.resourceId,
    therapistIds: input.therapistIds,
    startHour: input.startHour,
    durationHours,
    bufferHours,
    bufferMins: pkg.bufferMins,
    price: pkg.price,
    status: "Reserved",
    billed: false,
    billingRef: null,
    auditLog: [
      {
        timestamp: getManilaTimestamp(),
        actor: `${input.role} (${auth.actorName})`,
        action: "Created Slot Reservation",
        reason: `Locked ${pkg.name} (${pkg.durationMins}m + ${pkg.bufferMins}m buffer)`,
      },
    ],
  };

  store.bookings.unshift(newBooking);

  return NextResponse.json({ success: true, data: newBooking }, { status: 201 });
}
