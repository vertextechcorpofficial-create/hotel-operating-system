import { NextResponse } from "next/server";
import { z } from "zod";
import { canRoleTransitionPreArrival } from "@/modules/hotel-operating-system/group-bookings/lib/group-engine";
import {
  API_BASE_URL,
  getAuthActor,
  getDirectusHeaders,
  getGroupStore,
  getManilaBusinessDate,
  getManilaTimestamp,
} from "@/modules/hotel-operating-system/group-bookings/lib/group-store";
import type {
  GroupBlock,
  GroupBlockStatus,
  GroupRole,
} from "@/modules/hotel-operating-system/group-bookings/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBlockSchema = z.object({
  role: z.enum(["Manager", "Supervisor", "Accounting"]).default("Manager"),
  name: z.string().min(2).max(160),
  status: z
    .enum(["Inquiry", "Tentative Hold", "Definite / Confirmed"])
    .default("Definite / Confirmed"),
  allottedRooms: z.coerce.number().int().min(5).max(500),
  negotiatedRate: z.coerce.number().min(500).max(500000),
  roomTypeMix: z.string().min(1).max(160),
  depositPaid: z.coerce.number().min(0).max(10000000),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  routingRule: z.string().min(1).max(200),
});

async function probeDirectusGroupBlocks(): Promise<"live" | "fallback"> {
  if (!API_BASE_URL) return "fallback";
  try {
    const res = await fetch(`${API_BASE_URL}/items/group_blocks_hos?limit=1`, {
      headers: getDirectusHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
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

  const store = getGroupStore();
  const today = getManilaBusinessDate();
  const directusGroupsMode = await probeDirectusGroupBlocks();

  return NextResponse.json({
    success: true,
    data: {
      groupBlocks: store.groupBlocks,
      folioPostings: store.folioPostings,
      meta: {
        businessDate: today,
        directusGroupsMode,
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

  const parsed = createBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  if (!canRoleTransitionPreArrival(input.role as GroupRole)) {
    return NextResponse.json(
      {
        error:
          "Permission Denied: Only Sales / Reservations Managers can create new group blocks.",
      },
      { status: 403 }
    );
  }

  if (input.arrivalDate >= input.departureDate) {
    return NextResponse.json(
      { error: "Departure date must be after arrival date." },
      { status: 400 }
    );
  }

  const store = getGroupStore();
  const newBlock: GroupBlock = {
    id: `GRP-2026-${String(store.groupBlocks.length + 1).padStart(2, "0")}`,
    name: input.name.trim(),
    status: input.status as GroupBlockStatus,
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate,
    cutoffDate: input.cutoffDate,
    allottedRooms: input.allottedRooms,
    roomTypeMix: input.roomTypeMix.trim(),
    depositPaid: input.depositPaid,
    negotiatedRate: input.negotiatedRate,
    routingRule: input.routingRule,
    masterFolioTotal: 0,
    incidentalFolioTotal: 0,
    auditLogs: [
      {
        timestamp: getManilaTimestamp(),
        actor: `${input.role} (${auth.actorName})`,
        action: "Created Group Block",
        reason: `Held ${input.allottedRooms} rooms (${input.status})`,
      },
    ],
    roomingList: [],
  };

  store.groupBlocks.unshift(newBlock);
  return NextResponse.json({ success: true, data: newBlock }, { status: 201 });
}
