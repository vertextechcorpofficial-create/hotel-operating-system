import type {
  AmenityBooking,
  AmenityBookingStatus,
  AmenityPackage,
  AmenityResource,
  AmenityRole,
} from "../types";

export const AMENITY_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

export const AMENITY_PACKAGES: AmenityPackage[] = [
  {
    id: "signature_massage",
    name: "Signature Hilot Massage",
    price: 3200,
    durationMins: 60,
    bufferMins: 30,
    resourceCategory: "Spa Room",
    requiredTherapists: 1,
  },
  {
    id: "couples_retreat",
    name: "Couples Aromatherapy Retreat",
    price: 6800,
    durationMins: 90,
    bufferMins: 30,
    resourceCategory: "Spa Room",
    requiredTherapists: 2,
  },
  {
    id: "tennis_court",
    name: "Floodlit Tennis Court Rental",
    price: 1200,
    durationMins: 60,
    bufferMins: 15,
    resourceCategory: "Recreation",
    requiredTherapists: 0,
  },
  {
    id: "gym_cabana",
    name: "Poolside Gym Cabana Day Pass",
    price: 1800,
    durationMins: 120,
    bufferMins: 30,
    resourceCategory: "Recreation",
    requiredTherapists: 0,
  },
  {
    id: "vip_ktv",
    name: "VIP KTV Lounge Package",
    price: 4500,
    durationMins: 120,
    bufferMins: 30,
    resourceCategory: "Entertainment",
    requiredTherapists: 0,
  },
];

export const STATUS_TRANSITIONS: Record<
  AmenityBookingStatus,
  AmenityBookingStatus[]
> = {
  Reserved: ["Checked In", "Cancelled"],
  "Checked In": ["In Session", "No-Show", "Cancelled"],
  "In Session": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  "No-Show": [],
};

export function canActorTransition(
  role: AmenityRole,
  targetState: AmenityBookingStatus
): boolean {
  if (role === "Manager") return true;
  if (role === "Receptionist") return true;
  if (role === "Therapist") {
    return (
      targetState === "Checked In" ||
      targetState === "In Session" ||
      targetState === "Completed"
    );
  }
  return false;
}

export function canActorManageCatalog(role: AmenityRole): boolean {
  return role === "Manager";
}

export interface SlotOccupancy {
  state: "open" | "booked" | "buffer" | "offshift" | "inactive";
  label: string;
  booking?: AmenityBooking;
}

export function getSlotOccupancy(
  entityId: string,
  dateStr: string,
  hour: number,
  resources: AmenityResource[],
  bookings: AmenityBooking[]
): SlotOccupancy {
  const entity = resources.find((r) => r.id === entityId);
  if (!entity) return { state: "inactive", label: "Inactive" };
  if (!entity.active) return { state: "inactive", label: "Deactivated Resource" };
  if (hour < entity.shiftStart || hour >= entity.shiftEnd) {
    return { state: "offshift", label: "Off Shift (/hos/staff-roster)" };
  }

  for (const b of bookings) {
    if (b.date !== dateStr || b.status === "Cancelled" || b.status === "No-Show") {
      continue;
    }
    const involvesEntity =
      b.resourceId === entityId ||
      (b.therapistIds && b.therapistIds.includes(entityId));
    if (!involvesEntity) continue;

    if (hour >= b.startHour && hour < b.startHour + b.durationHours) {
      return {
        state: "booked",
        label: `${b.serviceName} (${b.guest}) — ${b.status}`,
        booking: b,
      };
    }
    if (
      hour >= b.startHour + b.durationHours &&
      hour < b.startHour + b.durationHours + b.bufferHours
    ) {
      return {
        state: "buffer",
        label: `Mandatory Sanitization & Linen Turnover Buffer (${b.id})`,
        booking: b,
      };
    }
  }

  return { state: "open", label: "Available Slot — Click to Select" };
}

export interface SlotValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSlotReservation(params: {
  date: string;
  startHour: number;
  packageId: string;
  resourceId: string;
  therapistIds: string[];
  resources: AmenityResource[];
  bookings: AmenityBooking[];
}): SlotValidationResult {
  const pkg = AMENITY_PACKAGES.find((p) => p.id === params.packageId);
  if (!pkg) {
    return { valid: false, errors: ["Invalid service package selected."] };
  }

  const durationHours = Math.ceil(pkg.durationMins / 60);
  const bufferHours = pkg.bufferMins > 0 ? 1 : 0;
  const errors: string[] = [];

  if (!params.resourceId) {
    errors.push("Physical resource selection is required.");
  }

  if (pkg.requiredTherapists >= 1 && params.therapistIds.length < 1) {
    errors.push("Spa treatment requires an assigned primary therapist.");
  }
  if (pkg.requiredTherapists === 2) {
    if (
      params.therapistIds.length < 2 ||
      params.therapistIds[0] === params.therapistIds[1]
    ) {
      errors.push(
        "Couples treatment requires two distinct therapists to be locked."
      );
    }
  }

  const entitiesToCheck = Array.from(
    new Set([params.resourceId, ...params.therapistIds].filter(Boolean))
  );
  const totalHoursNeeded = durationHours + bufferHours;

  for (const entId of entitiesToCheck) {
    const entObj = params.resources.find((r) => r.id === entId);
    if (!entObj) {
      errors.push(`Unknown resource or staff ID: ${entId}`);
      continue;
    }
    for (let h = params.startHour; h < params.startHour + totalHoursNeeded; h++) {
      const occ = getSlotOccupancy(
        entId,
        params.date,
        h,
        params.resources,
        params.bookings
      );
      if (occ.state !== "open") {
        errors.push(
          `Conflict on ${entObj.name} at ${String(h).padStart(2, "0")}:00 — ${occ.label}`
        );
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getAmenityStatusBadgeClasses(
  status: AmenityBookingStatus
): string {
  const map: Record<AmenityBookingStatus, string> = {
    Reserved:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
    "Checked In":
      "bg-blue-50 text-[#1a68ff] border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
    "In Session":
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
    Completed:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    Cancelled:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
    "No-Show":
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  };
  return (
    map[status] ||
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
  );
}
