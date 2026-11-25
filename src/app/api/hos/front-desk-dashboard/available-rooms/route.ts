import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_NIGHTS = 366;

/**
 * GET /api/hos/front-desk-dashboard/available-rooms
 * Query: roomTypeId (optional), checkIn + checkOut (optional, YYYY-MM-DD)
 *
 * Returns Vacant + Clean rooms. When roomTypeId is omitted (e.g. an advance
 * booking with no assigned room type), rooms of every type are returned.
 * When checkIn/checkOut are provided, rooms already booked on any night of
 * that range are excluded.
 */
export async function GET(request: Request) {
    try {
        if (!API_BASE_URL) {
            return NextResponse.json({ error: 'Missing API configuration.' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const roomTypeId = searchParams.get('roomTypeId');
        const checkIn = searchParams.get('checkIn');
        const checkOut = searchParams.get('checkOut');

        if (roomTypeId && !/^\d+$/.test(roomTypeId)) {
            return NextResponse.json({ error: 'roomTypeId must be a number.' }, { status: 400 });
        }

        const nightDates: string[] = [];
        if (checkIn || checkOut) {
            if (!checkIn || !checkOut || !DATE_ONLY_REGEX.test(checkIn) || !DATE_ONLY_REGEX.test(checkOut)) {
                return NextResponse.json({ error: 'checkIn and checkOut must both be YYYY-MM-DD.' }, { status: 400 });
            }
            const startMs = Date.parse(`${checkIn}T00:00:00Z`);
            const endMs = Date.parse(`${checkOut}T00:00:00Z`);
            if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
                return NextResponse.json({ error: 'checkOut must be after checkIn.' }, { status: 400 });
            }
            if ((endMs - startMs) / 86_400_000 > MAX_RANGE_NIGHTS) {
                return NextResponse.json({ error: 'Date range is too long.' }, { status: 400 });
            }
            for (let ms = startMs; ms < endMs; ms += 86_400_000) {
                nightDates.push(new Date(ms).toISOString().split('T')[0]);
            }
        }

        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(staticToken ? { 'Authorization': `Bearer ${staticToken}` } : {}),
        };

        // Fetch rooms that are Vacant (1) and Clean (1), optionally for a given type
        const roomFilter: Record<string, unknown> = {
            operational_status_id: { _eq: 1 },
            housekeeping_status_id: { _eq: 1 },
        };
        if (roomTypeId) roomFilter.type_id = { _eq: Number(roomTypeId) };

        const response = await fetch(
            `${API_BASE_URL}/items/rooms_hos?limit=-1&fields=id,room_number,floor_number&filter=${encodeURIComponent(JSON.stringify(roomFilter))}`,
            { headers }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch available rooms.');
        }

        const data = await response.json();
        const rooms: { id: number; room_number: string; floor_number: number | null }[] = data.data || [];

        // Exclude rooms that already have an active reservation on any requested night
        if (nightDates.length > 0 && rooms.length > 0) {
            const conflictFilter = {
                _and: [
                    { night_date: { _in: nightDates } },
                    { room_id: { _in: rooms.map((r) => r.id) } },
                    { reservation_id: { status: { _nin: ['Cancelled', 'cancelled', 'Checked-Out'] } } },
                ],
            };
            const conflictRes = await fetch(
                `${API_BASE_URL}/items/reservation_items_hos?limit=-1&fields=room_id&filter=${encodeURIComponent(JSON.stringify(conflictFilter))}`,
                { headers }
            );
            if (!conflictRes.ok) {
                throw new Error('Failed to verify room availability for the selected dates.');
            }
            const conflictData = await conflictRes.json();
            const bookedRoomIds = new Set<number>(
                ((conflictData.data || []) as { room_id: number | { id: number } | null }[])
                    .map((item) => (typeof item.room_id === 'object' && item.room_id !== null ? item.room_id.id : item.room_id))
                    .filter((id): id is number => typeof id === 'number')
            );
            return NextResponse.json({ data: rooms.filter((r) => !bookedRoomIds.has(r.id)) });
        }

        return NextResponse.json({ data: rooms });
    } catch (error) {
        console.error('Error fetching available rooms:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
