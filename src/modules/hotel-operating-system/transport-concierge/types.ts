export type TransportRole = "Concierge" | "Driver" | "Billing" | "Admin";

export type BookingStatus =
  | "Requested"
  | "Confirmed"
  | "Driver Assigned"
  | "En Route / Picked Up"
  | "Completed"
  | "Cancelled"
  | "No-Show";

export type ServiceType =
  | "Airport Pickup"
  | "Airport Drop-off"
  | "Chauffeur Charter"
  | "Local Tour";

export type FlightStatus =
  | "On Time"
  | "Delayed (+45m)"
  | "Diverted"
  | "Landed"
  | "N/A (Local)";

export interface ReservationSource {
  id: string;
  numericReservationId: number | null;
  guestName: string;
  room: string;
  status: string;
  folioId: string | null;
  arrival: string;
  departure: string;
}

export interface VehicleMaster {
  id: string;
  name: string;
  plate: string;
  type: string;
  capacity: number;
  active: boolean;
}

export interface DriverRoster {
  id: string;
  name: string;
  license: string;
  shiftStart: string;
  shiftEnd: string;
  onDuty: boolean;
}

export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  action: string;
  prev: string;
  next: string;
  reason?: string;
}

export interface TransportBooking {
  id: string;
  reservationId: string;
  numericReservationId: number | null;
  guestName: string;
  room: string;
  folioId: string | null;
  serviceType: ServiceType;
  flightNo: string;
  flightStatus: FlightStatus;
  date: string;
  pickupTime: string;
  durationMins: number;
  pax: number;
  pickupLocation: string;
  dropoffLocation: string;
  vehicleId: string;
  driverId: string;
  rate: number;
  status: BookingStatus;
  billed: boolean;
  billingRef: string | null;
  auditLog: AuditLogEntry[];
}

export interface FolioPostingEntry {
  postingId: string;
  bookingId: string;
  targetAccount: string;
  description: string;
  postedBy: string;
  timestamp: string;
  amount: number;
  source?: "guest_charges_hos" | "immediate_settlement" | "fallback";
}

export interface TransportDispatchPayload {
  bookings: TransportBooking[];
  reservations: ReservationSource[];
  vehicles: VehicleMaster[];
  drivers: DriverRoster[];
  folioPostings: FolioPostingEntry[];
  meta: {
    businessDate: string;
    directusBookingsMode: "live" | "fallback";
    reservationsSource: "live" | "fallback";
    turnaroundBufferMins: number;
  };
}
