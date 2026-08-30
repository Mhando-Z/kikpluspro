export const ENDPOINT_CATEGORIES = [
  "System",
  "Reference",
  "Competitions",
  "Teams",
  "Fixtures",
  "Players",
  "Availability",
  "Intelligence",
  "Betting",
];

const endpoint = (definition) => ({
  method: "GET",
  freshnessSeconds: 3600,
  params: [],
  required: [],
  ...definition,
});

export const API_FOOTBALL_ENDPOINTS = [
  endpoint({ id: "status", category: "System", path: "/status", title: "Account status", description: "Subscription and request quota usage.", freshnessSeconds: 300, sample: {} }),
  endpoint({ id: "timezone", category: "Reference", path: "/timezone", title: "Timezones", description: "Supported IANA timezone identifiers.", freshnessSeconds: 2592000, sample: {} }),
  endpoint({ id: "countries", category: "Reference", path: "/countries", title: "Countries", description: "Countries and flags covered by the football API.", params: ["name", "code", "search"], freshnessSeconds: 604800, sample: {} }),
  endpoint({ id: "leagues", category: "Competitions", path: "/leagues", title: "Leagues & cups", description: "Competition metadata, seasons and feature coverage.", params: ["id", "name", "country", "code", "season", "team", "type", "current", "search", "last"], freshnessSeconds: 86400, sample: { current: "true" } }),
  endpoint({ id: "league-seasons", category: "Competitions", path: "/leagues/seasons", title: "Available seasons", description: "All seasons currently available in API-Football.", freshnessSeconds: 604800, sample: {} }),
  endpoint({ id: "standings", category: "Competitions", path: "/standings", title: "Standings", description: "Rank, points, form and home/away records.", params: ["league", "season", "team"], required: ["season"], freshnessSeconds: 3600, sample: { league: "39", season: "2024" } }),

  endpoint({ id: "teams", category: "Teams", path: "/teams", title: "Teams", description: "Club or national-team profiles and venues.", params: ["id", "name", "league", "season", "country", "code", "venue", "search"], freshnessSeconds: 86400, sample: { league: "39", season: "2024" } }),
  endpoint({ id: "team-statistics", category: "Teams", path: "/teams/statistics", title: "Team statistics", description: "Season performance totals, form and biggest results.", params: ["league", "season", "team", "date"], required: ["league", "season", "team"], freshnessSeconds: 3600, sample: { league: "39", season: "2024", team: "33" } }),
  endpoint({ id: "team-seasons", category: "Teams", path: "/teams/seasons", title: "Team seasons", description: "Seasons available for a specific team.", params: ["team"], required: ["team"], freshnessSeconds: 604800, sample: { team: "33" } }),
  endpoint({ id: "team-countries", category: "Teams", path: "/teams/countries", title: "Team countries", description: "Countries represented in the teams dataset.", freshnessSeconds: 604800, sample: {} }),
  endpoint({ id: "venues", category: "Teams", path: "/venues", title: "Venues", description: "Stadium address, capacity, city and playing surface.", params: ["id", "name", "city", "country", "search"], freshnessSeconds: 604800, sample: { search: "old" } }),
  endpoint({ id: "coachs", category: "Teams", path: "/coachs", title: "Coaches", description: "Coach profile, current team and career history.", params: ["id", "team", "search"], freshnessSeconds: 86400, sample: { team: "33" } }),

  endpoint({ id: "fixture-rounds", category: "Fixtures", path: "/fixtures/rounds", title: "Fixture rounds", description: "Competition rounds or the current matchday.", params: ["league", "season", "current", "dates"], required: ["league", "season"], freshnessSeconds: 21600, sample: { league: "39", season: "2024", current: "true" } }),
  endpoint({ id: "fixtures", category: "Fixtures", path: "/fixtures", title: "Fixtures & live scores", description: "Schedules, scores, statuses, venues and score breakdowns.", params: ["id", "ids", "live", "date", "league", "season", "team", "last", "next", "from", "to", "round", "status", "venue", "timezone"], freshnessSeconds: 30, sample: { live: "all" } }),
  endpoint({ id: "fixture-headtohead", category: "Fixtures", path: "/fixtures/headtohead", title: "Head to head", description: "Historical meetings between two teams.", params: ["h2h", "date", "league", "season", "last", "next", "from", "to", "status", "venue", "timezone"], required: ["h2h"], freshnessSeconds: 86400, sample: { h2h: "33-40", last: "5" } }),
  endpoint({ id: "fixture-statistics", category: "Fixtures", path: "/fixtures/statistics", title: "Match statistics", description: "Shots, possession, corners, passes and discipline.", params: ["fixture", "team", "type", "half"], required: ["fixture"], freshnessSeconds: 60, sample: { fixture: "1200000" } }),
  endpoint({ id: "fixture-events", category: "Fixtures", path: "/fixtures/events", title: "Match events", description: "Chronological goals, cards and substitutions.", params: ["fixture", "team", "player", "type"], required: ["fixture"], freshnessSeconds: 20, sample: { fixture: "1200000" } }),
  endpoint({ id: "fixture-lineups", category: "Fixtures", path: "/fixtures/lineups", title: "Lineups", description: "Starting elevens, benches, formations and coaches.", params: ["fixture", "team", "player", "type"], required: ["fixture"], freshnessSeconds: 600, sample: { fixture: "1200000" } }),
  endpoint({ id: "fixture-players", category: "Fixtures", path: "/fixtures/players", title: "Player match statistics", description: "Minutes, ratings, goals, passes, duels and cards per match.", params: ["fixture", "team"], required: ["fixture"], freshnessSeconds: 60, sample: { fixture: "1200000" } }),

  endpoint({ id: "player-seasons", category: "Players", path: "/players/seasons", title: "Player seasons", description: "Seasons available for a specific player.", params: ["player"], required: ["player"], freshnessSeconds: 604800, sample: { player: "276" } }),
  endpoint({ id: "player-profiles", category: "Players", path: "/players/profiles", title: "Player profiles", description: "Paginated player identity and biographical information.", params: ["player", "search", "page"], freshnessSeconds: 604800, sample: { search: "saka" } }),
  endpoint({ id: "players", category: "Players", path: "/players", title: "Player statistics", description: "Profiles and detailed competition-season statistics.", params: ["id", "team", "league", "season", "search", "page"], required: ["season"], freshnessSeconds: 86400, sample: { league: "39", season: "2024", page: "1" } }),
  endpoint({ id: "player-squads", category: "Players", path: "/players/squads", title: "Squads", description: "Current registered squad with positions and shirt numbers.", params: ["team", "player"], freshnessSeconds: 86400, sample: { team: "33" } }),
  endpoint({ id: "player-teams", category: "Players", path: "/players/teams", title: "Player teams", description: "Teams represented by a player during their career.", params: ["player"], required: ["player"], freshnessSeconds: 604800, sample: { player: "276" } }),
  endpoint({ id: "top-scorers", category: "Players", path: "/players/topscorers", title: "Top scorers", description: "Top 20 goal scorers for a league and season.", params: ["league", "season"], required: ["league", "season"], freshnessSeconds: 21600, sample: { league: "39", season: "2024" } }),
  endpoint({ id: "top-assists", category: "Players", path: "/players/topassists", title: "Top assists", description: "Top 20 assist providers for a league and season.", params: ["league", "season"], required: ["league", "season"], freshnessSeconds: 21600, sample: { league: "39", season: "2024" } }),
  endpoint({ id: "top-yellow-cards", category: "Players", path: "/players/topyellowcards", title: "Top yellow cards", description: "Top 20 players ranked by yellow cards.", params: ["league", "season"], required: ["league", "season"], freshnessSeconds: 21600, sample: { league: "39", season: "2024" } }),
  endpoint({ id: "top-red-cards", category: "Players", path: "/players/topredcards", title: "Top red cards", description: "Top 20 players ranked by red cards.", params: ["league", "season"], required: ["league", "season"], freshnessSeconds: 21600, sample: { league: "39", season: "2024" } }),

  endpoint({ id: "injuries", category: "Availability", path: "/injuries", title: "Injuries & suspensions", description: "Current player availability by fixture, team or competition.", params: ["league", "season", "fixture", "team", "player", "date", "timezone"], freshnessSeconds: 14400, sample: { league: "39", season: "2024" } }),
  endpoint({ id: "transfers", category: "Availability", path: "/transfers", title: "Transfers", description: "Player or team transfer history.", params: ["player", "team"], freshnessSeconds: 86400, sample: { team: "33" } }),
  endpoint({ id: "trophies", category: "Availability", path: "/trophies", title: "Trophies", description: "Honours earned by a player or coach.", params: ["player", "coach"], freshnessSeconds: 604800, sample: { player: "276" } }),
  endpoint({ id: "sidelined", category: "Availability", path: "/sidelined", title: "Sidelined history", description: "Historical injuries and suspensions for a player or coach.", params: ["player", "coach"], freshnessSeconds: 86400, sample: { player: "276" } }),

  endpoint({ id: "predictions", category: "Intelligence", path: "/predictions", title: "Match predictions", description: "Modelled winner, goals, advice and probability comparison.", params: ["fixture"], required: ["fixture"], freshnessSeconds: 3600, sample: { fixture: "1200000" } }),

  endpoint({ id: "live-odds", category: "Betting", path: "/odds/live", title: "Live odds", description: "In-play odds for currently active fixtures.", params: ["fixture", "league", "bet"], freshnessSeconds: 15, sample: { league: "39" } }),
  endpoint({ id: "live-bets", category: "Betting", path: "/odds/live/bets", title: "Live bet types", description: "Reference IDs for in-play bet markets.", params: ["id", "search"], freshnessSeconds: 604800, sample: {} }),
  endpoint({ id: "odds", category: "Betting", path: "/odds", title: "Pre-match odds", description: "Bookmaker prices for upcoming fixtures.", params: ["fixture", "league", "season", "date", "timezone", "page", "bookmaker", "bet"], freshnessSeconds: 10800, sample: { league: "39", season: "2024", page: "1" } }),
  endpoint({ id: "odds-mapping", category: "Betting", path: "/odds/mapping", title: "Odds mapping", description: "Map fixture IDs to odds availability.", params: ["page"], freshnessSeconds: 10800, sample: { page: "1" } }),
  endpoint({ id: "bookmakers", category: "Betting", path: "/odds/bookmakers", title: "Bookmakers", description: "Reference list of bookmaker IDs and names.", params: ["id", "search"], freshnessSeconds: 604800, sample: {} }),
  endpoint({ id: "bet-types", category: "Betting", path: "/odds/bets", title: "Pre-match bet types", description: "Reference IDs for pre-match betting markets.", params: ["id", "search"], freshnessSeconds: 604800, sample: {} }),
];

export const API_FOOTBALL_BY_ID = Object.fromEntries(
  API_FOOTBALL_ENDPOINTS.map((item) => [item.id, item]),
);

export const API_FOOTBALL_BY_PATH = Object.fromEntries(
  API_FOOTBALL_ENDPOINTS.map((item) => [item.path, item]),
);

export function getEndpointDefinition(idOrPath) {
  return API_FOOTBALL_BY_ID[idOrPath] ?? API_FOOTBALL_BY_PATH[idOrPath] ?? null;
}

export function sanitizeEndpointParams(definition, input = {}) {
  return Object.fromEntries(
    definition.params
      .filter((key) => input[key] !== undefined && input[key] !== "")
      .map((key) => [key, String(input[key])]),
  );
}
