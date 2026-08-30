import { NextResponse } from "next/server";
import { getActiveModelRecord } from "@/lib/football-ai/repository";
import { loadCachedTeamAssetResolver } from "@/lib/api-football/team-assets";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RESULT_INDEX = { H: 0, D: 1, A: 2 };

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function impliedMarket(fixture) {
  const odds = [fixture.market_home_odds, fixture.market_draw_odds, fixture.market_away_odds].map(finite);
  if (odds.some((value) => value === null || value <= 1)) return null;
  const inverse = odds.map((value) => 1 / value);
  const total = inverse.reduce((sum, value) => sum + value, 0);
  return {
    homeWin: inverse[0] / total,
    draw: inverse[1] / total,
    awayWin: inverse[2] / total,
  };
}

function predictionPayload(prediction) {
  if (!prediction) return null;
  const outcomes = [
    { code: "H", label: "Home win", value: finite(prediction.home_win_probability) },
    { code: "D", label: "Draw", value: finite(prediction.draw_probability) },
    { code: "A", label: "Away win", value: finite(prediction.away_win_probability) },
  ];
  const pick = outcomes.reduce((best, outcome) => outcome.value > best.value ? outcome : best);
  return {
    id: prediction.id,
    probabilities: {
      homeWin: outcomes[0].value,
      draw: outcomes[1].value,
      awayWin: outcomes[2].value,
      over25: finite(prediction.over_25_probability),
      bothTeamsScore: finite(prediction.both_teams_score_probability),
    },
    expectedGoals: {
      home: finite(prediction.expected_home_goals),
      away: finite(prediction.expected_away_goals),
    },
    pick,
    confidence: prediction.confidence,
    topScorelines: prediction.top_scorelines ?? [],
    explanations: prediction.explanations ?? [],
    actualResult: prediction.actual_result,
    actualHomeGoals: prediction.actual_home_goals,
    actualAwayGoals: prediction.actual_away_goals,
    settledAt: prediction.settled_at,
    createdAt: prediction.created_at,
  };
}

function fixturePayload(fixture, prediction, resolveTeamAsset) {
  const homeAsset = resolveTeamAsset?.({ name: fixture.home_team_name, countryCode: fixture.country_code });
  const awayAsset = resolveTeamAsset?.({ name: fixture.away_team_name, countryCode: fixture.country_code });
  return {
    id: fixture.id,
    leagueCode: fixture.league_code,
    leagueName: fixture.league_name,
    kickoffAt: fixture.kickoff_at,
    homeTeam: {
      key: fixture.home_team_key,
      name: fixture.home_team_name,
      logo: homeAsset?.logo ?? null,
      apiFootballId: homeAsset?.apiFootballId ?? null,
    },
    awayTeam: {
      key: fixture.away_team_key,
      name: fixture.away_team_name,
      logo: awayAsset?.logo ?? null,
      apiFootballId: awayAsset?.apiFootballId ?? null,
    },
    status: fixture.status,
    result: fixture.result,
    score: fixture.home_goals === null || fixture.away_goals === null
      ? null
      : { home: fixture.home_goals, away: fixture.away_goals },
    marketOdds: {
      home: finite(fixture.market_home_odds),
      draw: finite(fixture.market_draw_odds),
      away: finite(fixture.market_away_odds),
    },
    marketProbabilities: impliedMarket(fixture),
    sourceLastModified: fixture.source_last_modified,
    prediction: predictionPayload(prediction),
  };
}

function performance(rows) {
  const settled = rows.filter((row) => row.actual_result && RESULT_INDEX[row.actual_result] !== undefined);
  if (!settled.length) return { matches: 0, accuracy: null, logLoss: null, brierScore: null };
  let correct = 0;
  let logLoss = 0;
  let brier = 0;
  for (const row of settled) {
    const probabilities = [
      finite(row.home_win_probability),
      finite(row.draw_probability),
      finite(row.away_win_probability),
    ];
    const actual = RESULT_INDEX[row.actual_result];
    const picked = probabilities.indexOf(Math.max(...probabilities));
    if (picked === actual) correct += 1;
    logLoss -= Math.log(Math.max(probabilities[actual], 1e-12));
    brier += probabilities.reduce((sum, value, index) =>
      sum + (value - (index === actual ? 1 : 0)) ** 2, 0) / 3;
  }
  return {
    matches: settled.length,
    accuracy: correct / settled.length,
    logLoss: logLoss / settled.length,
    brierScore: brier / settled.length,
  };
}

export async function GET() {
  const supabase = createServerSupabaseClient({ serviceRole: true });
  if (!supabase) {
    return NextResponse.json({ ready: false, error: "Supabase server credentials are not configured." }, { status: 503 });
  }
  const { record, error: modelError } = await getActiveModelRecord();
  if (modelError) return NextResponse.json({ ready: false, error: modelError }, { status: 503 });
  if (!record) {
    return NextResponse.json({ ready: false, error: "No active model exists. Run npm run ai:train." }, { status: 404 });
  }

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 90);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 60);
  const { data: fixtures, error: fixtureError } = await supabase
    .from("ai_fixtures")
    .select("*")
    .gte("kickoff_at", from.toISOString())
    .lte("kickoff_at", to.toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(500);
  if (fixtureError) {
    const missingMigration = fixtureError.code === "42P01" || fixtureError.message.includes("ai_fixtures");
    return NextResponse.json({
      ready: false,
      setupRequired: missingMigration,
      error: missingMigration
        ? "Apply supabase/migrations/202608300002_prediction_tracking.sql, then sync upcoming fixtures."
        : fixtureError.message,
    }, { status: 503 });
  }

  const fixtureIds = (fixtures ?? []).map((fixture) => fixture.id);
  let predictions = [];
  if (fixtureIds.length) {
    const { data, error } = await supabase
      .from("ai_predictions")
      .select("*")
      .eq("model_version_id", record.id)
      .in("fixture_id", fixtureIds);
    if (error) return NextResponse.json({ ready: false, error: error.message }, { status: 503 });
    predictions = data ?? [];
  }

  const resolveTeamAsset = await loadCachedTeamAssetResolver(supabase);
  const predictionByFixture = new Map(predictions.map((prediction) => [prediction.fixture_id, prediction]));
  const rows = (fixtures ?? []).map((fixture) => fixturePayload(
    fixture,
    predictionByFixture.get(fixture.id),
    resolveTeamAsset,
  ));
  const upcoming = rows.filter((fixture) => fixture.status === "scheduled" && new Date(fixture.kickoffAt) > now);
  const recent = rows
    .filter((fixture) => fixture.status === "finished" && fixture.prediction?.actualResult)
    .sort((left, right) => right.kickoffAt.localeCompare(left.kickoffAt))
    .slice(0, 20);
  const lastSourceUpdate = rows.reduce((latest, row) =>
    !row.sourceLastModified || latest >= row.sourceLastModified ? latest : row.sourceLastModified, "");

  return NextResponse.json({
    ready: true,
    model: { version: record.version, algorithm: record.algorithm, trainedTo: record.trained_to },
    source: {
      name: "Football-Data.co.uk latest fixtures",
      url: "https://www.football-data.co.uk/matches.php",
      lastModified: lastSourceUpdate || null,
    },
    upcoming,
    recent,
    performance: performance(predictions),
  }, { headers: { "cache-control": "private, max-age=0, must-revalidate" } });
}
