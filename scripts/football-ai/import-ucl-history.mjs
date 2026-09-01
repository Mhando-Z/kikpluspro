import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { OPENFOOTBALL_UCL_SOURCE_KEY, parseOpenFootballUcl } from "../../lib/football-ai/openfootball.js";

const DEFAULT_BASE_URL = "https://raw.githubusercontent.com/openfootball/champions-league/master";

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

function seasonsFrom(args) {
  if (args.seasons) return String(args.seasons).split(",").map(Number);
  const today = new Date();
  const lastCompletedSeasonStart = today.getUTCMonth() >= 6 ? today.getUTCFullYear() - 1 : today.getUTCFullYear() - 2;
  const from = Number(args.from ?? 2011);
  const to = Number(args.to ?? lastCompletedSeasonStart);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) {
    throw new Error("Use --from=YYYY --to=YYYY or --seasons=2022,2023,2024.");
  }
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function seasonFolder(start) {
  return `${start}-${String(start + 1).slice(-2)}`;
}

async function fetchSeason(baseUrl, seasonStart) {
  const url = `${baseUrl}/${seasonFolder(seasonStart)}/cl.txt`;
  const response = await fetch(url, { headers: { "user-agent": "KickPulse-Football-AI/1.7" } });
  if (response.status === 404) return { url, unavailable: true, text: "" };
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return { url, unavailable: false, text: await response.text() };
}

function databaseMatch(row) {
  const sourceMatchKey = [
    OPENFOOTBALL_UCL_SOURCE_KEY,
    row.seasonStart,
    row.matchDate,
    row.stage,
    row.home.key,
    row.away.key,
  ].join(":");
  return {
    source_match_key: sourceMatchKey,
    source_key: OPENFOOTBALL_UCL_SOURCE_KEY,
    league_code: "CL",
    league_name: "UEFA Champions League",
    country_code: "europe",
    season_start: row.seasonStart,
    match_date: row.matchDate,
    kickoff_time: row.kickoffTime,
    home_team_key: row.home.key,
    away_team_key: row.away.key,
    home_team_name: row.home.displayName,
    away_team_name: row.away.displayName,
    home_goals: row.homeGoals,
    away_goals: row.awayGoals,
    result: row.result,
    half_home_goals: row.halfHomeGoals,
    half_away_goals: row.halfAwayGoals,
    half_result: row.halfHomeGoals === null || row.halfAwayGoals === null
      ? null
      : row.halfHomeGoals > row.halfAwayGoals ? "H" : row.halfHomeGoals < row.halfAwayGoals ? "A" : "D",
    competition_stage: row.stage,
    format_era: row.formatEra,
    leg: row.leg,
    neutral_venue: row.neutralVenue,
    source_row_hash: createHash("sha256").update(row.rawLine).digest("hex"),
  };
}

function teamsAndAliases(parsed) {
  const teams = new Map();
  const aliases = new Map();
  for (const match of parsed) {
    for (const team of [match.home, match.away]) {
      teams.set(team.key, {
        canonical_key: team.key,
        display_name: team.displayName,
        country_code: team.countryCode,
        metadata: { provider: OPENFOOTBALL_UCL_SOURCE_KEY, associationCode: team.associationCode },
      });
      const alias = {
        provider: OPENFOOTBALL_UCL_SOURCE_KEY,
        country_code: team.countryCode,
        provider_name: team.providerName,
        canonical_key: team.key,
      };
      aliases.set(`${alias.country_code}:${alias.provider_name}`, alias);
    }
  }
  return { teams: [...teams.values()], aliases: [...aliases.values()] };
}

async function upsertBatches(supabase, table, rows, onConflict, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const seasons = seasonsFrom(args);
  const dryRun = Boolean(args["dry-run"]);
  const baseUrl = String(args["base-url"] ?? process.env.OPENFOOTBALL_UCL_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  const supabase = dryRun ? null : createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let runId = null;
  if (supabase) {
    const { data, error } = await supabase.from("ai_import_runs").insert({
      source_key: OPENFOOTBALL_UCL_SOURCE_KEY,
      requested_leagues: ["CL"],
      requested_seasons: seasons,
      metadata: { baseUrl, competition: "main UCL competition; qualifiers excluded" },
    }).select("id").single();
    if (error) throw new Error(`Could not start UCL import. Apply 202609010001_ucl_specialist.sql first. ${error.message}`);
    runId = data.id;
  }

  const parsed = [];
  let filesProcessed = 0;
  try {
    for (const seasonStart of seasons) {
      const source = await fetchSeason(baseUrl, seasonStart);
      if (source.unavailable) {
        console.warn(`Skipped unavailable UCL dataset: ${source.url}`);
        continue;
      }
      const rows = parseOpenFootballUcl(source.text, seasonStart);
      parsed.push(...rows);
      filesProcessed += 1;
      console.log(`Champions League ${seasonFolder(seasonStart)}: ${rows.length} completed regulation-time matches`);
    }

    const matches = parsed.map(databaseMatch);
    const identity = teamsAndAliases(parsed);
    if (supabase) {
      await upsertBatches(supabase, "ai_teams", identity.teams, "canonical_key");
      await upsertBatches(supabase, "ai_team_aliases", identity.aliases, "provider,country_code,provider_name");
      await upsertBatches(supabase, "ai_matches", matches, "source_match_key");
      await supabase.from("ai_import_runs").update({
        status: "succeeded",
        files_processed: filesProcessed,
        rows_received: matches.length,
        rows_written: matches.length,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    console.log(`${dryRun ? "Validated" : "Imported"} ${matches.length} UCL matches, ${identity.teams.length} teams, from ${filesProcessed} seasons.`);
  } catch (error) {
    if (supabase && runId) {
      await supabase.from("ai_import_runs").update({
        status: "failed",
        files_processed: filesProcessed,
        rows_received: parsed.length,
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      }).eq("id", runId);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
