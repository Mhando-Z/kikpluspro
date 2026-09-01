import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichTrainingMatches,
  findLinkedAiMatch,
  leagueCodeForCompetition,
  nameSimilarity,
  normalizeMatchOdds,
  normalizeMatchStats,
} from "../../lib/thestatsapi/transform.js";

const providerMatch = {
  id: "mt_1",
  utc_date: "2025-02-01T15:00:00Z",
  home_team: { id: "tm_1", name: "Manchester United" },
  away_team: { id: "tm_2", name: "Liverpool FC" },
  score: { home: 2, away: 1 },
};

test("competition discovery maps only supported top leagues", () => {
  assert.equal(leagueCodeForCompetition({ name: "Premier League", country: "England" }), "E0");
  assert.equal(leagueCodeForCompetition({ id: "comp_8814", name: "LaLiga", country: "Spain" }), "SP1");
  assert.equal(leagueCodeForCompetition({ name: "LaLiga", country: "Spain" }), "SP1");
  assert.equal(leagueCodeForCompetition({ id: "comp_0976", name: "LaLiga 2", country: "Spain" }), null);
  assert.equal(leagueCodeForCompetition({ name: "Championship", country: "England" }), null);
});

test("provider matches link to Football-Data rows using date, names and score", () => {
  const linked = findLinkedAiMatch(providerMatch, [{
    id: "ai-1",
    match_date: "2025-02-01",
    home_team_name: "Man United",
    away_team_name: "Liverpool",
    home_goals: 2,
    away_goals: 1,
  }]);
  assert.equal(linked.id, "ai-1");
});

test("official Premier League names link to Football-Data short names", () => {
  const cases = [
    ["Leicester City", "Ipswich Town", "Leicester", "Ipswich", 2, 0],
    ["West Ham United", "Nottingham Forest", "West Ham", "Nott'm Forest", 1, 2],
    ["Tottenham Hotspur", "Brighton & Hove Albion", "Tottenham", "Brighton", 1, 4],
    ["Ipswich Town", "West Ham United", "Ipswich", "West Ham", 1, 3],
  ];

  for (const [providerHome, providerAway, dataHome, dataAway, homeGoals, awayGoals] of cases) {
    const linked = findLinkedAiMatch({
      utc_date: "2025-05-25T15:00:00Z",
      home_team: { name: providerHome },
      away_team: { name: providerAway },
      score: { home: homeGoals, away: awayGoals },
    }, [{
      id: `${dataHome}-${dataAway}`,
      match_date: "2025-05-25",
      home_team_name: dataHome,
      away_team_name: dataAway,
      home_goals: homeGoals,
      away_goals: awayGoals,
    }]);

    assert.equal(linked?.id, `${dataHome}-${dataAway}`);
  }
});

test("provider aliases cover the observed Big Five team-name differences", () => {
  const aliases = [
    ["Newcastle United", "Newcastle"],
    ["Wolverhampton", "Wolves"],
    ["Leeds United", "Leeds"],
    ["Luton Town", "Luton"],
    ["Athletic Club", "Ath Bilbao"],
    ["Atlético Madrid", "Ath Madrid"],
    ["Celta Vigo", "Celta"],
    ["Real Betis", "Betis"],
    ["Rayo Vallecano", "Vallecano"],
    ["Real Sociedad", "Sociedad"],
    ["Deportivo Alavés", "Alaves"],
    ["Espanyol", "Espanol"],
    ["Real Valladolid", "Valladolid"],
    ["Real Oviedo", "Oviedo"],
    ["Levante UD", "Levante"],
    ["1. FSV Mainz 05", "Mainz"],
    ["Borussia Dortmund", "Dortmund"],
    ["Bayer 04 Leverkusen", "Leverkusen"],
    ["Borussia M'gladbach", "M'gladbach"],
    ["VfL Bochum 1848", "Bochum"],
    ["Eintracht Frankfurt", "Ein Frankfurt"],
    ["SC Freiburg", "Freiburg"],
    ["TSG Hoffenheim", "Hoffenheim"],
    ["VfB Stuttgart", "Stuttgart"],
    ["VfL Wolfsburg", "Wolfsburg"],
    ["FC Bayern München", "Bayern Munich"],
    ["SV Werder Bremen", "Werder Bremen"],
    ["1. FC Köln", "FC Koln"],
    ["1. FC Union Berlin", "Union Berlin"],
    ["Hertha BSC", "Hertha"],
    ["Hamburger SV", "Hamburg"],
    ["1. FC Heidenheim", "Heidenheim"],
    ["Darmstadt 98", "Darmstadt"],
    ["Olympique Lyonnais", "Lyon"],
    ["Olympique de Marseille", "Marseille"],
    ["Paris Saint-Germain", "Paris SG"],
    ["RC Lens", "Lens"],
    ["Stade Brestois", "Brest"],
    ["Stade Rennais", "Rennes"],
    ["AS Monaco", "Monaco"],
    ["RC Strasbourg", "Strasbourg"],
    ["Stade de Reims", "Reims"],
    ["Clermont Foot", "Clermont"],
  ];

  for (const [providerName, footballDataName] of aliases) {
    assert.equal(nameSimilarity(providerName, footballDataName), 1, `${providerName} should match ${footballDataName}`);
  }
  assert.ok(nameSimilarity("Manchester City", "Manchester United") < 0.8);
});

test("match stats normalize xG, npxG and sustainable shot features", () => {
  const row = normalizeMatchStats(providerMatch, { data: {
    overview: {
      expected_goals: { all: { home: 1.7, away: 0.8 } },
      big_chances: { all: { home: 4, away: 1 } },
    },
    shots: {
      total_shots: { all: { home: 15, away: 8 } },
      shots_on_target: { all: { home: 6, away: 2 } },
    },
    np_expected_goals: { all: { home: 1.4, away: 0.8 } },
  } }, "ai-1");
  assert.equal(row.home_xg, 1.7);
  assert.equal(row.home_npxg, 1.4);
  assert.equal(row.away_shots_on_target, 2);
  assert.equal(row.coverage.stats, true);
});

test("bookmaker prices are averaged and enrich missing training values", () => {
  const odds = normalizeMatchOdds(providerMatch, { data: { bookmakers: [
    { markets: { match_odds: {
      home: { opening: "2.00", last_seen: "1.90" },
      draw: { opening: "3.20", last_seen: "3.30" },
      away: { opening: "4.00", last_seen: "4.20" },
    } } },
    { markets: { match_odds: {
      home: { opening: "2.20", last_seen: "2.10" },
      draw: { opening: "3.40", last_seen: "3.50" },
      away: { opening: "3.80", last_seen: "4.00" },
    } } },
  ] } }, "ai-1");
  assert.equal(odds.opening_home_odds, 2.1);
  const [match] = enrichTrainingMatches([{ id: "ai-1", home_xg: null }], [{
    ai_match_id: "ai-1",
    home_xg: 1.7,
    away_xg: 0.8,
    home_npxg: 1.4,
    coverage: { stats: true },
  }]);
  assert.equal(match.home_xg, 1.7);
  assert.equal(match.home_npxg, 1.4);
});
