import { canonicalUclTeam } from "./ucl-teams.js";

export const OPENFOOTBALL_UCL_SOURCE_KEY = "openfootball-ucl";

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function uclFormatEra(seasonStart) {
  return Number(seasonStart) >= 2024 ? "league-phase" : "group-stage";
}

export function normalizeUclStage(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "unknown";
  if (text.startsWith("league")) return "league_phase";
  if (text.startsWith("group")) return "group_stage";
  if (/round of 16|last 16/.test(text)) return "round_of_16";
  if (/quarter/.test(text)) return "quarter_final";
  if (/semi/.test(text)) return "semi_final";
  if (/^final\b/.test(text)) return "final";
  if (/playoff|play-off/.test(text)) return "playoff";
  if (/qualif/.test(text)) return "qualifying";
  return text.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function knockoutStage(stage) {
  return ["round_of_16", "quarter_final", "semi_final", "playoff"].includes(stage);
}

export function parseOpenFootballUcl(text, seasonStart) {
  const matches = [];
  let matchDate = null;
  let stage = "unknown";
  let stageLabel = null;
  const legs = new Map();

  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("=")) continue;

    if (line.startsWith("▪")) {
      stageLabel = line.replace(/^▪\s*/, "").trim();
      stage = normalizeUclStage(stageLabel);
      continue;
    }

    const dateMatch = line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
    if (dateMatch) {
      const month = MONTHS[dateMatch[1]];
      const year = dateMatch[3] ? Number(dateMatch[3]) : month >= 7 ? Number(seasonStart) : Number(seasonStart) + 1;
      matchDate = isoDate(year, month, Number(dateMatch[2]));
      continue;
    }

    if (!matchDate) continue;
    const row = line.match(/^(?:(\d{1,2}:\d{2})\s+)?(.+?)\s+\(([A-Z]{3})\)\s+v\s+(.+?)\s+\(([A-Z]{3})\)\s+(\d+)-(\d+)(?:\s+\((\d+)-(\d+)\))?(.*)$/);
    if (!row) continue;
    const annotation = String(row[10] ?? "").trim();
    if (/\b(?:a\.?e\.?t\.?|pen(?:alty|alties|\.)?)\b/i.test(annotation)) continue;

    const home = canonicalUclTeam(row[2], row[3]);
    const away = canonicalUclTeam(row[4], row[5]);
    const homeGoals = Number(row[6]);
    const awayGoals = Number(row[7]);
    const pairKey = [stage, ...[home.key, away.key].sort()].join(":");
    const nextLeg = knockoutStage(stage) ? Math.min(2, (legs.get(pairKey) ?? 0) + 1) : null;
    if (nextLeg) legs.set(pairKey, nextLeg);

    matches.push({
      seasonStart: Number(seasonStart),
      matchDate,
      kickoffTime: row[1] ? `${row[1].padStart(5, "0")}:00` : null,
      stage,
      stageLabel,
      formatEra: uclFormatEra(seasonStart),
      leg: nextLeg,
      neutralVenue: stage === "final",
      home,
      away,
      homeGoals,
      awayGoals,
      halfHomeGoals: row[8] === undefined ? null : Number(row[8]),
      halfAwayGoals: row[9] === undefined ? null : Number(row[9]),
      result: homeGoals > awayGoals ? "H" : homeGoals < awayGoals ? "A" : "D",
      rawLine: line,
    });
  }
  return matches;
}
