import assert from "node:assert/strict";
import test from "node:test";
import { settleTrackedBets, summarizeTrackedBets } from "../../lib/bets/tracker.js";

test("tracked bets settle against published fixture results", () => {
  const bets = [{ id: "one", fixtureId: "fixture-1", selection: "H", stake: 1000, odds: 2, status: "pending" }];
  const [settled] = settleTrackedBets(bets, [{ id: "fixture-1", status: "finished", result: "H", score: { home: 2, away: 1 } }]);
  assert.equal(settled.status, "won");
  assert.equal(settled.returnAmount, 2000);
  assert.deepEqual(settled.score, { home: 2, away: 1 });
});

test("tracker summary calculates settled profit and hit rate", () => {
  const summary = summarizeTrackedBets([
    { status: "won", stake: 1000, odds: 2, returnAmount: 2000 },
    { status: "lost", stake: 500, odds: 3, returnAmount: 0 },
    { status: "pending", stake: 700, odds: 1.8 },
  ]);
  assert.equal(summary.won, 1);
  assert.equal(summary.lost, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.profit, 500);
  assert.equal(summary.roi, 1 / 3);
  assert.equal(summary.hitRate, 0.5);
});
