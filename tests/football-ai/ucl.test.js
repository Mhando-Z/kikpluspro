import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_MODEL_KEY,
  EXPANSION_MODEL_KEY,
  modelKeyForCompetition,
  UCL_MODEL_KEY,
} from "../../lib/football-ai/constants.js";
import { parseOpenFootballUcl } from "../../lib/football-ai/openfootball.js";
import { canonicalUclTeam } from "../../lib/football-ai/ucl-teams.js";
import { buildPrematchFeatures, createModelState, updateModelWithResult } from "../../lib/football-ai/model.js";

test("the model router isolates Big Five, expansion and UCL competitions", () => {
  assert.equal(modelKeyForCompetition("CL"), UCL_MODEL_KEY);
  assert.equal(modelKeyForCompetition("E0"), AI_MODEL_KEY);
  assert.equal(modelKeyForCompetition("SP1"), AI_MODEL_KEY);
  assert.equal(modelKeyForCompetition("I1"), AI_MODEL_KEY);
  assert.equal(modelKeyForCompetition("D1"), AI_MODEL_KEY);
  assert.equal(modelKeyForCompetition("F1"), AI_MODEL_KEY);
  assert.equal(modelKeyForCompetition("E1"), EXPANSION_MODEL_KEY);
  assert.equal(modelKeyForCompetition("B1"), EXPANSION_MODEL_KEY);
  assert.equal(modelKeyForCompetition("SC0"), EXPANSION_MODEL_KEY);
});

test("UCL team aliases reuse domestic canonical identities", () => {
  assert.equal(canonicalUclTeam("Manchester City FC", "ENG").key, "football-data:england:man-city");
  assert.equal(canonicalUclTeam("FC Bayern München", "GER").key, "football-data:germany:bayern-munich");
  assert.equal(canonicalUclTeam("AFC Ajax", "NED").key, "uefa:netherlands:afc-ajax");
});

test("OpenFootball parser captures stage, season boundary, legs and neutral final", () => {
  const input = `
= UEFA Champions League 2024/25
▪ League, Matchday 1
Tue Sep 17 2024
18:45 Juventus FC (ITA) v PSV (NED) 3-1 (2-0)
▪ Round of 16
Tue Mar 4 2025
Real Madrid CF (ESP) v Arsenal FC (ENG) 1-0 (0-0)
Wed Mar 12 2025
Arsenal FC (ENG) v Real Madrid CF (ESP) 2-0 (1-0)
▪ Final
Sat May 31 2025
Paris Saint-Germain FC (FRA) v FC Internazionale Milano (ITA) 1-1 (4-3 pen.)
`;
  const rows = parseOpenFootballUcl(input, 2024);
  assert.equal(rows.length, 3, "penalty shootout result is excluded because the 90-minute target is ambiguous");
  assert.equal(rows[0].matchDate, "2024-09-17");
  assert.equal(rows[0].formatEra, "league-phase");
  assert.equal(rows[1].stage, "round_of_16");
  assert.equal(rows[1].leg, 1);
  assert.equal(rows[2].leg, 2);
});

test("UCL features learn prior stage context and remove home advantage at neutral venues", () => {
  const state = createModelState({ homeAdvantageElo: 45 });
  const match = {
    league_code: "CL",
    season_start: 2025,
    match_date: "2026-02-10",
    competition_stage: "round_of_16",
    format_era: "league-phase",
    home_team_key: "uefa:netherlands:ajax",
    away_team_key: "uefa:portugal:benfica",
    home_team_name: "Ajax",
    away_team_name: "Benfica",
    home_goals: 2,
    away_goals: 0,
    result: "H",
  };
  updateModelWithResult(state, match);
  const neutral = buildPrematchFeatures(state, {
    ...match,
    match_date: "2026-03-10",
    neutral_venue: true,
  });
  assert.equal(neutral.contextMatchesKnown, 1);
  assert.equal(neutral.neutralVenue, true);
  assert.ok(Math.abs(neutral.eloDifference - (neutral.homeElo - neutral.awayElo)) < 0.02);
});
