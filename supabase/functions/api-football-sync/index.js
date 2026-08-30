import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveEndpoint, sanitizeParams } from "../_shared/endpoints.js";

const API_BASE_URL = "https://v3.football.api-sports.io";
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "P", "BT", "LIVE"]);
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-sync-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });

const integerHeader = (headers, name) => {
  const value = headers.get(name);
  return value === null ? null : Number.parseInt(value, 10);
};

const chunks = (items, size = 400) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function upsertRows(supabase, table, rows, onConflict) {
  if (!rows.length) return 0;
  let written = 0;
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} normalization failed: ${error.message}`);
    written += batch.length;
  }
  return written;
}

async function normalizeCountries(supabase, response, timestamp) {
  return upsertRows(
    supabase,
    "countries",
    response.map((country) => ({
      name: country.name,
      code: country.code,
      flag_url: country.flag,
      payload: country,
      source_updated_at: timestamp,
    })),
    "name",
  );
}

async function normalizeLeagues(supabase, response, timestamp) {
  const leagues = response.map((entry) => ({
    api_id: entry.league.id,
    name: entry.league.name,
    type: entry.league.type,
    logo_url: entry.league.logo,
    country_name: entry.country?.name,
    country_code: entry.country?.code,
    country_flag_url: entry.country?.flag,
    payload: entry,
    source_updated_at: timestamp,
  }));
  const leagueCount = await upsertRows(supabase, "leagues", leagues, "api_id");
  const seasons = response.flatMap((entry) =>
    (entry.seasons ?? []).map((season) => ({
      league_api_id: entry.league.id,
      season: season.year,
      starts_on: season.start,
      ends_on: season.end,
      is_current: Boolean(season.current),
      coverage: season.coverage ?? {},
      payload: season,
    })),
  );
  return leagueCount + (await upsertRows(supabase, "league_seasons", seasons, "league_api_id,season"));
}

async function normalizeTeams(supabase, response, timestamp) {
  const venues = response
    .filter((entry) => entry.venue?.id)
    .map((entry) => ({
      api_id: entry.venue.id,
      name: entry.venue.name,
      address: entry.venue.address,
      city: entry.venue.city,
      country: entry.venue.country,
      capacity: entry.venue.capacity,
      surface: entry.venue.surface,
      image_url: entry.venue.image,
      payload: entry.venue,
    }));
  const venueCount = await upsertRows(supabase, "venues", venues, "api_id");
  const teams = response.map((entry) => ({
    api_id: entry.team.id,
    name: entry.team.name,
    code: entry.team.code,
    country: entry.team.country,
    founded: entry.team.founded,
    is_national: Boolean(entry.team.national),
    logo_url: entry.team.logo,
    venue_api_id: entry.venue?.id ?? null,
    payload: entry,
    source_updated_at: timestamp,
  }));
  return venueCount + (await upsertRows(supabase, "teams", teams, "api_id"));
}

async function normalizeFixtures(supabase, response, timestamp) {
  const fixtures = response.map((entry) => ({
    api_id: entry.fixture.id,
    league_api_id: entry.league?.id,
    season: entry.league?.season,
    round: entry.league?.round,
    home_team_api_id: entry.teams?.home?.id,
    away_team_api_id: entry.teams?.away?.id,
    kickoff_at: entry.fixture.date,
    timezone: entry.fixture.timezone,
    venue_api_id: entry.fixture.venue?.id,
    referee: entry.fixture.referee,
    status_long: entry.fixture.status?.long,
    status_short: entry.fixture.status?.short,
    elapsed: entry.fixture.status?.elapsed,
    home_goals: entry.goals?.home,
    away_goals: entry.goals?.away,
    score: entry.score ?? {},
    payload: entry,
    source_updated_at: timestamp,
  }));
  return upsertRows(supabase, "fixtures", fixtures, "api_id");
}

async function normalizeStandings(supabase, response, timestamp) {
  const rows = response.flatMap((entry) =>
    (entry.league?.standings ?? []).flatMap((group) =>
      group.map((standing) => ({
        league_api_id: entry.league.id,
        season: entry.league.season,
        team_api_id: standing.team.id,
        group_name: standing.group ?? "",
        rank: standing.rank,
        points: standing.points,
        goals_diff: standing.goalsDiff,
        form: standing.form,
        description: standing.description,
        all_record: standing.all ?? {},
        home_record: standing.home ?? {},
        away_record: standing.away ?? {},
        payload: standing,
        source_updated_at: timestamp,
      })),
    ),
  );
  return upsertRows(supabase, "standings", rows, "league_api_id,season,team_api_id,group_name");
}

const leaderboardTypes = {
  "top-scorers": "top_scorers",
  "top-assists": "top_assists",
  "top-yellow-cards": "top_yellow_cards",
  "top-red-cards": "top_red_cards",
};

async function normalizeLeaderboard(supabase, definition, response, params, timestamp) {
  const players = response.map((entry) => ({
    api_id: entry.player.id,
    name: entry.player.name,
    firstname: entry.player.firstname,
    lastname: entry.player.lastname,
    age: entry.player.age,
    nationality: entry.player.nationality,
    height: entry.player.height,
    weight: entry.player.weight,
    photo_url: entry.player.photo,
    is_injured: Boolean(entry.player.injured),
    birth: entry.player.birth ?? {},
    payload: entry.player,
    source_updated_at: timestamp,
  }));
  const playerCount = await upsertRows(supabase, "players", players, "api_id");
  const type = leaderboardTypes[definition.id];
  const rows = response.map((entry, index) => {
    const statistics = entry.statistics?.[0] ?? {};
    const value = type === "top_scorers"
      ? statistics.goals?.total
      : type === "top_assists"
        ? statistics.goals?.assists
        : type === "top_yellow_cards"
          ? statistics.cards?.yellow
          : statistics.cards?.red;
    return {
      leaderboard_type: type,
      league_api_id: Number(params.league),
      season: Number(params.season),
      player_api_id: entry.player.id,
      team_api_id: statistics.team?.id ?? null,
      rank: index + 1,
      value: value ?? 0,
      statistics,
      payload: entry,
      source_updated_at: timestamp,
    };
  });
  return playerCount + (await upsertRows(supabase, "player_leaderboards", rows, "leaderboard_type,league_api_id,season,player_api_id"));
}

async function normalizeInjuries(supabase, response, timestamp) {
  const rows = response
    .filter((entry) => entry.player?.id && entry.fixture?.id)
    .map((entry) => ({
      player_api_id: entry.player.id,
      fixture_api_id: entry.fixture.id,
      team_api_id: entry.team?.id,
      league_api_id: entry.league?.id,
      season: entry.league?.season,
      injury_type: entry.player.type,
      reason: entry.player.reason,
      fixture_date: entry.fixture.date,
      payload: entry,
      source_updated_at: timestamp,
    }));
  return upsertRows(supabase, "injuries", rows, "player_api_id,fixture_api_id");
}

async function normalizeResponse(supabase, definition, response, params, timestamp) {
  if (definition.id === "countries") return normalizeCountries(supabase, response, timestamp);
  if (definition.id === "leagues") return normalizeLeagues(supabase, response, timestamp);
  if (definition.id === "teams") return normalizeTeams(supabase, response, timestamp);
  if (definition.id === "fixtures") return normalizeFixtures(supabase, response, timestamp);
  if (definition.id === "standings") return normalizeStandings(supabase, response, timestamp);
  if (leaderboardTypes[definition.id]) return normalizeLeaderboard(supabase, definition, response, params, timestamp);
  if (definition.id === "injuries") return normalizeInjuries(supabase, response, timestamp);
  return 0;
}

function apiErrors(payload) {
  if (Array.isArray(payload.errors)) return payload.errors.filter(Boolean);
  if (payload.errors && typeof payload.errors === "object") return Object.values(payload.errors).filter(Boolean);
  return [];
}

async function runJob({ supabase, apiKey, input, job = null }) {
  const started = Date.now();
  const definition = resolveEndpoint(input.endpoint ?? input.endpointId ?? job?.endpoint_id ?? job?.endpoint);
  if (!definition) throw new Error("Endpoint is not in the API-Football allowlist.");

  const params = sanitizeParams(definition, input.params ?? job?.params ?? {});
  const missing = definition.required.filter((key) => !params[key]);
  if (missing.length) throw new Error(`Missing required parameters: ${missing.join(", ")}`);

  const cacheKey = await sha256(`${definition.path}:${JSON.stringify(params)}`);
  const { data: existing } = await supabase
    .from("api_cache")
    .select("payload,expires_at,result_count")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (!input.force && existing?.expires_at && new Date(existing.expires_at).getTime() > Date.now()) {
    if (job?.id) {
      await supabase.from("sync_jobs").update({
        locked_at: null,
        lock_token: null,
        next_run_at: new Date(Date.now() + job.interval_seconds * 1000).toISOString(),
      }).eq("id", job.id);
    }
    return { endpoint: definition.id, status: "cached", results: existing.result_count ?? 0 };
  }

  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({
      job_id: job?.id ?? null,
      endpoint_id: definition.id,
      endpoint: definition.path,
      params,
      status: "running",
    })
    .select("id")
    .single();
  if (runError) throw new Error(`Could not create sync log: ${runError.message}`);

  try {
    const query = new URLSearchParams(params);
    const url = `${API_BASE_URL}${definition.path}${query.size ? `?${query}` : ""}`;
    const response = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    const payload = await response.json();
    const upstreamErrors = apiErrors(payload);
    if (!response.ok || upstreamErrors.length) {
      throw new Error(upstreamErrors.join("; ") || `API-Football returned HTTP ${response.status}`);
    }

    const records = Array.isArray(payload.response) ? payload.response : [];
    const rateLimitRemaining = integerHeader(response.headers, "x-ratelimit-remaining");
    const dailyRemaining = integerHeader(response.headers, "x-ratelimit-requests-remaining");
    const now = new Date().toISOString();

    if (!records.length && existing?.result_count > 0) {
      await supabase.from("api_cache").update({ is_stale: true }).eq("cache_key", cacheKey);
      await supabase.from("sync_runs").update({
        status: "skipped",
        records_received: 0,
        records_written: 0,
        http_status: response.status,
        rate_limit_remaining: rateLimitRemaining,
        rate_limit_daily_remaining: dailyRemaining,
        completed_at: now,
        duration_ms: Date.now() - started,
        error_message: "Upstream returned an empty response; retained the last non-empty cache.",
      }).eq("id", run.id);
      if (job?.id) {
        await supabase.from("sync_jobs").update({
          locked_at: null,
          lock_token: null,
          consecutive_failures: 0,
          last_success_at: now,
          next_run_at: new Date(Date.now() + job.interval_seconds * 1000).toISOString(),
        }).eq("id", job.id);
      }
      return { endpoint: definition.id, status: "stale-retained", results: existing.result_count };
    }

    const payloadString = JSON.stringify(payload);
    const responseHash = await sha256(payloadString);
    const expiresAt = new Date(Date.now() + definition.ttl * 1000).toISOString();
    const { error: cacheError } = await supabase.from("api_cache").upsert({
      cache_key: cacheKey,
      endpoint_id: definition.id,
      endpoint: definition.path,
      params,
      payload,
      result_count: records.length,
      http_status: response.status,
      is_public: definition.isPublic,
      is_stale: false,
      fetched_at: now,
      expires_at: expiresAt,
      rate_limit_remaining: rateLimitRemaining,
      rate_limit_daily_remaining: dailyRemaining,
      response_hash: responseHash,
    }, { onConflict: "cache_key" });
    if (cacheError) throw new Error(`Cache write failed: ${cacheError.message}`);

    const recordsWritten = await normalizeResponse(supabase, definition, records, params, now);
    await supabase.from("sync_runs").update({
      status: "succeeded",
      records_received: records.length,
      records_written: recordsWritten,
      http_status: response.status,
      rate_limit_remaining: rateLimitRemaining,
      rate_limit_daily_remaining: dailyRemaining,
      completed_at: now,
      duration_ms: Date.now() - started,
    }).eq("id", run.id);

    if (job?.id) {
      await supabase.from("sync_jobs").update({
        locked_at: null,
        lock_token: null,
        last_success_at: now,
        last_error: null,
        consecutive_failures: 0,
        next_run_at: new Date(Date.now() + job.interval_seconds * 1000).toISOString(),
      }).eq("id", job.id);
    }

    return {
      endpoint: definition.id,
      path: definition.path,
      status: "succeeded",
      results: records.length,
      normalized: recordsWritten,
      rateLimitRemaining,
      dailyRemaining,
      isLive: definition.id === "fixtures" && records.some((entry) => LIVE_STATUSES.has(entry.fixture?.status?.short)),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const now = new Date().toISOString();
    await supabase.from("sync_runs").update({
      status: "failed",
      error_message: message,
      completed_at: now,
      duration_ms: Date.now() - started,
    }).eq("id", run.id);
    if (job?.id) {
      const failures = (job.consecutive_failures ?? 0) + 1;
      const retrySeconds = Math.min(3600, 30 * 2 ** Math.min(failures, 7));
      await supabase.from("sync_jobs").update({
        locked_at: null,
        lock_token: null,
        last_error_at: now,
        last_error: message,
        consecutive_failures: failures,
        next_run_at: new Date(Date.now() + retrySeconds * 1000).toISOString(),
      }).eq("id", job.id);
    }
    return { endpoint: definition.id, status: "failed", error: message };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedSecret = Deno.env.get("SUPABASE_SYNC_SECRET");
  if (!expectedSecret || request.headers.get("x-sync-secret") !== expectedSecret) {
    return json({ error: "Unauthorized sync request" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    return json({ error: "Missing Edge Function secrets" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await request.json();
    let inputs = [];
    let claimedJobs = [];

    if (body.mode === "due") {
      const limit = Math.max(1, Math.min(Number(body.limit ?? 6), 20));
      const { data, error } = await supabase.rpc("claim_due_sync_jobs", { p_limit: limit });
      if (error) throw new Error(`Could not claim scheduled jobs: ${error.message}`);
      claimedJobs = data ?? [];
      inputs = claimedJobs.map((job) => ({ endpoint: job.endpoint_id, params: job.params }));
    } else if (Array.isArray(body.jobs)) {
      inputs = body.jobs.slice(0, 20);
    } else {
      inputs = [body];
    }

    const results = [];
    for (let index = 0; index < inputs.length; index += 1) {
      const result = await runJob({
        supabase,
        apiKey,
        input: inputs[index],
        job: claimedJobs[index] ?? null,
      });
      results.push(result);
      if (result.rateLimitRemaining !== null && result.rateLimitRemaining <= 1) break;
    }

    return json({ processed: results.length, results });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

