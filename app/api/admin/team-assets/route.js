import { NextResponse } from "next/server";
import { loadTeamAssetReport, reconcileCachedTeamAssets } from "@/lib/api-football/team-assets";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const expectedKey = process.env.ADMIN_SYNC_KEY;
  return Boolean(expectedKey && request.headers.get("x-admin-key") === expectedKey);
}

function setupRequired(message) {
  return message.includes("202609010003_team_assets.sql");
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerSupabaseClient({ serviceRole: true });
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service-role credentials are not configured." }, { status: 503 });
  }
  try {
    return NextResponse.json(await loadTeamAssetReport(supabase), {
      headers: { "cache-control": "private, max-age=0, must-revalidate" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load team-asset coverage.";
    return NextResponse.json({ error: message, setupRequired: setupRequired(message) }, { status: 503 });
  }
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerSupabaseClient({ serviceRole: true });
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service-role credentials are not configured." }, { status: 503 });
  }
  try {
    return NextResponse.json(await reconcileCachedTeamAssets(supabase));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reconcile team assets.";
    return NextResponse.json({ error: message, setupRequired: setupRequired(message) }, { status: 503 });
  }
}
