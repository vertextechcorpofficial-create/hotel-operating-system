import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decodeJwtPayload, COOKIE_NAME } from '@/lib/auth-utils';

interface CalendarReservationItem {
    id: string | number;
    night_date?: string;
    room_id?: string | number | null;
    reservation_id?: {
        id: string | number;
        status: string;
        check_in: string;
        check_out: string;
        total_amount?: number | string | null;
        guest_id?: {
            first_name: string;
            last_name: string;
        } | null;
    } | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        if (!payload?.sub) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        if (!API_BASE_URL) {
            return NextResponse.json({ error: 'Missing API configuration.' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        if (!start || !end) {
            return NextResponse.json({ error: 'Missing start or end date.' }, { status: 400 });
        }

        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(staticToken ? { 'Authorization': `Bearer ${staticToken}` } : {}),
        };

        // Parallel fetch of Room Types, Rooms, Operational Statuses, and Reservation Items
        const [
            typesRes,
            roomsRes,
            statusesRes,
            itemsRes,
            tasksRes
        ] = await Promise.all([
            // 1. Room Types
            fetch(`${API_BASE_URL}/items/room_types_hos?limit=-1&sort=id`, { headers }),
            // 2. Rooms (with operational status)
            fetch(`${API_BASE_URL}/items/rooms_hos?limit=-1&sort=room_number&fields=id,room_number,floor_number,type_id,operational_status_id.id,operational_status_id.status_name,operational_status_id.ui_color_code`, { headers }),
            // 3. Operational Statuses
            fetch(`${API_BASE_URL}/items/operational_statuses?limit=-1`, { headers }),
            // 4. Reservation Items (within date range) with Joins
            fetch(`${API_BASE_URL}/items/reservation_items_hos?limit=-1&fields=id,night_date,room_id,reservation_id.id,reservation_id.status,reservation_id.check_in,reservation_id.check_out,reservation_id.total_amount,reservation_id.guest_id.first_name,reservation_id.guest_id.last_name&filter=${encodeURIComponent(JSON.stringify({
                _and: [
                    { reservation_id: { check_in: { _lte: end } } },
                    { reservation_id: { check_out: { _gte: start } } }
                ]
            }))}`, { headers }),
            // 5. Blocking Maintenance Tasks
            fetch(`${API_BASE_URL}/items/housekeeping_tasks?limit=-1&fields=*`, { headers })
        ]);

        if (!typesRes.ok || !roomsRes.ok || !statusesRes.ok || !itemsRes.ok || !tasksRes.ok) {
            const errors = {
                types: !typesRes.ok ? { status: typesRes.status, text: await typesRes.text() } : null,
                rooms: !roomsRes.ok ? { status: roomsRes.status, text: await roomsRes.text() } : null,
                statuses: !statusesRes.ok ? { status: statusesRes.status, text: await statusesRes.text() } : null,
                items: !itemsRes.ok ? { status: itemsRes.status, text: await itemsRes.text() } : null,
                tasks: !tasksRes.ok ? { status: tasksRes.status, text: await tasksRes.text() } : null,
            };
            console.error('Calendar Fetch Error Breakdown:', JSON.stringify(errors, null, 2));
            throw new Error(`Failed to fetch data from Directus. Errors: ${JSON.stringify(errors)}`);
        }

        const typesData = await typesRes.json();
        const roomsData = await roomsRes.json();
        const statusesData = await statusesRes.json();
        const itemsData = await itemsRes.json();
        const rawTasksData = await tasksRes.json();

        // Build room -> price lookup for fallback nightly rate
        const roomTypePriceMap = new Map<number, number>();
        for (const t of (typesData.data || []) as Array<{ id: number; price?: number | string }>) {
            roomTypePriceMap.set(t.id, parseFloat(String(t.price ?? 0)) || 0);
        }
        const roomPriceMap = new Map<number, number>();
        for (const r of (roomsData.data || []) as Array<{ id: number; type_id?: number }>) {
            if (r.type_id != null) {
                roomPriceMap.set(r.id, roomTypePriceMap.get(r.type_id) ?? 0);
            }
        }

        // Process reservation items into unique reservations per room (excluding cancelled/no-show)
        const rawItems = (itemsData.data || []) as CalendarReservationItem[];
        const reservationsMap = new Map<string, {
            id: string | number;
            check_in_date: string;
            check_out_date: string;
            status: string;
            guest_id?: { first_name: string; last_name: string } | null;
            room_id: string | number | null;
            locked_price: number;
            minNight?: string;
            maxNight?: string;
        }>();

        rawItems.forEach((item: CalendarReservationItem) => {
            const resInfo = item.reservation_id;
            if (!resInfo) return;
            const statusLower = (resInfo.status || '').toLowerCase();
            if (statusLower === 'cancelled' || statusLower === 'no-show') return;

            const roomId = item.room_id ?? null;
            const key = `${resInfo.id}_${roomId ?? 'unassigned'}`;
            const night = item.night_date?.split('T')[0];

            const existing = reservationsMap.get(key);
            if (!existing) {
                const startMs = Date.parse(resInfo.check_in);
                const endMs = Date.parse(resInfo.check_out);
                const totalNights = !isNaN(startMs) && !isNaN(endMs) && endMs > startMs
                    ? Math.round((endMs - startMs) / 86_400_000)
                    : 1;
                const totalAmt = parseFloat(String(resInfo.total_amount ?? 0));
                const roomNumId = roomId != null ? Number(roomId) : NaN;
                const nightlyRate = !isNaN(totalAmt) && totalAmt > 0
                    ? Math.round((totalAmt / totalNights) * 100) / 100
                    : (!isNaN(roomNumId) ? (roomPriceMap.get(roomNumId) ?? 0) : 0);

                reservationsMap.set(key, {
                    id: resInfo.id,
                    check_in_date: resInfo.check_in,
                    check_out_date: resInfo.check_out,
                    status: resInfo.status,
                    guest_id: resInfo.guest_id,
                    room_id: roomId,
                    locked_price: nightlyRate,
                    minNight: night,
                    maxNight: night,
                });
            } else if (night) {
                if (!existing.minNight || night < existing.minNight) existing.minNight = night;
                if (!existing.maxNight || night > existing.maxNight) existing.maxNight = night;
            }
        });

        const uniqueReservations = Array.from(reservationsMap.values()).map((r) => {
            let checkIn = r.check_in_date;
            let checkOut = r.check_out_date;
            if (r.minNight && r.maxNight) {
                checkIn = r.minNight;
                const nextDayMs = Date.parse(`${r.maxNight}T00:00:00Z`) + 86_400_000;
                if (!isNaN(nextDayMs)) {
                    checkOut = new Date(nextDayMs).toISOString().split('T')[0];
                }
            }
            return {
                id: r.id,
                check_in_date: checkIn,
                check_out_date: checkOut,
                status: r.status,
                guest_id: r.guest_id,
                room_id: r.room_id,
                locked_price: r.locked_price,
            };
        });

        // Filter blocking tasks locally to avoid Directus schema sync issues with newly added MySQL fields
        // Fallback: If blocks_availability is entirely missing from payload, assume Maintenance tasks block availability.
        const blockingTasks = (rawTasksData.data || []).filter((t: { status?: string; blocks_availability?: number | boolean | string; task_type?: string; }) => {
            if (t.status === 'Completed') return false;
            
            if (t.blocks_availability !== undefined) {
                return t.blocks_availability === 1 || t.blocks_availability === true || t.blocks_availability === '1';
            }
            
            // Fallback for unsynced Directus fields
            return t.task_type && t.task_type.includes('Maintenance');
        });

        return NextResponse.json({
            data: {
                types: typesData.data || [],
                rooms: roomsData.data || [],
                statuses: statusesData.data || [],
                reservations: uniqueReservations,
                blockingTasks: blockingTasks,
            }
        });
    } catch (error) {
        console.error('Error fetching availability calendar data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
