import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchProviderFixtures,
  mergeStoredFixture,
  transformFootballDataDomesticMatch,
  transformOpenLigaDbMatch,
} from "../../lib/football-ai/provider-fixtures.js";
import { parseFixtureFeed, parseResultFeed } from "../../lib/football-ai/fixtures.js";

const footballDataMatch = {
  id: 501,
  utcDate: "2026-09-12T14:00:00Z",
  status: "FINISHED",
  matchday: 4,
  season: { startDate: "2026-08-01" },
  homeTeam: { id: 1, name: "Arsenal FC", shortName: "Arsenal", crest: "https://example.test/arsenal.svg" },
  awayTeam: { id: 2, name: "Chelsea FC", shortName: "Chelsea", crest: "https://example.test/chelsea.svg" },
  score: { duration: "REGULAR", fullTime: { home: 2, away: 1 } },
  lastUpdated: "2026-09-12T16:00:00Z",
};

const openLigaMatch = {
  matchID: 901,
  matchDateTimeUTC: "2026-09-13T15:30:00Z",
  leagueSeason: 2026,
  leagueShortcut: "bl1",
  matchIsFinished: true,
  team1: { teamId: 40, teamName: "FC Bayern München", shortName: "Bayern" },
  team2: { teamId: 16, teamName: "VfB Stuttgart", shortName: "Stuttgart" },
  matchResults: [
    { resultTypeKind: "HalfTime", pointsTeam1: 1, pointsTeam2: 0, resultOrderID: 1 },
    { resultTypeKind: "After90Minutes", pointsTeam1: 3, pointsTeam2: 1, resultOrderID: 2 },
  ],
  lastUpdateDateTime: "2026-09-13T17:30:00",
};

test("Football-Data.org domestic matches become provider-neutral canonical fixtures", () => {
  const fixture = transformFootballDataDomesticMatch(footballDataMatch, "E0");
  assert.equal(fixture.source_key, "football-data-org");
  assert.equal(fixture.canonical_fixture_key, "E0|2026-09-12|football-data:england:arsenal|football-data:england:chelsea");
  assert.equal(fixture.status, "finished");
  assert.equal(fixture.result, "H");
  assert.equal(fixture.home_goals, 2);
  assert.equal(fixture.source_payload.homeCrest, "https://example.test/arsenal.svg");
});

test("OpenLigaDB settlement selects the regulation result", () => {
  const fixture = transformOpenLigaDbMatch(openLigaMatch, "D1");
  assert.equal(fixture.source_key, "openligadb");
  assert.equal(fixture.status, "finished");
  assert.equal(fixture.home_goals, 3);
  assert.equal(fixture.away_goals, 1);
  assert.equal(fixture.result, "H");
});

test("provider workflow falls back by competition and reports unsupported leagues", async () => {
  const footballDataClient = {
    async competitionMatches(code) {
      if (code === "BL1") throw new Error("temporary primary failure");
      return { matches: [footballDataMatch] };
    },
  };
  const openLigaClient = {
    async seasonMatches(shortcut) {
      assert.equal(shortcut, "bl1");
      return [openLigaMatch];
    },
  };
  const feed = await fetchProviderFixtures({
    now: new Date("2026-09-10T12:00:00Z"),
    days: 7,
    pastDays: 1,
    leagueCodes: ["E0", "D1", "B1"],
    footballDataUkFixtureFetcher: async () => {
      throw new Error("temporary CSV fixture failure");
    },
    footballDataUkResultFetcher: async () => ({ fixtures: [], unavailable: true }),
    footballDataClient,
    openLigaClient,
  });

  assert.deepEqual(feed.sources.map((source) => [source.leagueCode, source.provider]), [
    ["E0", "football-data-org"],
    ["D1", "openligadb"],
  ]);
  assert.deepEqual(feed.unavailable, ["B1"]);
  assert.equal(feed.errors.length, 2);
  assert.equal(feed.fixtures.length, 2);
});

test("Football-Data.co.uk is primary for domestic fixtures and results", async () => {
  const fixtureCsv = [
    "Div,Date,Time,HomeTeam,AwayTeam,AvgCH,AvgCD,AvgCA",
    "E0,12/09/2026,15:00,Arsenal,Chelsea,1.80,3.60,4.70",
  ].join("\n");
  const resultCsv = [
    "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,AvgCH,AvgCD,AvgCA",
    "E0,09/09/2026,20:00,Fulham,Everton,1,1,D,2.10,3.30,3.60",
  ].join("\n");
  let fallbackCalls = 0;

  const feed = await fetchProviderFixtures({
    now: new Date("2026-09-10T12:00:00Z"),
    days: 7,
    pastDays: 3,
    leagueCodes: ["E0"],
    footballDataUkFixtureFetcher: async () => ({
      fixtures: parseFixtureFeed(fixtureCsv, {
        now: new Date("2026-09-10T12:00:00Z"),
        days: 7,
      }),
    }),
    footballDataUkResultFetcher: async ({ leagueCode, seasonStart, dateFrom, dateTo }) => ({
      fixtures: parseResultFeed(resultCsv, leagueCode, seasonStart, { dateFrom, dateTo }),
      unavailable: false,
    }),
    footballDataClient: {
      async competitionMatches() {
        fallbackCalls += 1;
        return { matches: [] };
      },
    },
    openLigaClient: { async seasonMatches() { return []; } },
  });

  assert.equal(fallbackCalls, 0);
  assert.equal(feed.unavailable.length, 0);
  assert.deepEqual(feed.sources.map((source) => [source.provider, source.fixtures, source.results]), [
    ["football-data-fixtures", 1, 1],
  ]);
  assert.equal(feed.fixtures.length, 2);
  assert.equal(feed.fixtures.find((fixture) => fixture.status === "scheduled").market_home_odds, 1.8);
  assert.equal(feed.fixtures.find((fixture) => fixture.status === "finished").result, "D");
});

test("stored fixture identity survives provider switching and finished matches cannot regress", () => {
  const current = {
    id: "fixture-1",
    source_fixture_key: "football-data-fixtures:E0:fixture-1",
    source_key: "football-data-fixtures",
    provider_fixture_id: "fixture-1",
    status: "scheduled",
    kickoff_time: "15:00:00",
    kickoff_at: "2026-09-12T14:00:00.000Z",
    source_timezone: "Europe/London",
    market_home_odds: 1.8,
    market_draw_odds: 3.6,
    market_away_odds: 4.7,
    over_25_odds: 1.9,
    under_25_odds: 1.9,
    source_payload: { homeCrest: "https://example.test/arsenal.svg" },
  };
  const result = {
    ...current,
    id: undefined,
    source_fixture_key: "football-data-uk:E0:result-1",
    source_key: "football-data-uk",
    provider_fixture_id: "result-1",
    status: "finished",
    result: "H",
    home_goals: 2,
    away_goals: 1,
    market_home_odds: null,
    source_payload: { timeEstimated: true },
  };

  const merged = mergeStoredFixture(current, result);
  assert.equal(merged.id, "fixture-1");
  assert.equal(merged.source_key, "football-data-fixtures");
  assert.equal(merged.status, "finished");
  assert.equal(merged.kickoff_at, current.kickoff_at);
  assert.equal(merged.market_home_odds, 1.8);
  assert.equal(merged.source_payload.homeCrest, "https://example.test/arsenal.svg");
  assert.equal(merged.source_payload.resultProvider, "football-data-uk");
  assert.equal(mergeStoredFixture({ ...current, status: "finished" }, current), null);
});
