import { getFootballData } from "@/lib/api-football/cache";

export async function competitionParams(searchParams) {
  const resolved = await searchParams;
  return {
    league: String(resolved?.league ?? process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID ?? "39"),
    season: String(resolved?.season ?? process.env.NEXT_PUBLIC_DEFAULT_SEASON ?? "2024"),
  };
}

export function responseOf(result) {
  return Array.isArray(result?.payload?.response) ? result.payload.response : [];
}

export function standingsOf(result) {
  return result?.payload?.response?.[0]?.league?.standings?.flat?.() ?? [];
}

export async function dashboardData(searchParams) {
  const competition = await competitionParams(searchParams);
  const [fixtures, standings, assists, injuries] = await Promise.all([
    getFootballData("fixtures", { ...competition, last: "20" }, { allowStale: true }),
    getFootballData("standings", competition, { allowStale: true }),
    getFootballData("top-assists", competition, { allowStale: true }),
    getFootballData("injuries", competition, { allowStale: true }),
  ]);
  return { competition, fixtures, standings, assists, injuries };
}
