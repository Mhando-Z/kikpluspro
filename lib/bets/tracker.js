const FINAL_RESULTS = new Set(["H", "D", "A"]);

function amount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function settleTrackedBets(bets = [], fixtureResults = []) {
  const resultByFixture = new Map(fixtureResults.map((fixture) => [fixture.id, fixture]));
  return bets.map((bet) => {
    const fixture = resultByFixture.get(bet.fixtureId);
    if (!fixture) return bet;
    if (["postponed", "cancelled"].includes(fixture.status)) {
      return { ...bet, status: "void", actualResult: fixture.result ?? null, score: fixture.score ?? null, settledAt: new Date().toISOString() };
    }
    if (!FINAL_RESULTS.has(fixture.result)) return bet;
    const won = bet.selection === fixture.result;
    return {
      ...bet,
      status: won ? "won" : "lost",
      actualResult: fixture.result,
      score: fixture.score ?? null,
      settledAt: fixture.settledAt ?? new Date().toISOString(),
      returnAmount: won ? amount(bet.stake) * amount(bet.odds) : 0,
    };
  });
}

export function summarizeTrackedBets(bets = []) {
  const won = bets.filter((bet) => bet.status === "won");
  const lost = bets.filter((bet) => bet.status === "lost");
  const voided = bets.filter((bet) => bet.status === "void");
  const pending = bets.filter((bet) => bet.status === "pending");
  const settled = [...won, ...lost, ...voided];
  const settledStake = settled.reduce((sum, bet) => sum + amount(bet.stake), 0);
  const totalReturn = won.reduce((sum, bet) => sum + amount(bet.returnAmount || amount(bet.stake) * amount(bet.odds)), 0)
    + voided.reduce((sum, bet) => sum + amount(bet.stake), 0);
  const profit = totalReturn - settledStake;
  return {
    total: bets.length,
    won: won.length,
    lost: lost.length,
    voided: voided.length,
    pending: pending.length,
    totalStake: bets.reduce((sum, bet) => sum + amount(bet.stake), 0),
    pendingStake: pending.reduce((sum, bet) => sum + amount(bet.stake), 0),
    settledStake,
    totalReturn,
    profit,
    roi: settledStake ? profit / settledStake : null,
    hitRate: won.length + lost.length ? won.length / (won.length + lost.length) : null,
  };
}
