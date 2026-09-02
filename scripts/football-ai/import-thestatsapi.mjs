import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { FOOTBALL_DATA_LEAGUES, UCL_COMPETITION_CODE } from "../../lib/football-ai/constants.js";
import { createStatsApiClient } from "../../lib/thestatsapi/client.js";
import {
  findLinkedAiMatch,
  leagueCodeForCompetition,
  normalizeMatchOdds,
  normalizeMatchStats,
  providerTeamIdentity,
  providerMatchRow,
} from "../../lib/thestatsapi/transform.js";

const SOURCE_KEY = "thestatsapi";
const RESOURCE_PATHS = {
  stats: (id) => `/football/matches/${id}/stats`,
  odds: (id) => `/football/matches/${id}/odds`,
  "player-stats": (id) => `/football/matches/${id}/player-stats`,
  lineups: (id) => `/football/matches/${id}/lineups`,
  shotmap: (id) => `/football/matches/${id}/shotmap`,
  timeline: (id) => `/football/matches/${id}/timeline`,
  referee: (id) => `/football/matches/${id}/referee`,
};

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

function csvValues(value, fallback) {
  return String(value ?? fallback).split(",").map((item) => item.trim()).filter(Boolean);
}

function requestedSeasons(args) {
  const seasons = csvValues(args.seasons, "2022,2023,2024,2025").map(Number);
  if (seasons.some((season) => !Number.isInteger(season))) throw new Error("--seasons must contain starting years.");
  return seasons;
}

function requestedLeagues(args) {
  const leagues = csvValues(args.leagues, Object.keys(FOOTBALL_DATA_LEAGUES).join(",")).map((code) => code.toUpperCase());
  const unknown = leagues.filter((code) => !FOOTBALL_DATA_LEAGUES[code] && code !== UCL_COMPETITION_CODE);
  if (unknown.length) throw new Error(`Unknown league codes: ${unknown.join(", ")}`);
  return leagues;
}

function requestedResources(args) {
  const resources = csvValues(args.resources, "stats,odds");
  const unknown = resources.filter((resource) => !RESOURCE_PATHS[resource]);
  if (unknown.length) throw new Error(`Unknown resources: ${unknown.join(", ")}`);
  return resources;
}

async function upsertBatches(supabase, table, rows, onConflict, size = 250) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function fetchExistingMatches(supabase, leagueCode, seasonStart) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("ai_matches")
      .select("id,match_date,home_team_key,away_team_key,home_team_name,away_team_name,home_goals,away_goals")
      .eq("league_code", leagueCode)
      .eq("season_start", seasonStart)
      .range(offset, offset + 999);
    if (error) throw new Error(`Could not load existing ${leagueCode} matches: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function fetchRowsInBatches(supabase, table, columns, ids) {
  const rows = [];
  for (let index = 0; index < ids.length; index += 100) {
    const { data, error } = await supabase.from(table).select(columns)
      .in("provider_match_id", ids.slice(index, index + 100));
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
  }
  return rows;
}

function resourceAllowed(resource, match, competition) {
  if (resource === "stats") return competition?.has_team_stats !== false;
  if (resource === "odds") return competition?.odds_available !== false && Boolean(match.odds_available);
  if (resource === "shotmap") return Boolean(match.xg_available);
  return true;
}

function mergeStoredEnrichment(current, patch) {
  return {
    ...(current ?? {}),
    ...patch,
    coverage: { ...(current?.coverage ?? {}), ...(patch?.coverage ?? {}) },
  };
}

function providerTeams(providerMatches, leagueCode) {
  const rows = new Map();
  for (const { source, linked } of providerMatches) {
    for (const side of ["home", "away"]) {
      const providerTeam = source[`${side}_team`];
      const identity = providerTeamIdentity(providerTeam, leagueCode);
      const canonicalKey = linked?.[`${side}_team_key`] ?? identity?.key;
      if (!canonicalKey || !identity) continue;
      rows.set(String(providerTeam.id), {
        provider: SOURCE_KEY,
        provider_team_id: String(providerTeam.id),
        provider_name: providerTeam.name,
        country_code: identity.countryCode,
        canonical_key: canonicalKey,
        metadata: {
          leagueCode,
          associationCode: identity.associationCode,
          logo: providerTeam.logo_url ?? providerTeam.logo ?? providerTeam.image_path ?? providerTeam.image ?? null,
        },
      });
    }
  }
  return [...rows.values()];
}

async function persistProviderTeams(supabase, rows) {
  if (!rows.length) return;
  const canonicalTeams = [...new Map(rows.map((row) => [row.canonical_key, {
    canonical_key: row.canonical_key,
    display_name: row.provider_name,
    country_code: row.country_code,
    metadata: { provider: SOURCE_KEY },
  }])).values()];
  const { error: teamError } = await supabase.from("ai_teams").upsert(canonicalTeams, {
    onConflict: "canonical_key",
    ignoreDuplicates: true,
  });
  if (teamError) throw new Error(`ai_teams: ${teamError.message}`);
  await upsertBatches(supabase, "ai_provider_teams", rows, "provider,provider_team_id");
  await upsertBatches(supabase, "ai_team_aliases", rows.map((row) => ({
    provider: SOURCE_KEY,
    country_code: row.country_code,
    provider_name: row.provider_name,
    canonical_key: row.canonical_key,
  })), "provider,country_code,provider_name");
}

export function selectEnrichmentMatches(providerMatches, { limit = Number.POSITIVE_INFINITY } = {}) {
  // Paid per-match resources are useful to training only after the provider
  // row links to a canonical ai_matches row. Keep every discovered provider
  // match as metadata below, but never spend trial quota on unlinked rows.
  const eligible = providerMatches.filter((row) => row.linked);
  return Number.isFinite(limit) ? eligible.slice(0, Math.max(0, limit)) : eligible;
}

async function importSeason({
  api,
  supabase,
  competition,
  season,
  leagueCode,
  resources,
  refresh,
  dryRun,
  remainingLimit,
}) {
  const existingMatches = await fetchExistingMatches(supabase, leagueCode, season.start_year);
  const matchQuery = {
    competition_id: competition.id,
    season_id: season.id,
    status: "finished",
  };
  if (leagueCode !== UCL_COMPETITION_CODE) {
    matchQuery.stage = FOOTBALL_DATA_LEAGUES[leagueCode]?.theStatsStage ?? "regular";
  }
  const discoveredApiMatches = await api.paginate("/football/matches", matchQuery);
  const discoveredProviderMatches = discoveredApiMatches.map((source) => ({
    source,
    linked: findLinkedAiMatch(source, existingMatches),
  }));
  const providerMatches = selectEnrichmentMatches(discoveredProviderMatches, {
    leagueCode,
    limit: remainingLimit,
  });
  const apiMatches = providerMatches.map((row) => row.source);
  const linkedAvailable = discoveredProviderMatches.filter((row) => row.linked).length;
  const matched = providerMatches.filter((row) => row.linked).length;
  console.log(`${leagueCode} ${season.start_year}/${String(season.end_year).slice(-2)}: ${apiMatches.length} selected of ${discoveredApiMatches.length} provider matches; ${matched} linked to training rows (${linkedAvailable} linked available).`);
  if (discoveredProviderMatches.length > linkedAvailable) {
    console.log(`  Skipping paid enrichment endpoints for ${discoveredProviderMatches.length - linkedAvailable} unlinked ${leagueCode} rows.`);
  }
  if (dryRun) {
    return { discovered: discoveredApiMatches.length, matches: apiMatches.length, linked: matched, payloads: 0, enrichments: 0 };
  }

  // Provider/team metadata is inexpensive and remains useful for diagnosing
  // aliases, but paid per-match resources are requested only for the selected
  // rows above. For UCL this prevents qualifiers from consuming the trial.
  const teamRows = providerTeams(discoveredProviderMatches, leagueCode);
  await persistProviderTeams(supabase, teamRows);
  const teamById = new Map(teamRows.map((row) => [row.provider_team_id, row]));
  const matchRows = discoveredProviderMatches.map(({ source, linked }) => {
    const row = providerMatchRow(source, { leagueCode, seasonStart: season.start_year, aiMatchId: linked?.id ?? null });
    if (!row) return null;
    row.home_team_key = linked?.home_team_key ?? teamById.get(row.provider_home_team_id)?.canonical_key ?? null;
    row.away_team_key = linked?.away_team_key ?? teamById.get(row.provider_away_team_id)?.canonical_key ?? null;
    return row;
  }).filter(Boolean);
  await upsertBatches(supabase, "ai_provider_matches", matchRows, "provider_match_id");

  if (!apiMatches.length) {
    return { discovered: discoveredApiMatches.length, matches: 0, linked: 0, payloads: 0, enrichments: 0 };
  }

  const ids = matchRows.map((row) => row.provider_match_id);
  const existingPayloadRows = refresh ? [] : await fetchRowsInBatches(
    supabase,
    "ai_provider_payloads",
    "provider_match_id,endpoint_key",
    ids,
  );
  const existingPayloads = new Set(existingPayloadRows.map((row) => `${row.provider_match_id}:${row.endpoint_key}`));
  const existingEnrichmentRows = await fetchRowsInBatches(supabase, "ai_match_enrichments", "*", ids);
  const enrichmentById = new Map(existingEnrichmentRows.map((row) => [row.provider_match_id, row]));
  const changedEnrichments = new Set();
  const payloadRows = [];

  // Linking can improve after aliases are added. Propagate the newly resolved
  // ai_match_id even when stats/odds payloads are already cached and skipped.
  // This makes a relink run quota-light instead of forcing --refresh.
  for (let index = 0; index < apiMatches.length; index += 1) {
    const providerMatchId = String(apiMatches[index].id);
    const aiMatchId = providerMatches[index].linked?.id ?? null;
    const current = enrichmentById.get(providerMatchId);
    if (current && aiMatchId && current.ai_match_id !== aiMatchId) {
      enrichmentById.set(providerMatchId, { ...current, ai_match_id: aiMatchId });
      changedEnrichments.add(providerMatchId);
    }
  }

  for (let index = 0; index < apiMatches.length; index += 1) {
    const match = apiMatches[index];
    const linked = providerMatches[index].linked;
    for (const resource of resources) {
      if (!resourceAllowed(resource, match, competition)) continue;
      const payloadKey = `${match.id}:${resource}`;
      if (!refresh && existingPayloads.has(payloadKey)) continue;
      try {
        const payload = await api.get(RESOURCE_PATHS[resource](match.id), {}, { allow404: true });
        if (!payload) continue;
        payloadRows.push({
          provider_match_id: String(match.id),
          endpoint_key: resource,
          payload,
          retrieved_at: new Date().toISOString(),
        });
        if (resource === "stats") {
          const current = enrichmentById.get(String(match.id));
          enrichmentById.set(String(match.id), mergeStoredEnrichment(
            current,
            normalizeMatchStats(match, payload, linked?.id ?? null),
          ));
          changedEnrichments.add(String(match.id));
        } else if (resource === "odds") {
          const current = enrichmentById.get(String(match.id));
          enrichmentById.set(String(match.id), mergeStoredEnrichment(
            current,
            normalizeMatchOdds(match, payload, linked?.id ?? null),
          ));
          changedEnrichments.add(String(match.id));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/\b(401|403)\b/.test(message)) throw error;
        console.warn(`${resource} unavailable for ${match.id}: ${message}`);
      }
    }
    if ((index + 1) % 25 === 0) {
      console.log(`  Processed ${index + 1}/${apiMatches.length}; API calls this run: ${api.metrics.requests}`);
    }
  }

  await upsertBatches(supabase, "ai_provider_payloads", payloadRows, "provider_match_id,endpoint_key", 100);
  const enrichmentRows = [...changedEnrichments].map((id) => {
    const row = { ...enrichmentById.get(id) };
    delete row.updated_at;
    return row;
  });
  await upsertBatches(supabase, "ai_match_enrichments", enrichmentRows, "provider_match_id");
  return {
    discovered: discoveredApiMatches.length,
    matches: apiMatches.length,
    linked: matched,
    payloads: payloadRows.length,
    enrichments: enrichmentRows.length,
  };
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const seasons = requestedSeasons(args);
  const leagueCodes = requestedLeagues(args);
  const resources = requestedResources(args);
  const dryRun = Boolean(args["dry-run"]);
  const refresh = Boolean(args.refresh);
  const limit = args.limit === undefined ? Number.POSITIVE_INFINITY : Number(args.limit);
  if (!(limit > 0)) throw new Error("--limit must be a positive number.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.THESTATSAPI_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase URL and service-role key are required.");
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const api = createStatsApiClient({
    apiKey,
    baseUrl: process.env.THESTATSAPI_BASE_URL,
    requestsPerMinute: process.env.THESTATSAPI_REQUESTS_PER_MINUTE ?? 220,
    maxRequests: process.env.THESTATSAPI_MAX_REQUESTS_PER_RUN ?? 45_000,
  });

  let run = null;
  if (!dryRun) {
    const { data, error } = await supabase.from("ai_import_runs").insert({
      source_key: SOURCE_KEY,
      requested_leagues: leagueCodes,
      requested_seasons: seasons,
      metadata: { resources, dryRun, refresh, limit: Number.isFinite(limit) ? limit : null },
    }).select("id").single();
    if (error) throw new Error(`Apply the sustainable-learning migration first. ${error.message}`);
    run = data;
  }

  const totals = { discovered: 0, matches: 0, linked: 0, payloads: 0, enrichments: 0, seasons: 0 };
  try {
    const competitions = await api.paginate("/football/competitions");
    const selectedCompetitions = new Map();
    for (const competition of competitions) {
      const code = leagueCodeForCompetition(competition);
      if (code && leagueCodes.includes(code)) selectedCompetitions.set(code, competition);
    }
    if (leagueCodes.includes(UCL_COMPETITION_CODE) && process.env.THESTATSAPI_UCL_COMPETITION_ID) {
      selectedCompetitions.set(UCL_COMPETITION_CODE, competitions.find((competition) =>
        String(competition.id) === String(process.env.THESTATSAPI_UCL_COMPETITION_ID)) ?? {
        id: process.env.THESTATSAPI_UCL_COMPETITION_ID,
        name: "UEFA Champions League",
      });
    }
    const missing = leagueCodes.filter((code) => !selectedCompetitions.has(code));
    if (missing.length) throw new Error(`Could not discover competitions for: ${missing.join(", ")}`);

    for (const leagueCode of leagueCodes) {
      const competition = selectedCompetitions.get(leagueCode);
      const seasonResponse = await api.get(`/football/competitions/${competition.id}/seasons`);
      const selectedSeasons = (seasonResponse?.data ?? []).filter((season) => seasons.includes(Number(season.start_year)));
      for (const season of selectedSeasons) {
        const result = await importSeason({
          api,
          supabase,
          competition,
          season,
          leagueCode,
          resources,
          refresh,
          dryRun,
          remainingLimit: Number.isFinite(limit) ? limit - totals.matches : Number.POSITIVE_INFINITY,
        });
        for (const key of ["discovered", "matches", "linked", "payloads", "enrichments"]) totals[key] += result[key];
        totals.seasons += 1;
        if (totals.matches >= limit) break;
      }
      if (totals.matches >= limit) break;
    }

    if (run) {
      await supabase.from("ai_import_runs").update({
        status: "succeeded",
        files_processed: totals.seasons,
        rows_received: totals.matches,
        rows_written: totals.payloads + totals.enrichments,
        completed_at: new Date().toISOString(),
        metadata: { resources, dryRun, refresh, totals, api: api.metrics },
      }).eq("id", run.id);
    }
    console.log(JSON.stringify({ totals, api: api.metrics }, null, 2));
  } catch (error) {
    if (run) {
      await supabase.from("ai_import_runs").update({
        status: "failed",
        files_processed: totals.seasons,
        rows_received: totals.matches,
        rows_written: totals.payloads + totals.enrichments,
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
        metadata: { resources, totals, api: api.metrics },
      }).eq("id", run.id);
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
