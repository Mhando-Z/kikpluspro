import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fetchFixtureFeed, syncFixtureFeed } from "../../lib/football-ai/fixtures.js";
import {
  AI_MODEL_KEY,
  modelFamilyForKey,
  modelKeyForCompetition,
  UCL_MODEL_KEY,
} from "../../lib/football-ai/constants.js";
import { fetchUclFixtures, syncUclFixtures } from "../../lib/football-ai/ucl-fixtures.js";
import { fetchStatsApiUclFixtures, syncStatsApiUclFixtures } from "../../lib/thestatsapi/ucl-fixtures.js";
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

async function preferredUclFeed({ supabase = null, days, pastDays = 0 } = {}) {
  const attempts = [];
  if (process.env.THESTATSAPI_KEY) {
    try {
      return supabase
        ? await syncStatsApiUclFixtures(supabase, { days, pastDays })
        : await fetchStatsApiUclFixtures({ days, pastDays });
    } catch (error) {
      attempts.push(`TheStatsAPI: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (process.env.FOOTBALL_DATA_ORG_API_KEY) {
    try {
      return supabase
        ? await syncUclFixtures(supabase, { days, pastDays })
        : await fetchUclFixtures({ days, pastDays });
    } catch (error) {
      attempts.push(`Football-Data.org: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (attempts.length) console.warn(`UCL providers unavailable. ${attempts.join(" | ")}`);
  return null;
}

async function dryRun(days) {
  const domestic = await fetchFixtureFeed({ days });
  const ucl = await preferredUclFeed({ days });
  const fixtures = [...domestic.fixtures, ...(ucl?.fixtures ?? []).filter((row) => row.status === "scheduled")];
  console.log(`Validated ${fixtures.length} future supported fixtures for the next ${days} days.`);
  console.log(`By competition: ${countsByLeague(fixtures)}`);
  console.log(`Domestic source last modified: ${domestic.sourceLastModified ?? "not supplied"}`);
  console.log(`Domestic source: ${domestic.url}`);
  if (ucl) console.log(`UCL source: ${ucl.providerName} (${ucl.dateFrom} to ${ucl.dateTo})`);
  else console.log("UCL source skipped: configure THESTATSAPI_KEY or FOOTBALL_DATA_ORG_API_KEY.");
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const days = positiveInteger(args.days, 14);
  if (args["dry-run"]) return dryRun(days);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const domesticFeed = await syncFixtureFeed(supabase, { days });
  const uclFeed = await preferredUclFeed({ supabase, days, pastDays: 7 });
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

  console.log(`Synced ${domesticFeed.fixtures.length} domestic fixtures and ${domesticFeed.teams} team records.`);
  if (uclFeed) console.log(`Synced ${uclFeed.fixtures.length} UCL fixtures/results and ${uclFeed.teams} team records from ${uclFeed.providerName}.`);
  else console.log("UCL sync skipped because neither preferred nor fallback provider is available.");
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
