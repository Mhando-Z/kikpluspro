import { createClient } from "@supabase/supabase-js";
import {
  FOOTBALL_DATA_LEAGUES,
  UCL_COMPETITION_CODE,
} from "../../lib/football-ai/constants.js";
import { seasonStartForDate } from "../../lib/football-ai/fixtures.js";
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

function leagueCodesFrom(value) {
  const supported = [...Object.keys(FOOTBALL_DATA_LEAGUES), UCL_COMPETITION_CODE];
  if (!value) return supported;
  const codes = String(value).split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
  const unknown = codes.filter((code) => !supported.includes(code));
  if (unknown.length) throw new Error(`Unsupported result competitions: ${unknown.join(", ")}`);
  return [...new Set(codes)];
}

function campaignPastDays(today, seasonStart) {
  const campaignStart = new Date(`${seasonStart}-07-01T00:00:00.000Z`);
  const end = new Date(`${today}T23:59:59.999Z`);
  return Math.max(1, Math.min(370, Math.ceil((end.getTime() - campaignStart.getTime()) / 86_400_000)));
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const today = String(args.date ?? new Date().toISOString().slice(0, 10));
  const seasonStart = Number(args.season ?? seasonStartForDate(today));
  if (!Number.isInteger(seasonStart) || seasonStart < 1900 || seasonStart > 2200) {
    throw new Error(`Invalid season start: ${args.season}`);
  }
  const leagueCodes = leagueCodesFrom(args.leagues);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const feed = await syncProviderFixtures(supabase, {
    now: new Date(`${today}T12:00:00.000Z`),
    days: 1,
    pastDays: campaignPastDays(today, seasonStart),
    leagueCodes,
  });
  const archive = await archiveFinishedFixtures(supabase, feed.fixtures);
  const settlement = await settleFinishedPredictions(supabase, feed.storedFixtures);

  console.log(`Provider routing: ${providerSummary(feed)}`);
  console.log(`Current result store refreshed with ${archive.written} new/corrected matches.`);
  console.log(`Skipped ${archive.skippedExisting} matches already stored from another canonical source.`);
  console.log(`Settled ${settlement.settled} pending pre-match predictions.`);
  for (const error of feed.errors) console.warn(`${error.leagueCode} ${error.provider}: ${error.message}`);
  if (feed.unavailable.length) {
    console.warn(`No current-season provider is configured for: ${feed.unavailable.join(", ")}. Existing history was retained.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
