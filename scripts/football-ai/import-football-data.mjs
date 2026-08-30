import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  FOOTBALL_DATA_LEAGUES,
  canonicalTeamKey,
  seasonToken,
} from "../../lib/football-ai/constants.js";
import {
  csvInteger,
  csvNumber,
  normalizeFootballDate,
  parseCsv,
} from "../../lib/football-ai/csv.js";

const SOURCE_KEY = "football-data-uk";
const DEFAULT_BASE_URL = "https://www.football-data.co.uk/mmz4281";

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

function seasonsFrom(args) {
  if (args.seasons) return String(args.seasons).split(",").map(Number);
  const from = Number(args.from ?? 2022);
  const to = Number(args.to ?? 2025);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) {
    throw new Error("Use --from=YYYY --to=YYYY or --seasons=2022,2023,2024,2025.");
  }
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function leaguesFrom(args) {
  const values = String(args.leagues ?? Object.keys(FOOTBALL_DATA_LEAGUES).join(","))
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const unknown = values.filter((value) => !FOOTBALL_DATA_LEAGUES[value]);
  if (unknown.length) throw new Error(`Unknown league codes: ${unknown.join(", ")}`);
  return values;
}

function decodeCsv(buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
}

function timeValue(value) {
  const text = String(value ?? "").trim();
  return /^\d{1,2}:\d{2}$/.test(text) ? `${text.padStart(5, "0")}:00` : null;
}

function selectedOdds(row) {
  const firstValue = (...values) => values.find((value) => String(value ?? "").trim() !== "");
  return {
    openingHome: csvNumber(firstValue(row.AvgH, row.B365H)),
    openingDraw: csvNumber(firstValue(row.AvgD, row.B365D)),
    openingAway: csvNumber(firstValue(row.AvgA, row.B365A)),
    closingHome: csvNumber(firstValue(row.AvgCH, row.B365CH)),
    closingDraw: csvNumber(firstValue(row.AvgCD, row.B365CD)),
    closingAway: csvNumber(firstValue(row.AvgCA, row.B365CA)),
    over25: csvNumber(firstValue(row["AvgC>2.5"], row["Avg>2.5"], row["B365C>2.5"], row["B365>2.5"])),
    under25: csvNumber(firstValue(row["AvgC<2.5"], row["Avg<2.5"], row["B365C<2.5"], row["B365<2.5"])),
  };
}

export function transformRow(row, league, seasonStart) {
  if (!row.Date || !row.HomeTeam || !row.AwayTeam || !["H", "D", "A"].includes(row.FTR)) return null;
  const homeGoals = csvInteger(row.FTHG);
  const awayGoals = csvInteger(row.FTAG);
  if (homeGoals === null || awayGoals === null) return null;

  const date = normalizeFootballDate(row.Date);
  const homeKey = canonicalTeamKey(league.countryCode, row.HomeTeam);
  const awayKey = canonicalTeamKey(league.countryCode, row.AwayTeam);
  const sourceMatchKey = [SOURCE_KEY, league.code, seasonStart, date, homeKey, awayKey].join(":");
  const odds = selectedOdds(row);

  return {
    source_match_key: sourceMatchKey,
    source_key: SOURCE_KEY,
    league_code: league.code,
    league_name: league.name,
    country_code: league.countryCode,
    season_start: seasonStart,
    match_date: date,
    kickoff_time: timeValue(row.Time),
    home_team_key: homeKey,
    away_team_key: awayKey,
    home_team_name: row.HomeTeam.trim(),
    away_team_name: row.AwayTeam.trim(),
    home_goals: homeGoals,
    away_goals: awayGoals,
    result: row.FTR,
    half_home_goals: csvInteger(row.HTHG),
    half_away_goals: csvInteger(row.HTAG),
    half_result: ["H", "D", "A"].includes(row.HTR) ? row.HTR : null,
    referee: row.Referee?.trim() || null,
    home_xg: csvNumber(row.HxG),
    away_xg: csvNumber(row.AxG),
    home_shots: csvInteger(row.HS),
    away_shots: csvInteger(row.AS),
    home_shots_on_target: csvInteger(row.HST),
    away_shots_on_target: csvInteger(row.AST),
    home_fouls: csvInteger(row.HF),
    away_fouls: csvInteger(row.AF),
    home_corners: csvInteger(row.HC),
    away_corners: csvInteger(row.AC),
    home_yellow: csvInteger(row.HY),
    away_yellow: csvInteger(row.AY),
    home_red: csvInteger(row.HR),
    away_red: csvInteger(row.AR),
    opening_home_odds: odds.openingHome,
    opening_draw_odds: odds.openingDraw,
    opening_away_odds: odds.openingAway,
    closing_home_odds: odds.closingHome,
    closing_draw_odds: odds.closingDraw,
    closing_away_odds: odds.closingAway,
    over_25_odds: odds.over25,
    under_25_odds: odds.under25,
    source_row_hash: createHash("sha256").update(JSON.stringify(row)).digest("hex"),
  };
}

export function teamsFrom(matches) {
  const teams = new Map();
  for (const match of matches) {
    teams.set(match.home_team_key, {
      canonical_key: match.home_team_key,
      display_name: match.home_team_name,
      country_code: match.country_code,
      metadata: { provider: SOURCE_KEY },
    });
    teams.set(match.away_team_key, {
      canonical_key: match.away_team_key,
      display_name: match.away_team_name,
      country_code: match.country_code,
      metadata: { provider: SOURCE_KEY },
    });
  }
  return [...teams.values()];
}

export function aliasesFrom(teams) {
  return teams.map((team) => ({
    provider: SOURCE_KEY,
    country_code: team.country_code,
    provider_name: team.display_name,
    canonical_key: team.canonical_key,
  }));
}

export async function upsertBatches(supabase, table, rows, onConflict, size = 500) {
  let written = 0;
  for (let index = 0; index < rows.length; index += size) {
    const batch = rows.slice(index, index + size);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    written += batch.length;
  }
  return written;
}

export async function fetchSeason(baseUrl, leagueCode, seasonStart) {
  const url = `${baseUrl}/${seasonToken(seasonStart)}/${leagueCode}.csv`;
  const response = await fetch(url, { headers: { "user-agent": "KickPulse-Football-AI/1.0" } });
  if (response.status === 404) return { url, rows: [], unavailable: true };
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const text = decodeCsv(await response.arrayBuffer());
  return { url, rows: parseCsv(text), unavailable: false };
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const seasons = seasonsFrom(args);
  const leagueCodes = leaguesFrom(args);
  const baseUrl = String(process.env.FOOTBALL_DATA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const dryRun = Boolean(args["dry-run"]);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = dryRun ? null : createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let importRunId = null;
  if (supabase) {
    const { data, error } = await supabase.from("ai_import_runs").insert({
      source_key: SOURCE_KEY,
      requested_leagues: leagueCodes,
      requested_seasons: seasons,
      metadata: { baseUrl },
    }).select("id").single();
    if (error) throw new Error(`Could not start import run. Apply the AI migration first. ${error.message}`);
    importRunId = data.id;
  }

  const matches = [];
  let filesProcessed = 0;
  try {
    for (const seasonStart of seasons) {
      for (const leagueCode of leagueCodes) {
        const league = FOOTBALL_DATA_LEAGUES[leagueCode];
        const result = await fetchSeason(baseUrl, leagueCode, seasonStart);
        if (result.unavailable) {
          console.warn(`Skipped unavailable dataset: ${result.url}`);
          continue;
        }
        const transformed = result.rows
          .map((row) => transformRow(row, league, seasonStart))
          .filter(Boolean);
        matches.push(...transformed);
        filesProcessed += 1;
        console.log(`${league.name} ${seasonStart}/${String(seasonStart + 1).slice(-2)}: ${transformed.length} completed matches`);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    const teams = teamsFrom(matches);
    if (!dryRun) {
      await upsertBatches(supabase, "ai_teams", teams, "canonical_key");
      await upsertBatches(supabase, "ai_team_aliases", aliasesFrom(teams), "provider,country_code,provider_name");
      const rowsWritten = await upsertBatches(supabase, "ai_matches", matches, "source_match_key");
      await supabase.from("ai_import_runs").update({
        status: "succeeded",
        files_processed: filesProcessed,
        rows_received: matches.length,
        rows_written: rowsWritten,
        completed_at: new Date().toISOString(),
      }).eq("id", importRunId);
    }
    console.log(`${dryRun ? "Validated" : "Imported"} ${matches.length} matches from ${filesProcessed} files.`);
  } catch (error) {
    if (supabase && importRunId) {
      await supabase.from("ai_import_runs").update({
        status: "failed",
        files_processed: filesProcessed,
        rows_received: matches.length,
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      }).eq("id", importRunId);
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
