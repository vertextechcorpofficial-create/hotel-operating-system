import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GARMENT_CATALOG,
  canRoleCreateLaundryOrder,
} from "@/modules/hotel-operating-system/laundry-dispatch/lib/laundry-engine";
import {
  API_BASE_URL,
  getAuthActor,
  getDirectusHeaders,
  getLaundryStore,
  getManilaBusinessDate,
  getManilaTimestamp,
} from "@/modules/hotel-operating-system/laundry-dispatch/lib/laundry-store";
import type {
  LaundryCategory,
  LaundryChannel,
  LaundryOrder,
  LaundryRole,
  LaundryTier,
} from "@/modules/hotel-operating-system/laundry-dispatch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createOrderSchema = z.object({
  role: z
    .enum([
      "Laundry Supervisor",
      "Valet Runner",
      "Front Desk Supervisor",
      "Revenue Manager",
      "Sales Manager",
      "System Admin",
    ])
    .default("Laundry Supervisor"),
  category: z.enum(["VALET", "LINEN"]),
  tier: z.enum(["Standard", "Express"]),
  roomOrDept: z.string().trim().min(2).max(120),
  channel: z.enum(["Internal", "Outsourced"]),
  garmentName: z.string().trim().min(2).max(120),
  qty: z.coerce.number().int().min(1).max(200),
  damageNotes: z.string().trim().max(300).optional(),
});

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

  const store = getLaundryStore();
  const [directusLaundryMode, directusChargesMode] = await Promise.all([
    probeDirectusCollection("laundry_orders_hos"),
    probeDirectusCollection("guest_charges_hos"),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      orders: store.orders,
      vendorBatches: store.vendorBatches,
      linenStock: store.linenStock,
      folios: store.folios,
      checkoutAlert: store.checkoutAlert,
      meta: {
        businessDate: getManilaBusinessDate(),
        directusLaundryMode,
        directusChargesMode,
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

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  if (!canRoleCreateLaundryOrder(input.role as LaundryRole)) {
    return NextResponse.json(
      {
        error: `Role "${input.role}" is not permitted to create laundry tickets.`,
      },
      { status: 403 }
    );
  }

  const catalogItem = GARMENT_CATALOG.find(
    (g) => g.key === input.garmentName
  );
  if (!catalogItem) {
    return NextResponse.json(
      { error: "Selected garment or linen item is invalid." },
      { status: 400 }
    );
  }

  const store = getLaundryStore();
  const newId = `LND-${store.nextOrderNum++}`;
  const initialStatus =
    input.channel === "Outsourced" ? "Outsourced" : "Collected";

  const newOrder: LaundryOrder = {
    id: newId,
    category: input.category as LaundryCategory,
    roomOrDept: input.roomOrDept,
    tier: input.tier as LaundryTier,
    channel: input.channel as LaundryChannel,
    vendorBatchId:
      input.channel === "Outsourced"
        ? store.vendorBatches[0]?.id || "VND-BATCH-19"
        : undefined,
    slaRemainingMins: input.tier === "Express" ? 240 : 1440,
    status: initialStatus,
    billedToFolio: false,
    damageNotes:
      input.damageNotes && input.damageNotes.length > 0
        ? input.damageNotes
        : "Inspected at collection; no pre-existing damage.",
    items: [
      {
        name: catalogItem.key,
        service: input.category === "LINEN" ? "Bulk Wash" : "Valet Service",
        qty: input.qty,
        unitPrice: input.category === "LINEN" ? 0 : catalogItem.unitPrice,
      },
    ],
    auditLogs: [
      {
        timestamp: getManilaTimestamp(),
        actor: `${input.role} (${auth.actorName})`,
        action: "Created Tagged Ticket",
        prev: "—",
        next: initialStatus,
      },
    ],
  };

  store.orders.unshift(newOrder);
  return NextResponse.json(
    {
      success: true,
      data: newOrder,
      message: `Created tagged ticket ${newOrder.id} for ${newOrder.roomOrDept}.`,
    },
    { status: 201 }
  );
}
