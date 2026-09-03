import { BrainCircuit, FlaskConical } from "lucide-react";
import { PageIntro } from "@/components/football/FootballUI";
import { PredictionLab } from "@/components/football/PredictionLab";

export const metadata = {
  title: "Football Match Prediction Simulator",

  description:
    "Simulate supported football matchups and compare calibrated home-win, draw and away-win probabilities using KickPulse's explainable Elo–Poisson models.",

  alternates: {
    canonical: "/simulator",
  },

  openGraph: {
    url: "/simulator",
    title: "Football Match Prediction Simulator | KickPulse",
    description:
      "Choose two clubs and inspect expected goals, outcome probabilities, likely scorelines and the factors influencing the forecast.",
  },
};

export default function SimulatorPage() {
  return (
    <div className="space-y-7">
      <PageIntro
        eyebrow="Manual scenario laboratory"
        title="Choose the matchup. Inspect the probability."
        description="Compare any two clubs in a supported league using the active Elo–Poisson model, calibrated outcome probabilities and explainable score simulation."
        actions={
          <span className="chip">
            <FlaskConical className="size-3.5 text-accent" /> Scenario analysis
          </span>
        }
      />
      <PredictionLab />
      <div className="surface-flat flex items-start gap-3 p-5 text-xs leading-5 text-ink-muted">
        <BrainCircuit className="mt-0.5 size-4 shrink-0 text-brand-strong" />
        <p>
          Manual simulations explore a hypothetical matchup. Automatic forecasts
          are the auditable predictions that enter the live model scorecard
          before kickoff.
        </p>
      </div>
    </div>
  );
}
