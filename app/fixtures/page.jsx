import { CalendarDays } from "lucide-react";
import { DataSourceBadge, EmptyState, MatchCard, PageIntro, SectionHeading } from "@/components/football/FootballUI";
import { getFootballData } from "@/lib/api-football/cache";
import { competitionParams, responseOf } from "@/lib/api-football/page-data";

export const metadata = { title: "Fixtures" };

export default async function FixturesPage({ searchParams }) {
  const competition = await competitionParams(searchParams);
  const lastData = await getFootballData("fixtures", { ...competition, last: "30" }, { allowStale: true });
  const recent = responseOf(lastData).filter((item) => item.fixture?.status?.short === "FT");
  return <div className="space-y-7"><PageIntro eyebrow="Results archive" title="Completed matches, ready for review." description="The default API-Football view uses the latest season available to free plans. The separate AI pipeline can import newer public match results without spending your API quota." actions={<><DataSourceBadge meta={lastData.meta} /><span className="chip"><CalendarDays className="size-3" /> {competition.season} season</span></>} /><section><SectionHeading description="Final scores remain available even when the upstream API has a temporary issue." title="Recent results" />{recent.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{recent.slice(0, 18).map((match, index) => <MatchCard compact index={index} key={match.fixture?.id} match={match} />)}</div> : <EmptyState title="No completed results in this cache key" />}</section></div>;
}
