import Link from "next/link";
import { ArrowUpRight, RefreshCcw } from "lucide-react";
import {
  DataSourceBadge,
  InjuryList,
  Leaderboard,
  MatchCard,
  MetricCard,
  PageIntro,
  SectionHeading,
  StandingsTable,
} from "@/components/football/FootballUI";
import { dashboardData, responseOf, standingsOf } from "@/lib/api-football/page-data";

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "P", "BT", "LIVE"]);

export default async function OverviewPage({ searchParams }) {
  const data = await dashboardData(searchParams);
  const fixtures = responseOf(data.fixtures);
  const table = standingsOf(data.standings);
  const assists = responseOf(data.assists);
  const injuries = responseOf(data.injuries);
  const live = fixtures.filter((item) => liveStatuses.has(item.fixture?.status?.short));
  const recent = fixtures.filter((item) => item.fixture?.status?.short === "FT");

  return (
    <div className="space-y-7">
      <PageIntro
        eyebrow="Matchday command center"
        title="Every decisive football signal, in one pulse."
        description="Live scores, league position, player momentum and availability—served from your Supabase cache so thousands of supporters share the same efficient API feed."
        actions={<><DataSourceBadge meta={data.fixtures.meta} /><Link className="button-primary" href="/live">Open live center <ArrowUpRight className="size-4" /></Link></>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Across tracked competitions" iconName="Activity" index={0} label="Live now" tone="danger" value={live.length} />
        <MetricCard detail="Completed cached fixtures" iconName="CalendarClock" index={1} label="Recent" tone="brand" value={recent.length} />
        <MetricCard detail="League-season leaders" iconName="Goal" index={2} label="Top assists" tone="accent" value={assists[0]?.statistics?.[0]?.goals?.assists ?? 0} />
        <MetricCard detail="Current injury records" iconName="Shield" index={3} label="Unavailable" tone="warning" value={injuries.length} />
      </section>

      <section>
        <SectionHeading description="Current live matches when your plan supports them, followed by cached historical results." href="/fixtures" title="Live & recent" />
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {[...live, ...recent].slice(0, 4).map((match, index) => <MatchCard compact index={index} key={match.fixture?.id} match={match} />)}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.55fr)]">
        <div className="surface-panel overflow-hidden">
          <div className="border-b border-line p-5 sm:p-6"><SectionHeading description="Qualification positions and five-match form." href="/standings" title="League position" /></div>
          <StandingsTable limit={7} rows={table} />
        </div>
        <div className="surface-panel p-5 sm:p-6">
          <SectionHeading description="Creators shaping the current season." href="/players" title="Assist leaders" />
          <Leaderboard players={assists} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)]">
        <div className="surface-panel p-5 sm:p-6">
          <SectionHeading description="Current absences synchronized from the injury endpoint." href="/insights" title="Availability watch" />
          <InjuryList items={injuries} limit={5} />
        </div>
        <div className="surface-panel score-grid flex flex-col justify-between p-6">
          <div><span className="chip"><RefreshCcw className="size-3" /> Smart refresh</span><h2 className="mt-5 text-2xl font-black tracking-[-0.04em]">The cache works harder than the quota.</h2><p className="mt-3 text-sm leading-6 text-ink-muted">Jobs use endpoint-specific TTLs, retain the last good response and stop when the rate-limit budget runs low.</p></div>
          <Link className="button-secondary mt-6" href="/admin">Review sync control <ArrowUpRight className="size-4" /></Link>
        </div>
      </section>
    </div>
  );
}
