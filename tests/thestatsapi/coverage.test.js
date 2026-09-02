import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCoverage } from "../../scripts/football-ai/check-thestatsapi-coverage.mjs";

test("coverage summaries preserve per-season availability and percentages", () => {
  const summary = summarizeCoverage("E1", { data: {
    id: "comp_8321",
    name: "EFL Championship",
    loaded_seasons: 24,
    seasons: [{
      name: "Championship 25/26",
      events: { finished: 552, total: 552 },
      data_types: {
        fixtures: { available: true, covered_events: 552, coverage_pct: 100 },
        team_stats: { available: true, covered_events: 540, coverage_pct: 97.8 },
        odds: { available: true, covered_events: 530, coverage_pct: 96.0 },
      },
    }],
  } });

  assert.equal(summary.competitionId, "comp_8321");
  assert.equal(summary.loadedSeasons, 24);
  assert.equal(summary.finishedEvents, 552);
  assert.equal(summary.dataTypes.team_stats.coveragePercent, 97.8);
  assert.equal(summary.dataTypes.xg.available, false);
});
