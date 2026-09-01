"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  DatabaseZap,
  ExternalLink,
  Gauge,
  Goal,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Target,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { TeamMark } from "@/components/football/FootballUI";
import { saveTrackedBet } from "@/lib/client/bet-store";

const outcomes = [
  { key: "homeWin", label: "Home", tone: "bg-brand" },
  { key: "draw", label: "Draw", tone: "bg-accent" },
  { key: "awayWin", label: "Away", tone: "bg-warning" },
];

function percentage(value, digits = 0) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)}%` : "—";
}

function decimal(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function kickoffLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function relativeSourceDate(value) {
  if (!value) return "Source time unavailable";
  return `Feed updated ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

function stageLabel(value) {
  return value ? String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : null;
}

function ProbabilityBar({ label, value, tone, selected }) {
  const width = Math.max(0, Math.min(100, Number(value || 0) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[0.69rem]">
        <span className={`font-extrabold ${selected ? "text-ink" : "text-ink-muted"}`}>{label}</span>
        <span className="font-black tabular-nums">{percentage(value, 1)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong/70">
        <motion.div
          className={`h-full rounded-full ${tone}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function SetupState({ error, onRetry, loading }) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-6 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <DatabaseZap className="size-5" />
          </span>
          <p className="eyebrow mt-6">One-time setup</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Connect the fixture tracker.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">
            Your trained model is preserved. Apply the new tracking migration once, then import the current fixture feed to create automatic forecasts.
          </p>
          {error ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning/5 p-4 text-xs leading-5 text-ink-muted">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{error}</span>
            </div>
          ) : null}
          <button className="button-secondary mt-5" type="button" onClick={onRetry} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Check again
          </button>
        </div>
        <div className="border-t border-line bg-[#06130f] p-6 text-[#dff8ed] lg:border-l lg:border-t-0 sm:p-8">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.15em] text-[#8ea49c]">Run from the project folder</p>
          <ol className="mt-5 space-y-4 text-xs">
            {[
              ["1", "Apply in Supabase SQL Editor", "202608300002_prediction_tracking.sql"],
              ["2", "Validate the public feed", "npm run ai:fixtures:dry"],
              ["3", "Sync and predict", "npm run ai:fixtures:sync"],
            ].map(([number, title, command]) => (
              <li className="flex gap-3" key={number}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#31dfa4]/15 font-black text-[#8af0cc]">{number}</span>
                <div className="min-w-0">
                  <p className="font-extrabold">{title}</p>
                  <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded-lg bg-black/25 px-2.5 py-2 text-[0.66rem] text-[#8af0cc]">{command}</code>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ForecastCard({ fixture, index, onOpen }) {
  const prediction = fixture.prediction;
  const leadingKey = prediction.pick.code === "H" ? "homeWin" : prediction.pick.code === "D" ? "draw" : "awayWin";
  return (
    <motion.article
      aria-label={`Open full prediction report for ${fixture.homeTeam.name} versus ${fixture.awayTeam.name}`}
      className="surface-flat cursor-pointer overflow-hidden p-5 transition hover:border-brand/30 hover:shadow-[0_18px_50px_rgba(12,171,120,0.10)]"
      initial={{ opacity: 0, y: 12 }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: Math.min(index * 0.04, 0.24), duration: 0.35 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="chip"><CircleDot className="size-3 text-brand-strong" /> {fixture.leagueName}</span>
          <span className="chip"><Sparkles className="size-3 text-accent" /> {prediction.model?.shortFamily ?? "AI model"} v{prediction.model?.version ?? "—"}</span>
        </div>
        <span className="text-[0.67rem] font-bold text-ink-muted">{kickoffLabel(fixture.kickoffAt)}</span>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <div className="min-w-0">
          <span className="mx-auto block w-fit"><TeamMark team={fixture.homeTeam} size="lg" /></span>
          <p className="mt-2 truncate text-sm font-black" title={fixture.homeTeam.name}>{fixture.homeTeam.name}</p>
        </div>
        <div>
          <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.14em] text-ink-muted">xG</p>
          <p className="mt-1 text-lg font-black tabular-nums">{decimal(prediction.expectedGoals.home, 1)}<span className="mx-1 text-ink-muted">–</span>{decimal(prediction.expectedGoals.away, 1)}</p>
        </div>
        <div className="min-w-0">
          <span className="mx-auto block w-fit"><TeamMark team={fixture.awayTeam} size="lg" /></span>
          <p className="mt-2 truncate text-sm font-black" title={fixture.awayTeam.name}>{fixture.awayTeam.name}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-surface-soft/65 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Model pick</span>
          <span className="text-xs font-black text-brand-strong">{prediction.pick.label} · {percentage(prediction.pick.value, 1)}</span>
        </div>
        <div className="mt-4 space-y-3">
          {outcomes.map((outcome) => (
            <ProbabilityBar
              key={outcome.key}
              label={outcome.label}
              tone={outcome.tone}
              value={prediction.probabilities[outcome.key]}
              selected={outcome.key === leadingKey}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.67rem]">
        <span className="flex items-center gap-1.5 font-bold text-ink-muted"><Target className="size-3.5" /> Top score {prediction.topScorelines[0]?.score ?? "—"}</span>
        <span className="font-extrabold text-brand-strong">Full report →</span>
      </div>
    </motion.article>
  );
}

function ReportMetric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-soft/55 p-4">
      <p className="flex items-center gap-2 text-[0.62rem] font-extrabold uppercase tracking-[0.11em] text-ink-muted"><Icon className="size-3.5" /> {label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
      {detail ? <p className="mt-1 text-[0.65rem] text-ink-muted">{detail}</p> : null}
    </div>
  );
}

function oddsFor(fixture, selection) {
  if (selection === "H") return fixture.marketOdds?.home;
  if (selection === "D") return fixture.marketOdds?.draw;
  return fixture.marketOdds?.away;
}

function PredictionReport({ fixture, model, onClose }) {
  const prediction = fixture.prediction;
  const predictionModel = prediction.model ?? model;
  const [selection, setSelection] = useState(prediction.pick.code);
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState(() => String(oddsFor(fixture, prediction.pick.code) ?? ""));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const leadingKey = prediction.pick.code === "H" ? "homeWin" : prediction.pick.code === "D" ? "draw" : "awayWin";

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  const changeSelection = (next) => {
    setSelection(next);
    setOdds(String(oddsFor(fixture, next) ?? ""));
  };

  const saveBet = async (event) => {
    event.preventDefault();
    const numericStake = Number(stake);
    const numericOdds = Number(odds);
    if (!Number.isFinite(numericStake) || numericStake <= 0) return toast.error("Enter a stake greater than zero.");
    if (!Number.isFinite(numericOdds) || numericOdds <= 1) return toast.error("Enter valid decimal odds greater than 1.00.");
    setSaving(true);
    try {
      await saveTrackedBet({
        id: fixture.id,
        fixtureId: fixture.id,
        predictionId: prediction.id,
        modelVersion: predictionModel.version,
        modelKey: predictionModel.modelKey,
        modelFamily: predictionModel.family,
        leagueCode: fixture.leagueCode,
        leagueName: fixture.leagueName,
        kickoffAt: fixture.kickoffAt,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        modelPick: { code: prediction.pick.code, label: prediction.pick.label, probability: prediction.pick.value },
        selection,
        stake: numericStake,
        odds: numericOdds,
        note: note.trim(),
        status: "pending",
        savedAt: new Date().toISOString(),
        actualResult: null,
        score: null,
        settledAt: null,
        returnAmount: 0,
      });
      toast.success("Prediction saved to your private tracker");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this prediction.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[90] overflow-y-auto bg-[#020806]/75 p-3 backdrop-blur-md sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.section aria-modal="true" className="surface-panel mx-auto my-3 max-w-5xl overflow-hidden" initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.99 }} role="dialog">
        <div className="flex items-center justify-between border-b border-line p-4 sm:px-6"><div><p className="eyebrow">Full prediction report</p><p className="mt-1 text-xs text-ink-muted">{fixture.leagueName}{fixture.competitionStage ? ` · ${stageLabel(fixture.competitionStage)}` : ""} · {kickoffLabel(fixture.kickoffAt)}</p></div><button aria-label="Close report" className="icon-button" onClick={onClose} type="button"><X className="size-4" /></button></div>
        <div className="border-b border-line bg-surface-soft/30 p-5 sm:p-7">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
            <div className="min-w-0"><span className="mx-auto block w-fit"><TeamMark team={fixture.homeTeam} size="lg" /></span><h2 className="mt-2 truncate text-base font-black sm:text-xl">{fixture.homeTeam.name}</h2></div>
            <div><p className="text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-ink-muted">Model pick</p><p className="mt-1 text-xl font-black text-brand-strong sm:text-2xl">{prediction.pick.label}</p><p className="text-xs font-extrabold text-ink-muted">{percentage(prediction.pick.value, 1)}</p></div>
            <div className="min-w-0"><span className="mx-auto block w-fit"><TeamMark team={fixture.awayTeam} size="lg" /></span><h2 className="mt-2 truncate text-base font-black sm:text-xl">{fixture.awayTeam.name}</h2></div>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2"><span className="chip capitalize"><Gauge className="size-3.5 text-accent" /> {prediction.confidence} confidence</span><span className="chip"><ShieldCheck className="size-3.5 text-brand-strong" /> {predictionModel.shortFamily ?? predictionModel.family} v{predictionModel.version}</span>{fixture.neutralVenue ? <span className="chip">Neutral venue</span> : null}</div>
        </div>
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.13em] text-ink-muted">1X2 probability</p>
            <div className="mt-4 space-y-4">{outcomes.map((outcome) => <ProbabilityBar key={outcome.key} label={outcome.label} tone={outcome.tone} value={prediction.probabilities[outcome.key]} selected={outcome.key === leadingKey} />)}</div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <ReportMetric icon={Goal} label="Expected goals" value={`${decimal(prediction.expectedGoals.home)} – ${decimal(prediction.expectedGoals.away)}`} />
              <ReportMetric icon={BarChart3} label="Top scoreline" value={prediction.topScorelines[0]?.score ?? "—"} detail={percentage(prediction.topScorelines[0]?.probability, 1)} />
              <ReportMetric icon={Target} label="Over 2.5" value={percentage(prediction.probabilities.over25, 1)} />
              <ReportMetric icon={Sparkles} label="Both teams score" value={percentage(prediction.probabilities.bothTeamsScore, 1)} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-line p-4"><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Most likely scores</p><div className="mt-3 space-y-2">{prediction.topScorelines.map((score, index) => <div className="flex items-center justify-between rounded-xl bg-surface-soft px-3 py-2.5" key={score.score}><span className="text-sm font-black"><span className="mr-2 text-[0.62rem] text-ink-muted">{index + 1}</span>{score.score}</span><span className="text-xs font-extrabold text-ink-muted">{percentage(score.probability, 1)}</span></div>)}</div></div>
            {fixture.marketOdds?.home || fixture.marketOdds?.draw || fixture.marketOdds?.away ? <div className="rounded-2xl border border-line p-4"><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Reference market odds</p><div className="mt-3 grid grid-cols-3 gap-2">{[["Home", fixture.marketOdds.home], ["Draw", fixture.marketOdds.draw], ["Away", fixture.marketOdds.away]].map(([label, value]) => <div className="rounded-xl bg-surface-soft p-3 text-center" key={label}><p className="text-[0.6rem] font-bold text-ink-muted">{label}</p><p className="mt-1 text-sm font-black">{value ? Number(value).toFixed(2) : "—"}</p></div>)}</div></div> : null}
          </div>
        </div>
        <div className="border-t border-line p-5 sm:p-7"><p className="flex items-center gap-2 text-xs font-extrabold"><ShieldQuestion className="size-4 text-accent" /> Why the model says this</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{prediction.explanations.map((explanation) => <p className="rounded-xl bg-surface-soft px-3 py-2.5 text-xs leading-5 text-ink-muted" key={explanation}>{explanation}</p>)}</div></div>
        <form className="border-t border-line bg-surface-soft/35 p-5 sm:p-7" onSubmit={saveBet}>
          <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong"><WalletCards className="size-4.5" /></span><div><h3 className="font-black">Track a bet from this report</h3><p className="mt-1 text-xs leading-5 text-ink-muted">One 1X2 selection per fixture. Saving again updates the record stored in this browser.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label><span className="mb-1.5 block text-xs font-extrabold">Selection</span><select className="form-control" onChange={(event) => changeSelection(event.target.value)} value={selection}><option value="H">Home win</option><option value="D">Draw</option><option value="A">Away win</option></select></label>
            <label><span className="mb-1.5 block text-xs font-extrabold">Stake (TZS)</span><input className="form-control" min="1" onChange={(event) => setStake(event.target.value)} placeholder="10000" step="1" type="number" value={stake} /></label>
            <label><span className="mb-1.5 block text-xs font-extrabold">Decimal odds</span><input className="form-control" min="1.01" onChange={(event) => setOdds(event.target.value)} placeholder="1.85" step="0.01" type="number" value={odds} /></label>
            <label><span className="mb-1.5 block text-xs font-extrabold">Note</span><input className="form-control" maxLength="140" onChange={(event) => setNote(event.target.value)} placeholder="Optional reason" value={note} /></label>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[0.65rem] leading-5 text-ink-muted">Tracking records your decision; it does not place a bet. Forecasts are probabilistic and can be wrong.</p><button className="button-primary shrink-0" disabled={saving} type="submit">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Track this bet</button></div>
        </form>
      </motion.section>
    </motion.div>,
    document.body,
  );
}

function Scorecard({ performance, recent }) {
  return (
    <section className="surface-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Tracked outcomes</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">Live model scorecard</h2>
          <p className="mt-2 text-xs leading-5 text-ink-muted">Metrics update only after a published final result is matched to a stored pre-match forecast.</p>
        </div>
        <span className="chip"><ShieldCheck className="size-3.5 text-brand-strong" /> {performance.matches} settled</span>
      </div>

      {performance.matches ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              [Trophy, "Accuracy", percentage(performance.accuracy, 1)],
              [Target, "Brier score", decimal(performance.brierScore, 3)],
            ].map(([Icon, label, value]) => (
              <div className="rounded-2xl border border-line bg-surface-soft/50 p-4" key={label}>
                <p className="flex items-center gap-2 text-[0.64rem] font-extrabold uppercase tracking-[0.12em] text-ink-muted"><Icon className="size-3.5" /> {label}</p>
                <p className="mt-3 text-xl font-black tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {recent.slice(0, 6).map((fixture) => {
              const correct = fixture.prediction.pick.code === fixture.result;
              return (
                <div className="grid gap-2 p-3.5 text-xs sm:grid-cols-[1fr_auto_auto] sm:items-center" key={fixture.id}>
                  <p className="font-extrabold">{fixture.homeTeam.name} <span className="text-ink-muted">v</span> {fixture.awayTeam.name}</p>
                  <p className="font-black tabular-nums">{fixture.score.home}–{fixture.score.away}</p>
                  <span className={`flex items-center gap-1.5 font-extrabold ${correct ? "text-brand-strong" : "text-ink-muted"}`}>
                    {correct ? <CheckCircle2 className="size-3.5" /> : <CircleDot className="size-3.5" />}
                    Pick: {fixture.prediction.pick.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-surface-soft/35 p-6 text-center">
          <CalendarClock className="mx-auto size-5 text-ink-muted" />
          <p className="mt-3 text-sm font-black">Waiting for the first tracked final score</p>
          <p className="mt-1 text-xs text-ink-muted">After fixtures finish, run <code className="font-bold text-brand-strong">npm run ai:fixtures:settle</code>.</p>
        </div>
      )}
    </section>
  );
}

export function AutomatedForecasts() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [selectedFixture, setSelectedFixture] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch("/api/ai/fixtures", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ready) throw new Error(payload.error || "Could not load automatic forecasts.");
      setState({ loading: false, error: null, data: payload });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Could not load automatic forecasts.", data: null });
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/ai/fixtures", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ready) throw new Error(payload.error || "Could not load automatic forecasts.");
        if (active) setState({ loading: false, error: null, data: payload });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: error instanceof Error ? error.message : "Could not load automatic forecasts.", data: null });
      });
    return () => { active = false; };
  }, []);

  const forecasted = useMemo(
    () => state.data?.upcoming.filter((fixture) => fixture.prediction) ?? [],
    [state.data],
  );

  if (state.loading && !state.data) {
    return (
      <section className="surface-panel flex min-h-64 items-center justify-center p-8" aria-live="polite">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-7 animate-spin text-brand-strong" />
          <p className="mt-4 text-sm font-extrabold">Loading tracked forecasts…</p>
        </div>
      </section>
    );
  }

  if (!state.data) return <SetupState error={state.error} onRetry={load} loading={state.loading} />;

  return (
    <div className="space-y-5">
      <section className="surface-panel overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Automatic forecasts</p>
              <span className="chip"><Sparkles className="size-3.5 text-accent" /> {state.data.models.length} active model {state.data.models.length === 1 ? "family" : "families"}</span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">The next fixtures, scored before kickoff.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Competition-aware routing sends domestic fixtures to the Big Five model and Champions League fixtures to the UCL specialist.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a className="button-ghost text-xs" href={state.data.source.url} target="_blank" rel="noreferrer">
              {relativeSourceDate(state.data.source.lastModified)} <ExternalLink className="size-3.5" />
            </a>
            <button className="icon-button" type="button" onClick={load} disabled={state.loading} aria-label="Refresh forecasts">
              <RefreshCw className={`size-4 ${state.loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </section>

      {forecasted.length ? (
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {forecasted.map((fixture, index) => <ForecastCard fixture={fixture} index={index} key={fixture.id} onOpen={() => setSelectedFixture(fixture)} />)}
        </section>
      ) : (
        <section className="surface-flat p-6 text-center sm:p-8">
          <CalendarClock className="mx-auto size-6 text-ink-muted" />
          <h3 className="mt-4 text-lg font-black">No synced forecasts in the current window</h3>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-ink-muted">The public feed may be between match rounds. Run <code className="font-bold text-brand-strong">npm run ai:fixtures:dry</code> to inspect it, then <code className="font-bold text-brand-strong">npm run ai:fixtures:sync</code>.</p>
        </section>
      )}

      <Scorecard performance={state.data.performance} recent={state.data.recent} />
      <AnimatePresence>
        {selectedFixture ? <PredictionReport fixture={selectedFixture} model={state.data.model} onClose={() => setSelectedFixture(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}
