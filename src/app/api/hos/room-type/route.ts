import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decodeJwtPayload, COOKIE_NAME } from '@/lib/auth-utils';
import { roomTypeSchema } from './validation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

export async function GET(request: Request) {
    try {
        if (!API_BASE_URL) return NextResponse.json({ error: 'Missing API config' }, { status: 500 });
        
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        
        let url = `${API_BASE_URL}/items/room_types_hos?limit=-1&sort=-created_at`;
        if (search) {
            const filter = { name: { _icontains: search } };
            url += `&filter=${encodeURIComponent(JSON.stringify(filter))}`;
        }

        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(staticToken ? { 'Authorization': `Bearer ${staticToken}` } : {}),
            },
        });

        if (!response.ok) throw new Error('Fetch failed');
        const data = await response.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (!API_BASE_URL) return NextResponse.json({ error: 'Missing API config' }, { status: 500 });

        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        let userId = null;
        if (token) {
            const payload = decodeJwtPayload(token);
            if (payload?.sub) userId = parseInt(payload.sub, 10);
        }

        const parsedBody = roomTypeSchema.safeParse(await request.json().catch(() => null));
        if (!parsedBody.success) {
            return NextResponse.json({ error: 'Invalid room type data.', details: parsedBody.error.flatten().fieldErrors }, { status: 400 });
        }
        const body = parsedBody.data;
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;

        const response = await fetch(`${API_BASE_URL}/items/room_types_hos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(staticToken ? { 'Authorization': `Bearer ${staticToken}` } : {}),
            },
            body: JSON.stringify({ ...body, created_by: userId, updated_by: userId }),
        });

        if (!response.ok) throw new Error('Create failed');
        const data = await response.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
