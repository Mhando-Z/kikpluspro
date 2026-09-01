import { FootballDataOrgClient } from "../football-data-org/client.js";
import { UCL_COMPETITION_CODE } from "./constants.js";
import { normalizeUclStage, uclFormatEra } from "./openfootball.js";
import { canonicalUclTeam } from "./ucl-teams.js";

export const UCL_FIXTURE_SOURCE_KEY = "football-data-org";

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function dateOffset(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

function statusOf(value) {
  if (["FINISHED", "AWARDED"].includes(value)) return "finished";
  if (["POSTPONED", "SUSPENDED"].includes(value)) return "postponed";
  if (value === "CANCELLED") return "cancelled";
  return "scheduled";
}

function associationOf(team) {
  return team?.area?.code ?? team?.area?.name?.slice(0, 3)?.toUpperCase() ?? null;
}

function nullableScore(value) {
  return value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
    ? null
    : Number(value);
}

function regulationScore(match) {
  const duration = match.score?.duration;
  const source = duration && duration !== "REGULAR"
    ? match.score?.regularTime
    : match.score?.fullTime;
  return {
    home: nullableScore(source?.home),
    away: nullableScore(source?.away),
  };
}

export function transformFootballDataOrgMatch(match) {
  if (!match?.id || !match?.utcDate || !match?.homeTeam?.name || !match?.awayTeam?.name) return null;
  const home = canonicalUclTeam(match.homeTeam.name, associationOf(match.homeTeam));
  const away = canonicalUclTeam(match.awayTeam.name, associationOf(match.awayTeam));
  const kickoff = new Date(match.utcDate);
  const seasonStart = Number(String(match.season?.startDate ?? kickoff.toISOString()).slice(0, 4));
  const status = statusOf(match.status);
  const regulation = regulationScore(match);
  const homeGoals = regulation.home;
  const awayGoals = regulation.away;
  const result = homeGoals === null || awayGoals === null ? null : homeGoals > awayGoals ? "H" : homeGoals < awayGoals ? "A" : "D";
  const stage = normalizeUclStage(String(match.stage ?? "").replaceAll("_", " "));

  return {
    canonical_fixture_key: [UCL_COMPETITION_CODE, kickoff.toISOString().slice(0, 10), home.key, away.key].join("|"),
    source_fixture_key: `${UCL_FIXTURE_SOURCE_KEY}:${UCL_COMPETITION_CODE}:${match.id}`,
    source_key: UCL_FIXTURE_SOURCE_KEY,
    provider_fixture_id: String(match.id),
    league_code: UCL_COMPETITION_CODE,
    league_name: "UEFA Champions League",
    country_code: "europe",
    season_start: seasonStart,
    match_date: kickoff.toISOString().slice(0, 10),
    kickoff_time: kickoff.toISOString().slice(11, 19),
    source_timezone: "UTC",
    kickoff_at: kickoff.toISOString(),
    home_team_key: home.key,
    away_team_key: away.key,
    home_team_name: home.displayName,
    away_team_name: away.displayName,
    status,
    home_goals: status === "finished" ? homeGoals : null,
    away_goals: status === "finished" ? awayGoals : null,
    result: status === "finished" ? result : null,
    competition_stage: stage,
    format_era: uclFormatEra(seasonStart),
    leg: null,
    neutral_venue: stage === "final",
    source_last_modified: match.lastUpdated ? new Date(match.lastUpdated).toISOString() : null,
    source_payload: {
      providerMatchId: match.id,
      providerStatus: match.status,
      scoreDuration: match.score?.duration ?? null,
      group: match.group ?? null,
      matchday: match.matchday ?? null,
      homeCrest: match.homeTeam.crest ?? null,
      awayCrest: match.awayTeam.crest ?? null,
      homeProviderId: match.homeTeam.id ?? null,
      awayProviderId: match.awayTeam.id ?? null,
    },
  };
}

export function uclFixtureToTrainingMatch(fixture) {
  if (fixture.status !== "finished" || fixture.home_goals === null || fixture.away_goals === null || !fixture.result) return null;
  const sourceKey = fixture.source_key ?? UCL_FIXTURE_SOURCE_KEY;
  return {
    source_match_key: `${sourceKey}:CL:${fixture.provider_fixture_id}`,
    source_key: sourceKey,
    provider_match_id: fixture.provider_fixture_id,
    league_code: fixture.league_code,
    league_name: fixture.league_name,
    country_code: fixture.country_code,
    season_start: fixture.season_start,
    match_date: fixture.match_date,
    kickoff_time: fixture.kickoff_time,
    home_team_key: fixture.home_team_key,
    away_team_key: fixture.away_team_key,
    home_team_name: fixture.home_team_name,
    away_team_name: fixture.away_team_name,
    home_goals: fixture.home_goals,
    away_goals: fixture.away_goals,
    result: fixture.result,
    competition_stage: fixture.competition_stage,
    format_era: fixture.format_era,
    leg: fixture.leg,
    neutral_venue: fixture.neutral_venue,
    source_row_hash: `${fixture.provider_fixture_id}:${fixture.home_goals}:${fixture.away_goals}`,
  };
}

function teamsFrom(fixtures) {
  const teams = new Map();
  for (const fixture of fixtures) {
    for (const side of ["home", "away"]) {
      const key = fixture[`${side}_team_key`];
      const name = fixture[`${side}_team_name`];
      teams.set(key, {
        canonical_key: key,
        display_name: name,
        country_code: key.split(":")[1] ?? "europe",
        metadata: {
          provider: UCL_FIXTURE_SOURCE_KEY,
          providerId: fixture.source_payload[`${side}ProviderId`],
          crest: fixture.source_payload[`${side}Crest`],
        },
      });
    }
  }
  return [...teams.values()];
}

async function upsertBatches(supabase, table, rows, onConflict, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function fetchUclFixtures({ now = new Date(), days = 14, pastDays = 0, client } = {}) {
  const provider = client ?? new FootballDataOrgClient();
  const dateFrom = dateOffset(now, -Number(pastDays));
  const dateTo = dateOffset(now, Number(days));
  const payload = await provider.competitionMatches(UCL_COMPETITION_CODE, { dateFrom, dateTo });
  const fixtures = (payload.matches ?? []).map(transformFootballDataOrgMatch).filter(Boolean)
    .sort((left, right) => left.kickoff_at.localeCompare(right.kickoff_at));
  return { fixtures, dateFrom, dateTo, url: "https://www.football-data.org/", providerName: "Football-Data.org" };
}

export async function syncUclFixtures(supabase, options = {}) {
  const feed = await fetchUclFixtures(options);
  const teams = teamsFrom(feed.fixtures);
  const aliases = teams.map((team) => ({
    provider: UCL_FIXTURE_SOURCE_KEY,
    country_code: team.country_code,
    provider_name: team.display_name,
    canonical_key: team.canonical_key,
  }));
  if (teams.length) {
    await upsertBatches(supabase, "ai_teams", teams, "canonical_key");
    await upsertBatches(supabase, "ai_team_aliases", aliases, "provider,country_code,provider_name");
  }
  if (feed.fixtures.length) await upsertBatches(supabase, "ai_fixtures", feed.fixtures, "canonical_fixture_key");
  return { ...feed, teams: teams.length };
}
