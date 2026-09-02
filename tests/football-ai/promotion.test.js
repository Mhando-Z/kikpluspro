import assert from "node:assert/strict";
import test from "node:test";
import { promotionDecision } from "../../lib/football-ai/promotion.js";

function model(logLoss, brierScore, testSeason = 2025) {
  return { metrics: { testSeason, test: { logLoss, brierScore } } };
}

test("the first model is promoted automatically", () => {
  const result = promotionDecision({ candidateMetrics: model(1, 0.2).metrics });
  assert.equal(result.promote, true);
});

test("a candidate must improve log loss without damaging Brier score", () => {
  const accepted = promotionDecision({
    activeModel: model(1.01, 0.2),
    candidateMetrics: model(1.0, 0.199).metrics,
  });
  const rejected = promotionDecision({
    activeModel: model(1.01, 0.2),
    candidateMetrics: model(1.02, 0.198).metrics,
  });
  assert.equal(accepted.promote, true);
  assert.equal(rejected.promote, false);
});

test("different test seasons require manual review", () => {
  const result = promotionDecision({
    activeModel: model(1.01, 0.2, 2024),
    candidateMetrics: model(1.0, 0.19, 2025).metrics,
  });
  assert.equal(result.promote, false);
  assert.match(result.reason, /different seasons/i);
});

test("an expanded competition scope requires manual review", () => {
  const result = promotionDecision({
    activeModel: {
      metrics: {
        ...model(1.01, 0.2).metrics,
        competitionCodes: ["E0", "SP1"],
      },
    },
    candidateMetrics: {
      ...model(1.0, 0.19).metrics,
      competitionCodes: ["E0", "E1", "SP1"],
    },
  });
  assert.equal(result.promote, false);
  assert.match(result.reason, /scope changed/i);
});
