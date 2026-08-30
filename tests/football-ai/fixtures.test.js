import assert from "node:assert/strict";
import test from "node:test";
import {
  parseFixtureFeed,
  seasonStartForDate,
  zonedLocalToUtc,
} from "../../lib/football-ai/fixtures.js";

test("UK fixture times are converted to UTC across daylight saving", () => {
  assert.equal(zonedLocalToUtc("2026-08-30", "16:30"), "2026-08-30T15:30:00.000Z");
  assert.equal(zonedLocalToUtc("2027-01-10", "15:00"), "2027-01-10T15:00:00.000Z");
});

test("season start follows the European campaign boundary", () => {
  assert.equal(seasonStartForDate("2026-08-30"), 2026);
  assert.equal(seasonStartForDate("2027-03-10"), 2026);
});

test("fixture feed keeps supported leagues, dates and market prices", () => {
  const csv = [
    "Div,Date,Time,HomeTeam,AwayTeam,AvgCH,AvgCD,AvgCA,AvgC>2.5,AvgC<2.5",
    "E0,30/08/2026,16:30,Arsenal,Chelsea,1.80,3.60,4.70,1.92,1.88",
    "B1,30/08/2026,18:00,Club Brugge,Genk,2.10,3.40,3.20,1.80,2.00",
    "SP1,20/09/2026,20:00,Barcelona,Valencia,1.30,5.50,9.00,1.50,2.50",
  ].join("\n");
  const fixtures = parseFixtureFeed(csv, {
    now: new Date("2026-08-29T12:00:00Z"),
    days: 14,
    sourceLastModified: "2026-08-28T15:00:00.000Z",
  });

  assert.equal(fixtures.length, 1);
  assert.equal(fixtures[0].league_code, "E0");
  assert.equal(fixtures[0].season_start, 2026);
  assert.equal(fixtures[0].kickoff_at, "2026-08-30T15:30:00.000Z");
  assert.equal(fixtures[0].market_home_odds, 1.8);
  assert.equal(fixtures[0].over_25_odds, 1.92);
  assert.match(fixtures[0].source_fixture_key, /arsenal.*chelsea/);
});
