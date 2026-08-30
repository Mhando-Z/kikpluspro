import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const expectedKey = process.env.ADMIN_SYNC_KEY;
  return Boolean(expectedKey && request.headers.get("x-admin-key") === expectedKey);
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const functionUrl = process.env.SUPABASE_SYNC_FUNCTION_URL;
  const syncSecret = process.env.SUPABASE_SYNC_SECRET;
  if (!functionUrl || !syncSecret) {
    return NextResponse.json(
      { error: "The sync function is not configured." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const headers = {
    "content-type": "application/json",
    "x-sync-secret": syncSecret,
  };

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    headers.authorization = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
    headers.apikey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync request failed." },
      { status: 502 },
    );
  }
}

