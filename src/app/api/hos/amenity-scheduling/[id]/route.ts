import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canActorTransition,
  STATUS_TRANSITIONS,
} from "@/modules/hotel-operating-system/amenity-scheduling/lib/slot-engine";
import {
  API_BASE_URL,
  getAmenityStore,
  getAuthActor,
  getDirectusHeaders,
  getManilaTimestamp,
} from "@/modules/hotel-operating-system/amenity-scheduling/lib/amenity-store";
import type {
  AmenityBookingStatus,
  AmenityRole,
} from "@/modules/hotel-operating-system/amenity-scheduling/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const transitionSchema = z.object({
  role: z.enum(["Receptionist", "Manager", "Therapist"]),
  targetState: z.enum([
    "Reserved",
    "Checked In",
    "In Session",
    "Completed",
    "Cancelled",
    "No-Show",
  ]),
  reason: z.string().max(300).optional(),
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
  const store = getAmenityStore();
  const booking = store.bookings.find((b) => b.id === id);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { role, targetState, reason } = parsed.data;
  const allowedNext = STATUS_TRANSITIONS[booking.status] || [];
  if (!allowedNext.includes(targetState as AmenityBookingStatus)) {
    return NextResponse.json(
      { error: `Invalid transition from "${booking.status}" to "${targetState}".` },
      { status: 400 }
    );
  }

  if (!canActorTransition(role as AmenityRole, targetState as AmenityBookingStatus)) {
    return NextResponse.json(
      {
        error: `Permission Denied: Role "${role}" cannot set "${targetState}".`,
      },
      { status: 403 }
    );
  }

  if (
    (targetState === "Cancelled" || targetState === "No-Show") &&
    !reason?.trim()
  ) {
    return NextResponse.json(
      { error: "Audit reason is mandatory for cancellations or no-shows." },
      { status: 400 }
    );
  }

  const nowTs = getManilaTimestamp();
  booking.status = targetState as AmenityBookingStatus;
  booking.auditLog.push({
    timestamp: nowTs,
    actor: `${role} (${auth.actorName})`,
    action: targetState,
    reason: reason?.trim() || `Transitioned to ${targetState}`,
  });

  if (targetState === "Completed" && !booking.billed) {
    const isWalkIn = booking.billingMode === "walkin";
    let postingId = `FOL-${Math.floor(1000 + Math.random() * 9000)}`;
    let settlementType = isWalkIn
      ? "Settled via POS Cash/Card (/hos/pos-services)"
      : "Auto-Posted to guest_charges_hos";

    if (!isWalkIn && booking.numericReservationId && API_BASE_URL) {
      try {
        const chargeRes = await fetch(`${API_BASE_URL}/items/guest_charges_hos`, {
          method: "POST",
          headers: getDirectusHeaders(),
          body: JSON.stringify({
            reservation_id: booking.numericReservationId,
            charge_type: "Amenity",
            description: `Amenity Session: ${booking.serviceName} (${booking.id})`,
            amount: booking.price,
            charge_date: new Date().toISOString(),
            created_by: auth.userId,
            updated_by: auth.userId,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (chargeRes.ok) {
          const created = (await chargeRes.json()) as {
            data?: { id?: number | string };
          };
          if (created.data?.id !== undefined) {
            postingId = `CHG-${created.data.id}`;
            settlementType = "Auto-Posted to guest_charges_hos (Live)";
          }
        }
      } catch {
        // Fallback gracefully if Directus is unreachable
      }
    }

    booking.billed = true;
    booking.billingRef = postingId;
    store.folioPostings.unshift({
      folioId: postingId,
      sourceBookingId: booking.id,
      targetAccount: isWalkIn
        ? `${booking.guest} (POS Walk-In)`
        : `${booking.guest} (Room Folio)`,
      description: `Amenity Session: ${booking.serviceName}`,
      amount: booking.price,
      settlementType,
      timestamp: nowTs,
    });
  }

  return NextResponse.json({ success: true, data: booking });
}
