import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decodeJwtPayload, COOKIE_NAME } from '@/lib/auth-utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    return Boolean(payload?.sub);
}

/**
 * PDF Templates Proxy API
 * This server-side route avoids CORS and secures the Directus token.
 */
export async function GET() {
    try {
        if (!(await isAuthenticated())) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const response = await fetch(`${API_BASE_URL}/items/pdf_templates`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${STATIC_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) throw new Error(`Directus error: ${response.status}`);
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error (GET pdf_templates):', error);
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (!(await isAuthenticated())) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const body = await request.json();
        const response = await fetch(`${API_BASE_URL}/items/pdf_templates`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STATIC_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`Directus error: ${response.status}`);
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error (POST pdf_templates):', error);
        return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
    }
}

