import type {
  LaundryCategory,
  LaundryOrder,
  LaundryRole,
  LaundryStatus,
  LaundryTier,
} from "../types";

export const GARMENT_CATALOG: readonly {
  key: string;
  label: string;
  unitPrice: number;
}[] = [
  {
    key: "Business Suit (Dry Clean)",
    label: "Business Suit – ₱650",
    unitPrice: 650,
  },
  {
    key: "Dress Shirt (Wash & Press)",
    label: "Dress Shirt – ₱220",
    unitPrice: 220,
  },
  {
    key: "Evening Gown (Delicate Dry Clean)",
    label: "Evening Gown – ₱950",
    unitPrice: 950,
  },
  {
    key: "Casual Bundle (Wash & Fold)",
    label: "Casual Bundle – ₱350",
    unitPrice: 350,
  },
  {
    key: "King Bed Sheets & Towels (Bulk)",
    label: "King Sheets & Towels (Bulk)",
    unitPrice: 0,
  },
];

export const SUPERVISOR_OVERRIDE_ROLES: readonly LaundryRole[] = [
  "Laundry Supervisor",
  "Front Desk Supervisor",
  "System Admin",
  "Revenue Manager",
  "Sales Manager",
];

export const CREATE_ORDER_ROLES: readonly LaundryRole[] = [
  "Laundry Supervisor",
  "Valet Runner",
  "Front Desk Supervisor",
  "System Admin",
];

export const STATE_TRANSITION_ROLES: readonly LaundryRole[] = [
  "Laundry Supervisor",
  "Valet Runner",
  "Front Desk Supervisor",
  "System Admin",
];

export const NEXT_LAUNDRY_TRANSITIONS: Partial<
  Record<LaundryStatus, LaundryStatus>
> = {
  Collected: "Tagged / In Processing",
  "Tagged / In Processing": "Quality Check / Ready",
  Outsourced: "Quality Check / Ready",
  "Quality Check / Ready": "Delivered",
};

export function canRoleCreateLaundryOrder(role: LaundryRole): boolean {
  return CREATE_ORDER_ROLES.includes(role);
}

export function canRoleTransitionLaundryStatus(role: LaundryRole): boolean {
  return STATE_TRANSITION_ROLES.includes(role);
}

export function canRolePerformSupervisorOverride(role: LaundryRole): boolean {
  return SUPERVISOR_OVERRIDE_ROLES.includes(role);
}

export function calculateLaundryItemsTotal(
  category: LaundryCategory,
  tier: LaundryTier,
  items: { qty: number; unitPrice: number }[]
): number {
  if (category === "LINEN") return 0;
  const subtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.qty) * Math.max(0, item.unitPrice),
    0
  );
  return tier === "Express" ? Math.round(subtotal * 1.5) : subtotal;
}

export function calculateLaundryOrderTotal(order: LaundryOrder): number {
  return calculateLaundryItemsTotal(order.category, order.tier, order.items);
}

export function formatSlaCountdown(order: LaundryOrder): {
  label: string;
  urgent: boolean;
} {
  if (order.status === "Delivered" || order.status === "Cancelled") {
    return { label: "Completed", urgent: false };
  }
  const mins = Math.max(0, order.slaRemainingMins);
  if (mins <= 60) {
    return {
      label: `${mins}m left (Urgent)`,
      urgent: order.tier === "Express",
    };
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { label: `${h}h ${m}m`, urgent: false };
}

export function canDeleteLaundryOrder(order: LaundryOrder): {
  allowed: boolean;
  reason?: string;
} {
  if (order.billedToFolio) {
    return {
      allowed: false,
      reason:
        "Deletion blocked: Valet tickets already posted to folios_hos cannot be deleted.",
    };
  }
  return { allowed: true };
}
