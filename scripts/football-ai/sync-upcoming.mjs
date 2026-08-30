import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fetchFixtureFeed, syncFixtureFeed } from "../../lib/football-ai/fixtures.js";
import {
  cloneModelState,
  predictMatch,
  sortMatchesChronologically,
  updateModelWithResult,
} from "../../lib/football-ai/model.js";

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

function positiveInteger(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60) {
    throw new Error("--days must be an integer between 1 and 60.");
  }
  return parsed;
}

function fixturePredictionKey(modelId, fixtureId) {
  return createHash("sha256").update(`${modelId}:${fixtureId}`).digest("hex");
}

async function fetchAllRecentMatches(supabase, trainedTo) {
  const pageSize = 1000;
  const matches = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from("ai_matches")
      .select("*")
      .order("match_date", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (trainedTo) query = query.gt("match_date", trainedTo);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load post-training results: ${error.message}`);
    matches.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return matches;
}

async function activeModel(supabase) {
  const { data, error } = await supabase
    .from("ai_model_versions")
    .select("id,version,algorithm,trained_to,artifact")
    .eq("is_active", true)
    .eq("status", "ready")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the active model: ${error.message}`);
  if (!data?.artifact) throw new Error("No active ready model exists. Run npm run ai:train first.");
  return data;
}

async function scheduledFixtures(supabase, days) {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + days);
  const { data, error } = await supabase
    .from("ai_fixtures")
    .select("*")
    .eq("status", "scheduled")
    .gt("kickoff_at", now.toISOString())
    .lt("kickoff_at", end.toISOString())
    .order("kickoff_at", { ascending: true });
  if (error) throw new Error(`Could not load upcoming fixtures: ${error.message}`);
  return data ?? [];
}

function predictionRow(model, fixture, prediction) {
  return {
    prediction_key: fixturePredictionKey(model.id, fixture.id),
    model_version_id: model.id,
    fixture_id: fixture.id,
    league_code: fixture.league_code,
    home_team_key: fixture.home_team_key,
    away_team_key: fixture.away_team_key,
    kickoff_at: fixture.kickoff_at,
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
  };
}

async function upsertPredictions(supabase, rows) {
  for (let index = 0; index < rows.length; index += 250) {
    const { error } = await supabase
      .from("ai_predictions")
      .upsert(rows.slice(index, index + 250), { onConflict: "prediction_key" });
    if (error) throw new Error(`Could not store automatic predictions: ${error.message}`);
  }
}

function countsByLeague(fixtures) {
  return Object.entries(Object.groupBy(fixtures, (fixture) => fixture.league_code))
    .map(([code, rows]) => `${code}: ${rows.length}`)
    .join(", ") || "none";
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const days = positiveInteger(args.days, 14);
  const dryRun = Boolean(args["dry-run"]);

  if (dryRun) {
    const feed = await fetchFixtureFeed({ days });
    console.log(`Validated ${feed.fixtures.length} supported fixtures for the next ${days} days.`);
    console.log(`By league: ${countsByLeague(feed.fixtures)}`);
    console.log(`Source last modified: ${feed.sourceLastModified ?? "not supplied"}`);
    console.log(`Source: ${feed.url}`);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const feed = await syncFixtureFeed(supabase, { days });
  const model = await activeModel(supabase);
  const recentMatches = await fetchAllRecentMatches(supabase, model.trained_to);
  const state = cloneModelState(model.artifact);
  for (const match of sortMatchesChronologically(recentMatches)) updateModelWithResult(state, match);

  const fixtures = await scheduledFixtures(supabase, days);
  const rows = fixtures.map((fixture) => predictionRow(model, fixture, predictMatch(state, fixture)));
  await upsertPredictions(supabase, rows);
  const coldStarts = rows.filter((row) =>
    Math.min(row.features.homeMatchesKnown, row.features.awayMatchesKnown) < 6).length;

  console.log(`Synced ${feed.fixtures.length} fixtures and ${feed.teams} team records.`);
  console.log(`Generated ${rows.length} forecasts with active model v${model.version} (${model.algorithm}).`);
  console.log(`Applied ${recentMatches.length} completed post-training matches to rolling form.`);
  console.log(`Low-history fixtures: ${coldStarts}. By league: ${countsByLeague(fixtures)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
