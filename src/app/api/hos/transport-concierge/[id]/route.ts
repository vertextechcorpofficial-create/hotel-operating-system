import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canActorManageBookings,
  canActorPerformTransition,
  canActorPostFolio,
  checkResourceConflicts,
  STATUS_TRANSITIONS,
} from "@/modules/hotel-operating-system/transport-concierge/lib/dispatch-engine";
import {
  API_BASE_URL,
  getAuthActor,
  getDirectusHeaders,
  getManilaTimestamp,
  getTransportStore,
} from "@/modules/hotel-operating-system/transport-concierge/lib/transport-store";
import type {
  BookingStatus,
  FlightStatus,
  ServiceType,
  TransportRole,
} from "@/modules/hotel-operating-system/transport-concierge/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    role: z.enum(["Concierge", "Driver", "Billing", "Admin"]),
    reservationId: z.string().min(1),
    numericReservationId: z.number().int().nullable().optional(),
    guestName: z.string().min(1).max(160),
    room: z.string().max(120),
    folioId: z.string().nullable().optional(),
    serviceType: z.enum([
      "Airport Pickup",
      "Airport Drop-off",
      "Chauffeur Charter",
      "Local Tour",
    ]),
    flightNo: z.string().max(40),
    flightStatus: z.enum([
      "On Time",
      "Delayed (+45m)",
      "Diverted",
      "Landed",
      "N/A (Local)",
    ]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
    durationMins: z.coerce.number().int().min(15).max(720),
    pax: z.coerce.number().int().min(1).max(50),
    pickupLocation: z.string().min(1).max(200),
    dropoffLocation: z.string().min(1).max(200),
    vehicleId: z.string().default(""),
    driverId: z.string().default(""),
    rate: z.coerce.number().min(0).max(500000),
    editReason: z.string().min(1).max(300),
  }),
  z.object({
    action: z.literal("transition"),
    role: z.enum(["Concierge", "Driver", "Billing", "Admin"]),
    targetState: z.enum([
      "Requested",
      "Confirmed",
      "Driver Assigned",
      "En Route / Picked Up",
      "Completed",
      "Cancelled",
      "No-Show",
    ]),
    reason: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal("post_folio"),
    role: z.enum(["Concierge", "Driver", "Billing", "Admin"]),
  }),
]);

const deleteSchema = z.object({
  role: z.enum(["Concierge", "Driver", "Billing", "Admin"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthActor();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const store = getTransportStore();
  const idx = store.bookings.findIndex((b) => b.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const existing = store.bookings[idx];
  const role = payload.role as TransportRole;
  const nowTs = getManilaTimestamp();

  if (payload.action === "update") {
    if (!canActorManageBookings(role)) {
      return NextResponse.json(
        { error: `Role "${role}" cannot edit bookings.` },
        { status: 403 }
      );
    }
    if (["Completed", "Cancelled", "No-Show"].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot edit booking in terminal state "${existing.status}".` },
        { status: 400 }
      );
    }

    const conflict = checkResourceConflicts({
      excludeBookingId: existing.id,
      date: payload.date,
      pickupTime: payload.pickupTime,
      durationMins: payload.durationMins,
      vehicleId: payload.vehicleId || undefined,
      driverId: payload.driverId || undefined,
      pax: payload.pax,
      bookings: store.bookings,
      vehicles: store.vehicles,
      drivers: store.drivers,
    });
    if (!conflict.valid) {
      return NextResponse.json({ error: conflict.message }, { status: 409 });
    }

    let nextStatus = existing.status;
    if (
      (existing.status === "Requested" || existing.status === "Confirmed") &&
      payload.vehicleId &&
      payload.driverId
    ) {
      nextStatus = "Driver Assigned";
    }

    store.bookings[idx] = {
      ...existing,
      reservationId: payload.reservationId,
      numericReservationId: payload.numericReservationId ?? existing.numericReservationId,
      guestName: payload.guestName.trim(),
      room: payload.room,
      folioId: payload.folioId ?? null,
      serviceType: payload.serviceType as ServiceType,
      flightNo: payload.flightNo.trim().toUpperCase() || "N/A",
      flightStatus: payload.flightStatus as FlightStatus,
      date: payload.date,
      pickupTime: payload.pickupTime,
      durationMins: payload.durationMins,
      pax: payload.pax,
      pickupLocation: payload.pickupLocation.trim(),
      dropoffLocation: payload.dropoffLocation.trim(),
      vehicleId: payload.vehicleId,
      driverId: payload.driverId,
      rate: payload.rate,
      status: nextStatus,
      auditLog: [
        ...existing.auditLog,
        {
          timestamp: nowTs,
          actor: `${role} (${auth.actorName})`,
          action: "Rescheduled / Updated",
          prev: `${existing.pickupTime} (${existing.flightStatus})`,
          next: `${payload.pickupTime} (${payload.flightStatus})`,
          reason: payload.editReason.trim(),
        },
      ],
    };

    return NextResponse.json({ success: true, data: store.bookings[idx] });
  }

  if (payload.action === "transition") {
    const targetState = payload.targetState as BookingStatus;
    const allowedTransitions = STATUS_TRANSITIONS[existing.status] || [];
    if (!allowedTransitions.includes(targetState)) {
      return NextResponse.json(
        { error: `Invalid transition from "${existing.status}" to "${targetState}".` },
        { status: 400 }
      );
    }
    if (!canActorPerformTransition(role, targetState)) {
      return NextResponse.json(
        { error: `Role "${role}" is not authorized to set "${targetState}".` },
        { status: 403 }
      );
    }
    if (targetState === "Driver Assigned" && (!existing.vehicleId || !existing.driverId)) {
      return NextResponse.json(
        { error: "Assign both vehicle and driver before setting Driver Assigned." },
        { status: 400 }
      );
    }
    if (
      (targetState === "Cancelled" || targetState === "No-Show") &&
      !payload.reason?.trim()
    ) {
      return NextResponse.json(
        { error: "Audit reason is required for Cancelled or No-Show status." },
        { status: 400 }
      );
    }

    const prev = existing.status;
    existing.status = targetState;
    existing.auditLog.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: `Status → ${targetState}`,
      prev,
      next: targetState,
      reason: payload.reason?.trim() || "Standard workflow update",
    });

    return NextResponse.json({ success: true, data: existing });
  }

  // action === 'post_folio'
  if (!canActorPostFolio(role)) {
    return NextResponse.json(
      { error: `Role "${role}" cannot post folio charges.` },
      { status: 403 }
    );
  }
  if (existing.billed) {
    return NextResponse.json(
      { error: "Duplicate posting prevented: this trip is already billed." },
      { status: 409 }
    );
  }
  if (existing.status !== "Completed") {
    return NextResponse.json(
      { error: "Trip must reach Completed status before posting charges." },
      { status: 400 }
    );
  }

  const isWalkIn = existing.reservationId === "WALK-IN" || !existing.folioId;
  const veh = store.vehicles.find((v) => v.id === existing.vehicleId);
  const description = `${existing.serviceType} (${existing.flightNo}) • ${
    veh ? veh.name : "Hotel Fleet"
  }`;

  let postingId = `CHG-${7701 + store.folioPostings.length}`;
  let source: "guest_charges_hos" | "immediate_settlement" | "fallback" = isWalkIn
    ? "immediate_settlement"
    : "fallback";

  // Attempt live write to Directus guest_charges_hos for resident reservations with numeric ID
  if (!isWalkIn && existing.numericReservationId && API_BASE_URL) {
    try {
      const chargeRes = await fetch(`${API_BASE_URL}/items/guest_charges_hos`, {
        method: "POST",
        headers: getDirectusHeaders(),
        body: JSON.stringify({
          reservation_id: existing.numericReservationId,
          charge_type: "Transport",
          description,
          amount: existing.rate,
          charge_date: new Date().toISOString(),
          created_by: auth.userId,
          updated_by: auth.userId,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (chargeRes.ok) {
        const created = (await chargeRes.json()) as { data?: { id?: number | string } };
        if (created.data?.id !== undefined) {
          postingId = `CHG-${created.data.id}`;
          source = "guest_charges_hos";
        }
      }
    } catch {
      // Fallback gracefully if Directus is unreachable
    }
  }

  const targetAccount = isWalkIn
    ? `Immediate Settlement (${existing.guestName})`
    : `${existing.folioId} (${existing.room} - ${existing.guestName})`;

  const posting = {
    postingId,
    bookingId: existing.id,
    targetAccount,
    description,
    postedBy: `${role} (${auth.actorName})`,
    timestamp: nowTs,
    amount: existing.rate,
    source,
  };

  store.folioPostings.unshift(posting);
  existing.billed = true;
  existing.billingRef = isWalkIn
    ? `${postingId} (Immediate)`
    : `${postingId} (${existing.folioId})`;
  existing.auditLog.push({
    timestamp: nowTs,
    actor: `${role} (${auth.actorName})`,
    action: isWalkIn ? "Settled Immediate Receipt" : "Posted to guest_charges_hos",
    prev: "Unbilled",
    next: `${existing.billingRef} • ₱${existing.rate.toLocaleString()}`,
    reason: "Completed trip charge verified",
  });

  return NextResponse.json({ success: true, data: { booking: existing, posting } });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthActor();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let role: TransportRole = "Concierge";
  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (parsed.success) role = parsed.data.role;
  } catch {
    // Allow empty body -> defaults to Concierge (will fail Admin check cleanly)
  }

  if (role !== "Admin") {
    return NextResponse.json(
      { error: "Only Admin role can delete transport records." },
      { status: 403 }
    );
  }

  const store = getTransportStore();
  const target = store.bookings.find((b) => b.id === id);
  if (!target) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (target.billed) {
    return NextResponse.json(
      { error: "Constraint: Cannot delete records with posted folio charges." },
      { status: 409 }
    );
  }

  store.bookings = store.bookings.filter((b) => b.id !== id);
  return NextResponse.json({ success: true, deletedId: id });
}
