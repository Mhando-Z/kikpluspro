import { pathToFileURL } from "node:url";
import {
  DOMESTIC_EXPANSION_CODES,
  FOOTBALL_DATA_LEAGUES,
} from "../../lib/football-ai/constants.js";
import { createStatsApiClient } from "../../lib/thestatsapi/client.js";
import { THESTATSAPI_COMPETITION_IDS } from "../../lib/thestatsapi/transform.js";

const DATA_TYPES = ["fixtures", "team_stats", "xg", "odds", "lineups", "player_stats", "standings"];

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

function requestedLeagues(args) {
  const codes = String(args.leagues ?? DOMESTIC_EXPANSION_CODES.join(","))
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const unknown = codes.filter((code) => !FOOTBALL_DATA_LEAGUES[code] || !THESTATSAPI_COMPETITION_IDS[code]);
  if (unknown.length) throw new Error(`TheStatsAPI competition IDs are not configured for: ${unknown.join(", ")}`);
  return codes;
}

function coverageValue(dataTypes, key) {
  const item = dataTypes?.[key] ?? {};
  return {
    available: Boolean(item.available),
    coveredEvents: Number(item.covered_events ?? 0),
    coveragePercent: Number(item.coverage_pct ?? 0),
  };
}

export function summarizeCoverage(code, payload) {
  const data = payload?.data ?? payload ?? {};
  const seasons = Array.isArray(data.seasons) ? data.seasons : [];
  const latest = seasons[0] ?? null;
  const dataTypes = latest?.data_types ?? data.data_types ?? {};
  return {
    code,
    competitionId: String(data.id ?? THESTATSAPI_COMPETITION_IDS[code]),
    competition: data.name ?? FOOTBALL_DATA_LEAGUES[code]?.name ?? code,
    loadedSeasons: Number(data.loaded_seasons ?? data.total_seasons ?? seasons.length),
    latestSeason: latest?.name ?? latest?.year ?? null,
    finishedEvents: Number(latest?.events?.finished ?? latest?.finished_events ?? 0),
    dataTypes: Object.fromEntries(DATA_TYPES.map((key) => [key, coverageValue(dataTypes, key)])),
    seasons,
  };
}

function tableRow(summary) {
  const percentage = (key) => {
    const item = summary.dataTypes[key];
    return item.available ? `${item.coveragePercent.toFixed(1)}%` : "none";
  };
  return {
    code: summary.code,
    competition: summary.competition,
    competition_id: summary.competitionId,
    seasons: summary.loadedSeasons,
    latest: summary.latestSeason ?? "unknown",
    finished: summary.finishedEvents,
    fixtures: percentage("fixtures"),
    stats: percentage("team_stats"),
    xg: percentage("xg"),
    odds: percentage("odds"),
  };
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const leagueCodes = requestedLeagues(args);
  const api = createStatsApiClient({
    apiKey: process.env.THESTATSAPI_KEY,
    baseUrl: process.env.THESTATSAPI_BASE_URL,
    requestsPerMinute: process.env.THESTATSAPI_REQUESTS_PER_MINUTE ?? 220,
    maxRequests: Math.max(leagueCodes.length, Number(process.env.THESTATSAPI_COVERAGE_MAX_REQUESTS ?? 20)),
  });
  const summaries = [];
  for (const code of leagueCodes) {
    const competitionId = THESTATSAPI_COMPETITION_IDS[code];
    const payload = await api.get(`/coverage/leagues/${competitionId}`);
    summaries.push(summarizeCoverage(code, payload));
  }
  console.table(summaries.map(tableRow));
  console.log(JSON.stringify({
    requests: api.metrics.requests,
    competitions: summaries.map((summary) => ({
      ...tableRow(summary),
      dataTypes: summary.dataTypes,
    })),
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
