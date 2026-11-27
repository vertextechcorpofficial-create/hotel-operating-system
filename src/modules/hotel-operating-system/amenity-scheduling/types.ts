export type AmenityRole = "Receptionist" | "Manager" | "Therapist";

export type ResourceCategory =
  | "Spa Room"
  | "Therapist"
  | "Recreation"
  | "Entertainment";

export type AmenityBookingStatus =
  | "Reserved"
  | "Checked In"
  | "In Session"
  | "Completed"
  | "Cancelled"
  | "No-Show";

export type GuestBillingMode = "inhouse" | "walkin";

export interface AmenityResource {
  id: string;
  name: string;
  category: ResourceCategory;
  capacity: number;
  active: boolean;
  shiftStart: number;
  shiftEnd: number;
}

export interface AmenityPackage {
  id: string;
  name: string;
  price: number;
  durationMins: number;
  bufferMins: number;
  resourceCategory: Exclude<ResourceCategory, "Therapist">;
  requiredTherapists: 0 | 1 | 2;
}

export interface AmenityAuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  reason: string;
}

export interface AmenityBooking {
  id: string;
  date: string;
  guest: string;
  reservationId: string;
  numericReservationId: number | null;
  billingMode: GuestBillingMode;
  packageId: string;
  serviceName: string;
  resourceId: string;
  therapistIds: string[];
  startHour: number;
  durationHours: number;
  bufferHours: number;
  bufferMins: number;
  price: number;
  status: AmenityBookingStatus;
  billed: boolean;
  billingRef: string | null;
  auditLog: AmenityAuditEntry[];
}

export interface AmenityFolioPosting {
  folioId: string;
  sourceBookingId: string;
  targetAccount: string;
  description: string;
  amount: number;
  settlementType: string;
  timestamp: string;
}

export interface AmenityReservationOption {
  id: string;
  numericReservationId: number | null;
  guestName: string;
  room: string;
  status: string;
}

export interface AmenitySchedulingPayload {
  resources: AmenityResource[];
  bookings: AmenityBooking[];
  folioPostings: AmenityFolioPosting[];
  reservations: AmenityReservationOption[];
  meta: {
    businessDate: string;
    directusAmenityMode: "live" | "fallback";
    reservationsSource: "live" | "fallback";
  };
}
