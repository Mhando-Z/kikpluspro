"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock3,
  Goal,
  HeartPulse,
  MapPin,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { apiFootballTeamLogo } from "@/lib/api-football/team-assets";

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "P", "BT", "LIVE"]);

export function PageIntro({ eyebrow, title, description, actions, compact = false }) {
  return (
    <section className={`surface-panel relative overflow-hidden ${compact ? "p-5 sm:p-6" : "p-6 sm:p-8"}`}>
      <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-10 h-px w-64 bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
      <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className={`${compact ? "mt-2 text-2xl sm:text-3xl" : "mt-3 text-3xl sm:text-4xl lg:text-[2.7rem]"} font-black leading-tight tracking-[-0.045em]`}>
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted sm:text-[0.95rem]">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function SectionHeading({ title, description, href, linkLabel = "View all" }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-black tracking-[-0.025em] sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-ink-muted sm:text-sm">{description}</p> : null}
      </div>
      {href ? (
        <Link className="flex shrink-0 items-center gap-1 text-xs font-extrabold text-brand-strong hover:underline" href={href}>
          {linkLabel} <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

export function DataSourceBadge({ meta }) {
  const demo = meta?.source === "demo";
  return (
    <span className="chip">
      <span className={`size-1.5 rounded-full ${demo ? "bg-warning" : meta?.isStale ? "bg-danger" : "bg-brand"}`} />
      {demo ? "Demo data" : meta?.isStale ? "Cached · stale" : "Supabase · fresh"}
    </span>
  );
}

export function TeamMark({ team, size = "md" }) {
  const logo = team?.logo
    ?? team?.logo_url
    ?? team?.logoUrl
    ?? apiFootballTeamLogo(team?.apiFootballId ?? team?.id);
  const [failedLogo, setFailedLogo] = useState(null);
  const initials = useMemo(() =>
    (team?.name ?? "FC")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(), [team?.name]);
  const sizeClass = size === "lg" ? "size-12 text-sm" : size === "sm" ? "size-7 text-[0.62rem]" : "size-9 text-xs";

  return (
    <span className={`relative flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand/15 bg-brand-soft font-black text-brand-strong`}>
      {logo && failedLogo !== logo ? (
        <Image
          alt={`${team?.name ?? "Football team"} crest`}
          className="size-[78%] object-contain"
          height={72}
          onError={() => setFailedLogo(logo)}
          sizes={size === "lg" ? "48px" : size === "sm" ? "28px" : "36px"}
          src={logo}
          width={72}
        />
      ) : initials}
    </span>
  );
}

const metricIconMap = { Activity, CalendarClock, Goal, Shield, Trophy, UsersRound };

export function MetricCard({ label, value, detail, iconName = "Activity", tone = "brand", index = 0 }) {
  const Icon = metricIconMap[iconName] ?? Activity;
  const tones = {
    brand: "bg-brand-soft text-brand-strong",
    accent: "bg-accent-soft text-accent",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
  };
  return (
    <motion.article
      className="surface-flat p-4 sm:p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex size-10 items-center justify-center rounded-2xl ${tones[tone]}`}>
          <Icon className="size-4.5" />
        </span>
        <TrendingUp className="size-4 text-ink-muted/60" />
      </div>
      <p className="mt-5 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </motion.article>
  );
}

function formatTime(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function matchLabel(status) {
  if (liveStatuses.has(status?.short)) return `${status.elapsed ?? ""}${status.elapsed ? "′" : status.short}`;
  if (status?.short === "FT") return "Full time";
  if (status?.short === "PST") return "Postponed";
  return "Upcoming";
}

export function MatchCard({ match, compact = false, index = 0 }) {
  const [saved, setSaved] = useState(false);
  const live = liveStatuses.has(match.fixture?.status?.short);
  const started = live || match.fixture?.status?.short === "FT";
  return (
    <motion.article
      className={`surface-flat relative overflow-hidden ${compact ? "p-4" : "p-5"}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, duration: 0.25 }}
      whileHover={{ y: -2 }}
    >
      {live ? <span className="absolute inset-x-0 top-0 h-0.5 bg-danger" /> : null}
      <div className="flex items-center justify-between gap-3">
        <span className={`chip ${live ? "text-danger" : ""}`}>
          {live ? <span className="live-dot" /> : <Clock3 className="size-3" />}
          {matchLabel(match.fixture?.status)}
        </span>
        <button
          aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
          aria-pressed={saved}
          className={`flex size-9 items-center justify-center rounded-xl transition ${saved ? "bg-warning/10 text-warning" : "text-ink-muted hover:bg-surface-soft hover:text-ink"}`}
          onClick={() => setSaved((current) => !current)}
          type="button"
        >
          <Star className="size-4" fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0 text-center">
          <TeamMark team={match.teams?.home} size={compact ? "md" : "lg"} />
          <p className="mt-2 truncate text-xs font-extrabold sm:text-sm">{match.teams?.home?.name}</p>
        </div>
        <div className="min-w-16 text-center">
          {started ? (
            <p className="text-2xl font-black tracking-[-0.06em] sm:text-3xl">
              {match.goals?.home ?? 0}<span className="mx-2 text-ink-muted/50">:</span>{match.goals?.away ?? 0}
            </p>
          ) : (
            <>
              <p className="text-lg font-black">{formatTime(match.fixture?.date)}</p>
              <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-wider text-ink-muted">Kickoff</p>
            </>
          )}
        </div>
        <div className="min-w-0 text-center">
          <span className="ml-auto block w-fit"><TeamMark team={match.teams?.away} size={compact ? "md" : "lg"} /></span>
          <p className="mt-2 truncate text-xs font-extrabold sm:text-sm">{match.teams?.away?.name}</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-[0.66rem] font-semibold text-ink-muted">
        <span className="truncate">{match.league?.name}</span>
        <span className="ml-3 flex shrink-0 items-center gap-1"><MapPin className="size-3" /> {match.fixture?.venue?.city ?? "Venue TBC"}</span>
      </div>
    </motion.article>
  );
}

export function StandingsTable({ rows = [], limit, highlightTop = 4 }) {
  const displayed = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[42rem]">
        <thead><tr><th className="w-12">#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Form</th><th className="text-right">Pts</th></tr></thead>
        <tbody>
          {displayed.map((row) => (
            <tr key={`${row.rank}-${row.team?.id}`}>
              <td><span className={`inline-flex size-7 items-center justify-center rounded-lg text-xs font-black ${row.rank <= highlightTop ? "bg-brand-soft text-brand-strong" : "bg-surface-soft text-ink-muted"}`}>{row.rank}</span></td>
              <td><div className="flex items-center gap-2.5"><TeamMark team={row.team} size="sm" /><span className="font-extrabold">{row.team?.name}</span></div></td>
              <td>{row.all?.played ?? 0}</td><td>{row.all?.win ?? 0}</td><td>{row.all?.draw ?? 0}</td><td>{row.all?.lose ?? 0}</td>
              <td className={row.goalsDiff >= 0 ? "text-brand-strong" : "text-danger"}>{row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}</td>
              <td><FormStrip form={row.form} /></td>
              <td className="text-right text-base font-black">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FormStrip({ form = "" }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Recent form ${form}`}>
      {String(form).slice(-5).split("").map((result, index) => (
        <span
          className={`flex size-5 items-center justify-center rounded-md text-[0.55rem] font-black ${result === "W" ? "bg-brand-soft text-brand-strong" : result === "L" ? "bg-danger/10 text-danger" : "bg-surface-soft text-ink-muted"}`}
          key={`${result}-${index}`}
        >{result}</span>
      ))}
    </span>
  );
}

export function Leaderboard({ players = [], metric = "assists", limit = 6 }) {
  return (
    <div className="space-y-2">
      {players.slice(0, limit).map((entry, index) => {
        const statistics = entry.statistics?.[0] ?? {};
        const value = metric === "goals" ? statistics.goals?.total : statistics.goals?.assists;
        return (
          <motion.div
            className="flex items-center gap-3 rounded-2xl border border-transparent p-2.5 transition hover:border-line hover:bg-surface-soft"
            key={entry.player?.id ?? index}
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.035 }}
          >
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${index < 3 ? "bg-accent-soft text-accent" : "bg-surface-soft text-ink-muted"}`}>{index + 1}</span>
            <TeamMark team={statistics.team} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{entry.player?.name}</p>
              <p className="truncate text-[0.68rem] text-ink-muted">{statistics.team?.name} · {statistics.games?.appearences ?? 0} apps</p>
            </div>
            <div className="text-right"><p className="text-lg font-black">{value ?? 0}</p><p className="text-[0.58rem] font-bold uppercase tracking-wider text-ink-muted">{metric}</p></div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function InjuryList({ items = [], limit = 6 }) {
  return (
    <div className="space-y-2">
      {items.slice(0, limit).map((entry, index) => (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-soft p-3" key={`${entry.player?.id}-${index}`}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger"><HeartPulse className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{entry.player?.name}</p><p className="truncate text-[0.68rem] text-ink-muted">{entry.team?.name} · {entry.player?.reason}</p></div>
          <span className="chip shrink-0">{entry.player?.type}</span>
        </div>
      ))}
    </div>
  );
}

export function TeamGrid({ teams = [] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map((entry, index) => (
        <motion.article className="surface-flat group p-4" key={entry.team?.id ?? index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.025 }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3"><TeamMark team={entry.team} size="lg" /><div><h3 className="font-black">{entry.team?.name}</h3><p className="mt-0.5 text-xs text-ink-muted">{entry.team?.country} · Est. {entry.team?.founded ?? "—"}</p></div></div>
            <ChevronRight className="size-4 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-brand-strong" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs"><p><span className="block text-ink-muted">Stadium</span><span className="mt-1 block truncate font-bold">{entry.venue?.name ?? "Unknown"}</span></p><p><span className="block text-ink-muted">Capacity</span><span className="mt-1 block font-bold">{entry.venue?.capacity?.toLocaleString() ?? "—"}</span></p></div>
        </motion.article>
      ))}
    </div>
  );
}

export function PredictionPanel({ item }) {
  const prediction = item?.predictions;
  const percentages = [
    { label: "Home", value: prediction?.percent?.home ?? "0%", tone: "bg-brand" },
    { label: "Draw", value: prediction?.percent?.draw ?? "0%", tone: "bg-accent" },
    { label: "Away", value: prediction?.percent?.away ?? "0%", tone: "bg-warning" },
  ];
  return (
    <div className="surface-panel overflow-hidden">
      <div className="score-grid border-b border-line p-6 sm:p-8">
        <span className="chip text-accent"><Sparkles className="size-3" /> Model prediction</span>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div><TeamMark team={item?.teams?.home} size="lg" /><p className="mt-2 text-sm font-black">{item?.teams?.home?.name}</p></div>
          <div><p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-ink-muted">Expected</p><p className="mt-1 text-4xl font-black tracking-[-0.08em]">{prediction?.goals?.home ?? "–"}<span className="mx-2 text-ink-muted/40">:</span>{prediction?.goals?.away ?? "–"}</p></div>
          <div><span className="ml-auto block w-fit"><TeamMark team={item?.teams?.away} size="lg" /></span><p className="mt-2 text-sm font-black">{item?.teams?.away?.name}</p></div>
        </div>
      </div>
      <div className="p-6 sm:p-8">
        <p className="text-sm font-extrabold">{prediction?.advice ?? "Prediction unavailable"}</p>
        <div className="mt-5 space-y-3">
          {percentages.map((entry) => <div key={entry.label}><div className="mb-1.5 flex justify-between text-xs"><span className="font-bold text-ink-muted">{entry.label}</span><span className="font-black">{entry.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-soft"><motion.div className={`h-full rounded-full ${entry.tone}`} initial={{ width: 0 }} animate={{ width: entry.value }} transition={{ duration: 0.6 }} /></div></div>)}
        </div>
      </div>
    </div>
  );
}

export function OddsBoard({ items = [] }) {
  const values = items[0]?.bookmakers?.[0]?.bets?.[0]?.values ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {values.map((value, index) => (
        <motion.div className="surface-flat p-5 text-center" key={value.value} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }}>
          <p className="text-xs font-bold text-ink-muted">{value.value}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">{value.odd}</p>
          <p className="mt-2 text-[0.62rem] font-extrabold uppercase tracking-widest text-brand-strong">Best price</p>
        </motion.div>
      ))}
    </div>
  );
}

export function EmptyState({ title = "No synchronized data yet", description = "Run the relevant sync job, then refresh this page." }) {
  return (
    <div className="rounded-3xl border border-dashed border-line p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-surface-soft text-ink-muted"><CircleAlert className="size-5" /></span>
      <p className="mt-4 font-black">{title}</p><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-ink-muted">{description}</p>
    </div>
  );
}
