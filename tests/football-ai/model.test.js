import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTemperature,
  createModelState,
  evaluateWalkForward,
  fitTemperatureCalibration,
  predictMatch,
  trainModel,
  updateModelWithResult,
} from "../../lib/football-ai/model.js";

function match(index, homeTeam, awayTeam, homeGoals, awayGoals, season = 2022) {
  return {
    id: `match-${index}`,
    source_match_key: `match-${index}`,
    league_code: "E0",
    season_start: season,
    match_date: new Date(Date.UTC(2022, 7, 1 + index)).toISOString().slice(0, 10),
    home_team_key: `football-data:england:${homeTeam.toLowerCase()}`,
    away_team_key: `football-data:england:${awayTeam.toLowerCase()}`,
    home_team_name: homeTeam,
    away_team_name: awayTeam,
    home_goals: homeGoals,
    away_goals: awayGoals,
    result: homeGoals > awayGoals ? "H" : homeGoals === awayGoals ? "D" : "A",
    home_shots: 8 + homeGoals * 2,
    away_shots: 7 + awayGoals * 2,
    home_shots_on_target: 2 + homeGoals,
    away_shots_on_target: 2 + awayGoals,
    home_xg: 0.7 + homeGoals * 0.45,
    away_xg: 0.6 + awayGoals * 0.45,
    closing_home_odds: 2.2,
    closing_draw_odds: 3.3,
    closing_away_odds: 3.5,
  };
}

function sampleMatches() {
  const teams = ["Arsenal", "Chelsea", "Liverpool", "Everton"];
  return Array.from({ length: 36 }, (_, index) => {
    const home = teams[index % teams.length];
    const away = teams[(index + 1 + (index % 2)) % teams.length];
    const homeGoals = (index * 7 + 2) % 4;
    const awayGoals = (index * 5 + 1) % 3;
    return match(index, home, away, homeGoals, awayGoals, index < 24 ? 2022 : 2023);
  });
}

test("training features are captured before the result update", () => {
  const matches = sampleMatches().slice(0, 3);
  const { state, featureRows } = trainModel(matches);
  assert.equal(featureRows[0].features.homeMatchesKnown, 0);
  assert.equal(featureRows[0].features.awayMatchesKnown, 0);
  assert.equal(state.trainedMatches, 3);
  assert.equal(state.leagues.E0.matches, 3);
  assert.equal(state.latestSeasonStart, 2022);
});

test("prediction probabilities form a normalized distribution", () => {
  const { state } = trainModel(sampleMatches());
  const prediction = predictMatch(state, {
    leagueCode: "E0",
    matchDate: "2024-08-17",
    homeTeamKey: "football-data:england:arsenal",
    awayTeamKey: "football-data:england:chelsea",
  });
  const total = prediction.probabilities.homeWin
    + prediction.probabilities.draw
    + prediction.probabilities.awayWin;
  assert.ok(Math.abs(total - 1) < 0.00001);
  assert.equal(prediction.topScorelines.length, 5);
  assert.ok(prediction.expectedGoals.home >= 0.2);
  assert.ok(["low", "medium", "high"].includes(prediction.confidence));
});

test("walk-forward evaluation returns finite held-out metrics", () => {
  const matches = sampleMatches();
  const training = trainModel(matches.slice(0, 24));
  const evaluation = evaluateWalkForward(training.state, matches.slice(24));
  assert.equal(evaluation.metrics.matches, 12);
  assert.ok(evaluation.metrics.accuracy >= 0 && evaluation.metrics.accuracy <= 1);
  assert.ok(Number.isFinite(evaluation.metrics.logLoss));
  assert.ok(Number.isFinite(evaluation.metrics.brierScore));
  assert.equal(evaluation.metrics.byLeague.E0.matches, 12);
  assert.equal(evaluation.state.trainedMatches, 36);
});

test("Elo moves toward the winning team after a result", () => {
  const state = createModelState();
  const result = match(0, "Arsenal", "Chelsea", 3, 0);
  updateModelWithResult(state, result);
  assert.ok(state.teams[result.home_team_key].elo > 1500);
  assert.ok(state.teams[result.away_team_key].elo < 1500);
});

test("temperature scaling keeps a normalized probability distribution", () => {
  const scaled = applyTemperature([0.72, 0.18, 0.1], 1.4);
  assert.ok(Math.abs(scaled.reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
  assert.ok(scaled[0] < 0.72);
  assert.ok(scaled.every((value) => value > 0 && value < 1));
});

test("calibration learns to soften overconfident validation probabilities", () => {
  const rows = Array.from({ length: 300 }, (_, index) => ({
    leagueCode: "E0",
    targetIndex: index % 3,
    probabilities: [0.9, 0.06, 0.04],
  }));
  const calibration = fitTemperatureCalibration(rows, { fittedSeason: 2024 });
  assert.ok(calibration.global.temperature > 1);
  assert.ok(calibration.global.logLossAfter < calibration.global.logLossBefore);
  assert.equal(calibration.leagues.E0.samples, 300);
});
