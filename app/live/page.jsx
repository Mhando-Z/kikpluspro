import { Database, Radio, ShieldCheck } from "lucide-react";
import { LiveScoreWidget } from "@/components/football/LiveScoreWidget";
import { MetricCard, PageIntro, SectionHeading } from "@/components/football/FootballUI";

export const metadata = { title: "Live center" };

export default function LivePage() {
  return (
    <div className="space-y-7">
      <PageIntro
        eyebrow="Live match center"
        title="See the score while the forecast stays frozen."
        description="Follow in-play and finished matches through the official free LiveXscores widget used by Football-Data. Live scores never overwrite the probability snapshot created before kickoff."
        actions={<span className="chip"><Radio className="size-3.5 text-danger" /> LiveXscores feed</span>}
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard detail="Provider-controlled updates" iconName="Activity" label="Score mode" tone="danger" value="Live" />
        <MetricCard detail="All, in play, upcoming, finished" iconName="ListFilter" index={1} label="Score views" tone="brand" value="4" />
        <MetricCard detail="Predictions remain pre-match records" iconName="ShieldCheck" index={2} label="Audit safety" tone="accent" value="Frozen" />
      </section>
      <LiveScoreWidget />
      <section>
        <SectionHeading
          description="Live display and model scoring have deliberately different responsibilities."
          title="How results reach the AI scorecard"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <article className="surface-flat p-5"><Radio className="size-5 text-danger" /><h2 className="mt-4 font-black">1. Watch live</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Use the scoreboard above to follow the five tracked fixtures as they play.</p></article>
          <article className="surface-flat p-5"><Database className="size-5 text-accent" /><h2 className="mt-4 font-black">2. Import full time</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Run <code>npm run ai:fixtures:settle</code> after Football-Data publishes the completed results.</p></article>
          <article className="surface-flat p-5"><ShieldCheck className="size-5 text-brand-strong" /><h2 className="mt-4 font-black">3. Verify honestly</h2><p className="mt-2 text-xs leading-5 text-ink-muted">KickPulse marks the stored forecast correct or incorrect without changing its original probabilities.</p></article>
        </div>
      </section>
    </div>
  );
}
