import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decodeJwtPayload, COOKIE_NAME } from '@/lib/auth-utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        const payload = token ? decodeJwtPayload(token) : null;
        if (!payload?.sub) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        if (!API_BASE_URL) {
            console.warn('NEXT_PUBLIC_API_BASE_URL is not defined in environment variables.');
            return NextResponse.json(
                { error: 'Internal Server Error: Missing API Base URL configuration.' },
                { status: 500 }
            );
        }

        const staticToken = process.env.DIRECTUS_STATIC_TOKEN;
        const response = await fetch(`${API_BASE_URL}/items/company?filter[company_id][_eq]=1`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(staticToken ? { 'Authorization': `Bearer ${staticToken}` } : {}),
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch company data. Status: ${response.status}`);
        }

        const data = await response.json();

        // Pre-process company_logo: Fetch and convert to Base64 to bypass CORS
        const company = data?.data?.[0];
        if (company && company.company_logo) {
            const logoUuid = company.company_logo;
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logoUuid);

            if (isUuid) {
                try {
                    const assetUrl = `${API_BASE_URL}/assets/${logoUuid}`;
                    const imgRes = await fetch(assetUrl, {
                        headers: staticToken ? { 'Authorization': `Bearer ${staticToken}` } : {},
                    });

                    if (imgRes.ok) {
                        const contentType = imgRes.headers.get('content-type') || 'image/png';
                        const buffer = await imgRes.arrayBuffer();
                        const base64 = Buffer.from(buffer).toString('base64');
                        company.company_logo = `data:${contentType};base64,${base64}`;
                    }
                } catch (imgErr) {
                    console.error('Error proxying company logo:', imgErr);
                    // Keep original UUID or handle as needed
                }
            }
        }

        if (!company) {
            console.warn('Company with ID 1 not found in Directus.');
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching company data:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
