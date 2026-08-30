const teams = {
  42: { id: 42, name: "Arsenal", logo: null },
  50: { id: 50, name: "Manchester City", logo: null },
  40: { id: 40, name: "Liverpool", logo: null },
  49: { id: 49, name: "Chelsea", logo: null },
  47: { id: 47, name: "Tottenham", logo: null },
  34: { id: 34, name: "Newcastle", logo: null },
  33: { id: 33, name: "Manchester United", logo: null },
  66: { id: 66, name: "Aston Villa", logo: null },
};

const league = {
  id: 39,
  name: "Premier League",
  country: "England",
  logo: null,
  flag: null,
  season: 2025,
};

const atTime = (hour, minute = 0, dayOffset = 0) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
};

const fixture = ({ id, home, away, status, elapsed, homeGoals, awayGoals, hour, dayOffset = 0 }) => ({
  fixture: {
    id,
    referee: "Demo official",
    timezone: "UTC",
    date: atTime(hour, 0, dayOffset),
    timestamp: Math.floor(new Date(atTime(hour, 0, dayOffset)).getTime() / 1000),
    periods: { first: null, second: null },
    venue: { id: id + 9000, name: `${teams[home].name} Stadium`, city: "England" },
    status: { long: status === "NS" ? "Not Started" : status === "FT" ? "Match Finished" : "Second Half", short: status, elapsed },
  },
  league: { ...league, round: "Regular Season - 4" },
  teams: { home: { ...teams[home], winner: homeGoals > awayGoals }, away: { ...teams[away], winner: awayGoals > homeGoals } },
  goals: { home: homeGoals, away: awayGoals },
  score: {
    halftime: { home: status === "NS" ? null : Math.min(homeGoals, 1), away: status === "NS" ? null : Math.min(awayGoals, 1) },
    fulltime: { home: status === "FT" ? homeGoals : null, away: status === "FT" ? awayGoals : null },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null },
  },
});

const demoFixtures = [
  fixture({ id: 1200001, home: 42, away: 50, status: "2H", elapsed: 67, homeGoals: 2, awayGoals: 1, hour: 15 }),
  fixture({ id: 1200002, home: 40, away: 49, status: "HT", elapsed: 45, homeGoals: 1, awayGoals: 1, hour: 16 }),
  fixture({ id: 1200003, home: 47, away: 34, status: "NS", elapsed: null, homeGoals: null, awayGoals: null, hour: 18 }),
  fixture({ id: 1200004, home: 33, away: 66, status: "NS", elapsed: null, homeGoals: null, awayGoals: null, hour: 20 }),
  fixture({ id: 1200005, home: 50, away: 40, status: "NS", elapsed: null, homeGoals: null, awayGoals: null, hour: 16, dayOffset: 1 }),
  fixture({ id: 1200006, home: 49, away: 42, status: "FT", elapsed: 90, homeGoals: 0, awayGoals: 2, hour: 14, dayOffset: -1 }),
];

const standingsRows = [
  [1, 42, 10, "WWWDW", 12, 9, 2, 1, 28, 10],
  [2, 40, 9, "WDWWW", 12, 8, 3, 1, 26, 11],
  [3, 50, 8, "WLWWW", 12, 8, 2, 2, 27, 14],
  [4, 49, 4, "WDWLW", 12, 6, 4, 2, 22, 18],
  [5, 66, 2, "LWWDW", 12, 6, 2, 4, 20, 18],
  [6, 47, 1, "WLDWL", 12, 5, 3, 4, 19, 18],
  [7, 34, -1, "DLLWW", 12, 4, 4, 4, 16, 17],
  [8, 33, -3, "LDWDL", 12, 3, 4, 5, 14, 17],
].map(([rank, teamId, goalsDiff, form, played, win, draw, lose, goalsFor, goalsAgainst]) => ({
  rank,
  team: teams[teamId],
  points: win * 3 + draw,
  goalsDiff,
  group: "Premier League",
  form,
  status: "same",
  description: rank <= 4 ? "Champions League" : null,
  all: { played, win, draw, lose, goals: { for: goalsFor, against: goalsAgainst } },
  home: { played: 6, win: Math.ceil(win / 2), draw: Math.floor(draw / 2), lose: Math.floor(lose / 2), goals: { for: Math.ceil(goalsFor / 2), against: Math.floor(goalsAgainst / 2) } },
  away: { played: 6, win: Math.floor(win / 2), draw: Math.ceil(draw / 2), lose: Math.ceil(lose / 2), goals: { for: Math.floor(goalsFor / 2), against: Math.ceil(goalsAgainst / 2) } },
  update: new Date().toISOString(),
}));

const playerNames = [
  [101, "Bukayo Saka", 42, 8, 5, 11, "8.01"],
  [102, "Mohamed Salah", 40, 7, 9, 12, "7.92"],
  [103, "Cole Palmer", 49, 7, 7, 12, "7.81"],
  [104, "Kevin De Bruyne", 50, 6, 3, 9, "7.76"],
  [105, "Bruno Fernandes", 33, 5, 4, 12, "7.54"],
  [106, "Morgan Rogers", 66, 5, 5, 12, "7.47"],
];

const leaderboardPlayers = playerNames.map(([id, name, teamId, assists, goals, appearances, rating]) => ({
  player: { id, name, firstname: name.split(" ")[0], lastname: name.split(" ").slice(1).join(" "), age: 25, birth: { date: "2001-01-01", place: null, country: "England" }, nationality: "England", height: "178 cm", weight: "72 kg", injured: false, photo: null },
  statistics: [{
    team: teams[teamId], league, games: { appearences: appearances, lineups: appearances - 1, minutes: appearances * 82, number: null, position: "Attacker", rating, captain: false },
    substitutes: { in: 1, out: 4, bench: 1 }, shots: { total: goals * 4, on: goals * 2 }, goals: { total: goals, conceded: 0, assists, saves: null },
    passes: { total: 38, key: assists * 2, accuracy: 84 }, tackles: { total: 18, blocks: 1, interceptions: 7 },
    duels: { total: 62, won: 37 }, dribbles: { attempts: 31, success: 18, past: null }, fouls: { drawn: 18, committed: 9 },
    cards: { yellow: 2, yellowred: 0, red: 0 }, penalty: { won: 1, commited: null, scored: 1, missed: 0, saved: null },
  }],
}));

const demoTeams = Object.values(teams).map((team) => ({
  team: { ...team, code: team.name.slice(0, 3).toUpperCase(), country: "England", founded: 1886, national: false },
  venue: { id: team.id + 9000, name: `${team.name} Stadium`, address: "Football Way", city: "England", capacity: 60000, surface: "grass", image: null },
}));

const injuries = [
  [301, "Gabriel Jesus", 42, "Injury", "Hamstring strain"],
  [302, "Reece James", 49, "Injury", "Muscle injury"],
  [303, "Rodri", 50, "Injury", "Knee rehabilitation"],
  [304, "Lisandro Martínez", 33, "Suspension", "One-match suspension"],
].map(([id, name, teamId, type, reason], index) => ({
  player: { id, name, photo: null, type, reason },
  team: teams[teamId],
  fixture: demoFixtures[index].fixture,
  league,
}));

const predictions = [{
  predictions: {
    winner: { id: 42, name: "Arsenal", comment: "Win or draw" },
    win_or_draw: true,
    under_over: "+2.5",
    goals: { home: "2", away: "1" },
    advice: "Arsenal or draw and over 1.5 goals",
    percent: { home: "48%", draw: "28%", away: "24%" },
  },
  league,
  teams: {
    home: { ...teams[42], last_5: { form: "78%", att: "72%", def: "81%", goals: { for: { total: 11, average: "2.2" }, against: { total: 4, average: "0.8" } } } },
    away: { ...teams[50], last_5: { form: "64%", att: "79%", def: "58%", goals: { for: { total: 12, average: "2.4" }, against: { total: 8, average: "1.6" } } } },
  },
  comparison: { form: { home: "55%", away: "45%" }, att: { home: "48%", away: "52%" }, def: { home: "58%", away: "42%" }, poisson_distribution: { home: "52%", away: "48%" }, h2h: { home: "50%", away: "50%" }, goals: { home: "54%", away: "46%" }, total: { home: "53.5%", away: "46.5%" } },
  h2h: [],
}];

const odds = [{
  league, fixture: demoFixtures[2].fixture, update: new Date().toISOString(),
  bookmakers: [
    { id: 8, name: "Demo Sportsbook", bets: [{ id: 1, name: "Match Winner", values: [{ value: "Home", odd: "1.92" }, { value: "Draw", odd: "3.45" }, { value: "Away", odd: "4.10" }] }, { id: 5, name: "Goals Over/Under", values: [{ value: "Over 2.5", odd: "1.78" }, { value: "Under 2.5", odd: "2.04" }] }] },
  ],
}];

function wrap(get, response, parameters = {}) {
  return { get, parameters, errors: [], results: response.length, paging: { current: 1, total: 1 }, response };
}

export function getDemoPayload(id, params = {}) {
  switch (id) {
    case "status":
      return wrap("status", [{ account: { firstname: "Demo", lastname: "Workspace", email: "demo@example.com" }, subscription: { plan: "Demo mode", end: null, active: true }, requests: { current: 24, limit_day: 100 } }], params);
    case "timezone":
      return wrap("timezone", ["Africa/Dar_es_Salaam", "Europe/London", "America/New_York", "Asia/Tokyo"], params);
    case "countries":
      return wrap("countries", [{ name: "England", code: "GB", flag: null }, { name: "Tanzania", code: "TZ", flag: null }, { name: "Spain", code: "ES", flag: null }], params);
    case "leagues":
      return wrap("leagues", [{ league, country: { name: "England", code: "GB", flag: null }, seasons: [{ year: 2025, start: "2025-08-01", end: "2026-05-30", current: true, coverage: { fixtures: { events: true, lineups: true, statistics_fixtures: true, statistics_players: true }, standings: true, players: true, top_scorers: true, top_assists: true, top_cards: true, injuries: true, predictions: true, odds: true } }] }], params);
    case "league-seasons":
      return wrap("leagues/seasons", [2022, 2023, 2024, 2025], params);
    case "fixtures":
      return wrap("fixtures", params.live ? demoFixtures.filter((item) => ["1H", "HT", "2H", "ET", "P"].includes(item.fixture.status.short)) : demoFixtures, params);
    case "fixture-headtohead":
      return wrap("fixtures/headtohead", demoFixtures.slice(-2), params);
    case "fixture-rounds":
      return wrap("fixtures/rounds", ["Regular Season - 4"], params);
    case "fixture-events":
      return wrap("fixtures/events", [{ time: { elapsed: 23, extra: null }, team: teams[42], player: { id: 101, name: "Bukayo Saka" }, assist: { id: 106, name: "Martin Ødegaard" }, type: "Goal", detail: "Normal Goal", comments: null }, { time: { elapsed: 58, extra: null }, team: teams[50], player: { id: 110, name: "Phil Foden" }, assist: { id: 104, name: "Kevin De Bruyne" }, type: "Goal", detail: "Normal Goal", comments: null }], params);
    case "fixture-statistics":
      return wrap("fixtures/statistics", [{ team: teams[42], statistics: [{ type: "Ball Possession", value: "56%" }, { type: "Total Shots", value: 14 }, { type: "Corner Kicks", value: 6 }] }, { team: teams[50], statistics: [{ type: "Ball Possession", value: "44%" }, { type: "Total Shots", value: 9 }, { type: "Corner Kicks", value: 3 }] }], params);
    case "fixture-lineups":
      return wrap("fixtures/lineups", [{ team: teams[42], formation: "4-3-3", startXI: leaderboardPlayers.slice(0, 3).map((item, index) => ({ player: { id: item.player.id, name: item.player.name, number: 7 + index, pos: "F", grid: `2:${index + 1}` } })), substitutes: [], coach: { id: 1, name: "Demo coach", photo: null } }], params);
    case "fixture-players":
      return wrap("fixtures/players", [{ team: teams[42], players: leaderboardPlayers.slice(0, 3) }], params);
    case "standings":
      return wrap("standings", [{ league: { ...league, standings: [standingsRows] } }], params);
    case "teams":
      return wrap("teams", demoTeams, params);
    case "team-statistics":
      return wrap("teams/statistics", [{ league, team: teams[33], form: "LDWDL", fixtures: { played: { home: 6, away: 6, total: 12 }, wins: { home: 2, away: 1, total: 3 }, draws: { home: 2, away: 2, total: 4 }, loses: { home: 2, away: 3, total: 5 } }, goals: { for: { total: { home: 8, away: 6, total: 14 } }, against: { total: { home: 7, away: 10, total: 17 } } }, clean_sheet: { home: 2, away: 1, total: 3 } }], params);
    case "team-seasons":
    case "player-seasons":
      return wrap(id.replace("-", "/"), [2023, 2024, 2025], params);
    case "team-countries":
      return wrap("teams/countries", [{ name: "England", code: "GB", flag: null }], params);
    case "venues":
      return wrap("venues", demoTeams.map((item) => item.venue), params);
    case "coachs":
      return wrap("coachs", [{ id: 1, name: "Mikel Arteta", firstname: "Mikel", lastname: "Arteta", age: 44, birth: { date: "1982-03-26", place: "San Sebastián", country: "Spain" }, nationality: "Spain", height: null, weight: null, photo: null, team: teams[42], career: [{ team: teams[42], start: "2019-12-22", end: null }] }], params);
    case "top-assists":
    case "top-scorers":
    case "top-yellow-cards":
    case "top-red-cards":
    case "players":
    case "player-profiles":
      return wrap(id, leaderboardPlayers, params);
    case "player-squads":
      return wrap("players/squads", [{ team: teams[42], players: leaderboardPlayers.slice(0, 4).map((item, index) => ({ id: item.player.id, name: item.player.name, age: item.player.age, number: 7 + index, position: "Attacker", photo: null })) }], params);
    case "player-teams":
      return wrap("players/teams", [{ team: teams[42], seasons: [2023, 2024, 2025] }], params);
    case "injuries":
      return wrap("injuries", injuries, params);
    case "predictions":
      return wrap("predictions", predictions, params);
    case "odds":
    case "live-odds":
      return wrap(id === "odds" ? "odds" : "odds/live", odds, params);
    case "bookmakers":
      return wrap("odds/bookmakers", [{ id: 8, name: "Demo Sportsbook" }], params);
    case "bet-types":
    case "live-bets":
      return wrap(id === "bet-types" ? "odds/bets" : "odds/live/bets", [{ id: 1, name: "Match Winner" }, { id: 5, name: "Goals Over/Under" }], params);
    case "odds-mapping":
      return wrap("odds/mapping", [{ fixture: { id: 1200003, date: atTime(18), timestamp: Math.floor(Date.now() / 1000) }, update: new Date().toISOString() }], params);
    case "transfers":
      return wrap("transfers", [{ player: { id: 101, name: "Demo Player" }, update: new Date().toISOString(), transfers: [{ date: "2025-07-01", type: "Free", teams: { in: teams[42], out: teams[49] } }] }], params);
    case "trophies":
      return wrap("trophies", [{ league: "Premier League", country: "England", season: "2024", place: "Winner" }], params);
    case "sidelined":
      return wrap("sidelined", [{ type: "Hamstring Injury", start: "2025-01-10", end: "2025-02-12" }], params);
    default:
      return wrap(id, [], params);
  }
}

export { demoFixtures, standingsRows, leaderboardPlayers, injuries, predictions, odds, demoTeams };

