import { NextResponse } from "next/server";
import { z } from "zod";
import {
  NEXT_LAUNDRY_TRANSITIONS,
  calculateLaundryOrderTotal,
  canDeleteLaundryOrder,
  canRolePerformSupervisorOverride,
  canRoleTransitionLaundryStatus,
} from "@/modules/hotel-operating-system/laundry-dispatch/lib/laundry-engine";
import {
  getAuthActor,
  getLaundryStore,
  getManilaTimeLabel,
  getManilaTimestamp,
} from "@/modules/hotel-operating-system/laundry-dispatch/lib/laundry-store";
import type { LaundryRole } from "@/modules/hotel-operating-system/laundry-dispatch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roleSchema = z
  .enum([
    "Laundry Supervisor",
    "Valet Runner",
    "Front Desk Supervisor",
    "Revenue Manager",
    "Sales Manager",
    "System Admin",
  ])
  .default("Laundry Supervisor");

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("advance"),
    role: roleSchema,
  }),
  z.object({
    action: z.literal("post_folio"),
    role: roleSchema,
  }),
  z.object({
    action: z.literal("expedite"),
    role: roleSchema,
  }),
  z.object({
    action: z.literal("reopen"),
    role: roleSchema,
    reason: z.string().trim().min(3).max(300),
  }),
  z.object({
    action: z.literal("damage_credit"),
    role: roleSchema,
    reason: z.string().trim().min(3).max(300),
  }),
]);

const deleteSchema = z.object({
  role: roleSchema,
});

function postValetChargeInternal(
  store: ReturnType<typeof getLaundryStore>,
  orderIndex: number
): { ok: true; amount: number } | { ok: false; error: string } {
  const order = store.orders[orderIndex];
  if (order.category === "LINEN") {
    return {
      ok: false,
      error: "Hotel Bulk Linen batches are non-billable and cannot post to folios.",
    };
  }
  if (order.billedToFolio) {
    return {
      ok: false,
      error: `Duplicate billing prevented: ${order.id} is already posted to folios_hos.`,
    };
  }

  const amount = calculateLaundryOrderTotal(order);
  order.billedToFolio = true;
  store.folios.unshift({
    id: `FOL-${store.nextFolioNum++}`,
    account: order.roomOrDept,
    source: `Valet Laundry (${order.id} • ${order.tier})`,
    amount,
    status: "Posted",
    timestamp: getManilaTimeLabel(),
  });
  return { ok: true, amount };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthActor();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const store = getLaundryStore();
  const idx = store.orders.findIndex((o) => o.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Laundry ticket not found." }, { status: 404 });
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

  const input = parsed.data;
  const order = store.orders[idx];
  const actorLabel = `${input.role} (${auth.actorName})`;

  switch (input.action) {
    case "advance": {
      if (!canRoleTransitionLaundryStatus(input.role as LaundryRole)) {
        return NextResponse.json(
          {
            error: `Role "${input.role}" cannot transition laundry order states.`,
          },
          { status: 403 }
        );
      }

      const nextStatus = NEXT_LAUNDRY_TRANSITIONS[order.status];
      if (!nextStatus) {
        return NextResponse.json(
          { error: `Ticket ${order.id} is already in "${order.status}".` },
          { status: 400 }
        );
      }

      const prevStatus = order.status;
      order.status = nextStatus;

      if (order.category === "LINEN" && nextStatus === "Delivered") {
        store.linenStock[0].clean += 40;
        store.linenStock[0].inWash = Math.max(0, store.linenStock[0].inWash - 40);
      }

      let folioPostedMessage = "";
      if (
        order.category === "VALET" &&
        (nextStatus === "Quality Check / Ready" || nextStatus === "Delivered") &&
        !order.billedToFolio
      ) {
        const res = postValetChargeInternal(store, idx);
        if (res.ok) {
          folioPostedMessage = ` Auto-posted ₱${res.amount.toLocaleString()} to folios_hos.`;
        }
      }

      order.auditLogs.unshift({
        timestamp: getManilaTimestamp(),
        actor: actorLabel,
        action: "Status Transition",
        prev: prevStatus,
        next: nextStatus,
      });

      return NextResponse.json({
        success: true,
        message: `Ticket ${order.id} transitioned to "${nextStatus}".${folioPostedMessage}`,
        tone: "success",
      });
    }

    case "post_folio": {
      if (!canRoleTransitionLaundryStatus(input.role as LaundryRole)) {
        return NextResponse.json(
          { error: `Role "${input.role}" cannot post valet charges.` },
          { status: 403 }
        );
      }
      const res = postValetChargeInternal(store, idx);
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      order.auditLogs.unshift({
        timestamp: getManilaTimestamp(),
        actor: actorLabel,
        action: "Manual Folio Posting",
        prev: "Unbilled",
        next: `Posted ₱${res.amount.toLocaleString()}`,
      });
      return NextResponse.json({
        success: true,
        message: `Posted ₱${res.amount.toLocaleString()} for ${order.id} to folios_hos.`,
        tone: "success",
      });
    }

    case "expedite": {
      const prevStatus = order.status;
      order.status = "Quality Check / Ready";
      order.slaRemainingMins = 10;
      if (order.category === "VALET" && !order.billedToFolio) {
        postValetChargeInternal(store, idx);
      }
      store.checkoutAlert = null;
      order.auditLogs.unshift({
        timestamp: getManilaTimestamp(),
        actor: actorLabel,
        action: "Early Checkout Expedite",
        prev: prevStatus,
        next: "Quality Check / Ready",
        reason: "Guest early checkout runner notification",
      });
      return NextResponse.json({
        success: true,
        message: `Ticket ${order.id} expedited to Ready & posted to folio.`,
        tone: "success",
      });
    }

    case "reopen": {
      if (!canRolePerformSupervisorOverride(input.role as LaundryRole)) {
        return NextResponse.json(
          {
            error: `Role "${input.role}" cannot perform supervisor overrides.`,
          },
          { status: 403 }
        );
      }
      if (order.status !== "Delivered") {
        return NextResponse.json(
          { error: "Only Delivered tickets can be reopened." },
          { status: 400 }
        );
      }
      order.status = "Quality Check / Ready";
      order.auditLogs.unshift({
        timestamp: getManilaTimestamp(),
        actor: actorLabel,
        action: "Supervisor Reopen",
        prev: "Delivered",
        next: "Quality Check / Ready",
        reason: input.reason,
      });
      return NextResponse.json({
        success: true,
        message: `Ticket ${order.id} reopened. Reason logged: ${input.reason}`,
        tone: "info",
      });
    }

    case "damage_credit": {
      if (!canRolePerformSupervisorOverride(input.role as LaundryRole)) {
        return NextResponse.json(
          {
            error: `Role "${input.role}" cannot issue damage or lost-garment credits.`,
          },
          { status: 403 }
        );
      }
      if (order.category !== "VALET") {
        return NextResponse.json(
          { error: "Damage credits apply only to Guest Valet tickets." },
          { status: 400 }
        );
      }
      const credit = Math.round(calculateLaundryOrderTotal(order) * 0.5);
      store.folios.unshift({
        id: `FOL-${store.nextFolioNum++}`,
        account: order.roomOrDept,
        source: `Damage Credit (${order.id} → /hos/guest-relations)`,
        amount: -credit,
        status: "Credit Issued",
        timestamp: getManilaTimeLabel(),
      });
      order.auditLogs.unshift({
        timestamp: getManilaTimestamp(),
        actor: actorLabel,
        action: "Issued Damage / Lost Credit",
        prev: "Full Charge",
        next: `-₱${credit.toLocaleString()} Credit`,
        reason: input.reason,
      });
      return NextResponse.json({
        success: true,
        message: `Issued ₱${credit.toLocaleString()} garment credit & linked /hos/guest-relations.`,
        tone: "success",
      });
    }
  }
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
  const store = getLaundryStore();
  const idx = store.orders.findIndex((o) => o.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Laundry ticket not found." }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request role." }, { status: 400 });
  }

  if (!canRolePerformSupervisorOverride(parsed.data.role as LaundryRole)) {
    return NextResponse.json(
      { error: "Only Supervisors or System Admins can delete unbilled tickets." },
      { status: 403 }
    );
  }

  const check = canDeleteLaundryOrder(store.orders[idx]);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: 409 });
  }

  store.orders.splice(idx, 1);
  return NextResponse.json({
    success: true,
    message: `Unbilled ticket ${id} removed from queue.`,
  });
}
