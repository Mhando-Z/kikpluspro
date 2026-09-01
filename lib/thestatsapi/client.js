const DEFAULT_BASE_URL = "https://api.thestatsapi.com/api";

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return Math.min(30_000, 750 * 2 ** attempt);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createStatsApiClient({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  requestsPerMinute = 220,
  fetchImpl = fetch,
  sleep = wait,
  maxRetries = 4,
  maxRequests = Number.POSITIVE_INFINITY,
} = {}) {
  if (!apiKey) throw new Error("THESTATSAPI_KEY is required.");
  const rpm = Math.max(1, Math.min(300, Number(requestsPerMinute) || 220));
  const minimumInterval = Math.ceil(60_000 / rpm);
  let lastRequestAt = 0;
  const requestBudget = Number(maxRequests);
  if (!(requestBudget > 0)) throw new Error("TheStatsAPI maxRequests must be positive.");
  const metrics = { requests: 0, retries: 0, notFound: 0, budget: Number.isFinite(requestBudget) ? requestBudget : null };

  async function get(path, query = {}, { allow404 = false } = {}) {
    const url = new URL(`${String(baseUrl).replace(/\/$/, "")}/${String(path).replace(/^\//, "")}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (metrics.requests >= requestBudget) {
        throw new Error(`TheStatsAPI request budget of ${requestBudget} was reached. Cached payloads are safe; resume with another run.`);
      }
      const remaining = minimumInterval - (Date.now() - lastRequestAt);
      if (remaining > 0) await sleep(remaining);
      lastRequestAt = Date.now();
      metrics.requests += 1;

      const response = await fetchImpl(url, {
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: "application/json",
          "user-agent": "KickPulse-Football-AI/2.0",
        },
      });
      if (response.status === 404 && allow404) {
        metrics.notFound += 1;
        return null;
      }
      if (response.ok) return response.json();
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        metrics.retries += 1;
        await sleep(retryDelay(response, attempt));
        continue;
      }
      const body = await response.text().catch(() => "");
      throw new Error(`TheStatsAPI ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
    }
    throw new Error(`TheStatsAPI request failed after ${maxRetries + 1} attempts.`);
  }

  async function paginate(path, query = {}) {
    const rows = [];
    for (let page = 1; ; page += 1) {
      const response = await get(path, { ...query, page, per_page: 100 });
      rows.push(...(response?.data ?? []));
      const totalPages = Number(response?.meta?.total_pages ?? page);
      if (page >= totalPages || !(response?.data?.length)) break;
    }
    return rows;
  }

  return { get, paginate, metrics };
}

export { DEFAULT_BASE_URL as THESTATSAPI_BASE_URL };
