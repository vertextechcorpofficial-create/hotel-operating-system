export type ReportPeriodPreset = "today" | "mtd" | "custom";

export interface KpiMetric {
  value: number;
  delta: number;
  subtext: string;
}

export interface AnalyticsKpis {
  occupancyRate: KpiMetric;
  adr: KpiMetric;
  revpar: KpiMetric;
  alos: KpiMetric;
}

export interface RevenueBreakdownBucket {
  label: string;
  roomCharges: number;
  incidentals: number;
}

export interface PaymentChannelMetric {
  channel: "PayMongo" | "Card" | "Cash";
  amount: number;
  percentage: number;
  count: number;
}

export interface PerformanceTrendPoint {
  date: string;
  label: string;
  adr: number;
  revpar: number;
  occupancyRate: number;
}

export interface ReconciliationLedgerRow {
  id: string;
  folioId: string;
  reservationId: number;
  roomNumber: string;
  chargeTitle: string;
  guestName: string;
  timeLabel: string;
  category: "Room Charge" | "Incidental / Service";
  paymentMethod: "PayMongo" | "Card" | "Cash";
  auditStatus: "Settled" | "Pending" | "Voided";
  amount: number;
}

export interface AnalyticsReportData {
  period: ReportPeriodPreset;
  startDate: string;
  endDate: string;
  auditStatusLabel: string;
  grossRevenue: number;
  roomChargesTotal: number;
  roomChargesPct: number;
  incidentalsTotal: number;
  incidentalsPct: number;
  kpis: AnalyticsKpis;
  revenueBreakdown: RevenueBreakdownBucket[];
  paymentMix: PaymentChannelMetric[];
  performanceTrend: PerformanceTrendPoint[];
  ledger: ReconciliationLedgerRow[];
}
