import assert from "node:assert/strict";
import test from "node:test";
import { selectEnrichmentMatches } from "../../scripts/football-ai/import-thestatsapi.mjs";

const rows = [
  { source: { id: "qualifier-1" }, linked: null },
  { source: { id: "main-1" }, linked: { id: "ai-1" } },
  { source: { id: "qualifier-2" }, linked: null },
  { source: { id: "main-2" }, linked: { id: "ai-2" } },
  { source: { id: "main-3" }, linked: { id: "ai-3" } },
];

test("UCL samples spend enrichment calls on linked main-competition rows first", () => {
  const selected = selectEnrichmentMatches(rows, { leagueCode: "CL", limit: 2 });
  assert.deepEqual(selected.map((row) => row.source.id), ["main-1", "main-2"]);
});

test("domestic selection also protects quota by enriching linked rows only", () => {
  const selected = selectEnrichmentMatches(rows, { leagueCode: "E0", limit: 2 });
  assert.deepEqual(selected.map((row) => row.source.id), ["main-1", "main-2"]);
});
