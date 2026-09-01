import assert from "node:assert/strict";
import test from "node:test";
import { transformFootballDataOrgMatch, uclFixtureToTrainingMatch } from "../../lib/football-ai/ucl-fixtures.js";

const base = {
  id: 12345,
  utcDate: "2026-09-16T19:00:00Z",
  status: "TIMED",
  stage: "LEAGUE_STAGE",
  matchday: 1,
  season: { startDate: "2026-07-01" },
  homeTeam: { id: 65, name: "Manchester City FC", crest: "https://crests.example/city.svg", area: { code: "ENG" } },
  awayTeam: { id: 4, name: "AFC Ajax", crest: "https://crests.example/ajax.svg", area: { code: "NED" } },
  score: { fullTime: { home: null, away: null } },
  lastUpdated: "2026-09-01T12:00:00Z",
};

test("Football-Data.org fixture transform preserves provider crests and UCL context", () => {
  const fixture = transformFootballDataOrgMatch(base);
  assert.equal(fixture.league_code, "CL");
  assert.equal(fixture.competition_stage, "league_phase");
  assert.equal(fixture.home_team_key, "football-data:england:man-city");
  assert.equal(fixture.away_team_key, "uefa:netherlands:afc-ajax");
  assert.equal(fixture.source_payload.homeCrest, "https://crests.example/city.svg");
  assert.equal(fixture.home_goals, null);
});

test("finished UCL fixtures become rolling training results", () => {
  const fixture = transformFootballDataOrgMatch({
    ...base,
    status: "FINISHED",
    score: { fullTime: { home: 2, away: 1 } },
  });
  const match = uclFixtureToTrainingMatch(fixture);
  assert.equal(match.result, "H");
  assert.equal(match.home_goals, 2);
  assert.equal(match.provider_match_id, "12345");
});

test("knockout settlement uses the 90-minute score instead of extra time", () => {
  const fixture = transformFootballDataOrgMatch({
    ...base,
    status: "FINISHED",
    score: {
      duration: "EXTRA_TIME",
      fullTime: { home: 2, away: 1 },
      regularTime: { home: 1, away: 1 },
    },
  });
  assert.equal(fixture.result, "D");
  assert.equal(fixture.home_goals, 1);
  assert.equal(fixture.away_goals, 1);
});
