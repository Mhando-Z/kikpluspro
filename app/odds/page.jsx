import { BadgeDollarSign, CircleDollarSign, Info, RadioTower } from "lucide-react";
import { DataSourceBadge, OddsBoard, PageIntro, SectionHeading } from "@/components/football/FootballUI";
import { getFootballData } from "@/lib/api-football/cache";
import { competitionParams, responseOf } from "@/lib/api-football/page-data";

export const metadata = { title: "Odds" };

export default async function OddsPage({ searchParams }) {
  const competition = await competitionParams(searchParams);
  const [oddsData, liveData, bookmakersData, betsData] = await Promise.all([getFootballData("odds", { ...competition, page: "1" }, { allowStale: true }), getFootballData("live-odds", { league: competition.league }, { allowStale: true }), getFootballData("bookmakers", {}, { allowStale: true }), getFootballData("bet-types", {}, { allowStale: true })]);
  const odds = responseOf(oddsData), live = responseOf(liveData), bookmakers = responseOf(bookmakersData), bets = responseOf(betsData);
  return <div className="space-y-7"><PageIntro eyebrow="Market intelligence" title="Prices without mixing the ID systems." description="Pre-match and live bet identifiers stay in separate namespaces, preventing one of the easiest API-Football integration mistakes." actions={<DataSourceBadge meta={oddsData.meta} />} /><section className="surface-panel p-5 sm:p-6"><SectionHeading description="Representative match-winner market from the current cache." title="Pre-match prices" /><OddsBoard items={odds} /></section><section className="grid gap-5 xl:grid-cols-3"><div className="surface-flat p-5"><CircleDollarSign className="size-5 text-brand-strong" /><p className="mt-4 text-3xl font-black">{odds.length}</p><p className="mt-1 text-xs font-extrabold text-ink-muted">Pre-match fixtures cached</p></div><div className="surface-flat p-5"><RadioTower className="size-5 text-danger" /><p className="mt-4 text-3xl font-black">{live.length}</p><p className="mt-1 text-xs font-extrabold text-ink-muted">Live odds feeds active</p></div><div className="surface-flat p-5"><BadgeDollarSign className="size-5 text-accent" /><p className="mt-4 text-3xl font-black">{bookmakers.length} / {bets.length}</p><p className="mt-1 text-xs font-extrabold text-ink-muted">Bookmakers / market types</p></div></section><section className="surface-flat flex gap-3 p-5"><Info className="mt-0.5 size-5 shrink-0 text-warning" /><div><h2 className="font-black">Capture odds history yourself</h2><p className="mt-1 text-xs leading-5 text-ink-muted">Live odds disappear after the match and pre-match history is limited. The included cache schema records response snapshots, timestamps and hashes so you can retain the history your product needs.</p></div></section></div>;
}

