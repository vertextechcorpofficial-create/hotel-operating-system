export type GroupRole = "Manager" | "Supervisor" | "Accounting";

export type GroupBlockStatus =
  | "Inquiry"
  | "Tentative Hold"
  | "Definite / Confirmed"
  | "In-House"
  | "Checked Out"
  | "Cancelled"
  | "Released";

export interface GroupAuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  reason: string;
}

export interface RoomingGuest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roomType: string;
  roomNumber: string;
  roomCleanStatus: "Clean" | "Dirty";
  checkIn: string;
  checkOut: string;
  status: "Assigned" | "Checked In" | "Checked Out";
  incidentals: number;
}

export interface GroupBlock {
  id: string;
  name: string;
  status: GroupBlockStatus;
  arrivalDate: string;
  departureDate: string;
  cutoffDate: string;
  allottedRooms: number;
  roomTypeMix: string;
  depositPaid: number;
  negotiatedRate: number;
  routingRule: string;
  masterFolioTotal: number;
  incidentalFolioTotal: number;
  auditLogs: GroupAuditEntry[];
  roomingList: RoomingGuest[];
}

export interface GroupFolioPosting {
  folioId: string;
  sourceBookingId: string;
  targetAccount: string;
  description: string;
  amount: number;
  settlementType: string;
  timestamp: string;
}

export interface GroupBookingsPayload {
  groupBlocks: GroupBlock[];
  folioPostings: GroupFolioPosting[];
  meta: {
    businessDate: string;
    directusGroupsMode: "live" | "fallback";
  };
}
