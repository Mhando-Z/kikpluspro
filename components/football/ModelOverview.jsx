"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  Trophy,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageIntro, TeamMark } from "@/components/football/FootballUI";

function percentage(value, digits = 1) {
  return Number.isFinite(Number(value))
    ? `${(Number(value) * 100).toFixed(digits)}%`
    : "—";
}

function decimal(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function MetricCard({ icon: Icon, label, value, detail, tone, index }) {
  const tones = {
    brand: "bg-brand-soft text-brand-strong",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger/10 text-danger",
    warning: "bg-warning/10 text-warning",
    neutral: "bg-surface-soft text-ink-muted",
  };
  return (
    <motion.article
      className="surface-flat p-4 sm:p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <span
        className={`flex size-10 items-center justify-center rounded-2xl ${tones[tone]}`}
      >
        <Icon className="size-4.5" />
      </span>
      <p className="mt-5 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-ink-muted">{detail}</p>
    </motion.article>
  );
}

function LoadingState() {
  return (
    <section className="surface-panel flex min-h-104 items-center justify-center p-8">
      <div className="text-center">
        <LoaderCircle className="mx-auto size-7 animate-spin text-brand-strong" />
        <p className="mt-4 text-sm font-extrabold">
          Calculating live model performance…
        </p>
      </div>
    </section>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <section className="surface-panel p-7 text-center sm:p-10">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="size-6" />
      </span>
      <h2 className="mt-5 text-xl font-black">
        Performance data is unavailable
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-muted">
        {error}
      </p>
      <button className="button-secondary mt-5" onClick={onRetry} type="button">
        <RefreshCw className="size-4" /> Try again
      </button>
    </section>
  );
}

function TrendChart({ timeline }) {
  const maximum = Math.max(1, ...timeline.map((item) => item.total));
  return (
    <section className="surface-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Prediction activity</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
            Forecasts and correct picks over time
          </h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Only settled forecasts count as correct or incorrect.
          </p>
        </div>
        <div className="flex gap-3 text-[0.66rem] font-extrabold text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-surface-strong" />{" "}
            Predictions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-brand" /> Correct
          </span>
        </div>
      </div>
      {timeline.length ? (
        <div className="mt-7 overflow-x-auto pb-2">
          <div
            className="flex min-w-136 items-end gap-3"
            style={{ height: 190 }}
          >
            {timeline.map((item) => {
              const totalHeight = Math.max(10, (item.total / maximum) * 145);
              const correctHeight = item.total
                ? (item.correct / item.total) * totalHeight
                : 0;
              return (
                <div
                  className="flex min-w-12 flex-1 flex-col items-center justify-end"
                  key={item.key}
                >
                  <p className="mb-2 text-[0.65rem] font-black tabular-nums">
                    {item.correct}
                    <span className="text-ink-muted">/{item.total}</span>
                  </p>
                  <div
                    className="relative w-full max-w-12 overflow-hidden rounded-t-xl bg-surface-strong"
                    style={{ height: totalHeight }}
                  >
                    <motion.div
                      className="absolute inset-x-0 bottom-0 bg-brand"
                      initial={{ height: 0 }}
                      animate={{ height: correctHeight }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                    />
                  </div>
                  <p className="mt-2 whitespace-nowrap text-[0.62rem] font-bold text-ink-muted">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">
          Prediction history will appear after automatic forecasts are
          generated.
        </p>
      )}
    </section>
  );
}

function LeaguePerformance({ rows }) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="border-b border-line p-5 sm:p-6">
        <p className="eyebrow">League diagnostics</p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
          Where the model performs best
        </h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          Do not assume equal reliability across competitions.
        </p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="data-table min-w-2xl">
            <thead>
              <tr>
                <th>League</th>
                <th>Predictions</th>
                <th>Settled</th>
                <th>Correct</th>
                <th>Incorrect</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <p className="font-extrabold">{row.label}</p>
                    <p className="text-[0.63rem] text-ink-muted">{row.key}</p>
                  </td>
                  <td>{row.total}</td>
                  <td>{row.settled}</td>
                  <td className="font-extrabold text-brand-strong">
                    {row.correct}
                  </td>
                  <td className="font-extrabold text-danger">
                    {row.incorrect}
                  </td>
                  <td className="font-black">{percentage(row.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-ink-muted">
          No league-level outcomes have been settled yet.
        </p>
      )}
    </section>
  );
}

function ModelFamilies({ rows }) {
  return (
    <section className="surface-panel p-5 sm:p-6">
      <p className="eyebrow">Model router</p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
        Separate scorecards by competition family
      </h2>
      <p className="mt-1 text-xs leading-5 text-ink-muted">
        Big Five, domestic expansion and Champions League predictions are
        trained, versioned, routed and evaluated independently.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((model) => (
          <article
            className="rounded-2xl border border-line bg-surface-soft/45 p-4"
            key={model.modelKey}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black">{model.family}</p>
              <span className="chip">
                <BrainCircuit className="size-3.5 text-accent" /> v
                {model.version}
              </span>
            </div>
            <p className="mt-1 text-[0.65rem] text-ink-muted">
              {model.algorithm}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-canvas-elevated p-3">
                <p className="text-[0.6rem] font-bold text-ink-muted">
                  Forecasts
                </p>
                <p className="mt-1 font-black">{model.performance.total}</p>
              </div>
              <div className="rounded-xl bg-canvas-elevated p-3">
                <p className="text-[0.6rem] font-bold text-ink-muted">
                  Settled
                </p>
                <p className="mt-1 font-black">{model.performance.settled}</p>
              </div>
              <div className="rounded-xl bg-canvas-elevated p-3">
                <p className="text-[0.6rem] font-bold text-ink-muted">
                  Accuracy
                </p>
                <p className="mt-1 font-black">
                  {percentage(model.performance.accuracy)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ConfidencePanel({ rows, streak }) {
  return (
    <section className="surface-panel p-5 sm:p-6">
      <p className="eyebrow">Confidence audit</p>
      <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
        Does confidence earn trust?
      </h2>
      <p className="mt-1 text-xs leading-5 text-ink-muted">
        High confidence is useful only when its settled accuracy supports it.
      </p>
      <div className="mt-5 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div
              className="rounded-2xl border border-line bg-surface-soft/45 p-4"
              key={row.key}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black">{row.label}</span>
                <span className="text-sm font-black tabular-nums">
                  {percentage(row.accuracy)}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-strong">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{
                    width: `${Math.max(0, Number(row.accuracy ?? 0) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[0.66rem] text-ink-muted">
                {row.correct} correct · {row.incorrect} incorrect ·{" "}
                {row.pending} pending
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-5 text-center text-xs text-ink-muted">
            No confidence groups yet.
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-canvas-elevated p-4">
        <span className="flex items-center gap-2 text-xs font-extrabold">
          <Activity className="size-4 text-brand-strong" /> Current result
          streak
        </span>
        <span
          className={`text-sm font-black ${streak.type === "correct" ? "text-brand-strong" : streak.type === "incorrect" ? "text-danger" : "text-ink-muted"}`}
        >
          {streak.count ? `${streak.count} ${streak.type}` : "Waiting"}
        </span>
      </div>
    </section>
  );
}

function RecentResults({ rows }) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex items-end justify-between gap-4 border-b border-line p-5 sm:p-6">
        <div>
          <p className="eyebrow">Latest decisions</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.035em]">
            Recent forecast results
          </h2>
        </div>
        <Link
          className="text-xs font-extrabold text-brand-strong"
          href="/predictions"
        >
          View forecasts <ArrowRight className="ml-1 inline size-3.5" />
        </Link>
      </div>
      {rows.length ? (
        <div className="divide-y divide-line">
          {rows.map((item) => (
            <div
              className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6"
              key={item.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex -space-x-2">
                  <TeamMark team={item.homeTeam} size="sm" />
                  <TeamMark team={item.awayTeam} size="sm" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">
                    {item.homeTeam.name}{" "}
                    <span className="text-ink-muted">v</span>{" "}
                    {item.awayTeam.name}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-ink-muted">
                    {item.leagueName} · Pick {item.predicted.label}{" "}
                    {percentage(item.predicted.probability)}
                  </p>
                </div>
              </div>
              <p className="text-lg font-black tabular-nums">
                {item.score.home}–{item.score.away}
              </p>
              <span
                className={`flex items-center gap-1.5 text-xs font-extrabold ${item.correct ? "text-brand-strong" : "text-danger"}`}
              >
                {item.correct ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <XCircle className="size-4" />
                )}
                {item.correct ? "Correct" : "Incorrect"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-ink-muted">
          Run the settlement command after fixtures finish to populate this
          list.
        </p>
      )}
    </section>
  );
}

export function ModelOverview() {
  const [state, setState] = useState({
    loading: true,
    data: null,
    error: null,
  });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch("/api/ai/performance", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.ready)
        throw new Error(payload.error || "Could not load model performance.");
      setState({ loading: false, data: payload, error: null });
    } catch (error) {
      setState({
        loading: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Could not load model performance.",
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/ai/performance", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ready)
          throw new Error(payload.error || "Could not load model performance.");
        if (active) setState({ loading: false, data: payload, error: null });
      })
      .catch((error) => {
        if (active)
          setState({
            loading: false,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Could not load model performance.",
          });
      });
    return () => {
      active = false;
    };
  }, []);
  const metrics = state.data?.performance;
  const testMetrics = state.data?.model?.testMetrics;
  const cards = useMemo(
    () =>
      metrics
        ? [
            [
              BrainCircuit,
              "Predictions",
              metrics.total.toLocaleString(),
              `${metrics.settled} settled · ${metrics.pending} pending`,
              "accent",
            ],
            [
              Trophy,
              "Correct picks",
              metrics.correct.toLocaleString(),
              "The highest 1X2 probability matched the result",
              "brand",
            ],
            [
              TrendingDown,
              "Incorrect picks",
              metrics.incorrect.toLocaleString(),
              "Settled forecasts where the leading pick missed",
              "danger",
            ],
            [
              Target,
              "Live accuracy",
              percentage(metrics.accuracy),
              `${metrics.settled.toLocaleString()} evaluated forecasts`,
              "warning",
            ],
            [
              Clock3,
              "Pending",
              metrics.pending.toLocaleString(),
              "Waiting for a final score and settlement",
              "neutral",
            ],
          ]
        : [],
    [metrics],
  );

  return (
    <div className="space-y-7">
      <PageIntro
        eyebrow="AI performance command center"
        title="Measure the model, not the marketing."
        description="Track every automatic forecast from prediction through final result, compare reliability by league and inspect whether confidence levels deserve trust."
        actions={
          <>
            <button
              className="button-secondary"
              onClick={load}
              disabled={state.loading}
              type="button"
            >
              <RefreshCw
                className={`size-4 ${state.loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </button>
            <Link className="button-primary" href="/predictions">
              Open forecasts <ArrowRight className="size-4" />
            </Link>
          </>
        }
      />
      {state.loading && !state.data ? (
        <LoadingState />
      ) : state.error ? (
        <ErrorState error={state.error} onRetry={load} />
      ) : metrics ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map(([Icon, label, value, detail, tone], index) => (
              <MetricCard
                icon={Icon}
                label={label}
                value={value}
                detail={detail}
                tone={tone}
                index={index}
                key={label}
              />
            ))}
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <TrendChart timeline={metrics.timeline} />
            <ConfidencePanel
              rows={metrics.byConfidence}
              streak={metrics.currentStreak}
            />
          </section>
          <ModelFamilies rows={state.data.modelFamilies ?? []} />
          <LeaguePerformance rows={metrics.byLeague} />
          <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <RecentResults rows={state.data.recent} />
            <div className="surface-panel p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
                  <ShieldCheck className="size-5" />
                </span>
                <span className="chip">
                  <Sparkles className="size-3.5 text-accent" />{" "}
                  {state.data.model.shortFamily} v{state.data.model.version}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-black tracking-[-0.035em]">
                Big Five held-out quality
              </h2>
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                These are training-time test results. Each model family has its
                own independent scorecard above.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface-soft p-4">
                  <p className="text-[0.64rem] font-extrabold uppercase tracking-wider text-ink-muted">
                    Accuracy
                  </p>
                  <p className="mt-2 text-xl font-black">
                    {percentage(testMetrics?.accuracy)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-soft p-4">
                  <p className="text-[0.64rem] font-extrabold uppercase tracking-wider text-ink-muted">
                    Log loss
                  </p>
                  <p className="mt-2 text-xl font-black">
                    {decimal(testMetrics?.logLoss)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-soft p-4">
                  <p className="text-[0.64rem] font-extrabold uppercase tracking-wider text-ink-muted">
                    Brier
                  </p>
                  <p className="mt-2 text-xl font-black">
                    {decimal(testMetrics?.brierScore)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-soft p-4">
                  <p className="text-[0.64rem] font-extrabold uppercase tracking-wider text-ink-muted">
                    Test matches
                  </p>
                  <p className="mt-2 text-xl font-black">
                    {Number(state.data.model.testRows ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <Link className="button-secondary mt-5 w-full" href="/simulator">
                <Gauge className="size-4" /> Open model simulator
              </Link>
            </div>
          </section>
          <section className="surface-flat flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-black">
                <BarChart3 className="size-4 text-brand-strong" /> Keep the
                scorecard honest
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                After match results are published, run{" "}
                <code className="font-bold text-brand-strong">
                  npm run ai:fixtures:update
                </code>{" "}
                to settle old forecasts and generate the next round.
              </p>
            </div>
            <Link className="button-secondary shrink-0" href="/tracker">
              Open bet tracker <ArrowRight className="size-4" />
            </Link>
          </section>
        </>
      ) : null}
    </div>
  );
}
