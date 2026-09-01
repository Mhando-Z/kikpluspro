import { UCL_COMPETITION_CODE } from "../football-ai/constants.js";
import { seasonStartForDate } from "../football-ai/fixtures.js";
import { normalizeUclStage, uclFormatEra } from "../football-ai/openfootball.js";
import { providerTeamIdentity, leagueCodeForCompetition } from "./transform.js";
import { createStatsApiClient } from "./client.js";

export const THESTATSAPI_SOURCE_KEY = "thestatsapi";

function nullableNumber(value) {
  return value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
    ? null
    : Number(value);
}

function statusOf(value) {
  const status = String(value ?? "").toLowerCase().replace(/[^a-z]+/g, "_");
  if (["finished", "complete", "completed", "full_time", "ft"].includes(status)) return "finished";
  if (["postponed", "suspended", "delayed"].includes(status)) return "postponed";
  if (["cancelled", "canceled", "abandoned"].includes(status)) return "cancelled";
  return "scheduled";
}

function teamLogo(team) {
  return team?.logo_url ?? team?.logo ?? team?.image_path ?? team?.image ?? null;
}

function dateOffset(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function knockoutLeg(value) {
  const leg = nullableNumber(value);
  return leg === 1 || leg === 2 ? leg : null;
}

function isoDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function seasonCandidates(seasons, dateFrom, dateTo) {
  const starts = new Set([
    seasonStartForDate(dateFrom.toISOString().slice(0, 10)),
    seasonStartForDate(dateTo.toISOString().slice(0, 10)),
  ]);
  const exact = seasons.filter((season) => starts.has(Number(season.start_year)));
  if (exact.length) return exact;
  return [...seasons].sort((left, right) => Number(right.start_year) - Number(left.start_year)).slice(0, 1);
}

export function transformStatsApiUclMatch(match, teamKeyByProviderId = new Map()) {
  if (!match?.id || !match?.utc_date || !match?.home_team?.name || !match?.away_team?.name) return null;
  const kickoff = new Date(match.utc_date);
  if (Number.isNaN(kickoff.getTime())) return null;
  const homeIdentity = providerTeamIdentity(match.home_team, UCL_COMPETITION_CODE);
  const awayIdentity = providerTeamIdentity(match.away_team, UCL_COMPETITION_CODE);
  const homeKey = teamKeyByProviderId.get(String(match.home_team.id)) ?? homeIdentity?.key;
  const awayKey = teamKeyByProviderId.get(String(match.away_team.id)) ?? awayIdentity?.key;
  if (!homeKey || !awayKey || homeKey === awayKey) return null;
  const seasonStart = Number(match.season?.start_year ?? match.season_start ?? seasonStartForDate(kickoff.toISOString().slice(0, 10)));
  const stage = normalizeUclStage(String(match.stage ?? match.round?.name ?? "").replaceAll("_", " "));
  const status = statusOf(match.status);
  const homeGoals = nullableNumber(match.score?.regular_time?.home ?? match.score?.home);
  const awayGoals = nullableNumber(match.score?.regular_time?.away ?? match.score?.away);
  const result = homeGoals === null || awayGoals === null ? null : homeGoals > awayGoals ? "H" : homeGoals < awayGoals ? "A" : "D";
  const matchDate = kickoff.toISOString().slice(0, 10);

  return {
    canonical_fixture_key: [UCL_COMPETITION_CODE, matchDate, homeKey, awayKey].join("|"),
    source_fixture_key: `${THESTATSAPI_SOURCE_KEY}:${UCL_COMPETITION_CODE}:${match.id}`,
    source_key: THESTATSAPI_SOURCE_KEY,
    provider_fixture_id: String(match.id),
    league_code: UCL_COMPETITION_CODE,
    league_name: "UEFA Champions League",
    country_code: "europe",
    season_start: seasonStart,
    match_date: matchDate,
    kickoff_time: kickoff.toISOString().slice(11, 19),
    source_timezone: "UTC",
    kickoff_at: kickoff.toISOString(),
    home_team_key: homeKey,
    away_team_key: awayKey,
    home_team_name: homeIdentity?.displayName ?? match.home_team.name,
    away_team_name: awayIdentity?.displayName ?? match.away_team.name,
    status,
    home_goals: status === "finished" ? homeGoals : null,
    away_goals: status === "finished" ? awayGoals : null,
    result: status === "finished" ? result : null,
    competition_stage: stage,
    format_era: uclFormatEra(seasonStart),
    leg: knockoutLeg(match.leg),
    neutral_venue: Boolean(match.neutral_venue) || stage === "final",
    source_last_modified: isoDateOrNull(match.updated_at),
    source_payload: {
      provider: THESTATSAPI_SOURCE_KEY,
      providerMatchId: match.id,
      providerStatus: match.status,
      homeCrest: teamLogo(match.home_team),
      awayCrest: teamLogo(match.away_team),
      homeProviderId: match.home_team.id,
      awayProviderId: match.away_team.id,
      oddsAvailable: Boolean(match.odds_available),
      xgAvailable: Boolean(match.xg_available),
      rawStage: match.stage ?? match.round?.name ?? null,
    },
  };
}

async function discoverCompetition(api) {
  if (process.env.THESTATSAPI_UCL_COMPETITION_ID) {
    return { id: process.env.THESTATSAPI_UCL_COMPETITION_ID, name: "UEFA Champions League" };
  }
  const competitions = await api.paginate("/football/competitions");
  const competition = competitions.find((row) => leagueCodeForCompetition(row) === UCL_COMPETITION_CODE);
  if (!competition) throw new Error("TheStatsAPI UEFA Champions League competition was not discovered. Set THESTATSAPI_UCL_COMPETITION_ID after checking the competitions response.");
  return competition;
}

export async function fetchStatsApiUclFixtures({ now = new Date(), days = 14, pastDays = 0, client } = {}) {
  const api = client ?? createStatsApiClient({
    apiKey: process.env.THESTATSAPI_KEY,
    baseUrl: process.env.THESTATSAPI_BASE_URL,
    requestsPerMinute: process.env.THESTATSAPI_REQUESTS_PER_MINUTE ?? 220,
    maxRequests: process.env.THESTATSAPI_MAX_REQUESTS_PER_RUN ?? 45_000,
  });
  const dateFrom = dateOffset(now, -Number(pastDays));
  const dateTo = dateOffset(now, Number(days));
  dateFrom.setUTCHours(0, 0, 0, 0);
  dateTo.setUTCHours(23, 59, 59, 999);
  const competition = await discoverCompetition(api);
  const seasonResponse = await api.get(`/football/competitions/${competition.id}/seasons`);
  const seasons = seasonCandidates(seasonResponse?.data ?? [], dateFrom, dateTo);
  if (!seasons.length) throw new Error("TheStatsAPI did not return a UCL season for the requested fixture window.");

  const rawMatches = [];
  for (const season of seasons) {
    rawMatches.push(...await api.paginate("/football/matches", {
      competition_id: competition.id,
      season_id: season.id,
    }));
  }
  const withinWindow = rawMatches.filter((match) => {
    const kickoff = new Date(match.utc_date);
    return kickoff >= dateFrom && kickoff <= dateTo;
  });
  return {
    fixtures: withinWindow.map((match) => transformStatsApiUclMatch(match)).filter(Boolean)
      .sort((left, right) => left.kickoff_at.localeCompare(right.kickoff_at)),
    rawMatches: withinWindow,
    competition,
    seasons,
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
    url: "https://www.thestatsapi.com/",
    providerName: "TheStatsAPI",
    apiMetrics: api.metrics,
  };
}

async function fetchTeamMappings(supabase, ids) {
  const mappings = new Map();
  for (let index = 0; index < ids.length; index += 100) {
    const { data, error } = await supabase.from("ai_provider_teams")
      .select("provider_team_id,canonical_key")
      .eq("provider", THESTATSAPI_SOURCE_KEY)
      .in("provider_team_id", ids.slice(index, index + 100));
    if (error) throw new Error(`ai_provider_teams: ${error.message}`);
    for (const row of data ?? []) if (row.canonical_key) mappings.set(row.provider_team_id, row.canonical_key);
  }
  return mappings;
}

async function upsertBatches(supabase, table, rows, onConflict, size = 250, options = {}) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + size), { onConflict, ...options });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function syncStatsApiUclFixtures(supabase, options = {}) {
  const feed = await fetchStatsApiUclFixtures(options);
  const providerIds = [...new Set(feed.rawMatches.flatMap((match) => [String(match.home_team.id), String(match.away_team.id)]))];
  const knownMappings = await fetchTeamMappings(supabase, providerIds);
  const fixtures = feed.rawMatches.map((match) => transformStatsApiUclMatch(match, knownMappings)).filter(Boolean);
  const teams = new Map();
  const providerTeams = new Map();
  for (let index = 0; index < feed.rawMatches.length; index += 1) {
    const match = feed.rawMatches[index];
    for (const side of ["home", "away"]) {
      const sourceTeam = match[`${side}_team`];
      const identity = providerTeamIdentity(sourceTeam, UCL_COMPETITION_CODE);
      const canonicalKey = knownMappings.get(String(sourceTeam.id)) ?? identity?.key;
      if (!identity || !canonicalKey) continue;
      teams.set(canonicalKey, {
        canonical_key: canonicalKey,
        display_name: identity.displayName,
        country_code: identity.countryCode,
        metadata: { provider: THESTATSAPI_SOURCE_KEY, crest: teamLogo(sourceTeam) },
      });
      providerTeams.set(String(sourceTeam.id), {
        provider: THESTATSAPI_SOURCE_KEY,
        provider_team_id: String(sourceTeam.id),
        provider_name: sourceTeam.name,
        country_code: identity.countryCode,
        canonical_key: canonicalKey,
        metadata: { leagueCode: UCL_COMPETITION_CODE, logo: teamLogo(sourceTeam) },
      });
    }
  }
  const teamRows = [...teams.values()];
  const providerRows = [...providerTeams.values()];
  if (teamRows.length) await upsertBatches(supabase, "ai_teams", teamRows, "canonical_key", 250, { ignoreDuplicates: true });
  if (providerRows.length) {
    await upsertBatches(supabase, "ai_provider_teams", providerRows, "provider,provider_team_id");
    await upsertBatches(supabase, "ai_team_aliases", providerRows.map((row) => ({
      provider: THESTATSAPI_SOURCE_KEY,
      country_code: row.country_code,
      provider_name: row.provider_name,
      canonical_key: row.canonical_key,
    })), "provider,country_code,provider_name");
  }
  if (fixtures.length) await upsertBatches(supabase, "ai_fixtures", fixtures, "canonical_fixture_key");
  return { ...feed, fixtures, teams: teamRows.length };
}
