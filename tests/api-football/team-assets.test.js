import assert from "node:assert/strict";
import test from "node:test";
import {
  apiFootballTeamLogo,
  createTeamAssetResolver,
  EXPANSION_TEAM_ASSET_SYNC_JOBS,
  matchTeamAssets,
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
  assert.equal(normalizeTeamName("Bodø/Glimt"), "bodo glimt");
  assert.equal(normalizeTeamName("Nott'm Forest"), "nott m forest");
});

test("Football-Data aliases match API-Football team names", () => {
  assert.equal(teamNameMatchScore("Man United", "Manchester United"), 1);
  assert.equal(teamNameMatchScore("Ath Madrid", "Atletico Madrid"), 1);
  assert.equal(teamNameMatchScore("Celta", "Celta Vigo"), 1);
  assert.equal(teamNameMatchScore("La Coruna", "Deportivo La Coruna"), 1);
  assert.equal(teamNameMatchScore("Milan", "AC Milan"), 1);
  assert.equal(teamNameMatchScore("QPR", "Queens Park Rangers"), 1);
  assert.equal(teamNameMatchScore("St Gilloise", "Union Saint-Gilloise"), 1);
  assert.equal(teamNameMatchScore("Heart of Midlothian", "Hearts"), 1);
});

test("expansion asset sync is limited to the three supported countries", () => {
  assert.deepEqual(
    EXPANSION_TEAM_ASSET_SYNC_JOBS.map((job) => job.params.country),
    ["England", "Belgium", "Scotland"],
  );
  assert.ok(EXPANSION_TEAM_ASSET_SYNC_JOBS.every((job) => (
    job.endpoint === "teams" && job.force === true
  )));
});

test("resolver returns a country-safe cached API-Football asset", () => {
  const resolve = createTeamAssetResolver(teams);
  assert.equal(resolve({ name: "Nott'm Forest", countryCode: "england" }).apiFootballId, 65);
  assert.equal(resolve({ name: "Paris SG", countryCode: "france" }).apiFootballId, 85);
  assert.equal(resolve({ name: "Bayern Munich", countryCode: "germany" }).apiFootballId, 157);
  assert.equal(resolve({ name: "Manchester United", countryCode: "italy" }), null);
});

test("resolver prioritizes an exact canonical AI-team link", () => {
  const resolve = createTeamAssetResolver(teams, [{
    canonical_key: "football-data:england:man-city",
    display_name: "Man City",
    country_code: "england",
    api_football_team_id: 50,
    logo_url: "https://media.api-sports.io/football/teams/50.png",
    logo_match_score: 1,
  }]);
  const asset = resolve({
    canonicalKey: "football-data:england:man-city",
    name: "A deliberately different display name",
    countryCode: "england",
  });
  assert.equal(asset.apiFootballId, 50);
  assert.equal(asset.matchMethod, "canonical-key");
});

test("reconciliation matches by country, preserves stable ids and reports misses", () => {
  const outcome = matchTeamAssets([
    { canonical_key: "football-data:england:man-city", display_name: "Man City", country_code: "england" },
    { canonical_key: "football-data:germany:bayern-munich", display_name: "Bayern Munich", country_code: "germany" },
    { canonical_key: "uefa:netherlands:ajax", display_name: "AFC Ajax", country_code: "netherlands" },
    { canonical_key: "uefa:portugal:missing", display_name: "Missing Club", country_code: "portugal" },
  ], [
    ...teams,
    { api_id: 194, name: "Ajax", country: "Netherlands", logo_url: null },
  ]);
  assert.deepEqual(outcome.matches.map((match) => match.apiFootballId).sort((a, b) => a - b), [50, 157, 194]);
  assert.equal(outcome.unresolved.length, 1);
  assert.equal(outcome.unresolved[0].canonicalKey, "uefa:portugal:missing");
});

test("reconciliation reserves an existing API-Football id before matching duplicate aliases", () => {
  const outcome = matchTeamAssets([
    {
      canonical_key: "uefa:spain:atletico-madrid",
      display_name: "Atletico Madrid",
      country_code: "spain",
    },
    {
      canonical_key: "football-data:spain:ath-madrid",
      display_name: "Ath Madrid",
      country_code: "spain",
      api_football_team_id: 530,
      logo_url: "https://media.api-sports.io/football/teams/530.png",
    },
  ], teams);

  assert.equal(outcome.matches.length, 1);
  assert.equal(outcome.matches[0].canonicalKey, "football-data:spain:ath-madrid");
  assert.equal(outcome.matches[0].method, "existing-link");
  assert.equal(outcome.inherited.length, 1);
  assert.equal(outcome.inherited[0].canonicalKey, "uefa:spain:atletico-madrid");
  assert.equal(outcome.inherited[0].sourceApiFootballId, 530);
  assert.equal(outcome.inherited[0].method, "alias-inheritance");
  assert.equal(outcome.unresolved.length, 0);
});

test("UCL country hints prevent generic Europe rows from matching clubs in the wrong country", () => {
  const outcome = matchTeamAssets([
    { canonical_key: "uefa:europe:aek-athens", display_name: "AEK Athens", country_code: "europe" },
    { canonical_key: "uefa:europe:bod-glimt", display_name: "Bodø/Glimt", country_code: "europe" },
    { canonical_key: "uefa:europe:viking-fk", display_name: "Viking FK", country_code: "europe" },
  ], [
    { api_id: 22607, name: "AEK Boco", country: "England", logo_url: null },
    { api_id: 120, name: "AEK Athens", country: "Greece", logo_url: null },
    { api_id: 327, name: "Bodo/Glimt", country: "Norway", logo_url: null },
    { api_id: 278, name: "Vikingur Reykjavik", country: "Iceland", logo_url: null },
    { api_id: 999, name: "Viking", country: "Norway", logo_url: null },
  ]);

  assert.deepEqual(
    outcome.matches.map((match) => match.apiFootballId).sort((left, right) => left - right),
    [120, 327, 999],
  );
  assert.equal(outcome.unresolved.length, 0);
});

test("logo CDN URLs are derived only from numeric API team ids", () => {
  assert.equal(apiFootballTeamLogo(33), "https://media.api-sports.io/football/teams/33.png");
  assert.equal(apiFootballTeamLogo("not-an-id"), null);
});
