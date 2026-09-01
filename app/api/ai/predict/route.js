import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { FOOTBALL_DATA_LEAGUES } from "@/lib/football-ai/constants";
import { loadCachedTeamAssetResolver } from "@/lib/api-football/team-assets";
import { predictMatch } from "@/lib/football-ai/model";
import { getActiveModelRecord } from "@/lib/football-ai/repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function predictionKey(modelId, input) {
  return createHash("sha256").update(JSON.stringify({
    modelId,
    leagueCode: input.leagueCode,
    matchDate: input.matchDate,
    homeTeamKey: input.homeTeamKey,
    awayTeamKey: input.awayTeamKey,
  })).digest("hex");
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (input.matchDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.matchDate)) {
      return NextResponse.json({ error: "matchDate must use YYYY-MM-DD." }, { status: 422 });
    }
    const { record, error } = await getActiveModelRecord();
    if (error) return NextResponse.json({ error }, { status: 503 });
    if (!record?.artifact) return NextResponse.json({ error: "No active trained model exists." }, { status: 404 });

    const home = record.artifact.teams?.[input.homeTeamKey];
    const away = record.artifact.teams?.[input.awayTeamKey];
    if (!home || !away) {
      return NextResponse.json({ error: "Both teams must exist in the active model." }, { status: 422 });
    }
    const league = record.artifact.leagues?.[input.leagueCode];
    if (!league) return NextResponse.json({ error: "Choose a league supported by the active model." }, { status: 422 });
    const expectedCountry = FOOTBALL_DATA_LEAGUES[input.leagueCode]?.countryCode;
    if (!expectedCountry || !home.key.includes(`:${expectedCountry}:`) || !away.key.includes(`:${expectedCountry}:`)) {
      return NextResponse.json({ error: "The selected teams do not belong to this league." }, { status: 422 });
    }
    const matchDate = input.matchDate || new Date().toISOString().slice(0, 10);
    const prediction = predictMatch(record.artifact, {
      leagueCode: input.leagueCode,
      matchDate,
      homeTeamKey: home.key,
      awayTeamKey: away.key,
      homeTeamName: home.name,
      awayTeamName: away.name,
    });

    const assetClient = createServerSupabaseClient({ serviceRole: true });
    const resolveTeamAsset = await loadCachedTeamAssetResolver(assetClient);
    const homeAsset = resolveTeamAsset({ canonicalKey: prediction.homeTeam.key, name: prediction.homeTeam.name, countryCode: expectedCountry });
    const awayAsset = resolveTeamAsset({ canonicalKey: prediction.awayTeam.key, name: prediction.awayTeam.name, countryCode: expectedCountry });
    prediction.homeTeam.logo = homeAsset?.logo ?? null;
    prediction.homeTeam.apiFootballId = homeAsset?.apiFootballId ?? null;
    prediction.awayTeam.logo = awayAsset?.logo ?? null;
    prediction.awayTeam.apiFootballId = awayAsset?.apiFootballId ?? null;

    const supabase = process.env.AI_AUDIT_PREDICTIONS === "true"
      ? createServerSupabaseClient({ serviceRole: true })
      : null;
    if (supabase) {
      const key = predictionKey(record.id, { ...input, matchDate });
      const { error: writeError } = await supabase.from("ai_predictions").upsert({
        prediction_key: key,
        model_version_id: record.id,
        league_code: prediction.leagueCode,
        home_team_key: prediction.homeTeam.key,
        away_team_key: prediction.awayTeam.key,
        kickoff_at: input.kickoffAt || null,
        expected_home_goals: prediction.expectedGoals.home,
        expected_away_goals: prediction.expectedGoals.away,
        home_win_probability: prediction.probabilities.homeWin,
        draw_probability: prediction.probabilities.draw,
        away_win_probability: prediction.probabilities.awayWin,
        over_25_probability: prediction.probabilities.over25,
        both_teams_score_probability: prediction.probabilities.bothTeamsScore,
        confidence: prediction.confidence,
        top_scorelines: prediction.topScorelines,
        features: prediction.features,
        explanations: prediction.explanations,
      }, { onConflict: "prediction_key" });
      if (writeError) console.error("Prediction audit write failed:", writeError.message);
    }

    return NextResponse.json({
      prediction,
      model: {
        version: record.version,
        algorithm: record.algorithm,
        trainedTo: record.trained_to,
        testMetrics: record.metrics?.test ?? null,
      },
      disclaimer: "Probabilistic analysis, not a guarantee or betting instruction.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prediction failed." }, { status: 400 });
  }
}
