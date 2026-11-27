import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthActor,
  getLaundryStore,
} from "@/modules/hotel-operating-system/laundry-dispatch/lib/laundry-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const batchActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("dispatch_vendor_batch"),
  }),
  z.object({
    action: z.literal("trigger_checkout_alert"),
  }),
  z.object({
    action: z.literal("dismiss_checkout_alert"),
  }),
]);

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

  const parsed = batchActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const store = getLaundryStore();
  if (parsed.data.action === "dispatch_vendor_batch") {
    const id = `VND-BATCH-${store.nextBatchNum++}`;
    store.vendorBatches.unshift({
      id,
      vendor: "SparklePro Executive DryCleaners",
      dispatchedAt: "Just now",
      itemCount: 4,
      status: "Dispatched to Vendor",
      eta: "Today, 06:30 PM",
    });
    return NextResponse.json({
      success: true,
      message: `Logged outsourced manifest ${id}.`,
      tone: "success",
    });
  }

  if (parsed.data.action === "trigger_checkout_alert") {
    const pendingValet =
      store.orders.find(
        (o) =>
          o.category === "VALET" &&
          !["Delivered", "Cancelled", "Quality Check / Ready"].includes(
            o.status
          )
      ) || store.orders[0];

    store.checkoutAlert = {
      ticketId: pendingValet.id,
      roomOrDept: pendingValet.roomOrDept,
      message: `${pendingValet.roomOrDept} is checking out at Front Desk while ticket ${pendingValet.id} is still "${pendingValet.status}".`,
    };
    return NextResponse.json({
      success: true,
      message: `Front Desk early checkout conflict detected for ${pendingValet.roomOrDept}!`,
      tone: "error",
    });
  }

  store.checkoutAlert = null;
  return NextResponse.json({
    success: true,
    message: "Alert dismissed.",
    tone: "info",
  });
}
