import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveScoreWidgetUrl } from "../../lib/live-scores/widget.js";

test("builds the provider's in-play widget URL without encoding its style commas", () => {
  const url = buildLiveScoreWidgetUrl({ view: "live", theme: "light" });
  assert.match(url, /^https:\/\/www\.livexscores\.com\/free2\.php\?p=4&sport=football&style=/);
  assert.match(url, /,verdana,11,/);
  assert.doesNotMatch(url, /%2C/);
  assert.match(url, /&timezone=\+0$/);
});

test("falls back safely for unknown views and themes", () => {
  const url = buildLiveScoreWidgetUrl({ view: "unknown", theme: "unknown" });
  assert.match(url, /\?p=0&/);
  assert.match(url, /style=x07110e,/);
});

