import { NextResponse } from "next/server";
import { z } from "zod";
import { canActorManageCatalog } from "@/modules/hotel-operating-system/amenity-scheduling/lib/slot-engine";
import {
  getAmenityStore,
  getAuthActor,
} from "@/modules/hotel-operating-system/amenity-scheduling/lib/amenity-store";
import type { AmenityRole } from "@/modules/hotel-operating-system/amenity-scheduling/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resourcePatchSchema = z.object({
  role: z.enum(["Receptionist", "Manager", "Therapist"]),
  resourceId: z.string().min(1),
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

  const parsed = resourcePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  if (!canActorManageCatalog(parsed.data.role as AmenityRole)) {
    return NextResponse.json(
      {
        error:
          "Only HOS Operations Managers can activate/deactivate catalog resources.",
      },
      { status: 403 }
    );
  }

  const store = getAmenityStore();
  const res = store.resources.find((r) => r.id === parsed.data.resourceId);
  if (!res) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  res.active = !res.active;
  return NextResponse.json({ success: true, data: res });
}
