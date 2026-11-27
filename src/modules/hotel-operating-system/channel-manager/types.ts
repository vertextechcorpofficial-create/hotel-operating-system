export type ChannelRole = "Manager" | "SysAdmin" | "Supervisor" | "Accounting";

export type ChannelConnectionStatus = "Active" | "Paused" | "Disconnected";

export type SyncLogStatus = "Queued" | "Synced" | "Failed" | "Retrying";

export interface OtaChannel {
  id: string;
  name: string;
  status: ChannelConnectionStatus;
  commissionPct: number;
  apiKeyValid: boolean;
  webhookSecret: string;
  icalUrl: string;
  lastSync: string;
}

export interface InventoryDateCell {
  confirmed: number;
  groupHolds: number;
  cap: number;
  stopSell: boolean;
}

export interface RoomInventoryRow {
  roomType: string;
  physicalRooms: number;
  outOfOrder: number;
  parityRate: number;
  dates: Record<string, InventoryDateCell>;
}

export interface IngestedOtaReservation {
  resId: string;
  externalId: string;
  channelId: string;
  channelName: string;
  guestName: string;
  roomType: string;
  date: string;
  grossAmount: number;
  commissionPct: number;
  commissionAmount: number;
  status: "Confirmed" | "Cancelled" | "Modified";
}

export interface ChannelSyncLog {
  logId: string;
  channelName: string;
  direction: string;
  action: string;
  status: SyncLogStatus;
  actor: string;
  timestamp: string;
  attempts: number;
}

export interface OverbookingAlert {
  externalId: string;
  channelName: string;
  guestName: string;
  roomType: string;
  dateStr: string;
}

export interface ChannelManagerMeta {
  businessDate: string;
  directusChannelsMode: "live" | "fallback";
  directusLogsMode: "live" | "fallback";
}

export interface ChannelManagerPayload {
  channels: OtaChannel[];
  dates: string[];
  roomInventory: RoomInventoryRow[];
  ingestedReservations: IngestedOtaReservation[];
  syncLogs: ChannelSyncLog[];
  overbookingAlert: OverbookingAlert | null;
  meta: ChannelManagerMeta;
}
