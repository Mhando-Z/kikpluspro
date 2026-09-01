import { FOOTBALL_DATA_LEAGUES, canonicalTeamKey } from "../football-ai/constants.js";

const COMPETITION_NAMES = {
  E0: ["premier league", "english premier league"],
  SP1: ["la liga", "laliga", "laliga ea sports", "primera division"],
  I1: ["serie a"],
  D1: ["bundesliga"],
  F1: ["ligue 1"],
};

// TheStatsAPI uses stable provider IDs for these competitions. Resolve by ID
// first so branding changes such as "La Liga" -> "LaLiga" do not stop an
// import. Name and country matching remains as a guarded fallback.
const COMPETITION_IDS = {
  E0: "comp_3039",
  SP1: "comp_8814",
  I1: "comp_5840",
  D1: "comp_4643",
  F1: "comp_0256",
};

// TheStatsAPI generally uses official club names while Football-Data.co.uk
// sometimes uses shorter display names. Keep these aliases explicit so a
// broad fuzzy-match relaxation cannot accidentally merge clubs such as
// Manchester City and Manchester United.
const TEAM_NAME_ALIASES = new Map([
  // Premier League
  ["brighton and hove albion", "brighton"],
  ["brighton hove albion", "brighton"],
  ["ipswich town", "ipswich"],
  ["leeds united", "leeds"],
  ["leicester city", "leicester"],
  ["luton town", "luton"],
  ["newcastle united", "newcastle"],
  ["nott m forest", "nottingham forest"],
  ["nottm forest", "nottingham forest"],
  ["tottenham hotspur", "tottenham"],
  ["west ham united", "west ham"],
  ["wolverhampton", "wolves"],

  // La Liga
  ["athletic", "ath bilbao"],
  ["atletico madrid", "ath madrid"],
  ["celta vigo", "celta"],
  ["deportivo alaves", "alaves"],
  ["espanyol", "espanol"],
  ["levante ud", "levante"],
  ["rayo vallecano", "vallecano"],
  ["real betis", "betis"],
  ["real oviedo", "oviedo"],
  ["real sociedad", "sociedad"],
  ["real valladolid", "valladolid"],

  // Bundesliga
  ["1 fsv mainz 05", "mainz"],
  ["1 heidenheim", "heidenheim"],
  ["1 koln", "koln"],
  ["1 union berlin", "union berlin"],
  ["bayer 04 leverkusen", "leverkusen"],
  ["bayern munchen", "bayern munich"],
  ["borussia dortmund", "dortmund"],
  ["borussia m gladbach", "m gladbach"],
  ["darmstadt 98", "darmstadt"],
  ["eintracht frankfurt", "ein frankfurt"],
  ["hamburger sv", "hamburg"],
  ["hertha bsc", "hertha"],
  ["sc freiburg", "freiburg"],
  ["sv werder bremen", "werder bremen"],
  ["tsg hoffenheim", "hoffenheim"],
  ["vfb stuttgart", "stuttgart"],
  ["vfl bochum 1848", "bochum"],
  ["vfl wolfsburg", "wolfsburg"],

  // Ligue 1
  ["as monaco", "monaco"],
  ["clermont foot", "clermont"],
  ["olympique de marseille", "marseille"],
  ["olympique lyonnais", "lyon"],
  ["paris st germain", "paris sg"],
  ["rc lens", "lens"],
  ["rc strasbourg", "strasbourg"],
  ["stade brestois", "brest"],
  ["stade de reims", "reims"],
  ["stade rennais", "rennes"],
]);

function normalized(value) {
  const name = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|ac|ssc|calcio|club|football)\b/g, " ")
    .replace(/saint/g, "st")
    .replace(/manchester/g, "man")
    .replace(/internazionale/g, "inter")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return TEAM_NAME_ALIASES.get(name) ?? name;
}

function bigrams(value) {
  const compact = normalized(value).replace(/\s/g, "");
  if (compact.length < 2) return new Set([compact]);
  return new Set(Array.from({ length: compact.length - 1 }, (_, index) => compact.slice(index, index + 2)));
}

export function nameSimilarity(left, right) {
  const a = normalized(left);
  const b = normalized(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  const overlap = [...aPairs].filter((pair) => bPairs.has(pair)).length;
  return (2 * overlap) / Math.max(1, aPairs.size + bPairs.size);
}

export function leagueCodeForCompetition(competition) {
  const providerId = String(competition?.id ?? "");
  const codeById = Object.keys(COMPETITION_IDS).find((code) => COMPETITION_IDS[code] === providerId);
  if (codeById) return codeById;

  const name = normalized(competition?.name);
  const country = normalized(competition?.country);
  return Object.keys(FOOTBALL_DATA_LEAGUES).find((code) => {
    const league = FOOTBALL_DATA_LEAGUES[code];
    return COMPETITION_NAMES[code].includes(name) && country === normalized(league.countryCode);
  }) ?? null;
}

export function providerMatchRow(match, { leagueCode, seasonStart, aiMatchId = null } = {}) {
  const league = FOOTBALL_DATA_LEAGUES[leagueCode];
  if (!league || !match?.id || !match?.home_team?.name || !match?.away_team?.name) return null;
  const matchDate = String(match.utc_date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) return null;
  return {
    provider_match_id: String(match.id),
    ai_match_id: aiMatchId,
    competition_id: String(match.competition_id),
    season_id: String(match.season_id),
    league_code: leagueCode,
    season_start: Number(seasonStart),
    match_date: matchDate,
    kickoff_at: match.utc_date,
    status: match.status,
    provider_home_team_id: String(match.home_team.id),
    provider_away_team_id: String(match.away_team.id),
    home_team_name: match.home_team.name,
    away_team_name: match.away_team.name,
    home_team_key: aiMatchId ? null : canonicalTeamKey(league.countryCode, match.home_team.name),
    away_team_key: aiMatchId ? null : canonicalTeamKey(league.countryCode, match.away_team.name),
    home_goals: Number.isFinite(Number(match.score?.home)) ? Number(match.score.home) : null,
    away_goals: Number.isFinite(Number(match.score?.away)) ? Number(match.score.away) : null,
    odds_available: Boolean(match.odds_available),
    xg_available: Boolean(match.xg_available),
    raw_payload: match,
  };
}

function valuePair(data, category, field) {
  const value = data?.[category]?.[field] ?? data?.overview?.[field] ?? data?.[field];
  const pair = value?.all ?? value;
  const home = Number(pair?.home);
  const away = Number(pair?.away);
  return {
    home: Number.isFinite(home) ? home : null,
    away: Number.isFinite(away) ? away : null,
  };
}

export function normalizeMatchStats(providerMatch, response, aiMatchId = null) {
  const data = response?.data ?? response ?? {};
  const xg = valuePair(data, "overview", "expected_goals");
  const npxg = valuePair(data, "root", "np_expected_goals");
  const shots = valuePair(data, "shots", "total_shots");
  const shotsOnTarget = valuePair(data, "shots", "shots_on_target");
  const bigChances = valuePair(data, "overview", "big_chances");
  const boxTouches = valuePair(data, "attack", "touches_in_penalty_area");
  const finalThird = valuePair(data, "passes", "final_third_entries");
  const possession = valuePair(data, "overview", "ball_possession");
  const goalsPrevented = valuePair(data, "goalkeeping", "goals_prevented");

  return {
    provider_match_id: String(providerMatch.id),
    ai_match_id: aiMatchId,
    home_xg: xg.home,
    away_xg: xg.away,
    home_npxg: npxg.home,
    away_npxg: npxg.away,
    home_shots: shots.home,
    away_shots: shots.away,
    home_shots_on_target: shotsOnTarget.home,
    away_shots_on_target: shotsOnTarget.away,
    home_big_chances: bigChances.home,
    away_big_chances: bigChances.away,
    home_box_touches: boxTouches.home,
    away_box_touches: boxTouches.away,
    home_final_third_entries: finalThird.home,
    away_final_third_entries: finalThird.away,
    home_possession: possession.home,
    away_possession: possession.away,
    home_goals_prevented: goalsPrevented.home,
    away_goals_prevented: goalsPrevented.away,
    coverage: { stats: true, xg: xg.home !== null || npxg.home !== null },
    retrieved_at: new Date().toISOString(),
  };
}

function averageOdds(bookmakers, outcome, field) {
  const values = bookmakers
    .map((bookmaker) => Number(bookmaker?.markets?.match_odds?.[outcome]?.[field]))
    .filter((value) => Number.isFinite(value) && value > 1);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function normalizeMatchOdds(providerMatch, response, aiMatchId = null) {
  const bookmakers = response?.data?.bookmakers ?? [];
  return {
    provider_match_id: String(providerMatch.id),
    ai_match_id: aiMatchId,
    opening_home_odds: averageOdds(bookmakers, "home", "opening"),
    opening_draw_odds: averageOdds(bookmakers, "draw", "opening"),
    opening_away_odds: averageOdds(bookmakers, "away", "opening"),
    closing_home_odds: averageOdds(bookmakers, "home", "last_seen"),
    closing_draw_odds: averageOdds(bookmakers, "draw", "last_seen"),
    closing_away_odds: averageOdds(bookmakers, "away", "last_seen"),
    coverage: { odds: bookmakers.length > 0 },
    retrieved_at: new Date().toISOString(),
  };
}

export function mergeEnrichmentRows(stats, odds) {
  const coverage = { ...(stats?.coverage ?? {}), ...(odds?.coverage ?? {}) };
  return { ...(stats ?? {}), ...(odds ?? {}), coverage };
}

export function enrichTrainingMatches(matches, enrichments) {
  const byMatch = new Map(enrichments.filter((row) => row.ai_match_id).map((row) => [row.ai_match_id, row]));
  return matches.map((match) => {
    const row = byMatch.get(match.id);
    if (!row) return match;
    return {
      ...match,
      home_xg: match.home_xg ?? row.home_xg,
      away_xg: match.away_xg ?? row.away_xg,
      home_npxg: row.home_npxg,
      away_npxg: row.away_npxg,
      home_shots: match.home_shots ?? row.home_shots,
      away_shots: match.away_shots ?? row.away_shots,
      home_shots_on_target: match.home_shots_on_target ?? row.home_shots_on_target,
      away_shots_on_target: match.away_shots_on_target ?? row.away_shots_on_target,
      opening_home_odds: match.opening_home_odds ?? row.opening_home_odds,
      opening_draw_odds: match.opening_draw_odds ?? row.opening_draw_odds,
      opening_away_odds: match.opening_away_odds ?? row.opening_away_odds,
      closing_home_odds: match.closing_home_odds ?? row.closing_home_odds,
      closing_draw_odds: match.closing_draw_odds ?? row.closing_draw_odds,
      closing_away_odds: match.closing_away_odds ?? row.closing_away_odds,
      enrichment_coverage: row.coverage,
    };
  });
}

export function findLinkedAiMatch(providerMatch, candidates) {
  const date = String(providerMatch.utc_date ?? "").slice(0, 10);
  const homeName = providerMatch.home_team?.name;
  const awayName = providerMatch.away_team?.name;
  const homeGoals = Number(providerMatch.score?.home);
  const awayGoals = Number(providerMatch.score?.away);
  let best = null;

  for (const candidate of candidates) {
    const dateDistance = Math.abs(new Date(`${date}T12:00:00Z`) - new Date(`${candidate.match_date}T12:00:00Z`)) / 86_400_000;
    if (dateDistance > 1) continue;
    const names = nameSimilarity(homeName, candidate.home_team_name) + nameSimilarity(awayName, candidate.away_team_name);
    const scoreBonus = homeGoals === Number(candidate.home_goals) && awayGoals === Number(candidate.away_goals) ? 0.2 : 0;
    const score = names + scoreBonus - dateDistance * 0.15;
    if (!best || score > best.score) best = { score, candidate };
  }
  return best?.score >= 1.55 ? best.candidate : null;
}
