"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageIntro, TeamMark } from "@/components/football/FootballUI";
import { settleTrackedBets, summarizeTrackedBets } from "@/lib/bets/tracker";
import {
  listTrackedBets,
  removeTrackedBet,
  saveTrackedBets,
} from "@/lib/client/bet-store";

const FILTERS = ["all", "pending", "won", "lost", "void"];
const OUTCOMES = { H: "Home win", D: "Draw", A: "Away win" };

function money(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function percentage(value) {
  return Number.isFinite(Number(value))
    ? `${(Number(value) * 100).toFixed(1)}%`
    : "—";
}

function dateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusStyle(status) {
  if (status === "won") return "bg-brand-soft text-brand-strong";
  if (status === "lost") return "bg-danger/10 text-danger";
  if (status === "void") return "bg-warning/10 text-warning";
  return "bg-surface-soft text-ink-muted";
}

function TrackerMetric({ icon: Icon, label, value, detail, tone }) {
  return (
    <article className="surface-flat p-4 sm:p-5">
      <span
        className={`flex size-10 items-center justify-center rounded-2xl ${tone}`}
      >
        <Icon className="size-4.5" />
      </span>
      <p className="mt-4 text-[0.64rem] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </article>
  );
}

function BetCard({ bet, onDelete }) {
  const profit =
    bet.status === "won"
      ? Number(bet.returnAmount || Number(bet.stake) * Number(bet.odds)) -
        Number(bet.stake)
      : bet.status === "lost"
        ? -Number(bet.stake)
        : 0;
  return (
    <article className="surface-flat overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:p-5">
        <div>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-wider ${statusStyle(bet.status)}`}
          >
            {bet.status}
          </span>
          <span className="ml-2 text-[0.67rem] font-bold text-ink-muted">
            {bet.leagueName}
          </span>
        </div>
        <button
          aria-label="Delete tracked bet"
          className="icon-button !min-h-9 !min-w-9"
          onClick={() => onDelete(bet)}
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div className="min-w-0">
            <span className="mx-auto block w-fit">
              <TeamMark team={bet.homeTeam} size="lg" />
            </span>
            <p className="mt-2 truncate text-sm font-black">
              {bet.homeTeam.name}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] font-extrabold uppercase tracking-wider text-ink-muted">
              {bet.score ? "Final" : "Kickoff"}
            </p>
            <p className="mt-1 text-lg font-black tabular-nums">
              {bet.score
                ? `${bet.score.home}–${bet.score.away}`
                : dateTime(bet.kickoffAt).split(",").at(-1)}
            </p>
          </div>
          <div className="min-w-0">
            <span className="mx-auto block w-fit">
              <TeamMark team={bet.awayTeam} size="lg" />
            </span>
            <p className="mt-2 truncate text-sm font-black">
              {bet.awayTeam.name}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-surface-soft p-3">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-wider text-ink-muted">
              Selection
            </p>
            <p className="mt-1 text-xs font-black">{OUTCOMES[bet.selection]}</p>
          </div>
          <div className="rounded-xl bg-surface-soft p-3">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-wider text-ink-muted">
              Stake
            </p>
            <p className="mt-1 text-xs font-black">{money(bet.stake)}</p>
          </div>
          <div className="rounded-xl bg-surface-soft p-3">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-wider text-ink-muted">
              Odds
            </p>
            <p className="mt-1 text-xs font-black">
              {Number(bet.odds).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl bg-surface-soft p-3">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-wider text-ink-muted">
              P/L
            </p>
            <p
              className={`mt-1 text-xs font-black ${profit > 0 ? "text-brand-strong" : profit < 0 ? "text-danger" : "text-ink"}`}
            >
              {bet.status === "pending" ? "Pending" : money(profit)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.67rem] text-ink-muted">
          <span>
            Model pick:{" "}
            <strong className="text-ink">
              {OUTCOMES[bet.modelPick?.code]} ·{" "}
              {percentage(bet.modelPick?.probability)}
            </strong>
          </span>
          <span>{dateTime(bet.kickoffAt)}</span>
        </div>
        {bet.note ? (
          <p className="mt-3 rounded-xl border border-line px-3 py-2.5 text-xs leading-5 text-ink-muted">
            {bet.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function BetTracker() {
  const [state, setState] = useState({
    loading: true,
    syncing: false,
    error: null,
    bets: [],
  });
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const bets = await listTrackedBets();
      setState({ loading: false, syncing: false, error: null, bets });
    } catch (error) {
      setState({
        loading: false,
        syncing: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not open the local tracker.",
        bets: [],
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncResults = async () => {
    if (!state.bets.length) return;
    setState((current) => ({ ...current, syncing: true, error: null }));
    try {
      const response = await fetch("/api/ai/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fixtureIds: state.bets.map((bet) => bet.fixtureId),
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Could not synchronize results.");
      const bets = settleTrackedBets(state.bets, payload.results);
      await saveTrackedBets(bets);
      setState({ loading: false, syncing: false, error: null, bets });
      toast.success("Tracked match results updated");
    } catch (error) {
      setState((current) => ({
        ...current,
        syncing: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not synchronize results.",
      }));
    }
  };

  // const deleteBet = async (bet) => {
  //   if (
  //     !window.confirm(
  //       `Remove ${bet.homeTeam.name} vs ${bet.awayTeam.name} from this device?`,
  //     )
  //   )
  //     return;
  //   await removeTrackedBet(bet.id);
  //   setState((current) => ({
  //     ...current,
  //     bets: current.bets.filter((item) => item.id !== bet.id),
  //   }));
  //   toast.success("Tracked bet removed");
  // };

  const deleteBet = async (bet) => {
    toast(
      `Remove ${bet.homeTeam.name} vs ${bet.awayTeam.name} from this device?`,
      {
        action: {
          label: "Delete",
          onClick: async () => {
            try {
              await removeTrackedBet(bet.id);
              setState((current) => ({
                ...current,
                bets: current.bets.filter((item) => item.id !== bet.id),
              }));
              toast.success("Tracked bet removed");
            } catch (err) {
              toast.error("Couldn't remove bet — please try again");
            }
          },
        },
        cancel: {
          label: "Cancel",
          onClick: () => {},
        },
        duration: 6000,
      },
    );
  };

  const exportBets = () => {
    const blob = new Blob([JSON.stringify(state.bets, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kickpulse-bets-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => summarizeTrackedBets(state.bets), [state.bets]);
  const visible = useMemo(
    () =>
      filter === "all"
        ? state.bets
        : state.bets.filter((bet) => bet.status === filter),
    [filter, state.bets],
  );

  return (
    <div className="space-y-7">
      <PageIntro
        eyebrow="Private bet journal"
        title="Track decisions, not just outcomes."
        description="Save the match predictions you acted on, reconcile them against final results and measure your own return. Records stay in IndexedDB on this browser."
        actions={
          <>
            <button
              className="button-secondary"
              disabled={!state.bets.length}
              onClick={exportBets}
              type="button"
            >
              <Download className="size-4" /> Export
            </button>
            <button
              className="button-primary"
              disabled={!state.bets.length || state.syncing}
              onClick={syncResults}
              type="button"
            >
              {state.syncing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}{" "}
              Check results
            </button>
          </>
        }
      />
      <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft p-4 text-xs leading-5 text-ink-muted">
        <HardDrive className="mt-0.5 size-4 shrink-0 text-accent" />
        <p>
          <strong className="text-ink">Stored only on this device.</strong>{" "}
          Clearing browser storage, switching browsers or using another computer
          will not carry these records across. Export periodically if you need a
          backup.
        </p>
      </div>
      {state.loading ? (
        <section className="surface-panel flex min-h-64 items-center justify-center">
          <LoaderCircle className="size-7 animate-spin text-brand-strong" />
        </section>
      ) : state.error && !state.bets.length ? (
        <section className="surface-panel p-8 text-center">
          <AlertTriangle className="mx-auto size-6 text-danger" />
          <h2 className="mt-4 text-lg font-black">Tracker unavailable</h2>
          <p className="mt-2 text-sm text-ink-muted">{state.error}</p>
        </section>
      ) : (
        <>
          {state.error ? (
            <p className="flex items-center gap-2 rounded-2xl bg-danger/10 p-3 text-xs font-bold text-danger">
              <AlertTriangle className="size-4" />
              {state.error}
            </p>
          ) : null}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <TrackerMetric
              icon={WalletCards}
              label="Tracked"
              value={summary.total}
              detail={`${summary.pending} pending`}
              tone="bg-accent-soft text-accent"
            />
            <TrackerMetric
              icon={CheckCircle2}
              label="Won"
              value={summary.won}
              detail={`${percentage(summary.hitRate)} hit rate`}
              tone="bg-brand-soft text-brand-strong"
            />
            <TrackerMetric
              icon={XCircle}
              label="Lost"
              value={summary.lost}
              detail={`${summary.voided} void`}
              tone="bg-danger/10 text-danger"
            />
            <TrackerMetric
              icon={summary.profit >= 0 ? TrendingUp : TrendingDown}
              label="Profit / loss"
              value={money(summary.profit)}
              detail={`${percentage(summary.roi)} ROI on settled stake`}
              tone={
                summary.profit >= 0
                  ? "bg-brand-soft text-brand-strong"
                  : "bg-danger/10 text-danger"
              }
            />
            <TrackerMetric
              icon={Target}
              label="Total staked"
              value={money(summary.totalStake)}
              detail={`${money(summary.pendingStake)} still pending`}
              tone="bg-warning/10 text-warning"
            />
          </section>
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Tracked matches</h2>
                <p className="mt-1 text-xs text-ink-muted">
                  One saved 1X2 selection per fixture.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((item) => (
                  <button
                    className={`rounded-full px-3 py-1.5 text-xs font-extrabold capitalize transition ${filter === item ? "bg-brand text-[#04100c]" : "bg-surface-soft text-ink-muted hover:text-ink"}`}
                    key={item}
                    onClick={() => setFilter(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            {visible.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {visible.map((bet) => (
                  <BetCard bet={bet} onDelete={deleteBet} key={bet.id} />
                ))}
              </div>
            ) : (
              <div className="surface-flat p-8 text-center">
                <Clock3 className="mx-auto size-6 text-ink-muted" />
                <h3 className="mt-4 text-lg font-black">
                  {state.bets.length
                    ? `No ${filter} records`
                    : "No predictions tracked yet"}
                </h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">
                  Open an automatic forecast, inspect the full report and use
                  “Track this bet” to add your selection.
                </p>
                <Link className="button-primary mt-5" href="/predictions">
                  Browse forecasts
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
