import { NextResponse } from "next/server";
import { loadCachedTeamAssetResolver } from "@/lib/api-football/team-assets";
import { FOOTBALL_DATA_LEAGUES } from "@/lib/football-ai/constants";
import { pickForPrediction, summarizePredictions } from "@/lib/football-ai/performance";
import { getActiveModelRecord } from "@/lib/football-ai/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function allPredictions(supabase, modelId) {
  const rows = [];
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await supabase
      .from("ai_predictions")
      .select("id,fixture_id,league_code,kickoff_at,home_team_key,away_team_key,home_win_probability,draw_probability,away_win_probability,confidence,actual_result,actual_home_goals,actual_away_goals,settled_at,created_at")
      .eq("model_version_id", modelId)
      .order("created_at", { ascending: false })
      .range(offset, offset + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return rows;
}

async function recentFixtures(supabase, ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("ai_fixtures")
    .select("id,league_code,league_name,country_code,kickoff_at,home_team_name,away_team_name,home_goals,away_goals,result")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function GET() {
  const supabase = createServerSupabaseClient({ serviceRole: true });
  if (!supabase) {
    return NextResponse.json({ ready: false, error: "Supabase server credentials are not configured." }, { status: 503 });
  }

  try {
    const { record, error } = await getActiveModelRecord();
    if (error) throw new Error(error);
    if (!record) {
      return NextResponse.json({ ready: false, error: "No active model exists. Run npm run ai:train." }, { status: 404 });
    }

    const predictions = await allPredictions(supabase, record.id);
    const summary = summarizePredictions(predictions);
    summary.byLeague = summary.byLeague.map((item) => ({
      ...item,
      label: FOOTBALL_DATA_LEAGUES[item.key]?.name ?? item.label,
    }));

    const recentPredictions = predictions
      .filter((row) => row.fixture_id && row.actual_result)
      .sort((left, right) => String(right.settled_at ?? right.kickoff_at).localeCompare(String(left.settled_at ?? left.kickoff_at)))
      .slice(0, 12);
    const fixtures = await recentFixtures(supabase, recentPredictions.map((row) => row.fixture_id));
    const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
    const resolveTeamAsset = await loadCachedTeamAssetResolver(supabase);
    const recent = recentPredictions.flatMap((prediction) => {
      const fixture = fixtureById.get(prediction.fixture_id);
      if (!fixture) return [];
      const pick = pickForPrediction(prediction);
      const homeAsset = resolveTeamAsset({ name: fixture.home_team_name, countryCode: fixture.country_code });
      const awayAsset = resolveTeamAsset({ name: fixture.away_team_name, countryCode: fixture.country_code });
      return [{
        id: prediction.id,
        fixtureId: fixture.id,
        leagueCode: fixture.league_code,
        leagueName: fixture.league_name,
        kickoffAt: fixture.kickoff_at,
        homeTeam: { name: fixture.home_team_name, logo: homeAsset?.logo ?? null, apiFootballId: homeAsset?.apiFootballId ?? null },
        awayTeam: { name: fixture.away_team_name, logo: awayAsset?.logo ?? null, apiFootballId: awayAsset?.apiFootballId ?? null },
        predicted: pick,
        actualResult: prediction.actual_result,
        score: { home: fixture.home_goals, away: fixture.away_goals },
        correct: pick.code === prediction.actual_result,
        confidence: prediction.confidence,
      }];
    });

    return NextResponse.json({
      ready: true,
      model: {
        version: record.version,
        algorithm: record.algorithm,
        trainedTo: record.trained_to,
        trainingRows: record.training_rows,
        validationRows: record.validation_rows,
        testRows: record.test_rows,
        testMetrics: record.metrics?.test ?? null,
      },
      performance: summary,
      recent,
    }, { headers: { "cache-control": "private, max-age=0, must-revalidate" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not calculate model performance.";
    const setupRequired = message.includes("ai_predictions") || message.includes("ai_fixtures");
    return NextResponse.json({ ready: false, setupRequired, error: message }, { status: 503 });
  }
}
