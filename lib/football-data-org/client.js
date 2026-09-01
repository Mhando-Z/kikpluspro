const DEFAULT_BASE_URL = "https://api.football-data.org/v4";

export class FootballDataOrgClient {
  constructor({
    apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY,
    baseUrl = process.env.FOOTBALL_DATA_ORG_BASE_URL ?? DEFAULT_BASE_URL,
    fetchImpl = fetch,
  } = {}) {
    if (!apiKey) throw new Error("FOOTBALL_DATA_ORG_API_KEY is required for Champions League fixtures.");
    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async request(path, query = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
    const response = await this.fetchImpl(url, {
      cache: "no-store",
      headers: { "X-Auth-Token": this.apiKey, "user-agent": "KickPulse-Football-AI/1.7" },
    });
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.json())?.message ?? ""; } catch { /* non-JSON response */ }
      throw new Error(`Football-Data.org ${response.status}: ${detail || response.statusText}`);
    }
    return response.json();
  }

  competitionMatches(code, query = {}) {
    return this.request(`/competitions/${encodeURIComponent(code)}/matches`, query);
  }
}
