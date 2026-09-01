export const AI_MODEL_KEY = "elo-poisson-global";
export const AI_ALGORITHM = "elo-poisson-hybrid-performance-v3";
export const FEATURE_VERSION = "prematch-rolling-v2";

export const UCL_MODEL_KEY = "uefa-champions-league";
export const UCL_ALGORITHM = "ucl-elo-poisson-xg-context-v2";
export const UCL_FEATURE_VERSION = "ucl-prematch-xg-context-v2";
export const UCL_COMPETITION_CODE = "CL";

export const MODEL_FAMILIES = {
  [AI_MODEL_KEY]: {
    key: AI_MODEL_KEY,
    label: "Domestic Big Five",
    shortLabel: "Domestic",
    competitionCodes: ["E0", "SP1", "I1", "D1", "F1"],
  },
  [UCL_MODEL_KEY]: {
    key: UCL_MODEL_KEY,
    label: "UEFA Champions League",
    shortLabel: "UCL specialist",
    competitionCodes: [UCL_COMPETITION_CODE],
  },
};

export const FOOTBALL_DATA_LEAGUES = {
  E0: {
    code: "E0",
    name: "Premier League",
    countryCode: "england",
    apiFootballId: "39",
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
  return String(code ?? "").toUpperCase() === UCL_COMPETITION_CODE ? UCL_MODEL_KEY : AI_MODEL_KEY;
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
