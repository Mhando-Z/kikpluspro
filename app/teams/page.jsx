import { Building2, MapPinned, ShieldCheck } from "lucide-react";
import { DataSourceBadge, MetricCard, PageIntro, SectionHeading, TeamGrid } from "@/components/football/FootballUI";
import { getFootballData } from "@/lib/api-football/cache";
import { competitionParams, responseOf } from "@/lib/api-football/page-data";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }) {
  const competition = await competitionParams(searchParams);
  const teamsData = await getFootballData("teams", competition, { allowStale: true });
  const teams = responseOf(teamsData);
  const venues = teams.filter((item) => item.venue?.id).length;
  const oldest = teams.reduce((current, item) => !current || (item.team?.founded ?? 9999) < (current.team?.founded ?? 9999) ? item : current, null);
  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Club directory" title="Identity, venue and squad context." description="Stable club profiles are cached aggressively, keeping logos and reference data away from your live-match request budget." actions={<DataSourceBadge meta={teamsData.meta} />} />
      <section className="grid gap-3 sm:grid-cols-3"><MetricCard detail="Selected competition" iconName="Shield" label="Clubs indexed" value={teams.length} /><MetricCard detail="Linked stadium records" iconName="CalendarClock" index={1} label="Venues" tone="accent" value={venues} /><MetricCard detail={oldest?.team?.name ?? "Awaiting data"} iconName="Trophy" index={2} label="Earliest founded" tone="warning" value={oldest?.team?.founded ?? "—"} /></section>
      <section><SectionHeading description="Club cards stay useful from phone portrait to widescreen operations view." title="Competition clubs" /><TeamGrid teams={teams} /></section>
      <section className="grid gap-4 md:grid-cols-3"><div className="surface-flat p-5"><Building2 className="size-5 text-brand-strong" /><h3 className="mt-4 font-black">Profiles</h3><p className="mt-2 text-xs leading-5 text-ink-muted">Names, codes, foundation year, country and national-team flag.</p></div><div className="surface-flat p-5"><MapPinned className="size-5 text-accent" /><h3 className="mt-4 font-black">Venue detail</h3><p className="mt-2 text-xs leading-5 text-ink-muted">Capacity, city, address and surface are normalized for instant filtering.</p></div><div className="surface-flat p-5"><ShieldCheck className="size-5 text-warning" /><h3 className="mt-4 font-black">Coverage first</h3><p className="mt-2 text-xs leading-5 text-ink-muted">League coverage flags prevent the UI from requesting unsupported features.</p></div></section>
    </div>
  );
}

