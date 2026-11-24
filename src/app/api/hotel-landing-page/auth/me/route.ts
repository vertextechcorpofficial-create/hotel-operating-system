import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("guest_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionData = JSON.parse(sessionCookie.value);
    const { accountId, guestId } = sessionData;

    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
      return NextResponse.json({ error: "Directus configuration is missing" }, { status: 500 });
    }

    const authHeaders = { 
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json"
    };

    // Fetch fresh account data
    const accountRes = await fetch(`${DIRECTUS_URL}/items/guest_accounts_hos/${accountId}?fields=email,username,contact_number,id_type,id_number,id_photo_uuid,profile_picture`, {
      method: "GET",
      headers: authHeaders,
    });

    if (!accountRes.ok) {
      return NextResponse.json({ error: "Failed to fetch account data" }, { status: 400 });
    }

    const accountData = await accountRes.json();
    const account = accountData.data;

    // Fetch fresh profile data (first/last name)
    const profileRes = await fetch(`${DIRECTUS_URL}/items/guests_hos/${guestId}?fields=first_name,last_name`, {
      method: "GET",
      headers: authHeaders,
    });

    let first_name = sessionData.first_name;
    let last_name = sessionData.last_name;

    if (profileRes.ok) {
      const profileData = await profileRes.json();
      first_name = profileData.data.first_name;
      last_name = profileData.data.last_name;
    }

    return NextResponse.json(
      {
        user: {
          accountId,
          guestId,
          email: account.email,
          username: account.username,
          contact_number: account.contact_number,
          id_type: account.id_type,
          id_number: account.id_number,
          id_photo_uuid: account.id_photo_uuid,
          profile_picture: account.profile_picture,
          first_name,
          last_name,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AUTH_ME] Error reading session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
