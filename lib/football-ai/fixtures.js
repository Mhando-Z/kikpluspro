import { FOOTBALL_DATA_LEAGUES, canonicalTeamKey } from "./constants.js";
import { csvNumber, normalizeFootballDate, parseCsv } from "./csv.js";

export const FIXTURE_SOURCE_KEY = "football-data-fixtures";
export const DEFAULT_FIXTURE_FEED_URL = "https://www.football-data.co.uk/fixtures.csv";

function firstValue(...values) {
  return values.find((value) => String(value ?? "").trim() !== "");
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

  return {
    source_fixture_key: [FIXTURE_SOURCE_KEY, league.code, matchDate, time, homeKey, awayKey].join(":"),
    source_key: FIXTURE_SOURCE_KEY,
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
    },
  };
}

export function parseFixtureFeed(text, {
  now = new Date(),
  days = 14,
  sourceLastModified = null,
} = {}) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Number(days));

  return parseCsv(text)
    .map((row) => fixtureFromRow(row, sourceLastModified))
    .filter(Boolean)
    .filter((fixture) => {
      const kickoff = new Date(fixture.kickoff_at);
      return kickoff >= start && kickoff < end;
    })
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
  now = new Date(),
  days = 14,
} = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "user-agent": "KickPulse-Football-AI/1.2" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  const lastModifiedHeader = response.headers.get("last-modified");
  const sourceLastModified = lastModifiedHeader && !Number.isNaN(Date.parse(lastModifiedHeader))
    ? new Date(lastModifiedHeader).toISOString()
    : null;
  const fixtures = parseFixtureFeed(await response.text(), { now, days, sourceLastModified });
  return { fixtures, sourceLastModified, url };
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
