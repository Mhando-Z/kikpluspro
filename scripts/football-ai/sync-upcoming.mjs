import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  AI_MODEL_KEY,
  FOOTBALL_DATA_LEAGUES,
  modelFamilyForKey,
  modelKeyForCompetition,
  UCL_COMPETITION_CODE,
  UCL_MODEL_KEY,
} from "../../lib/football-ai/constants.js";
import {
  fetchProviderFixtures,
  providerSummary,
  syncProviderFixtures,
} from "../../lib/football-ai/provider-fixtures.js";
import {
  archiveFinishedFixtures,
  settleFinishedPredictions,
} from "../../lib/football-ai/provider-results.js";
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

function positiveInteger(value, fallback, label = "days", maximum = 60) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    throw new Error(`--${label} must be an integer between 0 and ${maximum}.`);
  }
  return parsed;
}

function requestedLeagues(value) {
  const supported = [...Object.keys(FOOTBALL_DATA_LEAGUES), UCL_COMPETITION_CODE];
  if (!value) return supported;
  const codes = String(value).split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
  const unknown = codes.filter((code) => !supported.includes(code));
  if (unknown.length) throw new Error(`Unsupported fixture competitions: ${unknown.join(", ")}`);
  return [...new Set(codes)];
}

function fixturePredictionKey(modelId, fixtureId) {
  return createHash("sha256").update(`${modelId}:${fixtureId}`).digest("hex");
}

async function fetchAllRecentMatches(supabase, trainedTo, modelKey) {
  const matches = [];
  const competitionCodes = modelFamilyForKey(modelKey).competitionCodes;
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from("ai_matches").select("*")
      .order("match_date", { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + 999);
    if (trainedTo) query = query.gt("match_date", trainedTo);
    query = query.in("league_code", competitionCodes);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load post-training results: ${error.message}`);
    matches.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return matches;
}

async function activeModels(supabase) {
  const { data, error } = await supabase.from("ai_model_versions")
    .select("id,model_key,version,algorithm,trained_to,artifact")
    .eq("is_active", true).eq("status", "ready");
  if (error) throw new Error(`Could not load active models: ${error.message}`);
  const records = new Map((data ?? []).filter((row) => row.artifact).map((row) => [row.model_key, row]));
  if (!records.has(AI_MODEL_KEY)) throw new Error("No active domestic model exists. Run npm run ai:train first.");
  return records;
}

async function scheduledFixtures(supabase, days) {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + days);
  const { data, error } = await supabase.from("ai_fixtures").select("*")
    .eq("status", "scheduled")
    .gt("kickoff_at", now.toISOString()).lt("kickoff_at", end.toISOString())
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
    const { error } = await supabase.from("ai_predictions")
      .upsert(rows.slice(index, index + 250), { onConflict: "prediction_key" });
    if (error) throw new Error(`Could not store automatic predictions: ${error.message}`);
  }
}

function countsByLeague(fixtures) {
  return Object.entries(Object.groupBy(fixtures, (fixture) => fixture.league_code))
    .map(([code, rows]) => `${code}: ${rows.length}`).join(", ") || "none";
}

function printProviderWarnings(feed) {
  for (const error of feed.errors) {
    console.warn(`${error.leagueCode} ${error.provider}: ${error.message}`);
  }
  if (feed.unavailable.length) {
    console.warn(`No current provider is configured for: ${feed.unavailable.join(", ")}. Existing stored fixtures were retained.`);
  }
}

async function dryRun({ days, pastDays, leagueCodes }) {
  const feed = await fetchProviderFixtures({ days, pastDays, leagueCodes });
  const scheduled = feed.fixtures.filter((fixture) => fixture.status === "scheduled" && new Date(fixture.kickoff_at) > new Date());
  const finished = feed.fixtures.filter((fixture) => fixture.status === "finished");
  console.log(`Validated ${scheduled.length} future fixtures and ${finished.length} recent results (${feed.dateFrom} to ${feed.dateTo}).`);
  console.log(`By competition: ${countsByLeague(feed.fixtures)}`);
  console.log(`Provider routing: ${providerSummary(feed)}`);
  printProviderWarnings(feed);
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const days = positiveInteger(args.days, 14);
  const pastDays = positiveInteger(args["past-days"], 7, "past-days", 370);
  const leagueCodes = requestedLeagues(args.leagues);
  if (args["dry-run"]) return dryRun({ days, pastDays, leagueCodes });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const feed = await syncProviderFixtures(supabase, { days, pastDays, leagueCodes });
  const archive = await archiveFinishedFixtures(supabase, feed.fixtures);
  const settlement = await settleFinishedPredictions(supabase, feed.storedFixtures);
  const models = await activeModels(supabase);
  const states = new Map();
  const applied = new Map();
  for (const [modelKey, model] of models) {
    const recent = await fetchAllRecentMatches(supabase, model.trained_to, modelKey);
    const state = cloneModelState(model.artifact);
    for (const match of sortMatchesChronologically(recent)) updateModelWithResult(state, match);
    states.set(modelKey, state);
    applied.set(modelKey, recent.length);
  }

  const fixtures = await scheduledFixtures(supabase, days);
  const rows = [];
  const skipped = [];
  const unavailableModelKeys = new Set();
  const untrainedCompetitions = new Set();
  for (const fixture of fixtures) {
    const modelKey = modelKeyForCompetition(fixture.league_code);
    const model = models.get(modelKey);
    const state = states.get(modelKey);
    if (!model || !state) {
      skipped.push(fixture);
      unavailableModelKeys.add(modelKey);
      continue;
    }
    if (!Number(state.leagues?.[fixture.league_code]?.matches ?? 0)) {
      skipped.push(fixture);
      untrainedCompetitions.add(fixture.league_code);
      continue;
    }
    rows.push(predictionRow(model, fixture, predictMatch(state, fixture)));
  }
  if (rows.length) await upsertPredictions(supabase, rows);

  console.log(`Synced ${feed.fixtures.length} fixtures/results and ${feed.teams} team records.`);
  console.log(`Provider routing: ${providerSummary(feed)}`);
  console.log(`Archived ${archive.written} new/corrected results; skipped ${archive.skippedExisting} canonical duplicates.`);
  console.log(`Settled ${settlement.settled} stored pre-match predictions without changing their probabilities.`);
  printProviderWarnings(feed);
  const forecasted = fixtures.filter((fixture) => !skipped.includes(fixture));
  console.log(`Generated ${rows.length} competition-routed forecasts. By competition: ${countsByLeague(forecasted)}`);
  for (const [modelKey, model] of models) {
    console.log(`${modelFamilyForKey(modelKey).label}: v${model.version} (${model.algorithm}); ${applied.get(modelKey) ?? 0} post-training results applied.`);
  }
  if (skipped.length) {
    const needsUcl = skipped.some((fixture) => modelKeyForCompetition(fixture.league_code) === UCL_MODEL_KEY);
    console.warn(`Skipped ${skipped.length} fixtures without a compatible trained model.${needsUcl ? " Run npm run ai:ucl:train for UCL coverage." : ""}`);
  }
  if (unavailableModelKeys.size) {
    console.warn(`Missing active model families: ${[...unavailableModelKeys].map((key) => modelFamilyForKey(key).label).join(", ")}.`);
  }
  if (untrainedCompetitions.size) {
    console.warn(`The active domestic model has no training history for: ${[...untrainedCompetitions].sort().join(", ")}. Import history and retrain before forecasting these competitions.`);
  }
  const coldStarts = rows.filter((row) => Math.min(row.features.homeMatchesKnown, row.features.awayMatchesKnown) < 6).length;
  console.log(`Low-history forecasts: ${coldStarts}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
