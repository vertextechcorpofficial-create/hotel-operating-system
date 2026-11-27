import type {
  ChannelRole,
  IngestedOtaReservation,
  RoomInventoryRow,
} from "../types";

export interface SellableCalculation {
  netPhysicalAvailable: number;
  sellableToOta: number;
  stopSell: boolean;
  cap: number;
}

export function canRoleManageChannels(role: ChannelRole): boolean {
  return role === "Manager" || role === "SysAdmin";
}

export function canRoleResolveOverbooking(role: ChannelRole): boolean {
  return role === "Manager" || role === "SysAdmin" || role === "Supervisor";
}

export function computeSellableOtaInventory(
  roomRow: RoomInventoryRow,
  dateStr: string
): SellableCalculation {
  const cell = roomRow.dates[dateStr];
  if (!cell) {
    return {
      netPhysicalAvailable: 0,
      sellableToOta: 0,
      stopSell: false,
      cap: 0,
    };
  }

  const netPhysicalAvailable = Math.max(
    0,
    roomRow.physicalRooms - roomRow.outOfOrder - cell.confirmed - cell.groupHolds
  );

  if (cell.stopSell) {
    return {
      netPhysicalAvailable,
      sellableToOta: 0,
      stopSell: true,
      cap: cell.cap,
    };
  }

  return {
    netPhysicalAvailable,
    sellableToOta: Math.min(netPhysicalAvailable, cell.cap),
    stopSell: false,
    cap: cell.cap,
  };
}

export function computeCommissionBreakdown(
  grossAmount: number,
  commissionPct: number
): {
  grossAmount: number;
  commissionPct: number;
  commissionAmount: number;
  netPayout: number;
} {
  const safeGross = Math.max(0, grossAmount);
  const safePct = Math.max(0, Math.min(100, commissionPct));
  const commissionAmount = Math.round(safeGross * (safePct / 100));
  return {
    grossAmount: safeGross,
    commissionPct: safePct,
    commissionAmount,
    netPayout: Math.max(0, safeGross - commissionAmount),
  };
}

export function findDuplicateExternalBooking(
  reservations: IngestedOtaReservation[],
  externalId: string
): IngestedOtaReservation | undefined {
  const needle = externalId.trim().toLowerCase();
  if (!needle) return undefined;
  return reservations.find((r) => r.externalId.trim().toLowerCase() === needle);
}

export function formatMatrixDateHeader(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = String(d.getUTCDate()).padStart(2, "0");
  const weekday = d.toLocaleString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${month} ${day} (${weekday})`;
}

export function computeExponentialBackoffMs(attempt: number): number {
  const clamped = Math.max(1, Math.min(attempt, 5));
  return Math.min(30000, 1000 * 2 ** (clamped - 1));
}
