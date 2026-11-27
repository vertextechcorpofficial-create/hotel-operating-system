import type { GroupBlock, GroupBlockStatus, GroupRole, RoomingGuest } from "../types";

export const ALL_GROUP_STATES: GroupBlockStatus[] = [
  "Inquiry",
  "Tentative Hold",
  "Definite / Confirmed",
  "In-House",
  "Checked Out",
  "Cancelled",
  "Released",
];

export function canRoleTransitionPreArrival(role: GroupRole): boolean {
  return role === "Manager";
}

export function canRoleBatchCheckIn(role: GroupRole): boolean {
  return role === "Manager" || role === "Supervisor";
}

export function canRoleReconcileFolio(role: GroupRole): boolean {
  return role === "Manager" || role === "Accounting";
}

export function calcStayNights(arrivalDate: string, departureDate: string): number {
  const start = new Date(arrivalDate).getTime();
  const end = new Date(departureDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export function isCutoffExpiredForBlock(
  group: GroupBlock,
  todayStr: string
): boolean {
  return (
    group.cutoffDate < todayStr &&
    !["Released", "In-House", "Checked Out", "Cancelled"].includes(group.status)
  );
}

export interface CsvParseResult {
  validRows: RoomingGuest[];
  rowErrors: string[];
}

export function validateCsvRoomingRows(
  rawCsv: string,
  group: GroupBlock
): CsvParseResult {
  const lines = rawCsv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { validRows: [], rowErrors: ["CSV input is empty."] };
  }

  const dataLines = lines[0].toLowerCase().startsWith("firstname")
    ? lines.slice(1)
    : lines;

  const validRows: RoomingGuest[] = [];
  const rowErrors: string[] = [];
  const existingEmails = new Set(
    group.roomingList.map((r) => r.email.toLowerCase())
  );

  dataLines.forEach((line, idx) => {
    const cols = line.split(",").map((c) => c.trim());
    const rowNum = idx + 1;
    if (cols.length < 7) {
      rowErrors.push(`Row ${rowNum}: Incomplete columns (expected 7 fields).`);
      return;
    }

    const [
      firstName,
      lastName,
      email,
      roomType,
      roomNumber,
      checkIn,
      checkOut,
    ] = cols;

    if (!firstName || !lastName || !email.includes("@")) {
      rowErrors.push(
        `Row ${rowNum}: Missing guest name or invalid email (${email}).`
      );
      return;
    }

    if (existingEmails.has(email.toLowerCase())) {
      rowErrors.push(
        `Row ${rowNum}: Duplicate guest "${firstName} ${lastName}" (${email}) already exists in block.`
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || checkIn >= checkOut) {
      rowErrors.push(
        `Row ${rowNum}: Invalid stay dates (${checkIn} to ${checkOut}).`
      );
      return;
    }

    if (group.roomingList.length + validRows.length >= group.allottedRooms) {
      rowErrors.push(
        `Row ${rowNum}: Exceeds block room allotment cap (${group.allottedRooms} rooms).`
      );
      return;
    }

    existingEmails.add(email.toLowerCase());
    validRows.push({
      id: `RES-${920 + group.roomingList.length + validRows.length}`,
      firstName,
      lastName,
      email,
      roomType: roomType || "Standard King",
      roomNumber: roomNumber || String(410 + validRows.length),
      roomCleanStatus: "Clean",
      checkIn,
      checkOut,
      status: "Assigned",
      incidentals: 0,
    });
  });

  return { validRows, rowErrors };
}
