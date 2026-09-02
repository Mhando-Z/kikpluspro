import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_MODEL_KEY,
  BIG_FIVE_COMPETITION_CODES,
  DOMESTIC_EXPANSION_CODES,
  EXPANSION_MODEL_KEY,
  modelFamilyForKey,
  modelKeyForCompetition,
} from "../../lib/football-ai/constants.js";

test("domestic model families have non-overlapping competition scopes", () => {
  const overlap = BIG_FIVE_COMPETITION_CODES.filter((code) => DOMESTIC_EXPANSION_CODES.includes(code));
  assert.deepEqual(overlap, []);
  assert.deepEqual(modelFamilyForKey(AI_MODEL_KEY).competitionCodes, BIG_FIVE_COMPETITION_CODES);
  assert.deepEqual(modelFamilyForKey(EXPANSION_MODEL_KEY).competitionCodes, DOMESTIC_EXPANSION_CODES);
});

test("every domestic competition routes to exactly one expected family", () => {
  for (const code of BIG_FIVE_COMPETITION_CODES) {
    assert.equal(modelKeyForCompetition(code), AI_MODEL_KEY);
  }
  for (const code of DOMESTIC_EXPANSION_CODES) {
    assert.equal(modelKeyForCompetition(code), EXPANSION_MODEL_KEY);
  }
});
