import {
  AI_ALGORITHM,
  AI_MODEL_KEY,
  DEFAULT_MODEL_OPTIONS,
  FEATURE_VERSION,
  FOOTBALL_DATA_LEAGUES,
} from "./constants.js";

const EPSILON = 1e-12;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function average(values, fallback = 0) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : fallback;
}

function pointsFor(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return 3;
  if (goalsFor === goalsAgainst) return 1;
  return 0;
}

function daysBetween(left, right) {
  if (!left || !right) return null;
  const milliseconds = new Date(`${right}T12:00:00Z`).getTime() - new Date(`${left}T12:00:00Z`).getTime();
  return Math.max(0, Math.round(milliseconds / 86_400_000));
}

function poissonProbability(lambda, goals) {
  let factorial = 1;
  for (let value = 2; value <= goals; value += 1) factorial *= value;
  return Math.exp(-lambda) * lambda ** goals / factorial;
}

function createTeam(key, name, initialElo) {
  return {
    key,
    name,
    elo: initialElo,
    matches: 0,
    lastMatchDate: null,
    lastSeasonStart: null,
    history: [],
    home: { matches: 0, goalsFor: 0, goalsAgainst: 0, performanceFor: 0, performanceAgainst: 0 },
    away: { matches: 0, goalsFor: 0, goalsAgainst: 0, performanceFor: 0, performanceAgainst: 0 },
  };
}

function createLeague(code) {
  return {
    code,
    name: FOOTBALL_DATA_LEAGUES[code]?.name ?? code,
    matches: 0,
    homeGoals: 0,
    awayGoals: 0,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
  };
}

export function createModelState(overrides = {}) {
  const {
    modelKey = AI_MODEL_KEY,
    algorithm = AI_ALGORITHM,
    featureVersion = FEATURE_VERSION,
    ...optionOverrides
  } = overrides;
  return {
    modelKey,
    algorithm,
    featureVersion,
    options: { ...DEFAULT_MODEL_OPTIONS, ...optionOverrides },
    teams: {},
    leagues: {},
    contexts: {},
    calibration: null,
    trainedMatches: 0,
    trainedFrom: null,
    trainedThrough: null,
    latestSeasonStart: null,
  };
}

export function cloneModelState(state) {
  return structuredClone(state);
}

function getTeam(state, key, name = key) {
  if (!state.teams[key]) state.teams[key] = createTeam(key, name, state.options.initialElo);
  if (name && state.teams[key].name === key) state.teams[key].name = name;
  return state.teams[key];
}

function getLeague(state, code) {
  if (!state.leagues[code]) state.leagues[code] = createLeague(code);
  return state.leagues[code];
}

function leagueRates(league) {
  const priorMatches = 30;
  const matches = league?.matches ?? 0;
  return {
    homeGoals: ((league?.homeGoals ?? 0) + 1.45 * priorMatches) / (matches + priorMatches),
    awayGoals: ((league?.awayGoals ?? 0) + 1.15 * priorMatches) / (matches + priorMatches),
    drawRate: ((league?.draws ?? 0) + 0.26 * priorMatches) / (matches + priorMatches),
  };
}

function contextKey(match) {
  const stage = match.competition_stage ?? match.competitionStage;
  const era = match.format_era ?? match.formatEra;
  return stage || era ? `${match.league_code}:${era ?? "unknown"}:${stage ?? "unknown"}` : null;
}

function matchRates(state, match, league) {
  const baseline = leagueRates(league);
  const key = contextKey(match);
  const context = key ? state.contexts?.[key] : null;
  if (!context?.matches) return { ...baseline, contextMatches: 0 };
  const priorMatches = 40;
  return {
    homeGoals: (context.homeGoals + baseline.homeGoals * priorMatches) / (context.matches + priorMatches),
    awayGoals: (context.awayGoals + baseline.awayGoals * priorMatches) / (context.matches + priorMatches),
    drawRate: (context.draws + baseline.drawRate * priorMatches) / (context.matches + priorMatches),
    contextMatches: context.matches,
  };
}

function venueStrength(team, venue, rates, priorMatches) {
  const record = team[venue];
  const attackBaseline = venue === "home" ? rates.homeGoals : rates.awayGoals;
  const defenceBaseline = venue === "home" ? rates.awayGoals : rates.homeGoals;
  const performanceFor = Number(record.performanceFor ?? record.goalsFor ?? 0);
  const performanceAgainst = Number(record.performanceAgainst ?? record.goalsAgainst ?? 0);
  const attackRate = (performanceFor + priorMatches * attackBaseline) / (record.matches + priorMatches);
  const concededRate = (performanceAgainst + priorMatches * defenceBaseline) / (record.matches + priorMatches);
  return {
    attack: attackRate / attackBaseline,
    defenceWeakness: concededRate / defenceBaseline,
  };
}

function recentSummary(team, window, venue = null) {
  const relevant = (venue ? team.history.filter((entry) => entry.venue === venue) : team.history).slice(-window);
  const xgEntries = relevant.filter((entry) =>
    entry.xgFor !== null && entry.xgFor !== undefined && Number.isFinite(Number(entry.xgFor)));
  return {
    matches: relevant.length,
    pointsPerMatch: average(relevant.map((entry) => entry.points)),
    goalsFor: average(relevant.map((entry) => entry.goalsFor)),
    goalsAgainst: average(relevant.map((entry) => entry.goalsAgainst)),
    shotsFor: average(relevant.map((entry) => entry.shotsFor).filter(Number.isFinite)),
    shotsOnTargetFor: average(relevant.map((entry) => entry.shotsOnTargetFor).filter(Number.isFinite)),
    xgFor: average(relevant.map((entry) => entry.xgFor).filter(Number.isFinite)),
    xgAgainst: average(relevant.map((entry) => entry.xgAgainst).filter(Number.isFinite)),
    xgSamples: xgEntries.length,
    performanceFor: average(relevant.map((entry) => entry.performanceFor).filter(Number.isFinite)),
    performanceAgainst: average(relevant.map((entry) => entry.performanceAgainst).filter(Number.isFinite)),
  };
}

export function buildPrematchFeatures(state, match) {
  const home = getTeam(state, match.home_team_key, match.home_team_name);
  const away = getTeam(state, match.away_team_key, match.away_team_name);
  const league = getLeague(state, match.league_code);
  const rates = matchRates(state, match, league);
  const homeRecent = recentSummary(home, state.options.formWindow);
  const awayRecent = recentSummary(away, state.options.formWindow);
  const homeLong = recentSummary(home, state.options.longFormWindow);
  const awayLong = recentSummary(away, state.options.longFormWindow);

  const neutralVenue = Boolean(match.neutral_venue ?? match.neutralVenue);
  const effectiveHomeAdvantage = neutralVenue ? 0 : state.options.homeAdvantageElo;
  return {
    leagueCode: match.league_code,
    matchDate: match.match_date,
    competitionStage: match.competition_stage ?? match.competitionStage ?? null,
    formatEra: match.format_era ?? match.formatEra ?? null,
    knockoutLeg: Number(match.leg ?? match.knockoutLeg) || null,
    neutralVenue,
    homeTeamKey: home.key,
    awayTeamKey: away.key,
    homeElo: round(home.elo, 2),
    awayElo: round(away.elo, 2),
    eloDifference: round(home.elo + effectiveHomeAdvantage - away.elo, 2),
    homeMatchesKnown: home.matches,
    awayMatchesKnown: away.matches,
    homeRestDays: daysBetween(home.lastMatchDate, match.match_date),
    awayRestDays: daysBetween(away.lastMatchDate, match.match_date),
    leagueHomeGoals: round(rates.homeGoals),
    leagueAwayGoals: round(rates.awayGoals),
    leagueDrawRate: round(rates.drawRate),
    contextMatchesKnown: rates.contextMatches,
    homeFormPoints5: round(homeRecent.pointsPerMatch),
    awayFormPoints5: round(awayRecent.pointsPerMatch),
    homeGoalsFor5: round(homeRecent.goalsFor),
    awayGoalsFor5: round(awayRecent.goalsFor),
    homeGoalsAgainst5: round(homeRecent.goalsAgainst),
    awayGoalsAgainst5: round(awayRecent.goalsAgainst),
    homeShotsFor5: round(homeRecent.shotsFor),
    awayShotsFor5: round(awayRecent.shotsFor),
    homeShotsOnTarget5: round(homeRecent.shotsOnTargetFor),
    awayShotsOnTarget5: round(awayRecent.shotsOnTargetFor),
    homeXgFor5: round(homeRecent.xgFor),
    awayXgFor5: round(awayRecent.xgFor),
    homeXgAgainst5: round(homeRecent.xgAgainst),
    awayXgAgainst5: round(awayRecent.xgAgainst),
    homeXgSamples5: homeRecent.xgSamples,
    awayXgSamples5: awayRecent.xgSamples,
    homePerformanceFor5: round(homeRecent.performanceFor),
    awayPerformanceFor5: round(awayRecent.performanceFor),
    homePerformanceAgainst5: round(homeRecent.performanceAgainst),
    awayPerformanceAgainst5: round(awayRecent.performanceAgainst),
    homeFormPoints10: round(homeLong.pointsPerMatch),
    awayFormPoints10: round(awayLong.pointsPerMatch),
  };
}

function scoreDistribution(homeExpected, awayExpected, maxGoals) {
  const scorelines = [];
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let bothTeamsScore = 0;
  let mass = 0;

  for (let home = 0; home <= maxGoals; home += 1) {
    for (let away = 0; away <= maxGoals; away += 1) {
      const probability = poissonProbability(homeExpected, home) * poissonProbability(awayExpected, away);
      mass += probability;
      if (home > away) homeWin += probability;
      else if (home === away) draw += probability;
      else awayWin += probability;
      if (home + away >= 3) over25 += probability;
      if (home > 0 && away > 0) bothTeamsScore += probability;
      scorelines.push({ home, away, probability });
    }
  }

  const normalize = (value) => value / Math.max(mass, EPSILON);
  return {
    homeWin: normalize(homeWin),
    draw: normalize(draw),
    awayWin: normalize(awayWin),
    over25: normalize(over25),
    bothTeamsScore: normalize(bothTeamsScore),
    scorelines: scorelines
      .map((entry) => ({ ...entry, probability: normalize(entry.probability) }))
      .sort((left, right) => right.probability - left.probability),
  };
}

export function applyTemperature(probabilities, temperature = 1) {
  const safeTemperature = clamp(Number(temperature) || 1, 0.25, 4);
  const logits = probabilities.map((probability) => Math.log(Math.max(Number(probability), EPSILON)) / safeTemperature);
  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / Math.max(total, EPSILON));
}

function calibrationEntry(state, leagueCode) {
  if (!state.calibration) return null;
  return state.calibration.leagues?.[leagueCode] ?? state.calibration.global ?? null;
}

function expectedGoals(state, match) {
  const home = getTeam(state, match.home_team_key, match.home_team_name);
  const away = getTeam(state, match.away_team_key, match.away_team_name);
  const league = getLeague(state, match.league_code);
  const rates = matchRates(state, match, league);
  const homeStrength = venueStrength(home, "home", rates, state.options.strengthPriorMatches);
  const awayStrength = venueStrength(away, "away", rates, state.options.strengthPriorMatches);
  const neutralVenue = Boolean(match.neutral_venue ?? match.neutralVenue);
  const ratingDifference = home.elo + (neutralVenue ? 0 : state.options.homeAdvantageElo) - away.elo;
  const eloFactor = Math.exp(clamp(ratingDifference, -500, 500) * 0.00125);
  const homeRecent = recentSummary(home, state.options.formWindow);
  const awayRecent = recentSummary(away, state.options.formWindow);
  const homeFormFactor = homeRecent.matches >= 3
    ? clamp((homeRecent.performanceFor + rates.homeGoals) / (2 * rates.homeGoals), 0.72, 1.28)
    : 1;
  const awayFormFactor = awayRecent.matches >= 3
    ? clamp((awayRecent.performanceFor + rates.awayGoals) / (2 * rates.awayGoals), 0.72, 1.28)
    : 1;

  return {
    home: clamp(
      rates.homeGoals * homeStrength.attack * awayStrength.defenceWeakness * eloFactor * homeFormFactor,
      state.options.minimumExpectedGoals,
      state.options.maximumExpectedGoals,
    ),
    away: clamp(
      rates.awayGoals * awayStrength.attack * homeStrength.defenceWeakness / eloFactor * awayFormFactor,
      state.options.minimumExpectedGoals,
      state.options.maximumExpectedGoals,
    ),
  };
}

function confidenceFor(home, away, distribution) {
  const knownMatches = Math.min(home.matches, away.matches);
  const strongest = Math.max(distribution.homeWin, distribution.draw, distribution.awayWin);
  if (knownMatches < 6) return "low";
  if (knownMatches >= 15 && strongest >= 0.5) return "high";
  return "medium";
}

function explanationsFor(state, match, features, expected, distribution) {
  const explanations = [];
  const eloEdge = features.homeElo - features.awayElo;
  if (Math.abs(eloEdge) >= 45) {
    const leader = eloEdge > 0 ? match.home_team_name : match.away_team_name;
    explanations.push(`${leader} holds a ${Math.round(Math.abs(eloEdge))}-point pre-match Elo advantage.`);
  } else {
    explanations.push("The teams enter with closely matched Elo strength.");
  }
  if (features.homeFormPoints5 !== features.awayFormPoints5) {
    const formLeader = features.homeFormPoints5 > features.awayFormPoints5 ? match.home_team_name : match.away_team_name;
    explanations.push(`${formLeader} has the stronger five-match points rate.`);
  }
  explanations.push(`The goal model estimates ${expected.home.toFixed(2)}–${expected.away.toFixed(2)} expected goals.`);
  if (Math.min(features.homeMatchesKnown, features.awayMatchesKnown) < 6) {
    explanations.push("Confidence is reduced because one team has limited history in the training window.");
  } else if (distribution.draw > 0.3) {
    explanations.push("The score matrix contains an elevated draw probability.");
  }
  return explanations.slice(0, 4);
}

export function predictMatch(state, input) {
  const match = {
    league_code: input.league_code ?? input.leagueCode,
    match_date: input.match_date ?? input.matchDate ?? new Date().toISOString().slice(0, 10),
    home_team_key: input.home_team_key ?? input.homeTeamKey,
    away_team_key: input.away_team_key ?? input.awayTeamKey,
    home_team_name: input.home_team_name ?? input.homeTeamName ?? input.home_team_key ?? input.homeTeamKey,
    away_team_name: input.away_team_name ?? input.awayTeamName ?? input.away_team_key ?? input.awayTeamKey,
    competition_stage: input.competition_stage ?? input.competitionStage ?? null,
    format_era: input.format_era ?? input.formatEra ?? null,
    leg: input.leg ?? input.knockoutLeg ?? null,
    neutral_venue: Boolean(input.neutral_venue ?? input.neutralVenue),
  };
  if (!match.league_code || !match.home_team_key || !match.away_team_key) {
    throw new Error("leagueCode, homeTeamKey and awayTeamKey are required.");
  }
  if (match.home_team_key === match.away_team_key) throw new Error("A team cannot play itself.");

  const home = getTeam(state, match.home_team_key, match.home_team_name);
  const away = getTeam(state, match.away_team_key, match.away_team_name);
  const features = buildPrematchFeatures(state, match);
  const expected = expectedGoals(state, match);
  const distribution = scoreDistribution(expected.home, expected.away, state.options.maxGoals);
  const calibration = calibrationEntry(state, match.league_code);
  const outcomes = applyTemperature(
    [distribution.homeWin, distribution.draw, distribution.awayWin],
    calibration?.temperature ?? 1,
  );
  const calibratedDistribution = {
    ...distribution,
    homeWin: outcomes[0],
    draw: outcomes[1],
    awayWin: outcomes[2],
  };
  const confidence = confidenceFor(home, away, calibratedDistribution);

  return {
    modelKey: state.modelKey,
    algorithm: state.algorithm,
    leagueCode: match.league_code,
    homeTeam: { key: home.key, name: home.name },
    awayTeam: { key: away.key, name: away.name },
    expectedGoals: { home: round(expected.home), away: round(expected.away) },
    probabilities: {
      homeWin: round(outcomes[0], 6),
      draw: round(outcomes[1], 6),
      awayWin: round(outcomes[2], 6),
      over25: round(distribution.over25, 6),
      bothTeamsScore: round(distribution.bothTeamsScore, 6),
    },
    topScorelines: distribution.scorelines.slice(0, 5).map((entry) => ({
      score: `${entry.home}-${entry.away}`,
      probability: round(entry.probability, 6),
    })),
    confidence,
    calibration: {
      applied: Boolean(calibration),
      method: state.calibration?.method ?? null,
      temperature: calibration?.temperature ?? 1,
    },
    features,
    explanations: explanationsFor(state, match, features, expected, calibratedDistribution),
    generatedAt: new Date().toISOString(),
  };
}

function finiteValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function historyEntry(match, venue, xgWeight) {
  const home = venue === "home";
  const goalsFor = home ? match.home_goals : match.away_goals;
  const goalsAgainst = home ? match.away_goals : match.home_goals;
  const xgFor = home
    ? finiteValue(match.home_npxg, match.home_xg)
    : finiteValue(match.away_npxg, match.away_xg);
  const xgAgainst = home
    ? finiteValue(match.away_npxg, match.away_xg)
    : finiteValue(match.home_npxg, match.home_xg);
  const weight = clamp(Number(xgWeight) || 0, 0, 1);
  return {
    date: match.match_date,
    venue,
    goalsFor,
    goalsAgainst,
    points: pointsFor(goalsFor, goalsAgainst),
    shotsFor: home ? match.home_shots : match.away_shots,
    shotsAgainst: home ? match.away_shots : match.home_shots,
    shotsOnTargetFor: home ? match.home_shots_on_target : match.away_shots_on_target,
    shotsOnTargetAgainst: home ? match.away_shots_on_target : match.home_shots_on_target,
    xgFor,
    xgAgainst,
    performanceFor: xgFor === null ? goalsFor : weight * xgFor + (1 - weight) * goalsFor,
    performanceAgainst: xgAgainst === null ? goalsAgainst : weight * xgAgainst + (1 - weight) * goalsAgainst,
  };
}

export function updateModelWithResult(state, match) {
  const home = getTeam(state, match.home_team_key, match.home_team_name);
  const away = getTeam(state, match.away_team_key, match.away_team_name);
  const league = getLeague(state, match.league_code);
  const homeAdvantage = match.neutral_venue ? 0 : state.options.homeAdvantageElo;
  const expectedHome = 1 / (1 + 10 ** (-(home.elo + homeAdvantage - away.elo) / 400));
  const actualHome = match.home_goals > match.away_goals ? 1 : match.home_goals === match.away_goals ? 0.5 : 0;
  const adjustment = state.options.kFactor * (actualHome - expectedHome);
  home.elo += adjustment;
  away.elo -= adjustment;

  const homeEntry = historyEntry(match, "home", state.options.xgPerformanceWeight);
  const awayEntry = historyEntry(match, "away", state.options.xgPerformanceWeight);
  home.history.push(homeEntry);
  away.history.push(awayEntry);
  const retainedHistory = Math.max(state.options.formWindow, state.options.longFormWindow);
  home.history = home.history.slice(-retainedHistory);
  away.history = away.history.slice(-retainedHistory);
  home.matches += 1;
  away.matches += 1;
  home.lastMatchDate = match.match_date;
  away.lastMatchDate = match.match_date;
  home.lastSeasonStart = match.season_start ?? home.lastSeasonStart;
  away.lastSeasonStart = match.season_start ?? away.lastSeasonStart;
  home.home.matches += 1;
  home.home.goalsFor += match.home_goals;
  home.home.goalsAgainst += match.away_goals;
  home.home.performanceFor = Number(home.home.performanceFor ?? home.home.goalsFor - match.home_goals)
    + homeEntry.performanceFor;
  home.home.performanceAgainst = Number(home.home.performanceAgainst ?? home.home.goalsAgainst - match.away_goals)
    + homeEntry.performanceAgainst;
  away.away.matches += 1;
  away.away.goalsFor += match.away_goals;
  away.away.goalsAgainst += match.home_goals;
  away.away.performanceFor = Number(away.away.performanceFor ?? away.away.goalsFor - match.away_goals)
    + awayEntry.performanceFor;
  away.away.performanceAgainst = Number(away.away.performanceAgainst ?? away.away.goalsAgainst - match.home_goals)
    + awayEntry.performanceAgainst;

  league.matches += 1;
  league.homeGoals += match.home_goals;
  league.awayGoals += match.away_goals;
  if (match.home_goals > match.away_goals) league.homeWins += 1;
  else if (match.home_goals === match.away_goals) league.draws += 1;
  else league.awayWins += 1;

  const key = contextKey(match);
  if (key) {
    state.contexts ??= {};
    state.contexts[key] ??= {
      key,
      leagueCode: match.league_code,
      formatEra: match.format_era ?? match.formatEra ?? null,
      stage: match.competition_stage ?? match.competitionStage ?? null,
      matches: 0,
      homeGoals: 0,
      awayGoals: 0,
      draws: 0,
    };
    const context = state.contexts[key];
    context.matches += 1;
    context.homeGoals += match.home_goals;
    context.awayGoals += match.away_goals;
    if (match.home_goals === match.away_goals) context.draws += 1;
  }

  state.trainedMatches += 1;
  state.trainedFrom = !state.trainedFrom || match.match_date < state.trainedFrom ? match.match_date : state.trainedFrom;
  state.trainedThrough = !state.trainedThrough || match.match_date > state.trainedThrough ? match.match_date : state.trainedThrough;
  if (Number.isInteger(match.season_start)) {
    state.latestSeasonStart = Math.max(state.latestSeasonStart ?? match.season_start, match.season_start);
  }
  return state;
}

export function sortMatchesChronologically(matches) {
  return [...matches].sort((left, right) =>
    String(left.match_date).localeCompare(String(right.match_date))
      || String(left.league_code).localeCompare(String(right.league_code))
      || String(left.id ?? left.source_match_key).localeCompare(String(right.id ?? right.source_match_key)),
  );
}

export function trainModel(matches, options = {}) {
  const state = createModelState(options);
  const featureRows = [];
  for (const match of sortMatchesChronologically(matches)) {
    featureRows.push({
      matchId: match.id,
      features: buildPrematchFeatures(state, match),
      targetResult: match.result,
      targetHomeGoals: match.home_goals,
      targetAwayGoals: match.away_goals,
    });
    updateModelWithResult(state, match);
  }
  return { state, featureRows };
}

function marketProbabilities(match) {
  const odds = [match.closing_home_odds, match.closing_draw_odds, match.closing_away_odds].map(Number);
  if (odds.some((value) => !Number.isFinite(value) || value <= 1)) return null;
  const inverse = odds.map((value) => 1 / value);
  const total = inverse.reduce((sum, value) => sum + value, 0);
  return inverse.map((value) => value / total);
}

function createMetricAccumulator() {
  return { matches: 0, correct: 0, logLoss: 0, brier: 0, goalMae: 0, marketLogLoss: 0, marketRows: 0 };
}

function accumulateMetrics(accumulator, row) {
  const predictedIndex = row.probabilities.indexOf(Math.max(...row.probabilities));
  accumulator.matches += 1;
  if (predictedIndex === row.targetIndex) accumulator.correct += 1;
  accumulator.logLoss -= Math.log(Math.max(row.probabilities[row.targetIndex], EPSILON));
  accumulator.brier += row.probabilities.reduce((total, probability, index) =>
    total + (probability - (index === row.targetIndex ? 1 : 0)) ** 2, 0) / 3;
  accumulator.goalMae += (
    Math.abs(row.expectedGoals.home - row.actualGoals.home)
    + Math.abs(row.expectedGoals.away - row.actualGoals.away)
  ) / 2;
  if (row.marketProbabilities) {
    accumulator.marketLogLoss -= Math.log(Math.max(row.marketProbabilities[row.targetIndex], EPSILON));
    accumulator.marketRows += 1;
  }
}

function finalizedMetrics(accumulator) {
  const count = accumulator.matches || 1;
  return {
    matches: accumulator.matches,
    accuracy: round(accumulator.correct / count, 6),
    logLoss: round(accumulator.logLoss / count, 6),
    brierScore: round(accumulator.brier / count, 6),
    goalMae: round(accumulator.goalMae / count, 6),
    marketLogLoss: accumulator.marketRows ? round(accumulator.marketLogLoss / accumulator.marketRows, 6) : null,
    marketRows: accumulator.marketRows,
  };
}

export function evaluateWalkForward(initialState, matches) {
  const state = cloneModelState(initialState);
  const ordered = sortMatchesChronologically(matches);
  const overall = createMetricAccumulator();
  const leagueAccumulators = {};
  const predictions = [];

  for (const match of ordered) {
    const prediction = predictMatch(state, match);
    const probabilities = [
      prediction.probabilities.homeWin,
      prediction.probabilities.draw,
      prediction.probabilities.awayWin,
    ];
    const targetIndex = match.result === "H" ? 0 : match.result === "D" ? 1 : 2;
    const row = {
      leagueCode: match.league_code,
      result: match.result,
      targetIndex,
      probabilities,
      expectedGoals: prediction.expectedGoals,
      actualGoals: { home: match.home_goals, away: match.away_goals },
      marketProbabilities: marketProbabilities(match),
    };
    accumulateMetrics(overall, row);
    leagueAccumulators[match.league_code] ??= createMetricAccumulator();
    accumulateMetrics(leagueAccumulators[match.league_code], row);
    predictions.push(row);
    updateModelWithResult(state, match);
  }

  return {
    state,
    metrics: {
      ...finalizedMetrics(overall),
      byLeague: Object.fromEntries(
        Object.entries(leagueAccumulators).map(([code, accumulator]) => [code, finalizedMetrics(accumulator)]),
      ),
    },
    predictions,
  };
}

function logLossAtTemperature(rows, temperature) {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => {
    const scaled = applyTemperature(row.probabilities, temperature);
    return sum - Math.log(Math.max(scaled[row.targetIndex], EPSILON));
  }, 0);
  return total / rows.length;
}

function fitTemperature(rows) {
  let bestTemperature = 1;
  let bestLoss = logLossAtTemperature(rows, bestTemperature);
  for (let step = 30; step <= 100; step += 1) {
    const temperature = step / 50;
    const loss = logLossAtTemperature(rows, temperature);
    if (loss < bestLoss) {
      bestLoss = loss;
      bestTemperature = temperature;
    }
  }
  return {
    samples: rows.length,
    temperature: round(bestTemperature, 4),
    logLossBefore: round(logLossAtTemperature(rows, 1), 6),
    logLossAfter: round(bestLoss, 6),
  };
}

export function fitTemperatureCalibration(rows, {
  fittedSeason = null,
  minimumLeagueSamples = 200,
  shrinkage = 250,
} = {}) {
  if (!rows.length) throw new Error("Calibration requires validation predictions.");
  const global = fitTemperature(rows);
  const grouped = Object.groupBy(rows, (row) => row.leagueCode);
  const leagues = {};

  for (const [code, leagueRows] of Object.entries(grouped)) {
    if (leagueRows.length < minimumLeagueSamples) continue;
    const raw = fitTemperature(leagueRows);
    const leagueWeight = leagueRows.length / (leagueRows.length + shrinkage);
    const temperature = round(global.temperature + leagueWeight * (raw.temperature - global.temperature), 4);
    leagues[code] = {
      samples: leagueRows.length,
      temperature,
      rawTemperature: raw.temperature,
      logLossBefore: round(logLossAtTemperature(leagueRows, 1), 6),
      logLossAfter: round(logLossAtTemperature(leagueRows, temperature), 6),
    };
  }

  return {
    method: "temperature-scaling",
    fittedSeason,
    minimumLeagueSamples,
    shrinkage,
    global,
    leagues,
  };
}

export function modelSummary(state) {
  return {
    modelKey: state.modelKey,
    algorithm: state.algorithm,
    featureVersion: state.featureVersion,
    trainedMatches: state.trainedMatches,
    trainedFrom: state.trainedFrom,
    trainedThrough: state.trainedThrough,
    latestSeasonStart: state.latestSeasonStart,
    calibration: state.calibration ? {
      method: state.calibration.method,
      fittedSeason: state.calibration.fittedSeason,
      globalTemperature: state.calibration.global?.temperature ?? 1,
      calibratedLeagues: Object.keys(state.calibration.leagues ?? {}).length,
    } : null,
    leagues: Object.values(state.leagues).map((league) => ({
      code: league.code,
      name: league.name,
      matches: league.matches,
    })),
    contexts: Object.values(state.contexts ?? {}).map((context) => ({
      key: context.key,
      leagueCode: context.leagueCode,
      formatEra: context.formatEra,
      stage: context.stage,
      matches: context.matches,
    })),
    teams: Object.values(state.teams)
      .map((team) => ({ key: team.key, name: team.name, elo: round(team.elo, 2), matches: team.matches }))
      .sort((left, right) => right.elo - left.elo),
  };
}
