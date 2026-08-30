import { DataSourceBadge, FormStrip, PageIntro, StandingsTable } from "@/components/football/FootballUI";
import { getFootballData } from "@/lib/api-football/cache";
import { competitionParams, standingsOf } from "@/lib/api-football/page-data";

export const metadata = { title: "Standings" };

export default async function StandingsPage({ searchParams }) {
  const competition = await competitionParams(searchParams);
  const result = await getFootballData("standings", competition, { allowStale: true });
  const rows = standingsOf(result);
  return <div className="space-y-7"><PageIntro eyebrow="League table" title="The race, read at a glance." description="Separate home and away records, goal difference and recent form are preserved in normalized Supabase rows for fast table rendering." actions={<DataSourceBadge meta={result.meta} />} /><section className="surface-panel overflow-hidden"><div className="flex flex-col justify-between gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:p-6"><div><h2 className="text-xl font-black">Current positions</h2><p className="mt-1 text-xs text-ink-muted">Season {competition.season} · Qualification zone highlighted</p></div><div className="flex items-center gap-2 text-xs text-ink-muted"><span>Form guide</span><FormStrip form="WWDLW" /></div></div><StandingsTable rows={rows} /></section></div>;
}

