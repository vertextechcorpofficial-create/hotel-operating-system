import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthActor,
  getTransportStore,
} from "@/modules/hotel-operating-system/transport-concierge/lib/transport-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fleetPatchSchema = z.object({
  role: z.enum(["Concierge", "Driver", "Billing", "Admin"]),
  vehicleId: z.string().min(1),
});

export async function PATCH(request: Request) {
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

  const parsed = fleetPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (parsed.data.role !== "Admin") {
    return NextResponse.json(
      { error: "Only Admin role can modify vehicle master status." },
      { status: 403 }
    );
  }

  const store = getTransportStore();
  const veh = store.vehicles.find((v) => v.id === parsed.data.vehicleId);
  if (!veh) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  veh.active = !veh.active;
  return NextResponse.json({ success: true, data: veh });
}
