export type LaundryRole =
  | "Laundry Supervisor"
  | "Valet Runner"
  | "Front Desk Supervisor"
  | "Revenue Manager"
  | "Sales Manager"
  | "System Admin";

export type LaundryCategory = "VALET" | "LINEN";

export type LaundryTier = "Standard" | "Express";

export type LaundryChannel = "Internal" | "Outsourced";

export type LaundryStatus =
  | "Collected"
  | "Tagged / In Processing"
  | "Outsourced"
  | "Quality Check / Ready"
  | "Delivered"
  | "Cancelled";

export interface LaundryGarmentItem {
  name: string;
  service: string;
  qty: number;
  unitPrice: number;
}

export interface LaundryAuditLogEntry {
  timestamp: string;
  actor: string;
  action: string;
  prev: string;
  next: string;
  reason?: string;
}

export interface LaundryOrder {
  id: string;
  category: LaundryCategory;
  roomOrDept: string;
  tier: LaundryTier;
  channel: LaundryChannel;
  vendorBatchId?: string;
  slaRemainingMins: number;
  status: LaundryStatus;
  billedToFolio: boolean;
  damageNotes: string;
  items: LaundryGarmentItem[];
  auditLogs: LaundryAuditLogEntry[];
}

export interface VendorBatch {
  id: string;
  vendor: string;
  dispatchedAt: string;
  itemCount: number;
  status: string;
  eta: string;
}

export interface LinenStockItem {
  item: string;
  clean: number;
  soiled: number;
  inWash: number;
}

export interface LaundryFolioPosting {
  id: string;
  account: string;
  source: string;
  amount: number;
  status: string;
  timestamp: string;
}

export interface EarlyCheckoutAlert {
  ticketId: string;
  roomOrDept: string;
  message: string;
}

export interface LaundryDispatchMeta {
  businessDate: string;
  directusLaundryMode: "live" | "fallback";
  directusChargesMode: "live" | "fallback";
}

export interface LaundryDispatchPayload {
  orders: LaundryOrder[];
  vendorBatches: VendorBatch[];
  linenStock: LinenStockItem[];
  folios: LaundryFolioPosting[];
  checkoutAlert: EarlyCheckoutAlert | null;
  meta: LaundryDispatchMeta;
}
