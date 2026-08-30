const COUNTRY_NAMES = {
  england: "england",
  france: "france",
  germany: "germany",
  italy: "italy",
  spain: "spain",
};

const TEAM_ALIASES = {
  "ath bilbao": "athletic club",
  "ath madrid": "atletico madrid",
  "m gladbach": "borussia monchengladbach",
  "man city": "manchester city",
  "man united": "manchester united",
  "nott m forest": "nottingham forest",
  "sheffield utd": "sheffield united",
  "west brom": "west bromwich albion",
  "west ham": "west ham united",
  "athletic bilbao": "athletic club",
  "betis": "real betis",
  "espanol": "espanyol",
  "sociedad": "real sociedad",
  "valladolid": "real valladolid",
  "vallecano": "rayo vallecano",
  "leverkusen": "bayer leverkusen",
  "bayern munchen": "bayern munich",
  "dortmund": "borussia dortmund",
  "ein frankfurt": "eintracht frankfurt",
  "hoffenheim": "1899 hoffenheim",
  "st pauli": "fc st pauli",
  "paris sg": "paris saint germain",
  "st etienne": "saint etienne",
  "milan": "ac milan",
};

const CLUB_TOKENS = new Set([
  "1", "04", "05", "07", "1899", "1907", "1909", "1913",
  "ac", "acf", "afc", "as", "bc", "calcio", "cf", "cfc", "fc",
  "ogc", "rc", "rcd", "sc", "sco", "ss", "ssc", "sv", "tsg",
  "ud", "us", "vfb", "vfl",
]);

export function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function canonicalName(value) {
  const normalized = normalizeTeamName(value);
  return TEAM_ALIASES[normalized] ?? normalized;
}

function meaningfulTokens(value) {
  return canonicalName(value).split(" ").filter((token) => token && !CLUB_TOKENS.has(token));
}

function tokenScore(left, right) {
  const leftTokens = new Set(meaningfulTokens(left));
  const rightTokens = new Set(meaningfulTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function bigrams(value) {
  const compact = canonicalName(value).replace(/\s/g, "");
  if (compact.length < 2) return new Set([compact]);
  return new Set(Array.from({ length: compact.length - 1 }, (_, index) => compact.slice(index, index + 2)));
}

function bigramScore(left, right) {
  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  const intersection = [...leftPairs].filter((pair) => rightPairs.has(pair)).length;
  return (2 * intersection) / Math.max(1, leftPairs.size + rightPairs.size);
}

export function teamNameMatchScore(sourceName, candidateName) {
  const source = canonicalName(sourceName);
  const candidate = canonicalName(candidateName);
  if (!source || !candidate) return 0;
  if (source === candidate) return 1;
  const sourceBase = meaningfulTokens(source).join(" ");
  const candidateBase = meaningfulTokens(candidate).join(" ");
  if (sourceBase && sourceBase === candidateBase) return 0.98;
  return Math.max(tokenScore(source, candidate) * 0.92, bigramScore(source, candidate) * 0.82);
}

export function apiFootballTeamLogo(teamId) {
  const id = String(teamId ?? "").trim();
  return /^\d+$/.test(id) ? `https://media.api-sports.io/football/teams/${id}.png` : null;
}

function normalizedCountry(value) {
  const country = normalizeTeamName(value);
  return COUNTRY_NAMES[country] ?? country;
}

export function createTeamAssetResolver(rows = []) {
  const candidates = rows
    .filter((row) => row?.api_id && row?.name)
    .map((row) => ({
      apiFootballId: Number(row.api_id),
      name: row.name,
      country: normalizedCountry(row.country),
      logo: row.logo_url || apiFootballTeamLogo(row.api_id),
    }));

  return ({ name, country, countryCode } = {}) => {
    const expectedCountry = normalizedCountry(countryCode ?? country);
    const eligible = candidates.filter((candidate) => !expectedCountry || candidate.country === expectedCountry);
    const ranked = eligible
      .map((candidate) => ({ ...candidate, score: teamNameMatchScore(name, candidate.name) }))
      .sort((left, right) => right.score - left.score);
    const best = ranked[0];
    const runnerUp = ranked[1];
    if (!best || best.score < 0.72) return null;
    if (runnerUp && best.score < 0.98 && best.score - runnerUp.score < 0.08) return null;
    return best;
  };
}

export async function loadCachedTeamAssetResolver(supabase) {
  if (!supabase) return createTeamAssetResolver();
  const { data, error } = await supabase
    .from("teams")
    .select("api_id,name,country,logo_url")
    .not("api_id", "is", null)
    .limit(1000);
  if (error) {
    console.warn(`Team logo cache could not be loaded: ${error.message}`);
    return createTeamAssetResolver();
  }
  return createTeamAssetResolver(data ?? []);
}
