import assert from "node:assert/strict";
import test from "node:test";
import {
  apiFootballTeamLogo,
  createTeamAssetResolver,
  normalizeTeamName,
  teamNameMatchScore,
} from "../../lib/api-football/team-assets.js";

const teams = [
  { api_id: 33, name: "Manchester United", country: "England", logo_url: "https://media.api-sports.io/football/teams/33.png" },
  { api_id: 50, name: "Manchester City", country: "England", logo_url: null },
  { api_id: 65, name: "Nottingham Forest", country: "England", logo_url: null },
  { api_id: 530, name: "Atletico Madrid", country: "Spain", logo_url: null },
  { api_id: 157, name: "Bayern München", country: "Germany", logo_url: null },
  { api_id: 85, name: "Paris Saint Germain", country: "France", logo_url: null },
  { api_id: 489, name: "AC Milan", country: "Italy", logo_url: null },
];

test("team names normalize punctuation and accents", () => {
  assert.equal(normalizeTeamName("Bayern München"), "bayern munchen");
  assert.equal(normalizeTeamName("Nott'm Forest"), "nott m forest");
});

test("Football-Data aliases match API-Football team names", () => {
  assert.equal(teamNameMatchScore("Man United", "Manchester United"), 1);
  assert.equal(teamNameMatchScore("Ath Madrid", "Atletico Madrid"), 1);
  assert.equal(teamNameMatchScore("Milan", "AC Milan"), 1);
});

test("resolver returns a country-safe cached API-Football asset", () => {
  const resolve = createTeamAssetResolver(teams);
  assert.equal(resolve({ name: "Nott'm Forest", countryCode: "england" }).apiFootballId, 65);
  assert.equal(resolve({ name: "Paris SG", countryCode: "france" }).apiFootballId, 85);
  assert.equal(resolve({ name: "Bayern Munich", countryCode: "germany" }).apiFootballId, 157);
  assert.equal(resolve({ name: "Manchester United", countryCode: "italy" }), null);
});

test("logo CDN URLs are derived only from numeric API team ids", () => {
  assert.equal(apiFootballTeamLogo(33), "https://media.api-sports.io/football/teams/33.png");
  assert.equal(apiFootballTeamLogo("not-an-id"), null);
});
