import { createClient } from "@supabase/supabase-js";
import {
  UCL_ALGORITHM,
  UCL_FEATURE_VERSION,
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

const UCL_OPTIONS = {
  modelKey: UCL_MODEL_KEY,
  algorithm: UCL_ALGORITHM,
  featureVersion: UCL_FEATURE_VERSION,
  homeAdvantageElo: 45,
  kFactor: 20,
  strengthPriorMatches: 10,
};

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

async function fetchAll(supabase, table, select = "*") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function enrichments(supabase) {
  try {
    return await fetchAll(supabase, "ai_match_enrichments");
  } catch (error) {
    if (/does not exist|schema cache/i.test(error.message)) return [];
    throw error;
  }
}

async function activeUclModel(supabase) {
  const { data, error } = await supabase.from("ai_model_versions")
    .select("id,version,trained_to,metrics")
    .eq("model_key", UCL_MODEL_KEY)
    .eq("is_active", true)
    .eq("status", "ready")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const rawMatches = await fetchAll(supabase, "ai_matches");
  const enrichmentRows = await enrichments(supabase);
  const allMatches = enrichTrainingMatches(rawMatches, enrichmentRows);
  const uclMatches = allMatches.filter((match) => match.league_code === "CL");
  if (uclMatches.length < 300) {
    throw new Error(`Only ${uclMatches.length} UCL matches found. Run npm run ai:ucl:import first.`);
  }

  const seasons = [...new Set(uclMatches.map((match) => match.season_start))].sort((a, b) => a - b);
  const uclMatchIds = new Set(uclMatches.map((match) => match.id));
  const uclEnrichmentRows = enrichmentRows.filter((row) => uclMatchIds.has(row.ai_match_id));
  const uclEnrichment = {
    linkedRows: uclEnrichmentRows.length,
    statsRows: uclEnrichmentRows.filter((row) => row.coverage?.stats).length,
    xgRows: uclEnrichmentRows.filter((row) => row.home_xg != null || row.away_xg != null || row.home_npxg != null || row.away_npxg != null).length,
    oddsRows: uclEnrichmentRows.filter((row) => row.coverage?.odds).length,
  };
  const testSeason = Number(args["test-season"] ?? seasons.at(-1));
  const validationSeason = Number(args["validation-season"] ?? seasons.filter((season) => season < testSeason).at(-1));
  if (!Number.isInteger(validationSeason) || !Number.isInteger(testSeason) || validationSeason >= testSeason) {
    throw new Error("At least three ordered UCL seasons are required for chronological validation and testing.");
  }

  const validationMatches = uclMatches.filter((match) => match.season_start === validationSeason);
  const testMatches = uclMatches.filter((match) => match.season_start === testSeason);
  const preValidation = allMatches.filter((match) => match.season_start < validationSeason);
  const preTest = allMatches.filter((match) => match.season_start < testSeason);
  if (!preValidation.length || !validationMatches.length || !testMatches.length) {
    throw new Error("The chosen UCL split does not contain matches in each partition.");
  }

  console.log(`Shared domestic/UCL strength rows before validation: ${preValidation.length}`);
  console.log(`UCL validation ${validationSeason}/${String(validationSeason + 1).slice(-2)}: ${validationMatches.length}`);
  console.log(`UCL untouched test ${testSeason}/${String(testSeason + 1).slice(-2)}: ${testMatches.length}`);
  console.log(`UCL enrichment: ${uclEnrichment.xgRows} xG, ${uclEnrichment.statsRows} stats, ${uclEnrichment.oddsRows} odds rows.`);

  const validationSeed = trainModel(preValidation, UCL_OPTIONS);
  const validation = evaluateWalkForward(validationSeed.state, validationMatches);
  const calibration = fitTemperatureCalibration(validation.predictions, {
    fittedSeason: validationSeason,
    minimumLeagueSamples: 50,
  });
  const testSeed = trainModel(preTest, UCL_OPTIONS);
  const uncalibratedTest = evaluateWalkForward(testSeed.state, testMatches);
  const calibratedTestState = cloneModelState(testSeed.state);
  calibratedTestState.calibration = calibration;
  const test = evaluateWalkForward(calibratedTestState, testMatches);
  const final = trainModel(allMatches, UCL_OPTIONS);
  final.state.calibration = calibration;

  const current = await activeUclModel(supabase);
  const promotionMode = String(args.promotion ?? "auto").toLowerCase();
  if (!["auto", "always", "never"].includes(promotionMode)) throw new Error("--promotion must be auto, always or never.");
  const metrics = {
    specialistCompetition: "CL",
    validationSeason,
    testSeason,
    validation: validation.metrics,
    calibration,
    testUncalibrated: uncalibratedTest.metrics,
    test: test.metrics,
    trainingComposition: {
      totalRows: allMatches.length,
      uclRows: uclMatches.length,
      domesticStrengthRows: allMatches.length - uclMatches.length,
    },
    uclEnrichment,
  };
  const decision = promotionDecision({ mode: promotionMode, activeModel: current, candidateMetrics: metrics });
  metrics.promotion = { mode: promotionMode, ...decision };

  const { data: latest, error: versionError } = await supabase.from("ai_model_versions")
    .select("version").eq("model_key", UCL_MODEL_KEY).order("version", { ascending: false }).limit(1).maybeSingle();
  if (versionError) throw new Error(versionError.message);
  const version = (latest?.version ?? 0) + 1;
  const { data: inserted, error: insertError } = await supabase.from("ai_model_versions").insert({
    model_key: UCL_MODEL_KEY,
    version,
    algorithm: UCL_ALGORITHM,
    feature_version: UCL_FEATURE_VERSION,
    status: "ready",
    is_active: false,
    trained_from: final.state.trainedFrom,
    trained_to: final.state.trainedThrough,
    training_rows: preValidation.length,
    validation_rows: validationMatches.length,
    test_rows: testMatches.length,
    metrics,
    artifact: final.state,
    notes: `UCL specialist with shared domestic club strength. Calibration ${validationSeason}; untouched UCL test ${testSeason}. ${decision.reason}`,
  }).select("id").single();
  if (insertError) throw new Error(insertError.message);

  if (decision.promote) {
    const { error } = await supabase.rpc("activate_ai_model", { target_model_id: inserted.id });
    if (error) throw new Error(`UCL model stored but activation failed: ${error.message}`);
  }

  console.log(JSON.stringify({
    modelKey: UCL_MODEL_KEY,
    version,
    active: decision.promote,
    promotion: decision,
    summary: modelSummary(final.state),
    metrics,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
