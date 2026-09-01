import { createClient } from "@supabase/supabase-js";
import { FOOTBALL_DATA_LEAGUES } from "../../lib/football-ai/constants.js";
import { seasonStartForDate } from "../../lib/football-ai/fixtures.js";
import {
  aliasesFrom,
  fetchSeason,
  teamsFrom,
  transformRow,
  upsertBatches,
} from "./import-football-data.mjs";

const SOURCE_KEY = "football-data-uk";
const DEFAULT_BASE_URL = "https://www.football-data.co.uk/mmz4281";

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const today = String(args.date ?? new Date().toISOString().slice(0, 10));
  const seasonStart = Number(args.season ?? seasonStartForDate(today));
  const leagueCodes = String(args.leagues ?? Object.keys(FOOTBALL_DATA_LEAGUES).join(","))
    .split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
  const unknown = leagueCodes.filter((code) => !FOOTBALL_DATA_LEAGUES[code]);
  if (unknown.length) throw new Error(`Unknown league codes: ${unknown.join(", ")}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const baseUrl = String(process.env.FOOTBALL_DATA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const { data: run, error: runError } = await supabase.from("ai_import_runs").insert({
    source_key: SOURCE_KEY,
    requested_leagues: leagueCodes,
    requested_seasons: [seasonStart],
    metadata: { mode: "current-season-refresh", today, baseUrl },
  }).select("id").single();
  if (runError) throw new Error(runError.message);

  const matches = [];
  let filesProcessed = 0;
  try {
    for (const leagueCode of leagueCodes) {
      const league = FOOTBALL_DATA_LEAGUES[leagueCode];
      const result = await fetchSeason(baseUrl, leagueCode, seasonStart);
      if (result.unavailable) {
        console.warn(`Current-season file not available yet: ${result.url}`);
        continue;
      }
      const completed = result.rows.map((row) => transformRow(row, league, seasonStart)).filter(Boolean);
      matches.push(...completed);
      filesProcessed += 1;
      console.log(`${league.name}: ${completed.length} completed ${seasonStart}/${String(seasonStart + 1).slice(-2)} matches.`);
    }

    const teams = teamsFrom(matches);
    await upsertBatches(supabase, "ai_teams", teams, "canonical_key");
    await upsertBatches(supabase, "ai_team_aliases", aliasesFrom(teams), "provider,country_code,provider_name");
    const rowsWritten = await upsertBatches(supabase, "ai_matches", matches, "source_match_key");
    await supabase.from("ai_import_runs").update({
      status: "succeeded",
      files_processed: filesProcessed,
      rows_received: matches.length,
      rows_written: rowsWritten,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    console.log(`Current result store refreshed with ${matches.length} completed matches.`);
  } catch (error) {
    await supabase.from("ai_import_runs").update({
      status: "failed",
      files_processed: filesProcessed,
      rows_received: matches.length,
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : String(error),
    }).eq("id", run.id);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
