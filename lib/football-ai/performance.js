const OUTCOME_INDEX = { H: 0, D: 1, A: 2 };
const OUTCOME_LABELS = { H: "Home", D: "Draw", A: "Away" };

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function probabilitiesOf(row) {
  return [
    finite(row.home_win_probability),
    finite(row.draw_probability),
    finite(row.away_win_probability),
  ];
}

function predictionDate(row) {
  return row.kickoff_at ?? row.settled_at ?? row.created_at ?? "";
}

export function pickForPrediction(row) {
  const probabilities = probabilitiesOf(row);
  if (probabilities.some((value) => value === null)) {
    return { code: null, label: "Unavailable", probability: null };
  }
  const index = probabilities.indexOf(Math.max(...probabilities));
  const code = ["H", "D", "A"][index];
  return { code, label: OUTCOME_LABELS[code], probability: probabilities[index] };
}

function metricsFor(rows) {
  const settled = rows.filter((row) => OUTCOME_INDEX[row.actual_result] !== undefined);
  let correct = 0;
  let logLoss = 0;
  let brier = 0;

  for (const row of settled) {
    const probabilities = probabilitiesOf(row);
    if (probabilities.some((value) => value === null)) continue;
    const pick = pickForPrediction(row);
    const actualIndex = OUTCOME_INDEX[row.actual_result];
    if (pick.code === row.actual_result) correct += 1;
    logLoss -= Math.log(Math.max(probabilities[actualIndex], 1e-12));
    brier += probabilities.reduce((sum, value, index) =>
      sum + (value - (index === actualIndex ? 1 : 0)) ** 2, 0) / 3;
  }

  const pickProbabilities = rows
    .map((row) => pickForPrediction(row).probability)
    .filter((value) => value !== null);
  return {
    total: rows.length,
    settled: settled.length,
    correct,
    incorrect: settled.length - correct,
    pending: rows.length - settled.length,
    accuracy: settled.length ? correct / settled.length : null,
    logLoss: settled.length ? logLoss / settled.length : null,
    brierScore: settled.length ? brier / settled.length : null,
    averagePickProbability: pickProbabilities.length
      ? pickProbabilities.reduce((sum, value) => sum + value, 0) / pickProbabilities.length
      : null,
  };
}

function groupedMetrics(rows, keyOf, labels = {}) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, values]) => ({
    key,
    label: labels[key] ?? key,
    ...metricsFor(values),
  }));
}

function currentStreak(rows) {
  const settled = rows
    .filter((row) => OUTCOME_INDEX[row.actual_result] !== undefined)
    .sort((left, right) => predictionDate(right).localeCompare(predictionDate(left)));
  if (!settled.length) return { type: null, count: 0 };
  const firstCorrect = pickForPrediction(settled[0]).code === settled[0].actual_result;
  let count = 0;
  for (const row of settled) {
    const correct = pickForPrediction(row).code === row.actual_result;
    if (correct !== firstCorrect) break;
    count += 1;
  }
  return { type: firstCorrect ? "correct" : "incorrect", count };
}

export function summarizePredictions(rows = []) {
  const overall = metricsFor(rows);
  const byLeague = groupedMetrics(rows, (row) => row.league_code)
    .sort((left, right) => right.settled - left.settled || left.label.localeCompare(right.label));
  const byConfidence = groupedMetrics(
    rows,
    (row) => row.confidence,
    { high: "High", medium: "Medium", low: "Low" },
  ).sort((left, right) => ["high", "medium", "low"].indexOf(left.key) - ["high", "medium", "low"].indexOf(right.key));
  const byOutcome = groupedMetrics(
    rows,
    (row) => pickForPrediction(row).code,
    OUTCOME_LABELS,
  ).sort((left, right) => ["H", "D", "A"].indexOf(left.key) - ["H", "D", "A"].indexOf(right.key));
  const timeline = groupedMetrics(rows, (row) => predictionDate(row).slice(0, 7))
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(-12)
    .map((item) => ({
      ...item,
      label: new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" })
        .format(new Date(`${item.key}-01T00:00:00Z`)),
    }));

  return {
    ...overall,
    currentStreak: currentStreak(rows),
    byLeague,
    byConfidence,
    byOutcome,
    timeline,
  };
}
