import assert from "node:assert/strict";
import test from "node:test";
import {
  csvInteger,
  csvNumber,
  normalizeFootballDate,
  parseCsv,
} from "../../lib/football-ai/csv.js";
import { canonicalTeamKey, seasonToken } from "../../lib/football-ai/constants.js";

test("CSV parser preserves quoted commas and escaped quotes", () => {
  const rows = parseCsv('Date,HomeTeam,Note\n29/08/26,"Brighton, Hove","Won ""late"""\n');
  assert.deepEqual(rows, [{ Date: "29/08/26", HomeTeam: "Brighton, Hove", Note: 'Won "late"' }]);
});

test("football dates normalize two and four digit years", () => {
  assert.equal(normalizeFootballDate("01/09/24"), "2024-09-01");
  assert.equal(normalizeFootballDate("31/12/1999"), "1999-12-31");
  assert.equal(normalizeFootballDate("2025-05-17"), "2025-05-17");
});

test("numeric helpers reject missing or malformed values", () => {
  assert.equal(csvNumber("2.45"), 2.45);
  assert.equal(csvNumber(""), null);
  assert.equal(csvNumber("unknown"), null);
  assert.equal(csvInteger("7.9"), 7);
});

test("season and team identifiers are deterministic", () => {
  assert.equal(seasonToken(2025), "2526");
  assert.equal(canonicalTeamKey("spain", "Atlético Madrid"), "football-data:spain:atletico-madrid");
});

