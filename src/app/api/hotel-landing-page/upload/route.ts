import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("guest_session");
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the form data from the incoming request
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
      return NextResponse.json({ error: "Directus configuration is missing" }, { status: 500 });
    }

    // Forward the formData to Directus
    const directusFormData = new FormData();
    directusFormData.append("file", file);

    const res = await fetch(`${DIRECTUS_URL}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      },
      body: directusFormData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("[UPLOAD] Directus upload error:", errorData);
      return NextResponse.json({ error: errorData.errors?.[0]?.message || "Failed to upload file to Directus" }, { status: 400 });
    }

    const data = await res.json();
    return NextResponse.json({ id: data.data.id }, { status: 200 });

  } catch (error) {
    console.error("[UPLOAD] Internal Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
