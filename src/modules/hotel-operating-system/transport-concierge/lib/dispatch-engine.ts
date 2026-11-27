import type {
  BookingStatus,
  DriverRoster,
  ServiceType,
  TransportBooking,
  TransportRole,
  VehicleMaster,
} from "../types";

export const TURNAROUND_BUFFER_MINS = 30;

export const DEFAULT_SERVICE_RATES: Record<ServiceType, number> = {
  "Airport Pickup": 2800,
  "Airport Drop-off": 2800,
  "Chauffeur Charter": 6500,
  "Local Tour": 4200,
};

export const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Requested: ["Confirmed", "Cancelled"],
  Confirmed: ["Driver Assigned", "Cancelled"],
  "Driver Assigned": ["En Route / Picked Up", "Cancelled", "No-Show"],
  "En Route / Picked Up": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  "No-Show": [],
};

export const ALL_BOOKING_STATUSES: BookingStatus[] = [
  "Requested",
  "Confirmed",
  "Driver Assigned",
  "En Route / Picked Up",
  "Completed",
  "Cancelled",
  "No-Show",
];

export function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function canActorPerformTransition(
  role: TransportRole,
  targetState: BookingStatus
): boolean {
  if (role === "Admin") return true;
  if (role === "Concierge") {
    return [
      "Confirmed",
      "Driver Assigned",
      "En Route / Picked Up",
      "Completed",
      "Cancelled",
      "No-Show",
    ].includes(targetState);
  }
  if (role === "Driver") {
    return ["En Route / Picked Up", "Completed"].includes(targetState);
  }
  return false;
}

export function canActorPostFolio(role: TransportRole): boolean {
  return role === "Concierge" || role === "Billing" || role === "Admin";
}

export function canActorManageBookings(role: TransportRole): boolean {
  return role === "Concierge" || role === "Admin";
}

export interface ConflictCheckParams {
  excludeBookingId?: string | null;
  date: string;
  pickupTime: string;
  durationMins: number;
  vehicleId?: string;
  driverId?: string;
  pax?: number;
  bookings: TransportBooking[];
  vehicles: VehicleMaster[];
  drivers: DriverRoster[];
}

export interface ConflictCheckResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates vehicle capacity, driver roster shift window, and double-booking
 * across overlapping time windows plus the mandatory 30-minute turnaround buffer.
 */
export function checkResourceConflicts({
  excludeBookingId,
  date,
  pickupTime,
  durationMins,
  vehicleId,
  driverId,
  pax,
  bookings,
  vehicles,
  drivers,
}: ConflictCheckParams): ConflictCheckResult {
  const newStart = timeToMinutes(pickupTime);
  const newEndWithBuffer = newStart + Number(durationMins) + TURNAROUND_BUFFER_MINS;

  if (vehicleId) {
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!veh || !veh.active) {
      return {
        valid: false,
        message: "Selected vehicle is currently in maintenance / inactive.",
      };
    }
    if (pax && Number(pax) > veh.capacity) {
      return {
        valid: false,
        message: `Capacity exceeded: ${veh.name} holds max ${veh.capacity} pax (requested ${pax}).`,
      };
    }
  }

  if (driverId) {
    const drv = drivers.find((d) => d.id === driverId);
    if (!drv || !drv.onDuty) {
      return {
        valid: false,
        message: `Chauffeur ${drv ? drv.name : ""} is OFF-DUTY in /hos/staff-roster.`,
      };
    }
    const shiftStart = timeToMinutes(drv.shiftStart);
    const shiftEnd = timeToMinutes(drv.shiftEnd);
    const tripEnd = newStart + Number(durationMins);
    if (newStart < shiftStart || tripEnd > shiftEnd) {
      return {
        valid: false,
        message: `Shift conflict: ${drv.name}'s roster shift is ${drv.shiftStart}–${drv.shiftEnd}, outside trip window (${pickupTime}–${minutesToTime(tripEnd)}).`,
      };
    }
  }

  const activeStates: BookingStatus[] = [
    "Requested",
    "Confirmed",
    "Driver Assigned",
    "En Route / Picked Up",
    "Completed",
  ];

  for (const b of bookings) {
    if (b.id === excludeBookingId) continue;
    if (b.date !== date) continue;
    if (!activeStates.includes(b.status)) continue;

    const existingStart = timeToMinutes(b.pickupTime);
    const existingEndWithBuffer =
      existingStart + Number(b.durationMins) + TURNAROUND_BUFFER_MINS;

    const overlaps = newStart < existingEndWithBuffer && newEndWithBuffer > existingStart;
    if (!overlaps) continue;

    if (vehicleId && b.vehicleId === vehicleId) {
      const vName = vehicles.find((v) => v.id === vehicleId)?.name || vehicleId;
      return {
        valid: false,
        message: `Vehicle Double-Booking Blocked: ${vName} is booked for ${b.id} (${b.pickupTime} + ${b.durationMins}m + ${TURNAROUND_BUFFER_MINS}m buffer until ${minutesToTime(existingEndWithBuffer)}).`,
      };
    }

    if (driverId && b.driverId === driverId) {
      const dName = drivers.find((d) => d.id === driverId)?.name || driverId;
      return {
        valid: false,
        message: `Driver Double-Booking Blocked: ${dName} is assigned to ${b.id} (${b.pickupTime} + ${b.durationMins}m + ${TURNAROUND_BUFFER_MINS}m buffer until ${minutesToTime(existingEndWithBuffer)}).`,
      };
    }
  }

  return { valid: true };
}

export function getStatusBadgeClasses(status: BookingStatus): string {
  const map: Record<BookingStatus, string> = {
    Requested:
      "bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
    Confirmed:
      "bg-blue-50 text-[#1a73e8] border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
    "Driver Assigned":
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
    "En Route / Picked Up":
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    Completed:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    Cancelled:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
    "No-Show":
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  };
  return (
    map[status] ||
    "bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
  );
}
