const COUNTRY_NAMES = {
  blr: "belarus",
  "czech republic": "czechia",
  england: "england",
  france: "france",
  germany: "germany",
  italy: "italy",
  mda: "moldova",
  "republic of ireland": "ireland",
  rus: "russia",
  spain: "spain",
  turkiye: "turkey",
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
  "blackburn": "blackburn rovers",
  "birmingham": "birmingham city",
  "cardiff": "cardiff city",
  "coventry": "coventry city",
  "derby": "derby county",
  "hull": "hull city",
  "norwich": "norwich city",
  "preston": "preston north end",
  qpr: "queens park rangers",
  "sheffield weds": "sheffield wednesday",
  "stoke": "stoke city",
  "swansea": "swansea city",
  "athletic bilbao": "athletic club",
  "betis": "real betis",
  "celta": "celta vigo",
  "espanol": "espanyol",
  "la coruna": "deportivo la coruna",
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
  "st gilloise": "union saint gilloise",
  "st truiden": "sint truidense",
  "heart of midlothian": "hearts",
  "afc ajax": "ajax",
  "bayer 04 leverkusen": "bayer leverkusen",
  "club atletico de madrid": "atletico madrid",
  "fc bayern munchen": "bayern munich",
  "fc copenhagen": "copenhagen",
  "fc internazionale milano": "inter",
  "feyenoord rotterdam": "feyenoord",
  "internazionale": "inter",
  lask: "lask linz",
  "olympique de marseille": "marseille",
  "olympique lyonnais": "lyon",
  "psv eindhoven": "psv",
  "rb salzburg": "salzburg",
  "red bull salzburg": "salzburg",
  "sl benfica": "benfica",
  "sporting cp": "sporting lisbon",
  "sporting clube de portugal": "sporting lisbon",
};

// TheStatsAPI does not include an association for every UCL qualifier. Keep
// tightly scoped hints for observed active fixtures instead of disabling the
// country guard for every team stored under the generic `europe` region.
const UCL_TEAM_COUNTRY_HINTS = {
  "aek athens": "greece",
  "bodo glimt": "norway",
  fenerbahce: "turkey",
  galatasaray: "turkey",
  lask: "austria",
  "psv eindhoven": "netherlands",
  "sabah fk": "azerbaijan",
  "sk slavia praha": "czechia",
  "sk slovan bratislava": "slovakia",
  "viking fk": "norway",
};

const CLUB_TOKENS = new Set([
  "1", "04", "05", "07", "1899", "1907", "1909", "1913",
  "ac", "acf", "afc", "as", "bc", "calcio", "cf", "cfc", "fa", "fc", "fk",
  "club", "kv", "ogc", "rc", "rcd", "sc", "sco", "sk", "sl", "ss", "ssc",
  "sv", "tsg", "ud", "us", "vfb", "vfl",
]);

export const TEAM_ASSET_SYNC_JOBS = [
  ["England", { country: "England" }],
  ["Spain", { country: "Spain" }],
  ["Italy", { country: "Italy" }],
  ["Germany", { country: "Germany" }],
  ["France", { country: "France" }],
  ["Belgium", { country: "Belgium" }],
  ["Scotland", { country: "Scotland" }],
  ["UEFA Champions League 2024/25", { league: "2", season: "2024" }],
].map(([label, params]) => ({ label, endpoint: "teams", params, force: true }));

export const EXPANSION_TEAM_ASSET_SYNC_JOBS = [
  ["EFL Championship", { country: "England" }],
  ["Belgian Pro League", { country: "Belgium" }],
  ["Scottish Premiership", { country: "Scotland" }],
].map(([label, params]) => ({ label, endpoint: "teams", params, force: true }));

export const TARGETED_TEAM_ASSET_SYNC_JOBS = [
  ["Greece", { country: "Greece" }],
  ["Portugal", { country: "Portugal" }],
  ["Austria", { country: "Austria" }],
  ["Azerbaijan", { country: "Azerbaijan" }],
  ["Norway", { country: "Norway" }],
].map(([label, params]) => ({ label, endpoint: "teams", params, force: true }));

export function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[đĐðÐ]/g, "d")
    .replace(/[łŁ]/g, "l")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .replace(/[þÞ]/g, "th")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function canonicalName(value) {
  const normalized = normalizeTeamName(value);
  const withoutClubTokens = normalized
    .split(" ")
    .filter((token) => token && !CLUB_TOKENS.has(token))
    .join(" ");
  return TEAM_ALIASES[normalized] ?? TEAM_ALIASES[withoutClubTokens] ?? normalized;
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

function expectedCountryFor(name, country) {
  const storedCountry = normalizedCountry(country);
  if (storedCountry !== "europe") return storedCountry;
  return UCL_TEAM_COUNTRY_HINTS[normalizeTeamName(name)] ?? storedCountry;
}

export function createTeamAssetResolver(rows = [], canonicalRows = []) {
  const candidates = rows
    .filter((row) => row?.api_id && row?.name)
    .map((row) => ({
      apiFootballId: Number(row.api_id),
      name: row.name,
      country: normalizedCountry(row.country),
      logo: row.logo_url || apiFootballTeamLogo(row.api_id),
    }));

  const canonicalAssets = new Map(
    canonicalRows
      .filter((row) => row?.canonical_key && (row?.logo_url || row?.api_football_team_id))
      .map((row) => [row.canonical_key, {
        apiFootballId: row.api_football_team_id ? Number(row.api_football_team_id) : null,
        name: row.display_name,
        country: normalizedCountry(row.country_code),
        logo: row.logo_url || apiFootballTeamLogo(row.api_football_team_id),
        score: row.logo_match_score === null || row.logo_match_score === undefined
          ? 1
          : Number(row.logo_match_score),
        matchMethod: "canonical-key",
      }]),
  );

  return ({ canonicalKey, name, country, countryCode } = {}) => {
    if (canonicalKey && canonicalAssets.has(canonicalKey)) return canonicalAssets.get(canonicalKey);
    const expectedCountry = expectedCountryFor(name, countryCode ?? country);
    const eligible = candidates.filter((candidate) => !expectedCountry || candidate.country === expectedCountry);
    const ranked = eligible
      .map((candidate) => ({ ...candidate, score: teamNameMatchScore(name, candidate.name) }))
      .sort((left, right) => right.score - left.score);
    const best = ranked[0];
    const runnerUp = ranked[1];
    if (!best || best.score < 0.72) return null;
    if (runnerUp && best.score < 0.98 && best.score - runnerUp.score < 0.08) return null;
    return { ...best, matchMethod: best.score >= 0.98 ? "name" : "fuzzy-name" };
  };
}

async function loadPagedRows(supabase, table, columns, maximum = 10000) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; offset < maximum; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, Math.min(maximum, offset + pageSize) - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}

export async function loadCachedTeamAssetResolver(supabase) {
  if (!supabase) return createTeamAssetResolver();
  const [catalog, canonical] = await Promise.all([
    loadPagedRows(supabase, "teams", "api_id,name,country,logo_url"),
    loadPagedRows(
      supabase,
      "ai_teams",
      "canonical_key,display_name,country_code,api_football_team_id,logo_url,logo_match_score",
    ),
  ]);
  if (catalog.error) {
    console.warn(`Team logo cache could not be loaded: ${catalog.error.message}`);
  }
  if (canonical.error && !canonical.error.message.includes("logo_url")) {
    console.warn(`Canonical team assets could not be loaded: ${canonical.error.message}`);
  }
  return createTeamAssetResolver(catalog.data ?? [], canonical.error ? [] : canonical.data ?? []);
}

function rankedCandidates(aiTeam, apiTeams) {
  const expectedCountry = expectedCountryFor(aiTeam.display_name, aiTeam.country_code);
  return apiTeams
    .filter((candidate) => !expectedCountry || normalizedCountry(candidate.country) === expectedCountry)
    .map((candidate) => ({ candidate, score: teamNameMatchScore(aiTeam.display_name, candidate.name) }))
    .sort((left, right) => right.score - left.score);
}

export function matchTeamAssets(aiTeams = [], apiTeams = []) {
  const catalogById = new Map(apiTeams.map((team) => [String(team.api_id), team]));
  const preserved = [];
  const proposals = [];
  const inherited = [];
  const unresolved = [];

  for (const aiTeam of aiTeams) {
    const existingId = String(aiTeam.api_football_team_id ?? "");
    const existing = existingId ? catalogById.get(existingId) : null;
    if (existing) {
      proposals.push({ aiTeam, apiTeam: existing, score: 1, method: "existing-link" });
      continue;
    }
    if (existingId && aiTeam.logo_url) {
      preserved.push({ aiTeam, apiFootballId: Number(existingId), logo: aiTeam.logo_url });
      continue;
    }

    const ranked = rankedCandidates(aiTeam, apiTeams);
    const best = ranked[0];
    const runnerUp = ranked[1];
    if (!best || best.score < 0.72) {
      unresolved.push({
        canonicalKey: aiTeam.canonical_key,
        name: aiTeam.display_name,
        countryCode: aiTeam.country_code,
        reason: "no-confident-match",
        bestCandidate: best?.candidate?.name ?? null,
        bestScore: best ? Number(best.score.toFixed(4)) : null,
      });
      continue;
    }
    if (runnerUp && best.score < 0.98 && best.score - runnerUp.score < 0.08) {
      unresolved.push({
        canonicalKey: aiTeam.canonical_key,
        name: aiTeam.display_name,
        countryCode: aiTeam.country_code,
        reason: "ambiguous-match",
        bestCandidate: best.candidate.name,
        bestScore: Number(best.score.toFixed(4)),
      });
      continue;
    }
    proposals.push({
      aiTeam,
      apiTeam: best.candidate,
      score: best.score,
      method: best.score >= 0.999 ? "exact-name" : best.score >= 0.98 ? "normalized-name" : "fuzzy-name",
    });
  }

  proposals.sort((left, right) => (
    right.score - left.score
    || Number(right.method === "existing-link") - Number(left.method === "existing-link")
  ));
  const assignedApiIds = new Set();
  const matches = [];
  for (const proposal of proposals) {
    const apiId = String(proposal.apiTeam.api_id);
    if (assignedApiIds.has(apiId)) {
      inherited.push({
        canonicalKey: proposal.aiTeam.canonical_key,
        displayName: proposal.aiTeam.display_name,
        countryCode: proposal.aiTeam.country_code,
        metadata: proposal.aiTeam.metadata ?? {},
        sourceApiFootballId: Number(proposal.apiTeam.api_id),
        apiFootballName: proposal.apiTeam.name,
        logo: apiFootballTeamLogo(proposal.apiTeam.api_id) ?? proposal.apiTeam.logo_url ?? null,
        score: Number(proposal.score.toFixed(4)),
        method: "alias-inheritance",
      });
      continue;
    }
    assignedApiIds.add(apiId);
    matches.push({
      canonicalKey: proposal.aiTeam.canonical_key,
      displayName: proposal.aiTeam.display_name,
      countryCode: proposal.aiTeam.country_code,
      metadata: proposal.aiTeam.metadata ?? {},
      apiFootballId: Number(proposal.apiTeam.api_id),
      apiFootballName: proposal.apiTeam.name,
      apiFootballCountry: proposal.apiTeam.country,
      logo: apiFootballTeamLogo(proposal.apiTeam.api_id) ?? proposal.apiTeam.logo_url ?? null,
      score: Number(proposal.score.toFixed(4)),
      method: proposal.method,
    });
  }

  return { matches, inherited, preserved, unresolved };
}

async function upsertBatches(supabase, table, rows, onConflict, size = 400) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

function setupError(error) {
  const message = error instanceof Error ? error.message : error?.message ?? String(error);
  const mentionsAssetColumn = message.includes("api_football_team_id")
    || message.includes("logo_match_score");
  const isMissingColumn = /could not find .*column|column .* does not exist/i.test(message);
  if (mentionsAssetColumn && isMissingColumn) {
    return new Error("Apply supabase/migrations/202609010003_team_assets.sql before reconciling team assets.");
  }
  return error instanceof Error ? error : new Error(message);
}

export async function reconcileCachedTeamAssets(supabase) {
  if (!supabase) throw new Error("Supabase service-role credentials are not configured.");
  try {
    const [aiResult, catalogResult] = await Promise.all([
      loadPagedRows(
        supabase,
        "ai_teams",
        "canonical_key,display_name,country_code,metadata,api_football_team_id,logo_url,logo_match_score",
      ),
      loadPagedRows(supabase, "teams", "api_id,name,country,logo_url"),
    ]);
    if (aiResult.error) throw aiResult.error;
    if (catalogResult.error) throw catalogResult.error;

    const outcome = matchTeamAssets(aiResult.data, catalogResult.data);
    const now = new Date().toISOString();
    const teamRows = outcome.matches.map((match) => ({
      canonical_key: match.canonicalKey,
      display_name: match.displayName,
      country_code: match.countryCode,
      metadata: match.metadata,
      api_football_team_id: match.apiFootballId,
      logo_url: match.logo,
      logo_source: "api-football",
      logo_match_score: match.score,
      logo_updated_at: now,
    }));
    const inheritedRows = outcome.inherited.map((match) => ({
      canonical_key: match.canonicalKey,
      display_name: match.displayName,
      country_code: match.countryCode,
      metadata: match.metadata,
      api_football_team_id: null,
      logo_url: match.logo,
      logo_source: "api-football-alias",
      logo_match_score: match.score,
      logo_updated_at: now,
    }));

    await supabase.from("ai_data_sources").upsert({
      source_key: "api-football",
      name: "API-Football",
      base_url: "https://v3.football.api-sports.io",
      license_name: "API-Football terms apply",
      license_url: "https://www.api-football.com/terms",
      metadata: { use: "team identity and descriptive logo assets", persistent_dependency: false },
      updated_at: now,
    }, { onConflict: "source_key" }).then(({ error }) => {
      if (error) throw new Error(`ai_data_sources: ${error.message}`);
    });

    await upsertBatches(supabase, "ai_teams", [...teamRows, ...inheritedRows], "canonical_key");
    await upsertBatches(supabase, "ai_provider_teams", outcome.matches.map((match) => ({
      provider: "api-football",
      provider_team_id: String(match.apiFootballId),
      provider_name: match.apiFootballName,
      country_code: match.countryCode,
      canonical_key: match.canonicalKey,
      metadata: {
        logo_url: match.logo,
        api_country: match.apiFootballCountry,
        match_score: match.score,
        match_method: match.method,
        synced_at: now,
      },
    })), "provider,provider_team_id");

    const resolvedKeys = new Set([
      ...aiResult.data.filter((team) => team.logo_url).map((team) => team.canonical_key),
      ...outcome.matches.map((match) => match.canonicalKey),
      ...outcome.inherited.map((match) => match.canonicalKey),
    ]);
    const unresolvedByKey = new Map(outcome.unresolved.map((team) => [team.canonicalKey, team]));
    const needsLogo = aiResult.data
      .filter((team) => !resolvedKeys.has(team.canonical_key))
      .map((team) => unresolvedByKey.get(team.canonical_key) ?? ({
        canonicalKey: team.canonical_key,
        name: team.display_name,
        countryCode: team.country_code,
        reason: "logo-unavailable",
      }));
    const identityLinked = teamRows.length + outcome.preserved.length;
    const assetsResolved = resolvedKeys.size;

    return {
      catalogTeams: catalogResult.data.length,
      aiTeams: aiResult.data.length,
      linked: assetsResolved,
      assetsResolved,
      identityLinked,
      matchedThisRun: teamRows.length,
      inheritedThisRun: inheritedRows.length,
      preserved: outcome.preserved.length,
      unresolvedCount: needsLogo.length,
      identityUnresolvedCount: aiResult.data.length - identityLinked,
      coverage: aiResult.data.length
        ? Number((assetsResolved / aiResult.data.length).toFixed(4))
        : 0,
      unresolved: needsLogo.slice(0, 50),
      syncedAt: now,
    };
  } catch (error) {
    throw setupError(error);
  }
}

export async function loadTeamAssetReport(supabase) {
  if (!supabase) throw new Error("Supabase service-role credentials are not configured.");
  try {
    const [{ data: aiTeams, error }, { count: catalogTeams, error: countError }] = await Promise.all([
      loadPagedRows(
        supabase,
        "ai_teams",
        "canonical_key,display_name,country_code,api_football_team_id,logo_url,logo_source,logo_match_score,logo_updated_at",
      ),
      supabase.from("teams").select("api_id", { count: "exact", head: true }),
    ]);
    if (error) throw error;
    if (countError) throw countError;
    const assetsResolved = aiTeams.filter((team) => team.logo_url);
    const identityLinked = aiTeams.filter((team) => team.logo_url && team.api_football_team_id);
    const unresolved = aiTeams
      .filter((team) => !team.logo_url)
      .map((team) => ({
        canonicalKey: team.canonical_key,
        name: team.display_name,
        countryCode: team.country_code,
      }));
    const byCountry = Object.values(aiTeams.reduce((summary, team) => {
      const key = team.country_code || "unknown";
      summary[key] ??= { countryCode: key, total: 0, linked: 0, identityLinked: 0, unresolved: 0 };
      summary[key].total += 1;
      if (team.logo_url) summary[key].linked += 1;
      else summary[key].unresolved += 1;
      if (team.logo_url && team.api_football_team_id) summary[key].identityLinked += 1;
      return summary;
    }, {})).sort((left, right) => right.unresolved - left.unresolved || left.countryCode.localeCompare(right.countryCode));
    return {
      catalogTeams: catalogTeams ?? 0,
      aiTeams: aiTeams.length,
      linked: assetsResolved.length,
      assetsResolved: assetsResolved.length,
      identityLinked: identityLinked.length,
      unresolvedCount: unresolved.length,
      identityUnresolvedCount: aiTeams.length - identityLinked.length,
      coverage: aiTeams.length ? Number((assetsResolved.length / aiTeams.length).toFixed(4)) : 0,
      unresolved: unresolved.slice(0, 50),
      byCountry,
      lastUpdatedAt: assetsResolved.reduce((latest, team) =>
        !team.logo_updated_at || latest >= team.logo_updated_at ? latest : team.logo_updated_at, "") || null,
    };
  } catch (error) {
    throw setupError(error);
  }
}
