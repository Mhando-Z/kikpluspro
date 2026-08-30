import { createClient } from "@supabase/supabase-js";
import { FOOTBALL_DATA_LEAGUES } from "../../lib/football-ai/constants.js";
import {
  aliasesFrom,
  fetchSeason,
  teamsFrom,
  transformRow,
  upsertBatches,
} from "./import-football-data.mjs";

const DEFAULT_BASE_URL = "https://www.football-data.co.uk/mmz4281";

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

function fixtureResultKey(row) {
  return [row.league_code, row.match_date, row.home_team_key, row.away_team_key].join(":");
}

async function pendingFixtures(supabase) {
  const pageSize = 1000;
  const fixtures = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("ai_fixtures")
      .select("*")
      .eq("status", "scheduled")
      .lt("kickoff_at", new Date().toISOString())
      .order("kickoff_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not load unsettled fixtures: ${error.message}`);
    fixtures.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return fixtures;
}

async function sourceResults(fixtures, baseUrl) {
  const groups = new Map();
  for (const fixture of fixtures) {
    groups.set(`${fixture.season_start}:${fixture.league_code}`, {
      seasonStart: fixture.season_start,
      leagueCode: fixture.league_code,
    });
  }

  const matches = [];
  for (const { seasonStart, leagueCode } of groups.values()) {
    const league = FOOTBALL_DATA_LEAGUES[leagueCode];
    if (!league) continue;
    const result = await fetchSeason(baseUrl, leagueCode, seasonStart);
    if (result.unavailable) {
      console.warn(`Results are not published yet: ${result.url}`);
      continue;
    }
    const completed = result.rows
      .map((row) => transformRow(row, league, seasonStart))
      .filter(Boolean);
    matches.push(...completed);
    console.log(`${league.name} ${seasonStart}/${String(seasonStart + 1).slice(-2)}: ${completed.length} results available`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return matches;
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const dryRun = Boolean(args["dry-run"]);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const baseUrl = String(process.env.FOOTBALL_DATA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fixtures = await pendingFixtures(supabase);
  if (!fixtures.length) {
    console.log("No past scheduled fixtures are waiting for a result.");
    return;
  }

  const matches = await sourceResults(fixtures, baseUrl);
  const resultByFixture = new Map(matches.map((match) => [fixtureResultKey(match), match]));
  const settled = fixtures.flatMap((fixture) => {
    const match = resultByFixture.get(fixtureResultKey(fixture));
    return match ? [{ fixture, match }] : [];
  });

  if (dryRun) {
    console.log(`Would settle ${settled.length} of ${fixtures.length} past fixtures.`);
    return;
  }

  if (matches.length) {
    const teams = teamsFrom(matches);
    await upsertBatches(supabase, "ai_teams", teams, "canonical_key");
    await upsertBatches(supabase, "ai_team_aliases", aliasesFrom(teams), "provider,country_code,provider_name");
    await upsertBatches(supabase, "ai_matches", matches, "source_match_key");
  }

  for (const { fixture, match } of settled) {
    const settledAt = new Date().toISOString();
    const { error: fixtureError } = await supabase
      .from("ai_fixtures")
      .update({
        status: "finished",
        home_goals: match.home_goals,
        away_goals: match.away_goals,
        result: match.result,
      })
      .eq("id", fixture.id);
    if (fixtureError) throw new Error(`Could not settle ${fixture.home_team_name} v ${fixture.away_team_name}: ${fixtureError.message}`);

    const { error: predictionError } = await supabase
      .from("ai_predictions")
      .update({
        actual_result: match.result,
        actual_home_goals: match.home_goals,
        actual_away_goals: match.away_goals,
        settled_at: settledAt,
      })
      .eq("fixture_id", fixture.id);
    if (predictionError) throw new Error(`Could not score predictions for fixture ${fixture.id}: ${predictionError.message}`);
  }

  console.log(`Imported or refreshed ${matches.length} completed matches.`);
  console.log(`Settled ${settled.length} of ${fixtures.length} past tracked fixtures.`);
  if (settled.length < fixtures.length) {
    console.log(`${fixtures.length - settled.length} fixtures remain pending because the result is not in the source yet.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
