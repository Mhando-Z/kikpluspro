import { FOOTBALL_DATA_LEAGUES, canonicalTeamKey, seasonToken } from "./constants.js";
import { csvInteger, csvNumber, normalizeFootballDate, parseCsv } from "./csv.js";

export const FIXTURE_SOURCE_KEY = "football-data-fixtures";
export const RESULT_SOURCE_KEY = "football-data-uk";
export const DEFAULT_FIXTURE_FEED_URL = "https://www.football-data.co.uk/fixtures.csv";
export const DEFAULT_RESULT_FEED_BASE_URL = "https://www.football-data.co.uk/mmz4281";

const REQUIRED_FIXTURE_HEADERS = ["Div", "Date", "Time", "HomeTeam", "AwayTeam"];
const REQUIRED_RESULT_HEADERS = ["Div", "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR"];

function firstValue(...values) {
  return values.find((value) => String(value ?? "").trim() !== "");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function hasCsvHeaders(text, required) {
  const headers = String(text).replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0]
    .split(",").map((header) => header.replace(/^"|"$/g, "").trim());
  return required.every((header) => headers.includes(header));
}

function decodeCsv(buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
}

async function fetchCsv(url, {
  fetchImpl = fetch,
  maxRetries = 2,
  requiredHeaders,
} = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        cache: "no-store",
        headers: {
          accept: "text/csv,text/plain;q=0.9,*/*;q=0.1",
          "user-agent": "KickPulse-Football-AI/1.13",
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await wait(500 * (2 ** attempt));
      continue;
    }

    if (response.status === 404) return { unavailable: true, response, text: "" };
    if (!response.ok) {
      if (attempt === maxRetries || (response.status < 500 && response.status !== 429)) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
      }
      await wait(500 * (2 ** attempt));
      continue;
    }

    const text = decodeCsv(await response.arrayBuffer());
    if (!hasCsvHeaders(text, requiredHeaders)) {
      throw new Error(`Invalid Football-Data.co.uk CSV headers for ${url}`);
    }
    return { unavailable: false, response, text };
  }
  throw new Error(`Football-Data.co.uk request failed after retrying: ${url}`);
}

function responseLastModified(response) {
  const value = response?.headers?.get?.("last-modified");
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function partsInTimezone(date, timezone) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

export function zonedLocalToUtc(date, time, timezone = "Europe/London") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid fixture date or time: ${date} ${time}`);
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = partsInTimezone(new Date(guess), timezone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    guess += target - observedAsUtc;
  }
  return new Date(guess).toISOString();
}

export function seasonStartForDate(date) {
  const [year, month] = date.split("-").map(Number);
  return month >= 7 ? year : year - 1;
}

function fixtureFromRow(row, sourceLastModified) {
  const league = FOOTBALL_DATA_LEAGUES[String(row.Div ?? "").trim().toUpperCase()];
  if (!league || !row.Date || !row.Time || !row.HomeTeam || !row.AwayTeam) return null;
  const matchDate = normalizeFootballDate(row.Date);
  const time = String(row.Time).trim().padStart(5, "0");
  const homeName = String(row.HomeTeam).trim();
  const awayName = String(row.AwayTeam).trim();
  const homeKey = canonicalTeamKey(league.countryCode, homeName);
  const awayKey = canonicalTeamKey(league.countryCode, awayName);
  const kickoffAt = zonedLocalToUtc(matchDate, time);
  const canonicalFixtureKey = [league.code, matchDate, homeKey, awayKey].join("|");

  return {
    source_fixture_key: [FIXTURE_SOURCE_KEY, league.code, matchDate, time, homeKey, awayKey].join(":"),
    canonical_fixture_key: canonicalFixtureKey,
    source_key: FIXTURE_SOURCE_KEY,
    provider_fixture_id: canonicalFixtureKey,
    league_code: league.code,
    league_name: league.name,
    country_code: league.countryCode,
    season_start: seasonStartForDate(matchDate),
    match_date: matchDate,
    kickoff_time: `${time}:00`,
    source_timezone: "Europe/London",
    kickoff_at: kickoffAt,
    home_team_key: homeKey,
    away_team_key: awayKey,
    home_team_name: homeName,
    away_team_name: awayName,
    status: "scheduled",
    home_goals: null,
    away_goals: null,
    result: null,
    competition_stage: null,
    format_era: null,
    leg: null,
    neutral_venue: false,
    market_home_odds: csvNumber(firstValue(row.AvgCH, row.AvgH, row.B365CH, row.B365H)),
    market_draw_odds: csvNumber(firstValue(row.AvgCD, row.AvgD, row.B365CD, row.B365D)),
    market_away_odds: csvNumber(firstValue(row.AvgCA, row.AvgA, row.B365CA, row.B365A)),
    over_25_odds: csvNumber(firstValue(row["AvgC>2.5"], row["Avg>2.5"], row["B365C>2.5"], row["B365>2.5"])),
    under_25_odds: csvNumber(firstValue(row["AvgC<2.5"], row["Avg<2.5"], row["B365C<2.5"], row["B365<2.5"])),
    source_last_modified: sourceLastModified,
    source_payload: {
      division: row.Div,
      sourceDate: row.Date,
      sourceTime: row.Time,
      homeProviderName: homeName,
      awayProviderName: awayName,
      homeShortName: homeName,
      awayShortName: awayName,
    },
  };
}

function resultFixtureFromRow(row, league, seasonStart, sourceLastModified) {
  if (!row.Date || !row.HomeTeam || !row.AwayTeam || !["H", "D", "A"].includes(row.FTR)) return null;
  const homeGoals = csvInteger(row.FTHG);
  const awayGoals = csvInteger(row.FTAG);
  if (homeGoals === null || awayGoals === null) return null;

  const matchDate = normalizeFootballDate(row.Date);
  const sourceTime = /^\d{1,2}:\d{2}$/.test(String(row.Time ?? "").trim())
    ? String(row.Time).trim().padStart(5, "0")
    : "12:00";
  const homeName = String(row.HomeTeam).trim();
  const awayName = String(row.AwayTeam).trim();
  const homeKey = canonicalTeamKey(league.countryCode, homeName);
  const awayKey = canonicalTeamKey(league.countryCode, awayName);
  const canonicalFixtureKey = [league.code, matchDate, homeKey, awayKey].join("|");

  return {
    source_fixture_key: [RESULT_SOURCE_KEY, league.code, seasonStart, matchDate, homeKey, awayKey].join(":"),
    canonical_fixture_key: canonicalFixtureKey,
    source_key: RESULT_SOURCE_KEY,
    provider_fixture_id: canonicalFixtureKey,
    league_code: league.code,
    league_name: league.name,
    country_code: league.countryCode,
    season_start: seasonStart,
    match_date: matchDate,
    kickoff_time: `${sourceTime}:00`,
    source_timezone: "Europe/London",
    kickoff_at: zonedLocalToUtc(matchDate, sourceTime),
    home_team_key: homeKey,
    away_team_key: awayKey,
    home_team_name: homeName,
    away_team_name: awayName,
    status: "finished",
    home_goals: homeGoals,
    away_goals: awayGoals,
    result: row.FTR,
    competition_stage: null,
    format_era: null,
    leg: null,
    neutral_venue: false,
    market_home_odds: csvNumber(firstValue(row.AvgCH, row.AvgH, row.B365CH, row.B365H)),
    market_draw_odds: csvNumber(firstValue(row.AvgCD, row.AvgD, row.B365CD, row.B365D)),
    market_away_odds: csvNumber(firstValue(row.AvgCA, row.AvgA, row.B365CA, row.B365A)),
    over_25_odds: csvNumber(firstValue(row["AvgC>2.5"], row["Avg>2.5"], row["B365C>2.5"], row["B365>2.5"])),
    under_25_odds: csvNumber(firstValue(row["AvgC<2.5"], row["Avg<2.5"], row["B365C<2.5"], row["B365<2.5"])),
    source_last_modified: sourceLastModified,
    source_payload: {
      division: row.Div,
      sourceDate: row.Date,
      sourceTime: row.Time || null,
      timeEstimated: !row.Time,
      homeProviderName: homeName,
      awayProviderName: awayName,
      homeShortName: homeName,
      awayShortName: awayName,
    },
  };
}

export function parseFixtureFeed(text, {
  now = new Date(),
  days = 14,
  sourceLastModified = null,
} = {}) {
  const start = new Date(now);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Number(days));

  return parseCsv(text)
    .map((row) => fixtureFromRow(row, sourceLastModified))
    .filter(Boolean)
    .filter((fixture) => {
      const kickoff = new Date(fixture.kickoff_at);
      return kickoff > start && kickoff < end;
    })
    .sort((left, right) => left.kickoff_at.localeCompare(right.kickoff_at));
}

export function parseResultFeed(text, leagueCode, seasonStart, {
  dateFrom = "1900-01-01",
  dateTo = "2200-12-31",
  sourceLastModified = null,
} = {}) {
  const league = FOOTBALL_DATA_LEAGUES[String(leagueCode).trim().toUpperCase()];
  if (!league) throw new Error(`Unsupported Football-Data.co.uk league: ${leagueCode}`);
  return parseCsv(text)
    .map((row) => resultFixtureFromRow(row, league, seasonStart, sourceLastModified))
    .filter(Boolean)
    .filter((fixture) => fixture.match_date >= dateFrom && fixture.match_date <= dateTo)
    .sort((left, right) => left.kickoff_at.localeCompare(right.kickoff_at));
}

function teamsFrom(fixtures) {
  const teams = new Map();
  for (const fixture of fixtures) {
    teams.set(fixture.home_team_key, {
      canonical_key: fixture.home_team_key,
      display_name: fixture.home_team_name,
      country_code: fixture.country_code,
      metadata: { provider: FIXTURE_SOURCE_KEY },
    });
    teams.set(fixture.away_team_key, {
      canonical_key: fixture.away_team_key,
      display_name: fixture.away_team_name,
      country_code: fixture.country_code,
      metadata: { provider: FIXTURE_SOURCE_KEY },
    });
  }
  return [...teams.values()];
}

async function upsertBatches(supabase, table, rows, onConflict, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function fetchFixtureFeed({
  url = process.env.FOOTBALL_DATA_FIXTURES_URL ?? DEFAULT_FIXTURE_FEED_URL,
  now,
  days = 14,
  fetchImpl = fetch,
  maxRetries = 2,
} = {}) {
  const result = await fetchCsv(url, { fetchImpl, maxRetries, requiredHeaders: REQUIRED_FIXTURE_HEADERS });
  if (result.unavailable) throw new Error(`404 Not Found for ${url}`);
  const sourceLastModified = responseLastModified(result.response);
  const fixtures = parseFixtureFeed(result.text, { now, days, sourceLastModified });
  return { fixtures, sourceLastModified, url };
}

export async function fetchResultFeed({
  baseUrl = process.env.FOOTBALL_DATA_BASE_URL ?? DEFAULT_RESULT_FEED_BASE_URL,
  leagueCode,
  seasonStart,
  dateFrom,
  dateTo,
  fetchImpl = fetch,
  maxRetries = 2,
} = {}) {
  const code = String(leagueCode ?? "").trim().toUpperCase();
  if (!FOOTBALL_DATA_LEAGUES[code]) throw new Error(`Unsupported Football-Data.co.uk league: ${leagueCode}`);
  const url = `${String(baseUrl).replace(/\/$/, "")}/${seasonToken(seasonStart)}/${code}.csv`;
  const result = await fetchCsv(url, { fetchImpl, maxRetries, requiredHeaders: REQUIRED_RESULT_HEADERS });
  if (result.unavailable) return { fixtures: [], unavailable: true, sourceLastModified: null, url };
  const sourceLastModified = responseLastModified(result.response);
  return {
    fixtures: parseResultFeed(result.text, code, seasonStart, { dateFrom, dateTo, sourceLastModified }),
    unavailable: false,
    sourceLastModified,
    url,
  };
}

export async function syncFixtureFeed(supabase, options = {}) {
  const feed = await fetchFixtureFeed(options);
  const teams = teamsFrom(feed.fixtures);
  const aliases = teams.map((team) => ({
    provider: FIXTURE_SOURCE_KEY,
    country_code: team.country_code,
    provider_name: team.display_name,
    canonical_key: team.canonical_key,
  }));
  await upsertBatches(supabase, "ai_teams", teams, "canonical_key");
  await upsertBatches(supabase, "ai_team_aliases", aliases, "provider,country_code,provider_name");
  await upsertBatches(supabase, "ai_fixtures", feed.fixtures, "source_fixture_key");
  return { ...feed, teams: teams.length };
}
