import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { decodeJwtPayload, COOKIE_NAME } from '@/lib/auth-utils';
import type {
    AnalyticsReportData,
    PaymentChannelMetric,
    PerformanceTrendPoint,
    ReconciliationLedgerRow,
    ReportPeriodPreset,
    RevenueBreakdownBucket,
} from '@/modules/hotel-operating-system/analytics-reports/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z.object({
    period: z.enum(['today', 'mtd', 'custom']).default('today'),
    startDate: z.string().regex(DATE_REGEX).optional(),
    endDate: z.string().regex(DATE_REGEX).optional(),
});

const auditSchema = z.object({
    action: z.enum(['export_excel', 'export_pdf', 'night_audit_signoff']),
    startDate: z.string().regex(DATE_REGEX),
    endDate: z.string().regex(DATE_REGEX),
});

interface RawRoom {
    id: number;
    room_number: string;
    operational_status_id?: number | { id: number } | null;
    housekeeping_status_id?: number | { id: number } | null;
}

interface RawReservation {
    id: number;
    guest_id?: number | { id: number; first_name?: string; last_name?: string } | null;
    status?: string;
    check_in?: string;
    check_out?: string;
    total_amount?: number | string | null;
    created_at?: string;
}

interface RawReservationItem {
    id: number;
    reservation_id?: number | { id: number } | null;
    room_id?: number | { id: number } | null;
    night_date?: string;
}

interface RawGuest {
    id: number;
    first_name?: string;
    last_name?: string;
}

interface RawCharge {
    id: number;
    reservation_id?: number | { id: number } | null;
    charge_type?: string;
    description?: string;
    amount?: number | string | null;
    charge_date?: string;
    created_at?: string;
}

interface RawPayment {
    id: number;
    reservation_id?: number | { id: number } | null;
    amount?: number | string | null;
    payment_method?: string;
    payment_date?: string;
    status?: string;
    notes?: string;
    created_at?: string;
}

interface RawTask {
    id: number;
    room_id?: number | { id: number } | null;
    blocks_availability?: number | boolean | null;
    status?: string;
}

function getManilaBusinessDate(now: Date = new Date()): string {
    // Shift to Manila (UTC+8) and apply 02:00 AM business-day rollover cutoff
    const manilaMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000;
    return new Date(manilaMs).toISOString().split('T')[0];
}

function parseUtcDate(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
}

function addDaysUtc(dateStr: string, delta: number): string {
    const ms = parseUtcDate(dateStr) + delta * 86_400_000;
    return new Date(ms).toISOString().split('T')[0];
}

function extractId(val: unknown): number | null {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && /^\d+$/.test(val)) return parseInt(val, 10);
    if (val && typeof val === 'object' && 'id' in val) {
        return extractId((val as { id: unknown }).id);
    }
    return null;
}

function normalizeDateOnly(raw?: string | null): string {
    if (!raw) return '';
    return raw.split('T')[0].split(' ')[0];
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function calcDeltaPct(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return round2(((current - previous) / Math.abs(previous)) * 100);
}

function formatTimeLabel(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getTimeBucketIndex(iso?: string): number {
    if (!iso) return 2;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 2;
    const hour = d.getHours();
    if (hour < 9) return 0; // 06:00 AM
    if (hour < 13) return 1; // 10:00 AM
    if (hour < 17) return 2; // 02:00 PM
    if (hour < 21) return 3; // 06:00 PM
    return 4; // 10:00 PM
}

function mapPaymentMethod(rawMethod?: string): 'PayMongo' | 'Card' | 'Cash' {
    const m = (rawMethod || '').toUpperCase();
    if (m.includes('PAYMONGO') || m.includes('GCASH') || m.includes('MAYA') || m.includes('QR') || m.includes('ONLINE')) {
        return 'PayMongo';
    }
    if (m.includes('CARD') || m.includes('POS') || m.includes('CREDIT') || m.includes('DEBIT')) {
        return 'Card';
    }
    return 'Cash';
}

function isRoomChargeType(chargeType?: string, description?: string): boolean {
    const t = (chargeType || '').toUpperCase();
    const d = (description || '').toLowerCase();
    if (t === 'ROOM_CHARGE' || t.includes('ROOM') || t.includes('EXTENSION') || t.includes('NIGHT')) {
        return true;
    }
    if (d.includes('room') || d.includes('extension') || d.includes('night')) {
        return true;
    }
    return false;
}

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const authPayload = token ? decodeJwtPayload(token) : null;
        if (!authPayload?.sub) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        if (!API_BASE_URL) {
            return NextResponse.json({ error: 'Missing API configuration.' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            period: searchParams.get('period') || 'today',
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
        });

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid query parameters.', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const today = getManilaBusinessDate();
        const period: ReportPeriodPreset = parsed.data.period;
        let startDate = parsed.data.startDate || today;
        let endDate = parsed.data.endDate || today;

        if (period === 'today') {
            startDate = today;
            endDate = today;
        } else if (period === 'mtd') {
            startDate = `${today.slice(0, 7)}-01`;
            endDate = today;
        }

        const startMs = parseUtcDate(startDate);
        const endMs = parseUtcDate(endDate);
        if (endMs < startMs) {
            return NextResponse.json({ error: 'startDate must be before or equal to endDate.' }, { status: 400 });
        }

        const dayCount = Math.round((endMs - startMs) / 86_400_000) + 1;
        if (dayCount > 366) {
            return NextResponse.json({ error: 'Date range cannot exceed 366 days.' }, { status: 400 });
        }

        const prevEndDate = addDaysUtc(startDate, -1);
        const prevStartDate = addDaysUtc(prevEndDate, -(dayCount - 1));
        const trendStartDate = dayCount === 1 ? addDaysUtc(endDate, -6) : startDate;

        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(staticToken ? { Authorization: `Bearer ${staticToken}` } : {}),
        };

        const [roomsRes, tasksRes, reservationsRes, resItemsRes, guestsRes, chargesRes, paymentsRes, shiftsRes] =
            await Promise.all([
                fetch(`${API_BASE_URL}/items/rooms_hos?limit=-1&fields=id,room_number,operational_status_id,housekeeping_status_id`, { headers }),
                fetch(`${API_BASE_URL}/items/housekeeping_tasks?limit=-1&fields=id,room_id,blocks_availability,status`, { headers }),
                fetch(`${API_BASE_URL}/items/reservations_hos?limit=-1&fields=id,guest_id,status,check_in,check_out,total_amount,created_at`, { headers }),
                fetch(`${API_BASE_URL}/items/reservation_items_hos?limit=-1&fields=id,reservation_id,room_id,night_date`, { headers }),
                fetch(`${API_BASE_URL}/items/guests_hos?limit=-1&fields=id,first_name,last_name`, { headers }),
                fetch(`${API_BASE_URL}/items/guest_charges_hos?limit=-1&sort=-charge_date&fields=id,reservation_id,charge_type,description,amount,charge_date,created_at`, { headers }),
                fetch(`${API_BASE_URL}/items/payments_hos?limit=-1&sort=-payment_date&fields=id,reservation_id,amount,payment_method,payment_date,status,notes,created_at`, { headers }),
                fetch(`${API_BASE_URL}/items/shifts_hos?limit=1&sort=-opened_at&fields=id,status,opened_at`, { headers }),
            ]);

        const rooms: RawRoom[] = roomsRes.ok ? (await roomsRes.json()).data || [] : [];
        const tasks: RawTask[] = tasksRes.ok ? (await tasksRes.json()).data || [] : [];
        const reservations: RawReservation[] = reservationsRes.ok ? (await reservationsRes.json()).data || [] : [];
        const resItems: RawReservationItem[] = resItemsRes.ok ? (await resItemsRes.json()).data || [] : [];
        const guests: RawGuest[] = guestsRes.ok ? (await guestsRes.json()).data || [] : [];
        const charges: RawCharge[] = chargesRes.ok ? (await chargesRes.json()).data || [] : [];
        const payments: RawPayment[] = paymentsRes.ok ? (await paymentsRes.json()).data || [] : [];
        const latestShift = shiftsRes.ok ? ((await shiftsRes.json()).data || [])[0] : null;

        // 1. Active available room count (deduct OOO rooms & blocking maintenance tasks)
        const blockedRoomIds = new Set<number>();
        for (const t of tasks) {
            const blocks = t.blocks_availability === 1 || t.blocks_availability === true;
            const tStatus = (t.status || '').toLowerCase();
            if (blocks && tStatus !== 'completed' && tStatus !== 'cancelled') {
                const rId = extractId(t.room_id);
                if (rId !== null) blockedRoomIds.add(rId);
            }
        }
        const roomNumberById = new Map<number, string>();
        let activeRoomCount = 0;
        for (const r of rooms) {
            roomNumberById.set(r.id, r.room_number || String(r.id));
            const opId = extractId(r.operational_status_id);
            const hkId = extractId(r.housekeeping_status_id);
            const isOoo = opId === 5 || hkId === 5 || blockedRoomIds.has(r.id);
            if (!isOoo) activeRoomCount += 1;
        }

        // Lookup maps
        const guestNameById = new Map<number, string>();
        for (const g of guests) {
            const name = `${g.last_name ? `${g.last_name}, ` : ''}${g.first_name || ''}`.trim();
            guestNameById.set(g.id, name || `Guest #${g.id}`);
        }

        const reservationById = new Map<number, RawReservation>();
        const validReservationIds = new Set<number>();
        for (const res of reservations) {
            reservationById.set(res.id, res);
            const st = (res.status || '').toLowerCase();
            if (st !== 'cancelled' && st !== 'pending') {
                validReservationIds.add(res.id);
            }
        }

        const roomIdByReservation = new Map<number, number>();
        for (const item of resItems) {
            const resId = extractId(item.reservation_id);
            const roomId = extractId(item.room_id);
            if (resId !== null && roomId !== null && !roomIdByReservation.has(resId)) {
                roomIdByReservation.set(resId, roomId);
            }
        }

        // Helper to compute KPI metrics for any inclusive [from, to] window
        const computeWindowMetrics = (from: string, to: string) => {
            const windowDays = Math.round((parseUtcDate(to) - parseUtcDate(from)) / 86_400_000) + 1;
            const totalAvailableNights = activeRoomCount * windowDays;

            const occupiedItems = resItems.filter((item) => {
                const resId = extractId(item.reservation_id);
                const nd = normalizeDateOnly(item.night_date);
                return resId !== null && validReservationIds.has(resId) && nd >= from && nd <= to;
            });
            const occupiedNights = occupiedItems.length;

            const checkInsCount = reservations.filter((r) => {
                const st = (r.status || '').toLowerCase();
                const ci = normalizeDateOnly(r.check_in);
                return st !== 'cancelled' && st !== 'pending' && ci >= from && ci <= to;
            }).length;

            const windowCharges = charges.filter((c) => {
                const cd = normalizeDateOnly(c.charge_date || c.created_at);
                const typeLower = (c.charge_type || '').toLowerCase();
                return cd >= from && cd <= to && !typeLower.includes('void');
            });

            let roomRevenue = 0;
            let incidentalRevenue = 0;
            for (const c of windowCharges) {
                const amt = parseFloat(String(c.amount)) || 0;
                if (amt <= 0) continue;
                if (isRoomChargeType(c.charge_type, c.description)) {
                    roomRevenue += amt;
                } else {
                    incidentalRevenue += amt;
                }
            }

            // Fallback: if room charges aren't itemized in guest_charges_hos, use reservations' total_amount in window
            if (roomRevenue === 0 && occupiedNights > 0) {
                const seenRes = new Set<number>();
                for (const item of occupiedItems) {
                    const resId = extractId(item.reservation_id);
                    if (resId !== null && !seenRes.has(resId)) {
                        seenRes.add(resId);
                        const res = reservationById.get(resId);
                        if (res) {
                            const totalAmt = parseFloat(String(res.total_amount)) || 0;
                            const ci = normalizeDateOnly(res.check_in);
                            const co = normalizeDateOnly(res.check_out);
                            const totalResNights = ci && co ? Math.max(1, Math.round((parseUtcDate(co) - parseUtcDate(ci)) / 86_400_000)) : 1;
                            const nightsInWindow = occupiedItems.filter((oi) => extractId(oi.reservation_id) === resId).length;
                            roomRevenue += (totalAmt / totalResNights) * nightsInWindow;
                        }
                    }
                }
            }

            const occupancyRate = totalAvailableNights > 0 ? round2((occupiedNights / totalAvailableNights) * 100) : 0;
            const adr = occupiedNights > 0 ? round2(roomRevenue / occupiedNights) : 0;
            const revpar = totalAvailableNights > 0 ? round2(roomRevenue / totalAvailableNights) : 0;
            const alos = checkInsCount > 0 ? round2(occupiedNights / checkInsCount) : 0;

            return {
                occupancyRate,
                adr,
                revpar,
                alos,
                occupiedNights,
                totalAvailableNights,
                checkInsCount,
                roomRevenue: round2(roomRevenue),
                incidentalRevenue: round2(incidentalRevenue),
                windowCharges,
            };
        };

        const curr = computeWindowMetrics(startDate, endDate);
        const prev = computeWindowMetrics(prevStartDate, prevEndDate);

        // 2. Payment Channel Settlement Mix
        const windowPayments = payments.filter((p) => {
            const pd = normalizeDateOnly(p.payment_date || p.created_at);
            const st = (p.status || '').toLowerCase();
            const notesLower = (p.notes || '').toLowerCase();
            const isSettled = st === 'settled' || st === 'completed' || st === 'paid';
            const isDepositLiability = notesLower.includes('incidental deposit') || notesLower.includes('deposit refunded');
            return pd >= startDate && pd <= endDate && isSettled && !isDepositLiability;
        });

        const channelMap: Record<'PayMongo' | 'Card' | 'Cash', { amount: number; count: number }> = {
            PayMongo: { amount: 0, count: 0 },
            Card: { amount: 0, count: 0 },
            Cash: { amount: 0, count: 0 },
        };

        for (const p of windowPayments) {
            const amt = parseFloat(String(p.amount)) || 0;
            if (amt <= 0) continue;
            const ch = mapPaymentMethod(p.payment_method);
            channelMap[ch].amount += amt;
            channelMap[ch].count += 1;
        }

        const totalSettledPayments = channelMap.PayMongo.amount + channelMap.Card.amount + channelMap.Cash.amount;
        const paymentMix: PaymentChannelMetric[] = (['PayMongo', 'Card', 'Cash'] as const).map((channel) => {
            const amt = round2(channelMap[channel].amount);
            return {
                channel,
                amount: amt,
                percentage: totalSettledPayments > 0 ? round2((amt / totalSettledPayments) * 100) : 0,
                count: channelMap[channel].count,
            };
        });

        const grossRevenue = round2(
            curr.roomRevenue + curr.incidentalRevenue > 0 ? curr.roomRevenue + curr.incidentalRevenue : totalSettledPayments
        );
        const roomChargesPct = grossRevenue > 0 ? round2((curr.roomRevenue / grossRevenue) * 100) : 0;
        const incidentalsPct = grossRevenue > 0 ? round2(100 - roomChargesPct) : 0;

        // 3. Revenue Breakdown Bar Chart
        let revenueBreakdown: RevenueBreakdownBucket[] = [];
        if (dayCount === 1) {
            const bucketLabels = ['06:00 AM', '10:00 AM', '02:00 PM', '06:00 PM', '10:00 PM'];
            revenueBreakdown = bucketLabels.map((label) => ({ label, roomCharges: 0, incidentals: 0 }));
            for (const c of curr.windowCharges) {
                const amt = parseFloat(String(c.amount)) || 0;
                if (amt <= 0) continue;
                const idx = getTimeBucketIndex(c.created_at || c.charge_date);
                if (isRoomChargeType(c.charge_type, c.description)) {
                    revenueBreakdown[idx].roomCharges = round2(revenueBreakdown[idx].roomCharges + amt);
                } else {
                    revenueBreakdown[idx].incidentals = round2(revenueBreakdown[idx].incidentals + amt);
                }
            }
            if (curr.windowCharges.length === 0 && curr.roomRevenue > 0) {
                revenueBreakdown[2].roomCharges = curr.roomRevenue;
            }
        } else {
            const dailyMap = new Map<string, { roomCharges: number; incidentals: number }>();
            for (let i = 0; i < Math.min(dayCount, 14); i++) {
                const dStr = addDaysUtc(startDate, i);
                dailyMap.set(dStr, { roomCharges: 0, incidentals: 0 });
            }
            for (const c of curr.windowCharges) {
                const cd = normalizeDateOnly(c.charge_date || c.created_at);
                const bucket = dailyMap.get(cd);
                if (!bucket) continue;
                const amt = parseFloat(String(c.amount)) || 0;
                if (amt <= 0) continue;
                if (isRoomChargeType(c.charge_type, c.description)) {
                    bucket.roomCharges = round2(bucket.roomCharges + amt);
                } else {
                    bucket.incidentals = round2(bucket.incidentals + amt);
                }
            }
            revenueBreakdown = Array.from(dailyMap.entries()).map(([dStr, vals]) => ({
                label: new Date(parseUtcDate(dStr)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
                roomCharges: vals.roomCharges,
                incidentals: vals.incidentals,
            }));
        }

        // 4. Dual-Axis Performance Trend (ADR & RevPAR vs Occupancy %)
        const trendDays = Math.min(31, Math.round((parseUtcDate(endDate) - parseUtcDate(trendStartDate)) / 86_400_000) + 1);
        const performanceTrend: PerformanceTrendPoint[] = [];
        for (let i = 0; i < trendDays; i++) {
            const dStr = addDaysUtc(trendStartDate, i);
            const dayMetrics = computeWindowMetrics(dStr, dStr);
            performanceTrend.push({
                date: dStr,
                label: new Date(parseUtcDate(dStr)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
                adr: dayMetrics.adr,
                revpar: dayMetrics.revpar,
                occupancyRate: dayMetrics.occupancyRate,
            });
        }

        // 5. Reconciliation Ledger Rows
        const paymentByReservation = new Map<number, RawPayment>();
        for (const p of windowPayments) {
            const rId = extractId(p.reservation_id);
            if (rId !== null && !paymentByReservation.has(rId)) {
                paymentByReservation.set(rId, p);
            }
        }

        const ledger: ReconciliationLedgerRow[] = [];
        for (const c of curr.windowCharges) {
            const resId = extractId(c.reservation_id) ?? 0;
            const res = reservationById.get(resId);
            const guestId = extractId(res?.guest_id);
            const roomId = roomIdByReservation.get(resId);
            const roomNumber = roomId ? roomNumberById.get(roomId) || 'Unassigned' : 'Unassigned';
            const linkedPayment = paymentByReservation.get(resId);
            const amt = round2(parseFloat(String(c.amount)) || 0);
            if (amt <= 0) continue;

            ledger.push({
                id: `chg-${c.id}`,
                folioId: `FOL-${(normalizeDateOnly(c.charge_date || c.created_at) || today).slice(0, 4)}-${String(resId || c.id).padStart(4, '0')}`,
                reservationId: resId,
                roomNumber,
                chargeTitle: c.description || c.charge_type || 'Room Charge',
                guestName: guestId ? guestNameById.get(guestId) || 'Walk-In Guest' : 'Walk-In Guest',
                timeLabel: formatTimeLabel(c.created_at || c.charge_date),
                category: isRoomChargeType(c.charge_type, c.description) ? 'Room Charge' : 'Incidental / Service',
                paymentMethod: mapPaymentMethod(linkedPayment?.payment_method),
                auditStatus: linkedPayment ? 'Settled' : 'Pending',
                amount: amt,
            });
        }

        // Also include settled payments when no itemized charge rows exist for that reservation
        if (ledger.length === 0) {
            for (const p of windowPayments) {
                const resId = extractId(p.reservation_id) ?? 0;
                const res = reservationById.get(resId);
                const guestId = extractId(res?.guest_id);
                const roomId = roomIdByReservation.get(resId);
                const roomNumber = roomId ? roomNumberById.get(roomId) || 'Unassigned' : 'Unassigned';
                const amt = round2(parseFloat(String(p.amount)) || 0);
                if (amt <= 0) continue;

                ledger.push({
                    id: `pay-${p.id}`,
                    folioId: `FOL-${(normalizeDateOnly(p.payment_date || p.created_at) || today).slice(0, 4)}-${String(resId || p.id).padStart(4, '0')}`,
                    reservationId: resId,
                    roomNumber,
                    chargeTitle: p.notes || 'Settled Folio Payment',
                    guestName: guestId ? guestNameById.get(guestId) || 'Walk-In Guest' : 'Walk-In Guest',
                    timeLabel: formatTimeLabel(p.payment_date || p.created_at),
                    category: 'Room Charge',
                    paymentMethod: mapPaymentMethod(p.payment_method),
                    auditStatus: 'Settled',
                    amount: amt,
                });
            }
        }

        const isHistorical = endDate < today;
        const shiftClosed = latestShift && (latestShift.status || '').toLowerCase() === 'closed';
        const auditStatusLabel = isHistorical || shiftClosed
            ? 'Closed (Audited & Locked)'
            : 'Open (Current Business Day)';

        const responseData: AnalyticsReportData = {
            period,
            startDate,
            endDate,
            auditStatusLabel,
            grossRevenue,
            roomChargesTotal: curr.roomRevenue,
            roomChargesPct,
            incidentalsTotal: curr.incidentalRevenue,
            incidentalsPct,
            kpis: {
                occupancyRate: {
                    value: curr.occupancyRate,
                    delta: round2(curr.occupancyRate - prev.occupancyRate),
                    subtext: `${curr.occupiedNights} / ${curr.totalAvailableNights} Available Room Nights`,
                },
                adr: {
                    value: curr.adr,
                    delta: calcDeltaPct(curr.adr, prev.adr),
                    subtext: 'Net of Voided Postings',
                },
                revpar: {
                    value: curr.revpar,
                    delta: calcDeltaPct(curr.revpar, prev.revpar),
                    subtext: `Active Inventory: ${activeRoomCount} Rooms`,
                },
                alos: {
                    value: curr.alos,
                    delta: round2(curr.alos - prev.alos),
                    subtext: `${curr.checkInsCount} Check-ins / Bookings`,
                },
            },
            revenueBreakdown,
            paymentMix,
            performanceTrend,
            ledger,
        };

        return NextResponse.json({ success: true, data: responseData });
    } catch (error) {
        console.error('[Analytics Reports API GET Error]:', error);
        return NextResponse.json({ error: 'Failed to aggregate analytics report.' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const authPayload = token ? decodeJwtPayload(token) : null;
        if (!authPayload?.sub) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const parsed = auditSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid audit payload.', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const auditEntry = {
            userId: authPayload.sub,
            action: parsed.data.action,
            startDate: parsed.data.startDate,
            endDate: parsed.data.endDate,
            timestamp: new Date().toISOString(),
        };

        console.info('[HOS Analytics Audit Trail]', JSON.stringify(auditEntry));
        return NextResponse.json({ success: true, audit: auditEntry });
    } catch (error) {
        console.error('[Analytics Reports API POST Error]:', error);
        return NextResponse.json({ error: 'Failed to record audit event.' }, { status: 500 });
    }
}
