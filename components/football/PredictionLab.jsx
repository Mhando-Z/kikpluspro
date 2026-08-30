"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  DatabaseZap,
  Goal,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldQuestion,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TeamMark } from "@/components/football/FootballUI";

const outcomeDetails = [
  { key: "homeWin", label: "Home win", tone: "bg-brand" },
  { key: "draw", label: "Draw", tone: "bg-accent" },
  { key: "awayWin", label: "Away win", tone: "bg-warning" },
];

function percentage(value, digits = 0) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)}%` : "—";
}

function decimal(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

async function fetchActiveModel() {
  const response = await fetch("/api/ai/model", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.ready) throw new Error(payload.error || "The trained model is not available.");
  const usableLeagues = payload.model.leagues.filter((league) => league.teams.length >= 2);
  if (!usableLeagues.length) throw new Error("The active model does not contain two teams in a supported league.");
  return { ...payload.model, leagues: usableLeagues };
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-soft/60 p-4">
      <div className="flex items-center gap-2 text-ink-muted">
        <Icon className="size-3.5" />
        <span className="text-[0.64rem] font-extrabold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="mt-3 text-xl font-black tracking-[-0.035em]">{value}</p>
      {detail ? <p className="mt-1 text-[0.68rem] leading-4 text-ink-muted">{detail}</p> : null}
    </div>
  );
}

function ProbabilityBar({ label, value, tone, winner }) {
  const width = Math.max(0, Math.min(100, Number(value || 0) * 100));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <span className="flex items-center gap-2 font-extrabold">
          {winner ? <CheckCircle2 className="size-3.5 text-brand-strong" /> : <span className="size-3.5" />}
          {label}
        </span>
        <span className="font-black tabular-nums">{percentage(value, 1)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-strong/70">
        <motion.div
          className={`h-full rounded-full ${tone}`}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function EmptyModel({ error, onRetry, loading }) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-6 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <DatabaseZap className="size-5" />
          </span>
          <p className="eyebrow mt-6">Model setup</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Train the first honest baseline.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">
            The prediction interface is ready, but it will not invent results. Import completed matches into Supabase, then train and activate the baseline model.
          </p>
          {error ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning/5 p-4 text-xs leading-5 text-ink-muted">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{error}</span>
            </div>
          ) : null}
          <button className="button-secondary mt-5" onClick={onRetry} type="button" disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Check model status
          </button>
        </div>
        <div className="border-t border-line bg-[#06130f] p-6 text-[#dff8ed] lg:border-l lg:border-t-0 sm:p-8">
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.15em] text-[#8ea49c]">Run from the project folder</p>
          <ol className="mt-5 space-y-4 text-xs">
            {[
              ["1", "Apply the AI migration", "supabase db push"],
              ["2", "Import historical matches", "npm run ai:import -- --from=2010 --to=2025"],
              ["3", "Train and activate", "npm run ai:train"],
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

export function PredictionLab() {
  const [status, setStatus] = useState({ loading: true, error: null, model: null });
  const [leagueCode, setLeagueCode] = useState("");
  const [homeTeamKey, setHomeTeamKey] = useState("");
  const [awayTeamKey, setAwayTeamKey] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [predictionState, setPredictionState] = useState({ loading: false, error: null, data: null });

  async function loadModel() {
    setStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      const model = await fetchActiveModel();
      setStatus({ loading: false, error: null, model });
      setLeagueCode(model.leagues[0].code);
      setHomeTeamKey(model.leagues[0].teams[0].key);
      setAwayTeamKey(model.leagues[0].teams[1].key);
      setMatchDate((current) => current || new Date().toISOString().slice(0, 10));
    } catch (error) {
      setStatus({ loading: false, error: error instanceof Error ? error.message : "Could not load the model.", model: null });
    }
  }

  useEffect(() => {
    let active = true;
    fetchActiveModel()
      .then((model) => {
        if (!active) return;
        setStatus({ loading: false, error: null, model });
        setLeagueCode(model.leagues[0].code);
        setHomeTeamKey(model.leagues[0].teams[0].key);
        setAwayTeamKey(model.leagues[0].teams[1].key);
        setMatchDate(new Date().toISOString().slice(0, 10));
      })
      .catch((error) => {
        if (active) setStatus({ loading: false, error: error instanceof Error ? error.message : "Could not load the model.", model: null });
      });
    return () => { active = false; };
  }, []);

  const league = useMemo(
    () => status.model?.leagues.find((item) => item.code === leagueCode) ?? status.model?.leagues[0],
    [leagueCode, status.model],
  );

  function selectLeague(code) {
    const nextLeague = status.model?.leagues.find((item) => item.code === code);
    if (!nextLeague) return;
    setLeagueCode(code);
    setHomeTeamKey(nextLeague.teams[0]?.key ?? "");
    setAwayTeamKey(nextLeague.teams[1]?.key ?? "");
    setPredictionState({ loading: false, error: null, data: null });
  }

  async function submitPrediction(event) {
    event.preventDefault();
    if (!league || !homeTeamKey || !awayTeamKey || homeTeamKey === awayTeamKey) {
      setPredictionState({ loading: false, error: "Choose two different teams.", data: null });
      return;
    }
    setPredictionState({ loading: true, error: null, data: null });
    try {
      const response = await fetch("/api/ai/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagueCode: league.code, homeTeamKey, awayTeamKey, matchDate }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Prediction failed.");
      setPredictionState({ loading: false, error: null, data: payload });
    } catch (error) {
      setPredictionState({ loading: false, error: error instanceof Error ? error.message : "Prediction failed.", data: null });
    }
  }

  if (status.loading && !status.model) {
    return (
      <section className="surface-panel flex min-h-80 items-center justify-center p-8" aria-live="polite">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-7 animate-spin text-brand-strong" />
          <p className="mt-4 text-sm font-extrabold">Loading the active model…</p>
        </div>
      </section>
    );
  }

  if (!status.model) return <EmptyModel error={status.error} onRetry={loadModel} loading={status.loading} />;

  const metrics = status.model.metrics?.test ?? {};
  const uncalibratedMetrics = status.model.metrics?.testUncalibrated ?? null;
  const calibration = status.model.metrics?.calibration ?? null;
  const leagueMetrics = Object.entries(metrics.byLeague ?? {}).map(([code, values]) => ({
    code,
    name: status.model.leagues.find((item) => item.code === code)?.name ?? code,
    ...values,
  }));
  const calibrationDelta = uncalibratedMetrics
    ? Number(metrics.logLoss) - Number(uncalibratedMetrics.logLoss)
    : null;
  const result = predictionState.data?.prediction;
  const strongestOutcome = result
    ? outcomeDetails.reduce((best, item) => result.probabilities[item.key] > result.probabilities[best.key] ? item : best)
    : null;

  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <form className="surface-panel p-5 sm:p-6" onSubmit={submitPrediction}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Fixture simulator</p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">Build a matchup</h2>
            </div>
            <span className="chip"><Sparkles className="size-3.5 text-accent" /> v{status.model.version}</span>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-extrabold">Competition</span>
              <select className="form-control" value={league?.code ?? ""} onChange={(event) => selectLeague(event.target.value)}>
                {status.model.leagues.map((item) => <option value={item.code} key={item.code}>{item.name}</option>)}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-extrabold">Home team</span>
                <select className="form-control" value={homeTeamKey} onChange={(event) => setHomeTeamKey(event.target.value)}>
                  {league?.teams.map((team) => <option value={team.key} key={team.key} disabled={team.key === awayTeamKey}>{team.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-extrabold">Away team</span>
                <select className="form-control" value={awayTeamKey} onChange={(event) => setAwayTeamKey(event.target.value)}>
                  {league?.teams.map((team) => <option value={team.key} key={team.key} disabled={team.key === homeTeamKey}>{team.name}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-extrabold"><CalendarDays className="size-3.5 text-ink-muted" /> Match date</span>
              <input className="form-control" type="date" value={matchDate} onChange={(event) => setMatchDate(event.target.value)} required />
            </label>
          </div>

          {predictionState.error ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-xs font-bold text-danger" role="alert">
              <AlertTriangle className="size-4 shrink-0" /> {predictionState.error}
            </p>
          ) : null}
          <button className="button-primary mt-6 w-full" type="submit" disabled={predictionState.loading}>
            {predictionState.loading ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}
            {predictionState.loading ? "Calculating…" : "Run probability model"}
            {!predictionState.loading ? <ArrowRight className="size-4" /> : null}
          </button>
          <p className="mt-3 text-center text-[0.66rem] leading-4 text-ink-muted">Probabilistic analysis—not a guarantee or betting instruction.</p>
        </form>

        <div className="surface-panel min-h-[32rem] overflow-hidden">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div key={`${result.homeTeam.key}-${result.awayTeam.key}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="border-b border-line p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="eyebrow">Model output</p>
                      <div className="mt-3 flex items-center gap-3">
                        <TeamMark team={result.homeTeam} size="lg" />
                        <h2 className="text-lg font-black tracking-[-0.035em] sm:text-2xl">
                          {result.homeTeam.name} <span className="text-ink-muted/60">vs</span> {result.awayTeam.name}
                        </h2>
                        <TeamMark team={result.awayTeam} size="lg" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="chip w-fit capitalize"><Target className="size-3.5 text-brand-strong" /> {result.confidence} confidence</span>
                      {result.calibration?.applied ? <span className="chip w-fit"><Gauge className="size-3.5 text-accent" /> Calibrated T={decimal(result.calibration.temperature, 2)}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_0.85fr]">
                  <div>
                    <div className="space-y-5">
                      {outcomeDetails.map((item) => (
                        <ProbabilityBar
                          key={item.key}
                          label={item.label}
                          value={result.probabilities[item.key]}
                          tone={item.tone}
                          winner={strongestOutcome?.key === item.key}
                        />
                      ))}
                    </div>
                    <div className="mt-7 grid grid-cols-2 gap-3">
                      <Metric icon={Goal} label="Expected goals" value={`${result.expectedGoals.home.toFixed(2)} – ${result.expectedGoals.away.toFixed(2)}`} />
                      <Metric icon={TrendingUp} label="Over 2.5" value={percentage(result.probabilities.over25, 1)} />
                      <Metric icon={Target} label="Both score" value={percentage(result.probabilities.bothTeamsScore, 1)} />
                      <Metric icon={BarChart3} label="Best scoreline" value={result.topScorelines[0]?.score ?? "—"} detail={percentage(result.topScorelines[0]?.probability, 1)} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line bg-surface-soft/60 p-4">
                    <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Most likely scores</p>
                    <div className="mt-4 space-y-2">
                      {result.topScorelines.map((scoreline, index) => (
                        <div className="flex items-center justify-between rounded-xl bg-canvas-elevated px-3 py-2.5" key={scoreline.score}>
                          <span className="flex items-center gap-2 text-sm font-black"><span className="text-[0.62rem] text-ink-muted">{index + 1}</span>{scoreline.score}</span>
                          <span className="text-xs font-extrabold text-ink-muted">{percentage(scoreline.probability, 1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="border-t border-line p-5 sm:p-6">
                  <p className="flex items-center gap-2 text-xs font-extrabold"><ShieldQuestion className="size-4 text-accent" /> Why the model says this</p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {result.explanations.map((explanation) => <li className="rounded-xl bg-surface-soft px-3 py-2.5 text-xs leading-5 text-ink-muted" key={explanation}>{explanation}</li>)}
                  </ul>
                </div>
              </motion.div>
            ) : (
              <motion.div className="flex min-h-[32rem] items-center justify-center p-8" key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="max-w-sm text-center">
                  <span className="mx-auto flex size-16 items-center justify-center rounded-[1.4rem] bg-brand-soft text-brand-strong"><BrainCircuit className="size-7" /></span>
                  <h2 className="mt-5 text-xl font-black tracking-[-0.035em]">Ready for a real matchup.</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">Choose two clubs to calculate the full score matrix, outcome probabilities and supporting factors.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="surface-flat p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Held-out performance</p>
            <h2 className="mt-2 text-lg font-black tracking-[-0.03em]">What the latest test season measured</h2>
            <p className="mt-1 text-xs text-ink-muted">Trained through {status.model.trainedTo} · {Number(status.model.testRows || 0).toLocaleString()} unseen test matches</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[36rem]">
            <Metric icon={Target} label="Accuracy" value={percentage(metrics.accuracy, 1)} />
            <Metric icon={BarChart3} label="Log loss" value={decimal(metrics.logLoss)} detail={calibrationDelta === null ? "Lower is better" : `${calibrationDelta <= 0 ? "Improved" : "Changed"} ${decimal(Math.abs(calibrationDelta), 4)} after calibration`} />
            <Metric icon={ShieldQuestion} label="Brier" value={decimal(metrics.brierScore)} detail="Lower is better" />
            <Metric icon={Goal} label="Goal MAE" value={decimal(metrics.goalMae, 2)} detail="Per team" />
          </div>
        </div>
      </div>

      {calibration ? (
        <div className="surface-panel overflow-hidden">
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <p className="eyebrow">Probability calibration</p>
              <h2 className="mt-2 text-lg font-black tracking-[-0.03em]">Confidence adjusted before release</h2>
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                Temperature scaling learned from season {calibration.fittedSeason}. Values above 1 soften overconfident probabilities; values below 1 sharpen them.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric icon={Gauge} label="Global T" value={decimal(calibration.global?.temperature, 2)} />
                <Metric icon={DatabaseZap} label="Fit matches" value={Number(calibration.global?.samples ?? 0).toLocaleString()} />
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Untouched test comparison</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric icon={BarChart3} label="Before" value={decimal(uncalibratedMetrics?.logLoss)} detail="Uncalibrated log loss" />
                <Metric icon={BarChart3} label="After" value={decimal(metrics.logLoss)} detail="Calibrated log loss" />
                <Metric
                  icon={calibrationDelta !== null && calibrationDelta <= 0 ? CheckCircle2 : AlertTriangle}
                  label="Difference"
                  value={calibrationDelta === null ? "—" : `${calibrationDelta > 0 ? "+" : ""}${decimal(calibrationDelta, 4)}`}
                  detail={calibrationDelta === null ? "Retrain to compare" : calibrationDelta <= 0 ? "Improved on test data" : "Worsened on test data"}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="surface-panel overflow-hidden">
        <div className="border-b border-line p-5 sm:p-6">
          <p className="eyebrow">League diagnostics</p>
          <h2 className="mt-2 text-lg font-black tracking-[-0.03em]">Performance is not equal across competitions</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">The market gap compares model log loss with normalized closing-odds log loss. Lower values are better.</p>
        </div>
        {leagueMetrics.length ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[46rem]">
              <thead><tr><th>League</th><th>Matches</th><th>Accuracy</th><th>Log loss</th><th>Market</th><th>Market gap</th></tr></thead>
              <tbody>
                {leagueMetrics.sort((left, right) => left.logLoss - right.logLoss).map((item) => {
                  const marketGap = item.marketLogLoss === null ? null : item.logLoss - item.marketLogLoss;
                  return (
                    <tr key={item.code}>
                      <td><div><p className="font-extrabold">{item.name}</p><p className="text-[0.65rem] text-ink-muted">{item.code}</p></div></td>
                      <td>{Number(item.matches).toLocaleString()}</td>
                      <td className="font-extrabold">{percentage(item.accuracy, 1)}</td>
                      <td>{decimal(item.logLoss)}</td>
                      <td>{decimal(item.marketLogLoss)}</td>
                      <td><span className={`chip ${marketGap !== null && marketGap <= 0 ? "text-brand-strong" : "text-danger"}`}>{marketGap === null ? "—" : `${marketGap > 0 ? "+" : ""}${decimal(marketGap, 3)}`}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm text-ink-muted">Retrain with the v2 pipeline to generate league-level diagnostics.</div>
        )}
      </div>
    </section>
  );
}
