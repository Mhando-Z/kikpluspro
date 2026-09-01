import assert from "node:assert/strict";
import test from "node:test";
import { fetchStatsApiUclFixtures, transformStatsApiUclMatch } from "../../lib/thestatsapi/ucl-fixtures.js";

const scheduledMatch = {
  id: "mt_ucl_1",
  utc_date: "2026-09-16T19:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
  status: "not_started",
  stage: "LEAGUE_STAGE",
  competition_id: "comp_ucl",
  season_id: "season_2026",
  season: { start_year: 2026 },
  home_team: {
    id: "tm_city",
    name: "Manchester City FC",
    country_code: "ENG",
    logo_url: "https://logos.example/city.svg",
  },
  away_team: {
    id: "tm_ajax",
    name: "AFC Ajax",
    country_code: "NED",
    logo_url: "https://logos.example/ajax.svg",
  },
  score: { home: null, away: null },
};

test("TheStatsAPI UCL transform creates a provider-neutral canonical fixture", () => {
  const fixture = transformStatsApiUclMatch(scheduledMatch);
  assert.equal(fixture.source_key, "thestatsapi");
  assert.equal(fixture.canonical_fixture_key, "CL|2026-09-16|football-data:england:man-city|uefa:netherlands:afc-ajax");
  assert.equal(fixture.competition_stage, "league_phase");
  assert.equal(fixture.source_payload.homeCrest, "https://logos.example/city.svg");
  assert.equal(fixture.home_goals, null);
});

test("TheStatsAPI UCL feed discovers the competition, season and requested date window", async () => {
  const calls = [];
  const client = {
    metrics: { requests: 3 },
    paginate: async (path, query = {}) => {
      calls.push({ path, query });
      if (path === "/football/competitions") return [{ id: "comp_ucl", name: "UEFA Champions League", country: "Europe" }];
      return [
        scheduledMatch,
        { ...scheduledMatch, id: "mt_too_late", utc_date: "2026-10-20T19:00:00Z" },
      ];
    },
    get: async (path) => {
      calls.push({ path });
      return { data: [{ id: "season_2026", start_year: 2026 }] };
    },
  };
  const feed = await fetchStatsApiUclFixtures({
    now: new Date("2026-09-01T10:00:00Z"),
    days: 20,
    client,
  });
  assert.equal(feed.providerName, "TheStatsAPI");
  assert.equal(feed.fixtures.length, 1);
  assert.equal(feed.fixtures[0].provider_fixture_id, "mt_ucl_1");
  assert.deepEqual(calls.at(-1), {
    path: "/football/matches",
    query: { competition_id: "comp_ucl", season_id: "season_2026" },
  });
});
