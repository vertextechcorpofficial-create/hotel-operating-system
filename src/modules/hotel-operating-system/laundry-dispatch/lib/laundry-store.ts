import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import type {
  EarlyCheckoutAlert,
  LaundryFolioPosting,
  LaundryOrder,
  LinenStockItem,
  VendorBatch,
} from "../types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "";

export function getManilaBusinessDate(now: Date = new Date()): string {
  const manilaMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000;
  return new Date(manilaMs).toISOString().split("T")[0];
}

export function getManilaTimestamp(now: Date = new Date()): string {
  const manilaMs = now.getTime() + 8 * 60 * 60 * 1000;
  const iso = new Date(manilaMs).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export function getManilaTimeLabel(now: Date = new Date()): string {
  const manilaMs = now.getTime() + 8 * 60 * 60 * 1000;
  const iso = new Date(manilaMs).toISOString();
  const hh = Number(iso.slice(11, 13));
  const mm = iso.slice(14, 16);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${String(h12).padStart(2, "0")}:${mm} ${ampm}`;
}

export async function getAuthActor(fallbackRole = "Laundry Supervisor"): Promise<{
  authenticated: boolean;
  userId: number | null;
  actorName: string;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return { authenticated: false, userId: null, actorName: fallbackRole };
  }
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { authenticated: false, userId: null, actorName: fallbackRole };
  }

  const rawSub = payload.sub;
  const userId =
    typeof rawSub === "number"
      ? rawSub
      : typeof rawSub === "string" && /^\d+$/.test(rawSub)
      ? parseInt(rawSub, 10)
      : null;

  const first =
    (typeof payload.Firstname === "string" && payload.Firstname) ||
    (typeof payload.first_name === "string" && payload.first_name) ||
    "";
  const last =
    (typeof payload.LastName === "string" && payload.LastName) ||
    (typeof payload.last_name === "string" && payload.last_name) ||
    "";
  const name =
    [first, last].filter(Boolean).join(" ") ||
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.email === "string" && payload.email) ||
    "Staff User";

  return { authenticated: true, userId, actorName: name };
}

export function getDirectusHeaders(): Record<string, string> {
  const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
  return {
    "Content-Type": "application/json",
    ...(staticToken ? { Authorization: `Bearer ${staticToken}` } : {}),
  };
}

export interface LaundryMemoryStore {
  orders: LaundryOrder[];
  vendorBatches: VendorBatch[];
  linenStock: LinenStockItem[];
  folios: LaundryFolioPosting[];
  checkoutAlert: EarlyCheckoutAlert | null;
  nextOrderNum: number;
  nextFolioNum: number;
  nextBatchNum: number;
}

const globalForLaundry = globalThis as unknown as {
  __hosLaundryDispatchStore?: LaundryMemoryStore;
};

function buildInitialStore(): LaundryMemoryStore {
  return {
    orders: [
      {
        id: "LND-8041",
        category: "VALET",
        roomOrDept: "Room 402 – Claire Mendoza",
        tier: "Express",
        channel: "Internal",
        slaRemainingMins: 42,
        status: "Tagged / In Processing",
        billedToFolio: false,
        damageNotes:
          "Missing 1 pearl cuff button on right sleeve noted at intake.",
        items: [
          {
            name: "Business Suit (Dry Clean)",
            service: "Dry Clean",
            qty: 1,
            unitPrice: 650,
          },
          {
            name: "Dress Shirt (Wash & Press)",
            service: "Wash & Press",
            qty: 2,
            unitPrice: 220,
          },
        ],
        auditLogs: [],
      },
      {
        id: "LND-8042",
        category: "VALET",
        roomOrDept: "Room 518 – Hiroshi Sato",
        tier: "Standard",
        channel: "Outsourced",
        vendorBatchId: "VND-BATCH-19",
        slaRemainingMins: 780,
        status: "Outsourced",
        billedToFolio: false,
        damageNotes: "No pre-existing defects observed.",
        items: [
          {
            name: "Evening Gown (Delicate Dry Clean)",
            service: "Dry Clean",
            qty: 1,
            unitPrice: 950,
          },
        ],
        auditLogs: [],
      },
      {
        id: "LND-8043",
        category: "VALET",
        roomOrDept: "Room 601 – Sofia Lim",
        tier: "Express",
        channel: "Internal",
        slaRemainingMins: 15,
        status: "Quality Check / Ready",
        billedToFolio: true,
        damageNotes: "Verified intact.",
        items: [
          {
            name: "Business Suit (Dry Clean)",
            service: "Dry Clean",
            qty: 1,
            unitPrice: 650,
          },
        ],
        auditLogs: [],
      },
      {
        id: "LND-8044",
        category: "LINEN",
        roomOrDept: "Housekeeping Floor 3 & 4",
        tier: "Standard",
        channel: "Internal",
        slaRemainingMins: 310,
        status: "Tagged / In Processing",
        billedToFolio: false,
        damageNotes: "Bulk linen cart #4 – 68 kg total weight.",
        items: [
          {
            name: "King Bed Sheets & Towels (Bulk)",
            service: "Bulk Wash & Sanitize",
            qty: 85,
            unitPrice: 0,
          },
        ],
        auditLogs: [],
      },
      {
        id: "LND-8038",
        category: "VALET",
        roomOrDept: "Room 210 – Victor Gomez",
        tier: "Standard",
        channel: "Internal",
        slaRemainingMins: 0,
        status: "Delivered",
        billedToFolio: true,
        damageNotes: "Signed upon room delivery.",
        items: [
          {
            name: "Casual Bundle (Wash & Fold)",
            service: "Wash & Fold",
            qty: 2,
            unitPrice: 350,
          },
        ],
        auditLogs: [],
      },
    ],
    vendorBatches: [
      {
        id: "VND-BATCH-19",
        vendor: "SparklePro Executive DryCleaners",
        dispatchedAt: "Today, 09:15 AM",
        itemCount: 6,
        status: "In Vendor Facility",
        eta: "Today, 05:00 PM",
      },
      {
        id: "VND-BATCH-18",
        vendor: "SparklePro Executive DryCleaners",
        dispatchedAt: "Yesterday, 04:00 PM",
        itemCount: 11,
        status: "Returned & Inspected",
        eta: "Completed",
      },
    ],
    linenStock: [
      {
        item: "King Duvet Covers & Sheets",
        clean: 240,
        soiled: 85,
        inWash: 60,
      },
      {
        item: "Plush Bath & Hand Towels",
        clean: 410,
        soiled: 130,
        inWash: 95,
      },
      {
        item: "F&B / Spa Staff Uniforms",
        clean: 92,
        soiled: 24,
        inWash: 18,
      },
    ],
    folios: [
      {
        id: "FOL-9012",
        account: "Room 402 – Claire Mendoza",
        source: "Valet Laundry (Pre-Tag Estimate)",
        amount: 1100,
        status: "Pending",
        timestamp: "10:05 AM",
      },
      {
        id: "FOL-9011",
        account: "Room 305 – Elena Cruz",
        source: "Spa Amenity (AMN-201)",
        amount: 2800,
        status: "Posted",
        timestamp: "10:00 AM",
      },
      {
        id: "FOL-9010",
        account: "MASTER-GRP-101 (Apex Tech Summit)",
        source: "Group Room & Tax",
        amount: 84000,
        status: "Master Folio",
        timestamp: "09:45 AM",
      },
      {
        id: "FOL-9009",
        account: "Room 208 – David Tan (Booking.com)",
        source: "OTA Room Charge",
        amount: 6800,
        status: "Ingested",
        timestamp: "09:30 AM",
      },
      {
        id: "FOL-9008",
        account: "Room 601 – Sofia Lim",
        source: "Valet Laundry (LND-8043 • Express)",
        amount: 975,
        status: "Posted",
        timestamp: "09:15 AM",
      },
    ],
    checkoutAlert: null,
    nextOrderNum: 8051,
    nextFolioNum: 9013,
    nextBatchNum: 20,
  };
}

export function getLaundryStore(): LaundryMemoryStore {
  if (!globalForLaundry.__hosLaundryDispatchStore) {
    globalForLaundry.__hosLaundryDispatchStore = buildInitialStore();
  }
  return globalForLaundry.__hosLaundryDispatchStore;
}
