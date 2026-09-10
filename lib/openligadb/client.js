const DEFAULT_BASE_URL = "https://api.openligadb.de";

export class OpenLigaDbClient {
  constructor({
    baseUrl = process.env.OPENLIGADB_BASE_URL ?? DEFAULT_BASE_URL,
    fetchImpl = fetch,
  } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async request(path) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "KickPulse-Football-AI/1.12" },
    });
    if (!response.ok) {
      throw new Error(`OpenLigaDB ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  seasonMatches(shortcut, seasonStart) {
    return this.request(`/getmatchdata/${encodeURIComponent(shortcut)}/${encodeURIComponent(seasonStart)}`);
  }
}

export { DEFAULT_BASE_URL as OPENLIGADB_BASE_URL };
