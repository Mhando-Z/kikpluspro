import assert from "node:assert/strict";
import test from "node:test";
import { pickForPrediction, summarizePredictions } from "../../lib/football-ai/performance.js";

const rows = [
  { league_code: "E0", kickoff_at: "2026-08-01T14:00:00Z", confidence: "high", home_win_probability: 0.6, draw_probability: 0.25, away_win_probability: 0.15, actual_result: "H" },
  { league_code: "E0", kickoff_at: "2026-08-02T14:00:00Z", confidence: "medium", home_win_probability: 0.2, draw_probability: 0.3, away_win_probability: 0.5, actual_result: "D" },
  { league_code: "SP1", kickoff_at: "2026-08-03T14:00:00Z", confidence: "low", home_win_probability: 0.35, draw_probability: 0.3, away_win_probability: 0.35, actual_result: null },
];

test("prediction pick selects the largest calibrated probability", () => {
  assert.deepEqual(pickForPrediction(rows[0]), { code: "H", label: "Home", probability: 0.6 });
});

test("performance summary separates correct, incorrect and pending forecasts", () => {
  const summary = summarizePredictions(rows);
  assert.equal(summary.total, 3);
  assert.equal(summary.settled, 2);
  assert.equal(summary.correct, 1);
  assert.equal(summary.incorrect, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.accuracy, 0.5);
  assert.equal(summary.byLeague.length, 2);
  assert.equal(summary.timeline[0].key, "2026-08");
});
