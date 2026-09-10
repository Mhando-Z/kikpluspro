import { createClient } from "@supabase/supabase-js";
import {
  FOOTBALL_DATA_LEAGUES,
  UCL_COMPETITION_CODE,
} from "../../lib/football-ai/constants.js";
import {
  providerSummary,
  syncProviderFixtures,
} from "../../lib/football-ai/provider-fixtures.js";
import {
  archiveFinishedFixtures,
  settleFinishedPredictions,
} from "../../lib/football-ai/provider-results.js";

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

function integerOption(value, fallback, label, maximum) {
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

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const pastDays = integerOption(args["past-days"], 21, "past-days", 370);
  const leagueCodes = requestedLeagues(args.leagues);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const feed = await syncProviderFixtures(supabase, {
    days: integerOption(args.days, 1, "days", 60),
    pastDays,
    leagueCodes,
  });
  const archive = await archiveFinishedFixtures(supabase, feed.fixtures);
  const settlement = await settleFinishedPredictions(supabase, feed.storedFixtures);

  console.log(`Provider routing: ${providerSummary(feed)}`);
  console.log(`Archived ${archive.written} new/corrected results; skipped ${archive.skippedExisting} canonical duplicates.`);
  console.log(`Settled ${settlement.settled} stored predictions without changing their pre-match probabilities.`);
  for (const error of feed.errors) {
    console.warn(`${error.leagueCode} ${error.provider}: ${error.message}`);
  }
  if (feed.unavailable.length) {
    console.warn(`No result provider is configured for: ${feed.unavailable.join(", ")}. Those predictions remain pending.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
