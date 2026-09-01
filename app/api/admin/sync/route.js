import { NextResponse } from "next/server";
import { reconcileCachedTeamAssets, TEAM_ASSET_SYNC_JOBS } from "@/lib/api-football/team-assets";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const isTeamAssetSync = body.mode === "team-assets";
  const upstreamBody = isTeamAssetSync
    ? { jobs: TEAM_ASSET_SYNC_JOBS.map(({ endpoint, params, force }) => ({ endpoint, params, force })) }
    : body;
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
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
    });
    const result = await response.json();
    if (isTeamAssetSync && response.ok) {
      const supabase = createServerSupabaseClient({ serviceRole: true });
      if (!supabase) {
        return NextResponse.json({
          ...result,
          error: "The API-Football catalog synced, but Supabase service-role credentials are missing for reconciliation.",
        }, { status: 503 });
      }
      try {
        const teamAssets = await reconcileCachedTeamAssets(supabase);
        return NextResponse.json({ ...result, teamAssets });
      } catch (error) {
        return NextResponse.json({
          ...result,
          error: error instanceof Error ? error.message : "Team catalog synced but reconciliation failed.",
          setupRequired: true,
        }, { status: 503 });
      }
    }
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync request failed." },
      { status: 502 },
    );
  }
}
