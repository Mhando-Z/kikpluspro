const item = (id, path, ttl, params = [], required = [], isPublic = true) => ({
  id,
  path,
  ttl,
  params,
  required,
  isPublic,
});

export const ENDPOINTS = [
  item("status", "/status", 300, [], [], false),
  item("timezone", "/timezone", 2592000),
  item("countries", "/countries", 604800, ["name", "code", "search"]),
  item("leagues", "/leagues", 86400, ["id", "name", "country", "code", "season", "team", "type", "current", "search", "last"]),
  item("league-seasons", "/leagues/seasons", 604800),
  item("teams", "/teams", 86400, ["id", "name", "league", "season", "country", "code", "venue", "search"]),
  item("team-statistics", "/teams/statistics", 3600, ["league", "season", "team", "date"], ["league", "season", "team"]),
  item("team-seasons", "/teams/seasons", 604800, ["team"], ["team"]),
  item("team-countries", "/teams/countries", 604800),
  item("venues", "/venues", 604800, ["id", "name", "city", "country", "search"]),
  item("standings", "/standings", 3600, ["league", "season", "team"], ["season"]),
  item("fixture-rounds", "/fixtures/rounds", 21600, ["league", "season", "current", "dates"], ["league", "season"]),
  item("fixtures", "/fixtures", 30, ["id", "ids", "live", "date", "league", "season", "team", "last", "next", "from", "to", "round", "status", "venue", "timezone"]),
  item("fixture-headtohead", "/fixtures/headtohead", 86400, ["h2h", "date", "league", "season", "last", "next", "from", "to", "status", "venue", "timezone"], ["h2h"]),
  item("fixture-statistics", "/fixtures/statistics", 60, ["fixture", "team", "type", "half"], ["fixture"]),
  item("fixture-events", "/fixtures/events", 20, ["fixture", "team", "player", "type"], ["fixture"]),
  item("fixture-lineups", "/fixtures/lineups", 600, ["fixture", "team", "player", "type"], ["fixture"]),
  item("fixture-players", "/fixtures/players", 60, ["fixture", "team"], ["fixture"]),
  item("injuries", "/injuries", 14400, ["league", "season", "fixture", "team", "player", "date", "timezone"]),
  item("predictions", "/predictions", 3600, ["fixture"], ["fixture"]),
  item("coachs", "/coachs", 86400, ["id", "team", "search"]),
  item("player-seasons", "/players/seasons", 604800, ["player"], ["player"]),
  item("player-profiles", "/players/profiles", 604800, ["player", "search", "page"]),
  item("players", "/players", 86400, ["id", "team", "league", "season", "search", "page"], ["season"]),
  item("player-squads", "/players/squads", 86400, ["team", "player"]),
  item("player-teams", "/players/teams", 604800, ["player"], ["player"]),
  item("top-scorers", "/players/topscorers", 21600, ["league", "season"], ["league", "season"]),
  item("top-assists", "/players/topassists", 21600, ["league", "season"], ["league", "season"]),
  item("top-yellow-cards", "/players/topyellowcards", 21600, ["league", "season"], ["league", "season"]),
  item("top-red-cards", "/players/topredcards", 21600, ["league", "season"], ["league", "season"]),
  item("transfers", "/transfers", 86400, ["player", "team"]),
  item("trophies", "/trophies", 604800, ["player", "coach"]),
  item("sidelined", "/sidelined", 86400, ["player", "coach"]),
  item("live-odds", "/odds/live", 15, ["fixture", "league", "bet"]),
  item("live-bets", "/odds/live/bets", 604800, ["id", "search"]),
  item("odds", "/odds", 10800, ["fixture", "league", "season", "date", "timezone", "page", "bookmaker", "bet"]),
  item("odds-mapping", "/odds/mapping", 10800, ["page"]),
  item("bookmakers", "/odds/bookmakers", 604800, ["id", "search"]),
  item("bet-types", "/odds/bets", 604800, ["id", "search"]),
];

export const BY_ID = Object.fromEntries(ENDPOINTS.map((entry) => [entry.id, entry]));
export const BY_PATH = Object.fromEntries(ENDPOINTS.map((entry) => [entry.path, entry]));

export function resolveEndpoint(value) {
  return BY_ID[value] ?? BY_PATH[value] ?? null;
}

export function sanitizeParams(definition, input = {}) {
  return Object.fromEntries(
    definition.params
      .filter((key) => input[key] !== undefined && input[key] !== null && input[key] !== "")
      .map((key) => [key, String(input[key])])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

