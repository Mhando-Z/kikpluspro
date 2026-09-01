import assert from "node:assert/strict";
import test from "node:test";
import { createStatsApiClient } from "../../lib/thestatsapi/client.js";

test("TheStatsAPI client paginates at the documented maximum page size", async () => {
  const urls = [];
  const client = createStatsApiClient({
    apiKey: "test-key",
    requestsPerMinute: 300,
    sleep: async () => {},
    fetchImpl: async (url, options) => {
      urls.push({ url: String(url), authorization: options.headers.authorization });
      const page = Number(url.searchParams.get("page"));
      return new Response(JSON.stringify({
        data: [{ id: `row-${page}` }],
        meta: { page, total_pages: 2 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const rows = await client.paginate("/football/matches", { status: "finished" });
  assert.deepEqual(rows.map((row) => row.id), ["row-1", "row-2"]);
  assert.equal(new URL(urls[0].url).searchParams.get("per_page"), "100");
  assert.equal(urls[0].authorization, "Bearer test-key");
  assert.equal(client.metrics.requests, 2);
});

test("TheStatsAPI client retries rate limits and accepts optional 404 responses", async () => {
  let attempts = 0;
  const client = createStatsApiClient({
    apiKey: "test-key",
    sleep: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return new Response("limited", { status: 429 });
      if (attempts === 2) return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
      return new Response("missing", { status: 404 });
    },
  });
  assert.deepEqual(await client.get("/resource"), { data: { ok: true } });
  assert.equal(await client.get("/missing", {}, { allow404: true }), null);
  assert.equal(client.metrics.retries, 1);
  assert.equal(client.metrics.notFound, 1);
});
