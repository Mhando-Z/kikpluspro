import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getEndpointDefinition,
  sanitizeEndpointParams,
} from "@/lib/api-football/endpoints";
import { getDemoPayload } from "@/lib/api-football/demo-data";

export function canonicalParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function buildCacheKey(path, params = {}) {
  const normalized = canonicalParams(params);
  return createHash("sha256")
    .update(`${path}:${JSON.stringify(normalized)}`)
    .digest("hex");
}

export async function getFootballData(idOrPath, params = {}, options = {}) {
  const definition = getEndpointDefinition(idOrPath);
  if (!definition) throw new Error(`Unknown API-Football endpoint: ${idOrPath}`);

  const sanitizedParams = sanitizeEndpointParams(definition, params);
  const cacheKey = buildCacheKey(definition.path, sanitizedParams);
  const supabase = createServerSupabaseClient();

  if (supabase) {
    let query = supabase
      .from("api_cache")
      .select("payload,fetched_at,expires_at,is_stale,rate_limit_remaining")
      .eq("cache_key", cacheKey)
      .limit(1);

    if (!options.allowStale) {
      query = query.gte("expires_at", new Date().toISOString());
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data?.payload) {
      return {
        payload: data.payload,
        meta: {
          source: "supabase",
          fetchedAt: data.fetched_at,
          expiresAt: data.expires_at,
          isStale:
            data.is_stale || new Date(data.expires_at).getTime() < Date.now(),
          rateLimitRemaining: data.rate_limit_remaining,
          endpoint: definition.path,
          params: sanitizedParams,
        },
      };
    }
  }

  const payload = getDemoPayload(definition.id, sanitizedParams);
  return {
    payload,
    meta: {
      source: "demo",
      fetchedAt: new Date().toISOString(),
      expiresAt: null,
      isStale: false,
      rateLimitRemaining: null,
      endpoint: definition.path,
      params: sanitizedParams,
    },
  };
}

