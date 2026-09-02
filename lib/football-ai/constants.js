export const AI_MODEL_KEY = "elo-poisson-global";
export const AI_ALGORITHM = "elo-poisson-hybrid-performance-v3";
export const FEATURE_VERSION = "prematch-rolling-v2";

export const EXPANSION_MODEL_KEY = "domestic-expansion";
export const EXPANSION_ALGORITHM = "elo-poisson-hybrid-expansion-v1";
export const EXPANSION_FEATURE_VERSION = FEATURE_VERSION;

export const UCL_MODEL_KEY = "uefa-champions-league";
export const UCL_ALGORITHM = "ucl-elo-poisson-xg-context-v2";
export const UCL_FEATURE_VERSION = "ucl-prematch-xg-context-v2";
export const UCL_COMPETITION_CODE = "CL";

export const BIG_FIVE_COMPETITION_CODES = ["E0", "SP1", "I1", "D1", "F1"];
export const DOMESTIC_EXPANSION_CODES = ["E1", "B1", "SC0"];
export const DOMESTIC_MODEL_KEYS = [AI_MODEL_KEY, EXPANSION_MODEL_KEY];

export const MODEL_FAMILIES = {
  [AI_MODEL_KEY]: {
    key: AI_MODEL_KEY,
    label: "Big Five League Model",
    shortLabel: "Big Five",
    competitionCodes: BIG_FIVE_COMPETITION_CODES,
    algorithm: AI_ALGORITHM,
    featureVersion: FEATURE_VERSION,
  },
  [EXPANSION_MODEL_KEY]: {
    key: EXPANSION_MODEL_KEY,
    label: "Domestic Expansion Model",
    shortLabel: "Expansion",
    competitionCodes: DOMESTIC_EXPANSION_CODES,
    algorithm: EXPANSION_ALGORITHM,
    featureVersion: EXPANSION_FEATURE_VERSION,
  },
  [UCL_MODEL_KEY]: {
    key: UCL_MODEL_KEY,
    label: "UEFA Champions League",
    shortLabel: "UCL specialist",
    competitionCodes: [UCL_COMPETITION_CODE],
    algorithm: UCL_ALGORITHM,
    featureVersion: UCL_FEATURE_VERSION,
  },
};

export const FOOTBALL_DATA_LEAGUES = {
  E0: {
    code: "E0",
    name: "Premier League",
    countryCode: "england",
    apiFootballId: "39",
  },
  E1: {
    code: "E1",
    name: "EFL Championship",
    countryCode: "england",
    apiFootballId: "40",
  },
  SP1: {
    code: "SP1",
    name: "La Liga",
    countryCode: "spain",
    apiFootballId: "140",
  },
  I1: {
    code: "I1",
    name: "Serie A",
    countryCode: "italy",
    apiFootballId: "135",
  },
  D1: {
    code: "D1",
    name: "Bundesliga",
    countryCode: "germany",
    apiFootballId: "78",
  },
  F1: {
    code: "F1",
    name: "Ligue 1",
    countryCode: "france",
    apiFootballId: "61",
  },
  B1: {
    code: "B1",
    name: "Belgian Pro League",
    countryCode: "belgium",
    apiFootballId: "144",
    theStatsStage: "all",
  },
  SC0: {
    code: "SC0",
    name: "Scottish Premiership",
    countryCode: "scotland",
    apiFootballId: "179",
    theStatsStage: "all",
  },
};

export const DEFAULT_MODEL_OPTIONS = {
  initialElo: 1500,
  kFactor: 24,
  homeAdvantageElo: 58,
  formWindow: 5,
  longFormWindow: 10,
  strengthPriorMatches: 8,
  xgPerformanceWeight: 0.65,
  maxGoals: 8,
  minimumExpectedGoals: 0.2,
  maximumExpectedGoals: 4.5,
};

export function modelKeyForCompetition(code) {
  const normalized = String(code ?? "").toUpperCase();
  if (normalized === UCL_COMPETITION_CODE) return UCL_MODEL_KEY;
  if (DOMESTIC_EXPANSION_CODES.includes(normalized)) return EXPANSION_MODEL_KEY;
  return AI_MODEL_KEY;
}

export function modelFamilyForKey(modelKey) {
  return MODEL_FAMILIES[modelKey] ?? {
    key: modelKey,
    label: modelKey,
    shortLabel: modelKey,
    competitionCodes: [],
  };
}

export function seasonToken(seasonStart) {
  const start = Number(seasonStart);
  if (!Number.isInteger(start) || start < 1900 || start > 2200) {
    throw new Error(`Invalid season start: ${seasonStart}`);
  }
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

export function canonicalTeamKey(countryCode, name) {
  const slug = String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `football-data:${countryCode}:${slug}`;
}
