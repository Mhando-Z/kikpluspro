export function promotionDecision({
  mode = "auto",
  activeModel = null,
  candidateMetrics,
  minimumLogLossImprovement = 0.0005,
  brierTolerance = 0.0002,
} = {}) {
  if (mode === "always") return { promote: true, reason: "Manual promotion requested." };
  if (mode === "never") return { promote: false, reason: "Candidate-only training requested." };
  if (!activeModel) return { promote: true, reason: "No active model exists." };

  const candidateScope = [...(candidateMetrics.competitionCodes ?? [])].sort();
  const activeScope = [...(activeModel.metrics?.competitionCodes ?? [])].sort();
  if (candidateScope.length && candidateScope.join(",") !== activeScope.join(",")) {
    return {
      promote: false,
      reason: activeScope.length
        ? `The competition scope changed (${activeScope.join(", ")} -> ${candidateScope.join(", ")}); review and promote manually.`
        : "The active model has no competition-scope metadata; review the expanded candidate and promote manually.",
    };
  }

  const activeMetrics = activeModel.metrics ?? {};
  if (Number(activeMetrics.testSeason) !== Number(candidateMetrics.testSeason)) {
    return {
      promote: false,
      reason: "The active and candidate models were tested on different seasons; review manually.",
    };
  }

  const activeLoss = Number(activeMetrics.test?.logLoss);
  const candidateLoss = Number(candidateMetrics.test?.logLoss);
  const activeBrier = Number(activeMetrics.test?.brierScore);
  const candidateBrier = Number(candidateMetrics.test?.brierScore);
  if (![activeLoss, candidateLoss, activeBrier, candidateBrier].every(Number.isFinite)) {
    return { promote: false, reason: "Comparable log-loss and Brier metrics are unavailable." };
  }

  const lossImproved = candidateLoss <= activeLoss - minimumLogLossImprovement;
  const calibrationHeld = candidateBrier <= activeBrier + brierTolerance;
  return {
    promote: lossImproved && calibrationHeld,
    reason: lossImproved && calibrationHeld
      ? `Candidate log loss improved from ${activeLoss} to ${candidateLoss} without Brier regression.`
      : `Candidate did not pass the gate (log loss ${activeLoss} -> ${candidateLoss}; Brier ${activeBrier} -> ${candidateBrier}).`,
    comparison: {
      activeLogLoss: activeLoss,
      candidateLogLoss: candidateLoss,
      activeBrier,
      candidateBrier,
    },
  };
}
