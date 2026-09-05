import Link from "next/link";
import {
  BrainCircuit,
  Database,
  MousePointerClick,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { PageIntro } from "@/components/football/FootballUI";
import { AutomatedForecasts } from "@/components/football/AutomatedForecasts";

export const metadata = {
  title: "AI Football Predictions",

  description:
    "Review upcoming football predictions with calibrated match probabilities, expected goals, likely scorelines, confidence levels and clear model explanations.",

  alternates: {
    canonical: "/predictions",
  },

  openGraph: {
    url: "/predictions",
    title: "AI Football Predictions | KickPulse",
    description:
      "Upcoming match forecasts with calibrated probabilities, expected goals, likely scorelines and explainable model evidence.",
  },
};

export default function PredictionsPage() {
  return (
    <div className="space-y-7">
      <PageIntro
        eyebrow="Automatic match intelligence"
        title="Every upcoming fixture, scored before kickoff."
        description="Open any forecast for the full probability report, expected goals, likely scorelines, model explanations and a private option to track the bet on this device."
        actions={
          <div className="flex flex-wrap gap-2">
            <span className="chip">
              <BrainCircuit className="size-3.5" /> Calibrated Elo + Poisson v2
            </span>
            <Link className="button-secondary" href="/live">
              <Radio className="size-3.5 text-danger" /> Live scores
            </Link>
          </div>
        }
      />
      {/* prediction reports section */}
      <AutomatedForecasts />
      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-flat p-5">
          <MousePointerClick className="size-5 text-brand-strong" />
          <h2 className="mt-4 font-black">Open the full report</h2>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Click any forecast card to inspect the same depth available in the
            manual simulator.
          </p>
        </article>
        <article className="surface-flat p-5">
          <Database className="size-5 text-accent" />
          <h2 className="mt-4 font-black">Tracked before kickoff</h2>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Automatic predictions are written before results exist, keeping the
            live scorecard honest.
          </p>
        </article>
        <article className="surface-flat p-5">
          <ShieldCheck className="size-5 text-warning" />
          <h2 className="mt-4 font-black">Probabilities, not promises</h2>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            Use the model as decision support and record results rather than
            treating confidence as certainty.
          </p>
        </article>
      </section>
    </div>
  );
}
