import { createClient } from "@supabase/supabase-js";
import { FOOTBALL_DATA_LEAGUES } from "../../lib/football-ai/constants.js";
import { fetchUclFixtures, syncUclFixtures, uclFixtureToTrainingMatch } from "../../lib/football-ai/ucl-fixtures.js";
import { fetchStatsApiUclFixtures, syncStatsApiUclFixtures } from "../../lib/thestatsapi/ucl-fixtures.js";
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

async function preferredUclResults({ supabase = null, days, pastDays } = {}) {
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
  if (attempts.length) console.warn(`UCL result providers unavailable. ${attempts.join(" | ")}`);
  return null;
}

async function existingUclResultKeys(supabase, matches) {
  if (!matches.length) return new Set();
  const dates = matches.map((match) => match.match_date).sort();
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("ai_matches")
      .select("league_code,match_date,home_team_key,away_team_key")
      .eq("league_code", "CL")
      .gte("match_date", dates[0])
      .lte("match_date", dates.at(-1))
      .range(offset, offset + 999);
    if (error) throw new Error(`Could not check existing UCL results: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return new Set(rows.map(fixtureResultKey));
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

  const domesticMatches = await sourceResults(fixtures, baseUrl);
  let uclFeed = null;
  const uclPending = fixtures.filter((fixture) => fixture.league_code === "CL");
  if (uclPending.length) {
    const earliest = Math.min(...uclPending.map((fixture) => new Date(fixture.kickoff_at).getTime()));
    const pastDays = Math.max(1, Math.ceil((Date.now() - earliest) / 86_400_000) + 1);
    const uclOptions = { days: 1, pastDays: Math.min(pastDays, 60) };
    uclFeed = await preferredUclResults({
      supabase: dryRun ? null : supabase,
      ...uclOptions,
    });
    if (uclFeed) {
      console.log(`${uclFeed.providerName}: ${uclFeed.fixtures.filter((fixture) => fixture.status === "finished").length} UCL results available.`);
    } else {
      console.warn("UCL fixtures remain pending because neither TheStatsAPI nor Football-Data.org is available.");
    }
  }
  const uclResults = (uclFeed?.fixtures ?? []).filter((fixture) => fixture.status === "finished");
  const matches = [...domesticMatches, ...uclResults];
  const resultByFixture = new Map(matches.map((match) => [fixtureResultKey(match), match]));
  const settled = fixtures.flatMap((fixture) => {
    const match = resultByFixture.get(fixtureResultKey(fixture));
    return match ? [{ fixture, match }] : [];
  });

  if (dryRun) {
    console.log(`Would settle ${settled.length} of ${fixtures.length} past fixtures.`);
    return;
  }

  if (domesticMatches.length) {
    const teams = teamsFrom(domesticMatches);
    await upsertBatches(supabase, "ai_teams", teams, "canonical_key");
    await upsertBatches(supabase, "ai_team_aliases", aliasesFrom(teams), "provider,country_code,provider_name");
    await upsertBatches(supabase, "ai_matches", domesticMatches, "source_match_key");
  }
  const candidateUclTrainingMatches = [...new Map(
    uclResults.map(uclFixtureToTrainingMatch).filter(Boolean)
      .map((match) => [fixtureResultKey(match), match]),
  ).values()];
  const existingUclKeys = await existingUclResultKeys(supabase, candidateUclTrainingMatches);
  const uclTrainingMatches = candidateUclTrainingMatches.filter((match) => !existingUclKeys.has(fixtureResultKey(match)));
  if (uclTrainingMatches.length) {
    await upsertBatches(supabase, "ai_matches", uclTrainingMatches, "source_match_key");
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

  console.log(`Imported or refreshed ${domesticMatches.length} domestic matches and archived ${uclTrainingMatches.length} new UCL results.`);
  if (candidateUclTrainingMatches.length > uclTrainingMatches.length) {
    console.log(`Skipped ${candidateUclTrainingMatches.length - uclTrainingMatches.length} UCL results already present from another source.`);
  }
  console.log(`Settled ${settled.length} of ${fixtures.length} past tracked fixtures.`);
  if (settled.length < fixtures.length) {
    console.log(`${fixtures.length - settled.length} fixtures remain pending because the result is not in the source yet.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
