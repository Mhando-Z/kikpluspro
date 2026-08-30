import { BrainCircuit, Database, MousePointerClick, ShieldCheck } from "lucide-react";
import { PageIntro } from "@/components/football/FootballUI";
import { AutomatedForecasts } from "@/components/football/AutomatedForecasts";

export const metadata = { title: "Automatic forecasts" };

export default function PredictionsPage() {
  return (
    <div className="space-y-7">
      <PageIntro
        eyebrow="Automatic match intelligence"
        title="Every upcoming fixture, scored before kickoff."
        description="Open any forecast for the full probability report, expected goals, likely scorelines, model explanations and a private option to track the bet on this device."
        actions={<span className="chip"><BrainCircuit className="size-3.5" /> Calibrated Elo + Poisson v2</span>}
      />
      <AutomatedForecasts />
      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-flat p-5"><MousePointerClick className="size-5 text-brand-strong" /><h2 className="mt-4 font-black">Open the full report</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Click any forecast card to inspect the same depth available in the manual simulator.</p></article>
        <article className="surface-flat p-5"><Database className="size-5 text-accent" /><h2 className="mt-4 font-black">Tracked before kickoff</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Automatic predictions are written before results exist, keeping the live scorecard honest.</p></article>
        <article className="surface-flat p-5"><ShieldCheck className="size-5 text-warning" /><h2 className="mt-4 font-black">Probabilities, not promises</h2><p className="mt-2 text-xs leading-5 text-ink-muted">Use the model as decision support and record results rather than treating confidence as certainty.</p></article>
      </section>
    </div>
  );
}
