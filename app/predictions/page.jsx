import { BrainCircuit, Database, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/football/FootballUI";
import { AutomatedForecasts } from "@/components/football/AutomatedForecasts";
import { PredictionLab } from "@/components/football/PredictionLab";

export const metadata = { title: "AI predictions" };

export default function PredictionsPage() {
  return (
    <div className="space-y-7">
      <PageIntro
        eyebrow="Explainable match intelligence"
        title="Probabilities built from form, strength and goals."
        description="KickPulse combines chronological Elo ratings, a Poisson score model and validation-season calibration. Every feature is calculated before kickoff and tested against a later season."
        actions={<span className="chip"><BrainCircuit className="size-3.5" /> Calibrated Elo + Poisson v2</span>}
      />
      <AutomatedForecasts />
      <PredictionLab />
      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-flat p-5"><Database className="size-5 text-brand-strong" /><h2 className="mt-4 font-black">Chronological data</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Training rows are ordered by date. Match statistics only influence later matches.</p></article>
        <article className="surface-flat p-5"><ShieldCheck className="size-5 text-accent" /><h2 className="mt-4 font-black">Leakage protected</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Current-match scores, shots and xG are targets—not prediction inputs.</p></article>
        <article className="surface-flat p-5"><BrainCircuit className="size-5 text-warning" /><h2 className="mt-4 font-black">Calibrated honestly</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Probability calibration learns from validation data, then faces a separate untouched test season.</p></article>
      </section>
    </div>
  );
}
