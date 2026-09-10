import { teamNameMatchScore } from "../api-football/team-assets.js";
import { FootballDataOrgClient } from "../football-data-org/client.js";
import { OpenLigaDbClient } from "../openligadb/client.js";
import {
  FOOTBALL_DATA_LEAGUES,
  UCL_COMPETITION_CODE,
  canonicalTeamKey,
} from "./constants.js";
import {
  FIXTURE_SOURCE_KEY,
  RESULT_SOURCE_KEY,
  fetchFixtureFeed,
  fetchResultFeed,
} from "./fixtures.js";
import { normalizeUclStage, uclFormatEra } from "./openfootball.js";
import { transformFootballDataOrgMatch } from "./ucl-fixtures.js";
import { canonicalUclTeam } from "./ucl-teams.js";

export const FOOTBALL_DATA_ORG_SOURCE_KEY = "football-data-org";
export const OPENLIGADB_SOURCE_KEY = "openligadb";

const FOOTBALL_DATA_ORG_CODES = {
  E0: "PL",
  E1: "ELC",
  SP1: "PD",
  I1: "SA",
  D1: "BL1",
  F1: "FL1",
  CL: "CL",
};

const OPENLIGADB_CODES = {
  E0: "pl",
  SP1: "la1",
  D1: "bl1",
  CL: "ucl",
};

const PROVIDER_LABELS = {
  [FIXTURE_SOURCE_KEY]: "Football-Data.co.uk",
  [RESULT_SOURCE_KEY]: "Football-Data.co.uk",
  [FOOTBALL_DATA_ORG_SOURCE_KEY]: "Football-Data.org",
  [OPENLIGADB_SOURCE_KEY]: "OpenLigaDB",
};

function dateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function offsetDate(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + Number(days));
  return dateOnly(date);
}

function nullableNumber(value) {
  return value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
    ? null
    : Number(value);
}

function resultCode(home, away) {
  if (home === null || away === null) return null;
  return home > away ? "H" : home < away ? "A" : "D";
}

function providerTimestamp(value) {
  if (!value) return null;
  let parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(value))) {
    parsed = new Date(`${value}Z`);
  }
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function footballDataStatus(value) {
  if (["FINISHED", "AWARDED"].includes(value)) return "finished";
  if (["POSTPONED", "SUSPENDED"].includes(value)) return "postponed";
  if (value === "CANCELLED") return "cancelled";
  return "scheduled";
}

function footballDataScore(match) {
  const source = match.score?.duration && match.score.duration !== "REGULAR"
    ? match.score?.regularTime
    : match.score?.fullTime;
  return {
    home: nullableNumber(source?.home),
    away: nullableNumber(source?.away),
  };
}

function configuredCode(provider, leagueCode) {
  const code = String(leagueCode).toUpperCase();
  const prefix = provider === FOOTBALL_DATA_ORG_SOURCE_KEY
    ? "FOOTBALL_DATA_ORG"
    : "OPENLIGADB";
  const override = process.env[`${prefix}_${code}_CODE`];
  if (override !== undefined) return String(override).trim() || null;
  return provider === FOOTBALL_DATA_ORG_SOURCE_KEY
    ? FOOTBALL_DATA_ORG_CODES[code] ?? null
    : OPENLIGADB_CODES[code] ?? null;
}

function providerTeamName(team) {
  return String(team?.name ?? team?.teamName ?? "").trim();
}

function providerShortName(team) {
  return String(team?.shortName ?? "").trim() || null;
}

export function transformFootballDataDomesticMatch(match, leagueCode) {
  const league = FOOTBALL_DATA_LEAGUES[leagueCode];
  if (!league || !match?.id || !match?.utcDate || !match?.homeTeam?.name || !match?.awayTeam?.name) return null;
  const kickoff = new Date(match.utcDate);
  if (Number.isNaN(kickoff.getTime())) return null;
  const homeProviderName = providerTeamName(match.homeTeam);
  const awayProviderName = providerTeamName(match.awayTeam);
  const homeDisplayName = providerShortName(match.homeTeam) ?? homeProviderName;
  const awayDisplayName = providerShortName(match.awayTeam) ?? awayProviderName;
  const homeKey = canonicalTeamKey(league.countryCode, homeDisplayName);
  const awayKey = canonicalTeamKey(league.countryCode, awayDisplayName);
  const status = footballDataStatus(match.status);
  const score = footballDataScore(match);
  const seasonStart = Number(String(match.season?.startDate ?? kickoff.toISOString()).slice(0, 4));

  return {
    canonical_fixture_key: [league.code, dateOnly(kickoff), homeKey, awayKey].join("|"),
    source_fixture_key: `${FOOTBALL_DATA_ORG_SOURCE_KEY}:${league.code}:${match.id}`,
    source_key: FOOTBALL_DATA_ORG_SOURCE_KEY,
    provider_fixture_id: String(match.id),
    league_code: league.code,
    league_name: league.name,
    country_code: league.countryCode,
    season_start: seasonStart,
    match_date: dateOnly(kickoff),
    kickoff_time: kickoff.toISOString().slice(11, 19),
    source_timezone: "UTC",
    kickoff_at: kickoff.toISOString(),
    home_team_key: homeKey,
    away_team_key: awayKey,
    home_team_name: homeDisplayName,
    away_team_name: awayDisplayName,
    status,
    home_goals: status === "finished" ? score.home : null,
    away_goals: status === "finished" ? score.away : null,
    result: status === "finished" ? resultCode(score.home, score.away) : null,
    competition_stage: null,
    format_era: null,
    leg: null,
    neutral_venue: false,
    market_home_odds: null,
    market_draw_odds: null,
    market_away_odds: null,
    over_25_odds: null,
    under_25_odds: null,
    source_last_modified: match.lastUpdated ? new Date(match.lastUpdated).toISOString() : null,
    source_payload: {
      providerMatchId: match.id,
      providerStatus: match.status,
      matchday: match.matchday ?? null,
      stage: match.stage ?? null,
      homeProviderName,
      awayProviderName,
      homeShortName: providerShortName(match.homeTeam),
      awayShortName: providerShortName(match.awayTeam),
      homeCrest: match.homeTeam.crest ?? null,
      awayCrest: match.awayTeam.crest ?? null,
      homeProviderId: match.homeTeam.id ?? null,
      awayProviderId: match.awayTeam.id ?? null,
    },
  };
}

function openLigaFinalScore(match) {
  const results = Array.isArray(match?.matchResults) ? match.matchResults : [];
  const regulation = results.find((row) => row.resultTypeKind === "After90Minutes")
    ?? results.find((row) => Number(row.resultTypeID) === 2)
    ?? [...results].sort((left, right) => Number(right.resultOrderID ?? 0) - Number(left.resultOrderID ?? 0))[0];
  return {
    home: nullableNumber(regulation?.pointsTeam1),
    away: nullableNumber(regulation?.pointsTeam2),
  };
}

export function transformOpenLigaDbMatch(match, leagueCode) {
  const isUcl = leagueCode === UCL_COMPETITION_CODE;
  const league = isUcl
    ? { code: UCL_COMPETITION_CODE, name: "UEFA Champions League", countryCode: "europe" }
    : FOOTBALL_DATA_LEAGUES[leagueCode];
  if (!league || !match?.matchID || !match?.team1?.teamName || !match?.team2?.teamName) return null;
  const kickoff = new Date(match.matchDateTimeUTC ?? match.matchDateTime);
  if (Number.isNaN(kickoff.getTime())) return null;
  const homeProviderName = providerTeamName(match.team1);
  const awayProviderName = providerTeamName(match.team2);
  const homeDisplayName = providerShortName(match.team1) ?? homeProviderName;
  const awayDisplayName = providerShortName(match.team2) ?? awayProviderName;
  const homeIdentity = isUcl ? canonicalUclTeam(homeProviderName) : null;
  const awayIdentity = isUcl ? canonicalUclTeam(awayProviderName) : null;
  const homeKey = homeIdentity?.key ?? canonicalTeamKey(league.countryCode, homeDisplayName);
  const awayKey = awayIdentity?.key ?? canonicalTeamKey(league.countryCode, awayDisplayName);
  const score = openLigaFinalScore(match);
  const finished = Boolean(match.matchIsFinished && score.home !== null && score.away !== null);
  const stage = isUcl ? normalizeUclStage(match.group?.groupName ?? "") : null;

  return {
    canonical_fixture_key: [league.code, dateOnly(kickoff), homeKey, awayKey].join("|"),
    source_fixture_key: `${OPENLIGADB_SOURCE_KEY}:${league.code}:${match.matchID}`,
    source_key: OPENLIGADB_SOURCE_KEY,
    provider_fixture_id: String(match.matchID),
    league_code: league.code,
    league_name: league.name,
    country_code: league.countryCode,
    season_start: Number(match.leagueSeason ?? dateOnly(kickoff).slice(0, 4)),
    match_date: dateOnly(kickoff),
    kickoff_time: kickoff.toISOString().slice(11, 19),
    source_timezone: "UTC",
    kickoff_at: kickoff.toISOString(),
    home_team_key: homeKey,
    away_team_key: awayKey,
    home_team_name: homeIdentity?.displayName ?? homeDisplayName,
    away_team_name: awayIdentity?.displayName ?? awayDisplayName,
    status: finished ? "finished" : "scheduled",
    home_goals: finished ? score.home : null,
    away_goals: finished ? score.away : null,
    result: finished ? resultCode(score.home, score.away) : null,
    competition_stage: stage,
    format_era: isUcl ? uclFormatEra(Number(match.leagueSeason ?? dateOnly(kickoff).slice(0, 4))) : null,
    leg: null,
    neutral_venue: stage === "final",
    market_home_odds: null,
    market_draw_odds: null,
    market_away_odds: null,
    over_25_odds: null,
    under_25_odds: null,
    source_last_modified: providerTimestamp(match.lastUpdateDateTime),
    source_payload: {
      providerMatchId: match.matchID,
      leagueShortcut: match.leagueShortcut ?? null,
      group: match.group?.groupName ?? null,
      homeProviderName,
      awayProviderName,
      homeShortName: providerShortName(match.team1),
      awayShortName: providerShortName(match.team2),
      homeCrest: match.team1.teamIconUrl ?? null,
      awayCrest: match.team2.teamIconUrl ?? null,
      homeProviderId: match.team1.teamId ?? null,
      awayProviderId: match.team2.teamId ?? null,
    },
  };
}

function inWindow(fixture, dateFrom, dateTo) {
  return fixture.match_date >= dateFrom && fixture.match_date <= dateTo;
}

async function footballDataFeed({ leagueCode, dateFrom, dateTo, client }) {
  const providerCode = configuredCode(FOOTBALL_DATA_ORG_SOURCE_KEY, leagueCode);
  if (!providerCode) return { available: false, reason: "not configured" };
  const payload = await client.competitionMatches(providerCode, { dateFrom, dateTo });
  const transform = leagueCode === UCL_COMPETITION_CODE
    ? transformFootballDataOrgMatch
    : (match) => transformFootballDataDomesticMatch(match, leagueCode);
  return {
    available: true,
    fixtures: (payload.matches ?? []).map(transform).filter(Boolean),
    provider: FOOTBALL_DATA_ORG_SOURCE_KEY,
    providerName: PROVIDER_LABELS[FOOTBALL_DATA_ORG_SOURCE_KEY],
  };
}

async function openLigaFeed({ leagueCode, dateFrom, dateTo, seasonStarts, client }) {
  const shortcut = configuredCode(OPENLIGADB_SOURCE_KEY, leagueCode);
  if (!shortcut) return { available: false, reason: "not configured" };
  const payloads = [];
  for (const seasonStart of seasonStarts) {
    const payload = await client.seasonMatches(shortcut, seasonStart);
    payloads.push(...(Array.isArray(payload) ? payload : []));
  }
  return {
    available: true,
    fixtures: payloads.map((match) => transformOpenLigaDbMatch(match, leagueCode))
      .filter(Boolean).filter((fixture) => inWindow(fixture, dateFrom, dateTo)),
    provider: OPENLIGADB_SOURCE_KEY,
    providerName: PROVIDER_LABELS[OPENLIGADB_SOURCE_KEY],
  };
}

function seasonStartsInWindow(dateFrom, dateTo) {
  const starts = new Set();
  for (const date of [dateFrom, dateTo]) {
    const [year, month] = date.split("-").map(Number);
    starts.add(month >= 7 ? year : year - 1);
  }
  return [...starts].sort();
}

export async function fetchProviderFixtures({
  now = new Date(),
  days = 14,
  pastDays = 7,
  leagueCodes = [...Object.keys(FOOTBALL_DATA_LEAGUES), UCL_COMPETITION_CODE],
  footballDataUkFixtureFetcher = fetchFixtureFeed,
  footballDataUkResultFetcher = fetchResultFeed,
  footballDataClient,
  openLigaClient,
} = {}) {
  const dateFrom = offsetDate(now, -pastDays);
  const dateTo = offsetDate(now, days);
  const primary = footballDataClient ?? (process.env.FOOTBALL_DATA_ORG_API_KEY ? new FootballDataOrgClient() : null);
  const fallback = openLigaClient ?? new OpenLigaDbClient();
  const fixtures = [];
  const sources = [];
  const unavailable = [];
  const errors = [];
  const seasonStarts = seasonStartsInWindow(dateFrom, dateTo);

  const domesticCodes = leagueCodes
    .map((code) => String(code).trim().toUpperCase())
    .filter((code) => code !== UCL_COMPETITION_CODE && FOOTBALL_DATA_LEAGUES[code]);
  let ukFixtureFeed = null;
  if (domesticCodes.length && footballDataUkFixtureFetcher) {
    try {
      ukFixtureFeed = await footballDataUkFixtureFetcher({ now, days });
    } catch (error) {
      errors.push({
        leagueCode: "DOMESTIC",
        provider: FIXTURE_SOURCE_KEY,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const rawCode of leagueCodes) {
    const leagueCode = String(rawCode).trim().toUpperCase();
    const selected = new Map();

    if (leagueCode !== UCL_COMPETITION_CODE && FOOTBALL_DATA_LEAGUES[leagueCode]) {
      const scheduled = (ukFixtureFeed?.fixtures ?? []).filter((fixture) => fixture.league_code === leagueCode);
      const finished = [];
      let resultsAvailable = Boolean(footballDataUkResultFetcher);

      if (footballDataUkResultFetcher) {
        for (const seasonStart of seasonStarts) {
          try {
            const resultFeed = await footballDataUkResultFetcher({
              leagueCode,
              seasonStart,
              dateFrom,
              dateTo,
            });
            if (resultFeed.unavailable) resultsAvailable = false;
            finished.push(...(resultFeed.fixtures ?? []));
          } catch (error) {
            resultsAvailable = false;
            errors.push({
              leagueCode,
              provider: RESULT_SOURCE_KEY,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      for (const fixture of [...finished, ...scheduled]) {
        selected.set(fixture.canonical_fixture_key, fixture);
      }
      if (ukFixtureFeed || resultsAvailable) {
        sources.push({
          leagueCode,
          provider: FIXTURE_SOURCE_KEY,
          providerName: PROVIDER_LABELS[FIXTURE_SOURCE_KEY],
          fixtures: scheduled.length,
          results: finished.length,
        });
      }

      const needsScheduledFallback = !ukFixtureFeed || scheduled.length === 0;
      const needsResultFallback = !resultsAvailable;
      let fallbackSelected = false;
      if ((needsScheduledFallback || needsResultFallback) && primary && configuredCode(FOOTBALL_DATA_ORG_SOURCE_KEY, leagueCode)) {
        try {
          const feed = await footballDataFeed({ leagueCode, dateFrom, dateTo, client: primary });
          const supplements = feed.fixtures.filter((fixture) => (
            (needsScheduledFallback && fixture.status === "scheduled")
            || (needsResultFallback && fixture.status === "finished")
          ));
          for (const fixture of supplements) {
            if (!selected.has(fixture.canonical_fixture_key)) selected.set(fixture.canonical_fixture_key, fixture);
          }
          sources.push({
            leagueCode,
            provider: feed.provider,
            providerName: feed.providerName,
            fixtures: supplements.filter((fixture) => fixture.status === "scheduled").length,
            results: supplements.filter((fixture) => fixture.status === "finished").length,
            fallback: true,
          });
          fallbackSelected = true;
        } catch (error) {
          errors.push({ leagueCode, provider: FOOTBALL_DATA_ORG_SOURCE_KEY, message: error instanceof Error ? error.message : String(error) });
        }
      }

      if ((needsScheduledFallback || needsResultFallback) && !fallbackSelected && configuredCode(OPENLIGADB_SOURCE_KEY, leagueCode)) {
        try {
          const feed = await openLigaFeed({ leagueCode, dateFrom, dateTo, seasonStarts, client: fallback });
          const supplements = feed.fixtures.filter((fixture) => (
            (needsScheduledFallback && fixture.status === "scheduled")
            || (needsResultFallback && fixture.status === "finished")
          ));
          for (const fixture of supplements) {
            if (!selected.has(fixture.canonical_fixture_key)) selected.set(fixture.canonical_fixture_key, fixture);
          }
          sources.push({
            leagueCode,
            provider: feed.provider,
            providerName: feed.providerName,
            fixtures: supplements.filter((fixture) => fixture.status === "scheduled").length,
            results: supplements.filter((fixture) => fixture.status === "finished").length,
            fallback: true,
          });
          fallbackSelected = true;
        } catch (error) {
          errors.push({ leagueCode, provider: OPENLIGADB_SOURCE_KEY, message: error instanceof Error ? error.message : String(error) });
        }
      }

      if (!ukFixtureFeed && !resultsAvailable && !fallbackSelected) unavailable.push(leagueCode);
      fixtures.push(...selected.values());
      continue;
    }

    let feed = null;
    if (primary && configuredCode(FOOTBALL_DATA_ORG_SOURCE_KEY, leagueCode)) {
      try {
        feed = await footballDataFeed({ leagueCode, dateFrom, dateTo, client: primary });
      } catch (error) {
        errors.push({ leagueCode, provider: FOOTBALL_DATA_ORG_SOURCE_KEY, message: error instanceof Error ? error.message : String(error) });
      }
    }
    if (!feed && configuredCode(OPENLIGADB_SOURCE_KEY, leagueCode)) {
      try {
        feed = await openLigaFeed({ leagueCode, dateFrom, dateTo, seasonStarts, client: fallback });
      } catch (error) {
        errors.push({ leagueCode, provider: OPENLIGADB_SOURCE_KEY, message: error instanceof Error ? error.message : String(error) });
      }
    }
    if (!feed) {
      unavailable.push(leagueCode);
      continue;
    }
    fixtures.push(...feed.fixtures);
    sources.push({
      leagueCode,
      provider: feed.provider,
      providerName: feed.providerName,
      fixtures: feed.fixtures.filter((fixture) => fixture.status === "scheduled").length,
      results: feed.fixtures.filter((fixture) => fixture.status === "finished").length,
    });
  }

  return {
    fixtures: fixtures.sort((left, right) => left.kickoff_at.localeCompare(right.kickoff_at)),
    sources,
    unavailable,
    errors,
    dateFrom,
    dateTo,
  };
}

async function loadPaged(supabase, table, columns, mutate = (query) => query) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await mutate(supabase.from(table).select(columns)).range(offset, offset + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function bestExistingTeam(fixture, side, candidates) {
  const providerName = fixture.source_payload[`${side}ProviderName`];
  const shortName = fixture.source_payload[`${side}ShortName`];
  const ranked = candidates.map((team) => ({
    team,
    score: Math.max(
      teamNameMatchScore(providerName, team.display_name),
      shortName ? teamNameMatchScore(shortName, team.display_name) : 0,
    ),
  })).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 0.9) return null;
  if (second && best.score < 0.98 && best.score - second.score < 0.06) return null;
  return best.team;
}

async function resolveFixtureTeams(supabase, fixtures) {
  if (!fixtures.length) return fixtures;
  const existingTeams = await loadPaged(supabase, "ai_teams", "canonical_key,display_name,country_code");
  const aliases = await loadPaged(
    supabase,
    "ai_team_aliases",
    "provider,country_code,provider_name,canonical_key",
    (query) => query.in("provider", [
      FIXTURE_SOURCE_KEY,
      RESULT_SOURCE_KEY,
      FOOTBALL_DATA_ORG_SOURCE_KEY,
      OPENLIGADB_SOURCE_KEY,
    ]),
  );
  const teamByKey = new Map(existingTeams.map((team) => [team.canonical_key, team]));
  const teamsByCountry = new Map();
  for (const team of existingTeams) {
    const rows = teamsByCountry.get(team.country_code) ?? [];
    rows.push(team);
    teamsByCountry.set(team.country_code, rows);
  }
  const aliasByName = new Map(aliases.map((alias) => [
    [alias.provider, alias.country_code, alias.provider_name].join("|"),
    alias.canonical_key,
  ]));

  return fixtures.map((fixture) => {
    if (fixture.league_code === UCL_COMPETITION_CODE) return fixture;
    const resolved = { ...fixture, source_payload: { ...fixture.source_payload } };
    for (const side of ["home", "away"]) {
      const providerName = fixture.source_payload[`${side}ProviderName`];
      const aliasKey = [fixture.source_key, fixture.country_code, providerName].join("|");
      const aliased = teamByKey.get(aliasByName.get(aliasKey));
      const existing = aliased ?? bestExistingTeam(fixture, side, teamsByCountry.get(fixture.country_code) ?? []);
      if (existing) {
        resolved[`${side}_team_key`] = existing.canonical_key;
        resolved[`${side}_team_name`] = existing.display_name;
      }
    }
    if (resolved.home_team_key === resolved.away_team_key) return fixture;
    resolved.canonical_fixture_key = [
      resolved.league_code,
      resolved.match_date,
      resolved.home_team_key,
      resolved.away_team_key,
    ].join("|");
    return resolved;
  });
}

function teamsFrom(fixtures) {
  const teams = new Map();
  for (const fixture of fixtures) {
    for (const side of ["home", "away"]) {
      const key = fixture[`${side}_team_key`];
      const countryCode = key.split(":")[1] ?? fixture.country_code;
      const providerName = fixture.source_payload[`${side}ProviderName`] ?? fixture[`${side}_team_name`];
      teams.set(key, {
        canonical_key: key,
        display_name: fixture[`${side}_team_name`],
        country_code: countryCode,
        metadata: {
          provider: fixture.source_key,
          providerId: fixture.source_payload[`${side}ProviderId`] ?? null,
          providerName,
          crest: fixture.source_payload[`${side}Crest`] ?? null,
        },
      });
    }
  }
  return [...teams.values()];
}

function aliasesFrom(fixtures) {
  const aliases = new Map();
  for (const fixture of fixtures) {
    for (const side of ["home", "away"]) {
      for (const name of [
        fixture.source_payload[`${side}ProviderName`],
        fixture.source_payload[`${side}ShortName`],
      ].filter(Boolean)) {
        const row = {
          provider: fixture.source_key,
          country_code: fixture[`${side}_team_key`].split(":")[1] ?? fixture.country_code,
          provider_name: name,
          canonical_key: fixture[`${side}_team_key`],
        };
        aliases.set([row.provider, row.country_code, row.provider_name].join("|"), row);
      }
    }
  }
  return [...aliases.values()];
}

async function upsertBatches(supabase, table, rows, onConflict, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export function mergeStoredFixture(current, fixture) {
  if (!current) return fixture;
  if (current.status === "finished" && fixture.status !== "finished") return null;
  const estimatedTime = Boolean(fixture.source_payload?.timeEstimated);
  return {
    ...fixture,
    id: current.id,
    // Preserve the identity and prediction foreign key of the first stored
    // source while allowing a later provider to complete the same match.
    source_fixture_key: current.source_fixture_key,
    source_key: current.source_key,
    provider_fixture_id: current.provider_fixture_id ?? fixture.provider_fixture_id,
    kickoff_time: estimatedTime ? current.kickoff_time : fixture.kickoff_time,
    kickoff_at: estimatedTime ? current.kickoff_at : fixture.kickoff_at,
    source_timezone: estimatedTime ? current.source_timezone : fixture.source_timezone,
    market_home_odds: fixture.market_home_odds ?? current.market_home_odds,
    market_draw_odds: fixture.market_draw_odds ?? current.market_draw_odds,
    market_away_odds: fixture.market_away_odds ?? current.market_away_odds,
    over_25_odds: fixture.over_25_odds ?? current.over_25_odds,
    under_25_odds: fixture.under_25_odds ?? current.under_25_odds,
    source_payload: {
      ...(current.source_payload ?? {}),
      ...(fixture.source_payload ?? {}),
      resultProvider: fixture.status === "finished" ? fixture.source_key : undefined,
    },
  };
}

async function upsertFixtures(supabase, fixtures, dateFrom, dateTo) {
  if (!fixtures.length) return [];
  const existing = await loadPaged(
    supabase,
    "ai_fixtures",
    "id,source_fixture_key,canonical_fixture_key,source_key,provider_fixture_id,status,kickoff_time,kickoff_at,source_timezone,source_payload,market_home_odds,market_draw_odds,market_away_odds,over_25_odds,under_25_odds",
    (query) => query.or(`status.eq.scheduled,match_date.gte.${dateFrom}`),
  );
  const bySource = new Map(existing.map((row) => [row.source_fixture_key, row]));
  const byCanonical = new Map(existing.filter((row) => row.canonical_fixture_key).map((row) => [row.canonical_fixture_key, row]));
  const matched = [];
  const fresh = [];
  for (const fixture of fixtures) {
    const current = bySource.get(fixture.source_fixture_key) ?? byCanonical.get(fixture.canonical_fixture_key);
    if (current) {
      const merged = mergeStoredFixture(current, fixture);
      if (merged) matched.push(merged);
    }
    else fresh.push(fixture);
  }
  await upsertBatches(supabase, "ai_fixtures", matched, "id");
  await upsertBatches(supabase, "ai_fixtures", fresh, "canonical_fixture_key");
  const leagueCodes = [...new Set(fixtures.map((fixture) => fixture.league_code))];
  return loadPaged(
    supabase,
    "ai_fixtures",
    "*",
    (query) => query.in("league_code", leagueCodes).gte("match_date", dateFrom).lte("match_date", dateTo),
  );
}

export async function syncProviderFixtures(supabase, options = {}) {
  const feed = await fetchProviderFixtures(options);
  const fixtures = await resolveFixtureTeams(supabase, feed.fixtures);
  const teams = teamsFrom(fixtures);
  const aliases = aliasesFrom(fixtures);
  await upsertBatches(supabase, "ai_teams", teams, "canonical_key");
  await upsertBatches(supabase, "ai_team_aliases", aliases, "provider,country_code,provider_name");
  const storedFixtures = await upsertFixtures(supabase, fixtures, feed.dateFrom, feed.dateTo);
  return { ...feed, fixtures, storedFixtures, teams: teams.length };
}

export function providerSummary(feed) {
  return feed.sources.map((source) => (
    `${source.leagueCode}: ${source.providerName}${source.fallback ? " fallback" : ""} (${source.fixtures ?? 0} fixtures, ${source.results ?? 0} results)`
  )).join(", ") || "none";
}
