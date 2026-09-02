import { createClient } from "@supabase/supabase-js";
import {
  AI_MODEL_KEY,
  modelFamilyForKey,
  UCL_MODEL_KEY,
} from "../../lib/football-ai/constants.js";
import {
  cloneModelState,
  evaluateWalkForward,
  fitTemperatureCalibration,
  modelSummary,
  trainModel,
} from "../../lib/football-ai/model.js";
import { promotionDecision } from "../../lib/football-ai/promotion.js";
import { enrichTrainingMatches } from "../../lib/thestatsapi/transform.js";

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

async function fetchAllMatches(supabase, competitionCodes) {
  const matches = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("ai_matches")
      .select("*")
      .in("league_code", competitionCodes)
      .order("match_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    matches.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return matches;
}

async function fetchAllEnrichments(supabase) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("ai_match_enrichments")
      .select("*")
      .not("ai_match_id", "is", null)
      .range(from, from + pageSize - 1);
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        console.warn("TheStatsAPI enrichment table is not installed; training with Football-Data only.");
        return [];
      }
      throw new Error(error.message);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function activeModel(supabase, modelKey) {
  const { data, error } = await supabase
    .from("ai_model_versions")
    .select("id,version,trained_to,metrics")
    .eq("model_key", modelKey)
    .eq("is_active", true)
    .eq("status", "ready")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function upsertFeatures(supabase, featureRows, featureVersion) {
  const rows = featureRows.map((row) => ({
    match_id: row.matchId,
    feature_version: featureVersion,
    features: row.features,
    target_result: row.targetResult,
    target_home_goals: row.targetHomeGoals,
    target_away_goals: row.targetAwayGoals,
    generated_at: new Date().toISOString(),
  }));
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await supabase.from("ai_match_features")
      .upsert(rows.slice(index, index + 500), { onConflict: "match_id" });
    if (error) throw new Error(`Feature persistence failed: ${error.message}`);
  }
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const modelKey = String(args["model-key"] ?? AI_MODEL_KEY);
  if (modelKey === UCL_MODEL_KEY) throw new Error("Use npm run ai:ucl:train for the UCL specialist.");
  const family = modelFamilyForKey(modelKey);
  if (!family.competitionCodes.length || !family.algorithm || !family.featureVersion) {
    throw new Error(`Unknown baseline model key: ${modelKey}`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rawMatches = await fetchAllMatches(supabase, family.competitionCodes);
  const enrichments = await fetchAllEnrichments(supabase);
  const matchIds = new Set(rawMatches.map((match) => match.id));
  const familyEnrichments = enrichments.filter((row) => matchIds.has(row.ai_match_id));
  const matches = enrichTrainingMatches(rawMatches, familyEnrichments);
  if (matches.length < 500) throw new Error(`Only ${matches.length} ${family.shortLabel} matches found. Import historical data first.`);
  const currentActiveModel = await activeModel(supabase, modelKey);
  const minimumNewMatches = Number(args["min-new-matches"] ?? 0);
  if (!Number.isInteger(minimumNewMatches) || minimumNewMatches < 0) {
    throw new Error("--min-new-matches must be a non-negative integer.");
  }
  if (currentActiveModel?.trained_to && minimumNewMatches > 0) {
    const newMatches = matches.filter((match) => match.match_date > currentActiveModel.trained_to).length;
    if (newMatches < minimumNewMatches) {
      console.log(`Skipped training: ${newMatches} new matches; ${minimumNewMatches} required.`);
      return;
    }
  }
  const enrichedMatches = matches.filter((match) => match.enrichment_coverage?.stats).length;
  const xgMatches = matches.filter((match) => match.home_npxg != null || match.home_xg != null).length;
  console.log(`Historical enrichment: ${enrichedMatches} stats rows; ${xgMatches} matches with xG or npxG.`);

  const seasons = [...new Set(matches.map((match) => match.season_start))].sort((a, b) => a - b);
  const testSeason = Number(args["test-season"] ?? seasons.at(-1));
  const validationSeason = Number(args["validation-season"] ?? seasons.filter((season) => season < testSeason).at(-1));
  if (!Number.isInteger(validationSeason) || !Number.isInteger(testSeason) || validationSeason >= testSeason) {
    throw new Error("At least three ordered seasons are required for training, validation and testing.");
  }

  const trainingMatches = matches.filter((match) => match.season_start < validationSeason);
  const validationMatches = matches.filter((match) => match.season_start === validationSeason);
  const testMatches = matches.filter((match) => match.season_start === testSeason);
  if (!trainingMatches.length || !validationMatches.length || !testMatches.length) {
    throw new Error("The requested chronological split does not contain matches in every partition.");
  }

  console.log(`Training rows: ${trainingMatches.length}`);
  console.log(`Validation season ${validationSeason}: ${validationMatches.length}`);
  console.log(`Test season ${testSeason}: ${testMatches.length}`);

  console.log(`Training ${family.label} (${family.competitionCodes.join(", ")}).`);
  const modelOptions = {
    modelKey,
    algorithm: family.algorithm,
    featureVersion: family.featureVersion,
  };
  const training = trainModel(trainingMatches, modelOptions);
  const validation = evaluateWalkForward(training.state, validationMatches);
  const calibration = fitTemperatureCalibration(validation.predictions, { fittedSeason: validationSeason });
  const uncalibratedTest = evaluateWalkForward(validation.state, testMatches);
  const calibratedState = cloneModelState(validation.state);
  calibratedState.calibration = calibration;
  const test = evaluateWalkForward(calibratedState, testMatches);
  const final = trainModel(matches, modelOptions);
  final.state.calibration = calibration;
  const summary = modelSummary(final.state);
  const metrics = {
    competitionCodes: family.competitionCodes,
    modelFamily: family.label,
    validationSeason,
    testSeason,
    validation: validation.metrics,
    calibration,
    testUncalibrated: uncalibratedTest.metrics,
    test: test.metrics,
    enrichment: {
      linkedRows: familyEnrichments.length,
      statsRows: enrichedMatches,
      xgRows: xgMatches,
    },
  };

  const promotionMode = String(args.promotion ?? "auto").toLowerCase();
  if (!["auto", "always", "never"].includes(promotionMode)) {
    throw new Error("--promotion must be auto, always or never.");
  }
  const decision = promotionDecision({
    mode: promotionMode,
    activeModel: currentActiveModel,
    candidateMetrics: metrics,
  });
  metrics.promotion = { mode: promotionMode, ...decision };

  const logLossDelta = test.metrics.logLoss - uncalibratedTest.metrics.logLoss;
  console.log(`Calibration temperature: ${calibration.global.temperature}`);
  console.log(`Test log loss: ${uncalibratedTest.metrics.logLoss} uncalibrated -> ${test.metrics.logLoss} calibrated (${logLossDelta <= 0 ? "improved" : "worsened"} ${Math.abs(logLossDelta).toFixed(6)})`);

  if (args["persist-features"]) {
    console.log(`Persisting ${final.featureRows.length} leakage-safe feature rows...`);
    await upsertFeatures(supabase, final.featureRows, family.featureVersion);
  }

  const { data: latest, error: versionError } = await supabase
    .from("ai_model_versions")
    .select("version")
    .eq("model_key", modelKey)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw new Error(versionError.message);
  const version = (latest?.version ?? 0) + 1;
  const { data: inserted, error: insertError } = await supabase.from("ai_model_versions").insert({
    model_key: modelKey,
    version,
    algorithm: final.state.algorithm,
    feature_version: final.state.featureVersion,
    status: "ready",
    is_active: false,
    trained_from: final.state.trainedFrom,
    trained_to: final.state.trainedThrough,
    training_rows: trainingMatches.length,
    validation_rows: validationMatches.length,
    test_rows: testMatches.length,
    metrics,
    artifact: final.state,
    notes: `Temperature calibration fitted on ${validationSeason}; untouched final test on ${testSeason}. ${decision.reason}`,
  }).select("id").single();
  if (insertError) throw new Error(insertError.message);

  if (decision.promote) {
    const { error: activateError } = await supabase.rpc("activate_ai_model", { target_model_id: inserted.id });
    if (activateError) throw new Error(`Model stored but activation failed: ${activateError.message}`);
  }

  console.log(JSON.stringify({ version, active: decision.promote, promotion: decision, summary, metrics }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
