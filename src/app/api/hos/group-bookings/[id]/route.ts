import { NextResponse } from "next/server";
import { z } from "zod";
import {
  calcStayNights,
  canRoleBatchCheckIn,
  canRoleReconcileFolio,
  canRoleTransitionPreArrival,
  validateCsvRoomingRows,
} from "@/modules/hotel-operating-system/group-bookings/lib/group-engine";
import {
  getAuthActor,
  getGroupStore,
  getManilaTimestamp,
} from "@/modules/hotel-operating-system/group-bookings/lib/group-store";
import type {
  GroupBlockStatus,
  GroupRole,
} from "@/modules/hotel-operating-system/group-bookings/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("transition"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
    targetState: z.enum([
      "Inquiry",
      "Tentative Hold",
      "Definite / Confirmed",
      "In-House",
      "Checked Out",
      "Cancelled",
      "Released",
    ]),
    reason: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal("extend_cutoff"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
    reason: z.string().min(1).max(300),
  }),
  z.object({
    action: z.literal("enforce_cutoff"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
  }),
  z.object({
    action: z.literal("reopen_block"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
    reason: z.string().min(1).max(300),
  }),
  z.object({
    action: z.literal("toggle_routing"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
  }),
  z.object({
    action: z.literal("mark_clean"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
    resId: z.string().min(1),
  }),
  z.object({
    action: z.literal("remove_guest"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
    resId: z.string().min(1),
  }),
  z.object({
    action: z.literal("batch_checkin"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
  }),
  z.object({
    action: z.literal("settle_master_folio"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
  }),
  z.object({
    action: z.literal("import_csv"),
    role: z.enum(["Manager", "Supervisor", "Accounting"]),
    rawCsv: z.string().min(1).max(1024 * 1024),
  }),
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthActor();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const store = getGroupStore();
  const group = store.groupBlocks.find((g) => g.id === id);
  if (!group) {
    return NextResponse.json({ error: "Group block not found." }, { status: 404 });
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
  const role = payload.role as GroupRole;
  const nowTs = getManilaTimestamp();

  if (payload.action === "transition") {
    const nextState = payload.targetState as GroupBlockStatus;
    if (
      ["Inquiry", "Tentative Hold", "Definite / Confirmed", "Cancelled"].includes(
        nextState
      ) &&
      !canRoleTransitionPreArrival(role)
    ) {
      return NextResponse.json(
        {
          error:
            "Permission Denied: Only Sales / Reservations Managers can change pre-arrival block states.",
        },
        { status: 403 }
      );
    }

    if (nextState === "Cancelled" && !payload.reason?.trim()) {
      return NextResponse.json(
        { error: "Mandatory audit reason is required to cancel a group block." },
        { status: 400 }
      );
    }

    group.status = nextState;
    if (nextState === "Checked Out") {
      group.roomingList.forEach((r) => {
        r.status = "Checked Out";
      });
    }
    group.auditLogs.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: `Transitioned to ${nextState}`,
      reason: payload.reason?.trim() || `Status updated to ${nextState}`,
    });
    return NextResponse.json({ success: true, data: group });
  }

  if (payload.action === "extend_cutoff") {
    if (!canRoleTransitionPreArrival(role)) {
      return NextResponse.json(
        {
          error:
            "Permission Denied: Only an authorized Sales/Reservations Manager can extend a cutoff date.",
        },
        { status: 403 }
      );
    }
    const base = new Date(group.cutoffDate);
    const shifted = new Date(
      (Number.isNaN(base.getTime()) ? Date.now() : base.getTime()) +
        5 * 86_400_000
    )
      .toISOString()
      .split("T")[0];
    group.cutoffDate = shifted < "2026-12-04" ? "2026-12-04" : shifted;
    group.auditLogs.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: `Extended Cutoff Date to ${group.cutoffDate}`,
      reason: payload.reason.trim(),
    });
    return NextResponse.json({ success: true, data: group });
  }

  if (payload.action === "enforce_cutoff") {
    const releasedCount = Math.max(
      0,
      group.allottedRooms - group.roomingList.length
    );
    group.allottedRooms = group.roomingList.length;
    group.status =
      group.roomingList.length === 0 ? "Released" : "Definite / Confirmed";
    group.auditLogs.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: "Released Unassigned Cutoff Rooms",
      reason: `Returned ${releasedCount} unassigned rooms to public/OTA inventory.`,
    });
    return NextResponse.json({
      success: true,
      data: group,
      releasedCount,
    });
  }

  if (payload.action === "reopen_block") {
    if (!canRoleTransitionPreArrival(role)) {
      return NextResponse.json(
        {
          error:
            "Only HOS Operations Managers can reopen released group blocks.",
        },
        { status: 403 }
      );
    }
    group.status = "Definite / Confirmed";
    group.allottedRooms += 5;
    group.cutoffDate = "2026-12-05";
    group.auditLogs.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: "Reopened Block (+5 rooms)",
      reason: payload.reason.trim(),
    });
    return NextResponse.json({ success: true, data: group });
  }

  if (payload.action === "toggle_routing") {
    group.routingRule = group.routingRule.startsWith("Room & Tax")
      ? "All Charges (Room + Incidentals) → Master Folio"
      : "Room & Tax → Master Folio | Incidentals → Individual Folio";
    return NextResponse.json({ success: true, data: group });
  }

  if (payload.action === "mark_clean") {
    const guest = group.roomingList.find((r) => r.id === payload.resId);
    if (!guest) {
      return NextResponse.json({ error: "Guest record not found." }, { status: 404 });
    }
    guest.roomCleanStatus = "Clean";
    return NextResponse.json({ success: true, data: group, guest });
  }

  if (payload.action === "remove_guest") {
    const guest = group.roomingList.find((r) => r.id === payload.resId);
    if (!guest) {
      return NextResponse.json({ error: "Guest record not found." }, { status: 404 });
    }
    group.roomingList = group.roomingList.filter((r) => r.id !== payload.resId);
    group.auditLogs.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: "Early Departure / Cancel",
      reason: `Removed ${guest.firstName} ${guest.lastName} (${guest.id}) while preserving Master Folio totals.`,
    });
    return NextResponse.json({ success: true, data: group, removedGuest: guest });
  }

  if (payload.action === "batch_checkin") {
    if (!canRoleBatchCheckIn(role)) {
      return NextResponse.json(
        {
          error:
            "Permission Denied: Only Front Desk Supervisors or Managers can execute Batch Check-In.",
        },
        { status: 403 }
      );
    }
    if (group.roomingList.length === 0) {
      return NextResponse.json(
        { error: "Cannot batch check-in an empty rooming list." },
        { status: 400 }
      );
    }
    const dirtyOrUnassigned = group.roomingList.filter(
      (r) => !r.roomNumber || r.roomCleanStatus === "Dirty"
    );
    if (dirtyOrUnassigned.length > 0) {
      return NextResponse.json(
        {
          error: `${dirtyOrUnassigned.length} room(s) are Dirty or unassigned. Mark clean before batch check-in.`,
        },
        { status: 409 }
      );
    }
    if (group.status !== "Definite / Confirmed") {
      return NextResponse.json(
        { error: "Block must be Definite / Confirmed before Batch Check-In." },
        { status: 400 }
      );
    }

    group.status = "In-House";
    group.roomingList.forEach((r) => {
      r.status = "Checked In";
    });
    group.auditLogs.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: "Executed Batch Check-In",
      reason: `Checked in ${group.roomingList.length} rooms.`,
    });
    return NextResponse.json({ success: true, data: group });
  }

  if (payload.action === "settle_master_folio") {
    if (!canRoleReconcileFolio(role)) {
      return NextResponse.json(
        {
          error:
            "Permission Denied: Only Accounting or HOS Managers can reconcile Master Folios.",
        },
        { status: 403 }
      );
    }
    const isAllMaster = group.routingRule.startsWith("All Charges");
    const totalIncidentals = group.roomingList.reduce(
      (acc, r) => acc + r.incidentals,
      0
    );
    const amount = isAllMaster
      ? group.masterFolioTotal + totalIncidentals
      : group.masterFolioTotal;

    const posting = {
      folioId: `MFOL-${Math.floor(1000 + Math.random() * 9000)}`,
      sourceBookingId: group.id,
      targetAccount: `${group.name} (Master Folio)`,
      description: `Group Block Settlement (${group.roomingList.length} rooms • ${group.routingRule})`,
      amount,
      settlementType: "Master Folio Split Routed (folios_hos)",
      timestamp: nowTs,
    };
    store.folioPostings.unshift(posting);
    group.auditLogs.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: "Reconciled Master Folio",
      reason: `Posted ₱${amount.toLocaleString()} (${posting.folioId})`,
    });
    return NextResponse.json({ success: true, data: { group, posting } });
  }

  // action === 'import_csv'
  const result = validateCsvRoomingRows(payload.rawCsv, group);
  if (result.validRows.length > 0) {
    group.roomingList.push(...result.validRows);
    const nights = calcStayNights(group.arrivalDate, group.departureDate);
    group.masterFolioTotal +=
      result.validRows.length * group.negotiatedRate * nights;
    group.auditLogs.push({
      timestamp: nowTs,
      actor: `${role} (${auth.actorName})`,
      action: "CSV Rooming Import",
      reason: `Imported ${result.validRows.length} valid guest(s); flagged ${result.rowErrors.length} error(s).`,
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      group,
      validCount: result.validRows.length,
      rowErrors: result.rowErrors,
    },
  });
}
