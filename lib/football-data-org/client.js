const DEFAULT_BASE_URL = "https://api.football-data.org/v4";

function positiveNumber(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class FootballDataOrgClient {
  constructor({
    apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY,
    baseUrl = process.env.FOOTBALL_DATA_ORG_BASE_URL ?? DEFAULT_BASE_URL,
    fetchImpl = fetch,
    maxRetries = 2,
  } = {}) {
    if (!apiKey) throw new Error("FOOTBALL_DATA_ORG_API_KEY is required for fixture and result synchronization.");
    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
    this.maxRetries = positiveNumber(maxRetries, 2);
  }

  async request(path, query = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchImpl(url, {
        cache: "no-store",
        headers: { "X-Auth-Token": this.apiKey, "user-agent": "KickPulse-Football-AI/1.12" },
      });
      if (response.ok) return response.json();

      let detail = "";
      try { detail = (await response.json())?.message ?? ""; } catch { /* non-JSON response */ }
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === this.maxRetries) {
        throw new Error(`Football-Data.org ${response.status}: ${detail || response.statusText}`);
      }
      const retryAfter = positiveNumber(response.headers.get("retry-after"), 0);
      const resetAfter = positiveNumber(response.headers.get("x-requestcounter-reset"), 0);
      const seconds = Math.max(retryAfter, resetAfter, 2 ** attempt);
      await wait(Math.min(seconds, 65) * 1000);
    }

    throw new Error("Football-Data.org request failed after retrying.");
  }

  competitionMatches(code, query = {}) {
    return this.request(`/competitions/${encodeURIComponent(code)}/matches`, query);
  }
}
