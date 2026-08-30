import { NextResponse } from "next/server";
import { getActiveModelRecord, safeModelPayload } from "@/lib/football-ai/repository";
import { loadCachedTeamAssetResolver } from "@/lib/api-football/team-assets";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { record, error } = await getActiveModelRecord();
  if (error) {
    return NextResponse.json({ ready: false, error }, { status: 503 });
  }
  if (!record) {
    return NextResponse.json({
      ready: false,
      error: "No active model exists. Import historical matches and run npm run ai:train.",
    }, { status: 404 });
  }
  const resolveTeamAsset = await loadCachedTeamAssetResolver(createServerSupabaseClient({ serviceRole: true }));
  return NextResponse.json({ ready: true, model: safeModelPayload(record, resolveTeamAsset) }, {
    headers: { "cache-control": "private, max-age=0, must-revalidate" },
  });
}
