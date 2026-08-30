import { Activity, Radio, TimerReset } from "lucide-react";
import { DataSourceBadge, MetricCard, PageIntro, SectionHeading } from "@/components/football/FootballUI";
import { RealtimeLiveGrid } from "@/components/football/RealtimeLiveGrid";
import { getFootballData } from "@/lib/api-football/cache";
import { competitionParams, responseOf } from "@/lib/api-football/page-data";

export const metadata = { title: "Live center" };

export default async function LivePage({ searchParams }) {
  const competition = await competitionParams(searchParams);
  const liveData = await getFootballData("fixtures", { live: competition.league }, { allowStale: true });
  const matches = responseOf(liveData);
  const firstFixture = matches[0]?.fixture?.id;
  const [eventsData, statsData] = firstFixture
    ? await Promise.all([getFootballData("fixture-events", { fixture: firstFixture }, { allowStale: true }), getFootballData("fixture-statistics", { fixture: firstFixture }, { allowStale: true })])
    : [{ payload: { response: [] } }, { payload: { response: [] } }];
  const events = responseOf(eventsData);
  const stats = responseOf(statsData);

  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Live match center" title="Follow every shift in momentum." description="A single batched API request updates Supabase, while every connected screen receives the same score state without multiplying upstream calls." actions={<DataSourceBadge meta={liveData.meta} />} />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard detail="In the selected competition" iconName="Activity" label="Matches live" tone="danger" value={matches.length} />
        <MetricCard detail="Recommended polling floor" iconName="CalendarClock" index={1} label="Refresh cadence" tone="brand" value="30s" />
        <MetricCard detail="Backend polls, not viewers" iconName="UsersRound" index={2} label="Fan-out model" tone="accent" value="1 → all" />
      </section>
      <section><SectionHeading description="Star any match to keep it in your local watchlist." title="On the pitch" /><RealtimeLiveGrid initialMatches={matches} /></section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="surface-panel p-5 sm:p-6"><SectionHeading description="Goals, cards and substitutions from the featured live match." title="Match timeline" /><div className="space-y-3">{events.map((event, index) => <div className="flex items-center gap-3 rounded-2xl bg-surface-soft p-3" key={`${event.time?.elapsed}-${index}`}><span className="flex size-10 items-center justify-center rounded-xl bg-canvas-elevated text-xs font-black">{event.time?.elapsed}′</span><span className={`flex size-9 items-center justify-center rounded-xl ${event.type === "Goal" ? "bg-brand-soft text-brand-strong" : "bg-warning/10 text-warning"}`}>{event.type === "Goal" ? <Radio className="size-4" /> : <TimerReset className="size-4" />}</span><div><p className="text-sm font-extrabold">{event.player?.name}</p><p className="text-xs text-ink-muted">{event.detail} · {event.team?.name}</p></div></div>)}</div></div>
        <div className="surface-panel p-5 sm:p-6"><SectionHeading description="Live team totals update at a slower, quota-aware cadence." title="Key numbers" /><div className="grid gap-3 sm:grid-cols-2">{stats.map((entry) => <div className="surface-flat p-4" key={entry.team?.id}><p className="font-black">{entry.team?.name}</p><div className="mt-4 space-y-3">{entry.statistics?.map((stat) => <div className="flex items-center justify-between text-xs" key={stat.type}><span className="text-ink-muted">{stat.type}</span><span className="font-black">{stat.value ?? "—"}</span></div>)}</div></div>)}</div></div>
      </section>
    </div>
  );
}
