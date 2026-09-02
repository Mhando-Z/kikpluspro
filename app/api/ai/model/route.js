import { NextResponse } from "next/server";
import { AI_MODEL_KEY, DOMESTIC_MODEL_KEYS } from "@/lib/football-ai/constants";
import { getActiveModelRecords, safeModelPayload } from "@/lib/football-ai/repository";
import { loadCachedTeamAssetResolver } from "@/lib/api-football/team-assets";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { records, error } = await getActiveModelRecords();
  if (error) {
    return NextResponse.json({ ready: false, error }, { status: 503 });
  }
  const domesticRecords = records.filter((record) => DOMESTIC_MODEL_KEYS.includes(record.model_key));
  if (!domesticRecords.length) {
    return NextResponse.json({
      ready: false,
      error: "No active domestic model exists. Import history and train the Big Five and expansion families.",
    }, { status: 404 });
  }
  const resolveTeamAsset = await loadCachedTeamAssetResolver(createServerSupabaseClient({ serviceRole: true }));
  const models = domesticRecords
    .map((record) => safeModelPayload(record, resolveTeamAsset))
    .filter(Boolean);
  const primary = models.find((model) => model.modelKey === AI_MODEL_KEY) ?? models[0];
  return NextResponse.json({ ready: true, model: primary, models }, {
    headers: { "cache-control": "private, max-age=0, must-revalidate" },
  });
}
