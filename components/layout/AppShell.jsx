"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Moon,
  Settings2,
  Sparkles,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import { FaFutbol } from "react-icons/fa6";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";

const navigation = [
  { href: "/", label: "AI overview", icon: LayoutDashboard },
  { href: "/predictions", label: "Forecasts", icon: Sparkles },
  { href: "/simulator", label: "Simulator", icon: FlaskConical },
  { href: "/tracker", label: "Bet tracker", icon: WalletCards },
  { href: "/admin", label: "Data control", icon: Settings2 },
];

const legacyDataRoutes = [
  "/live",
  "/fixtures",
  "/standings",
  "/teams",
  "/players",
  "/insights",
  "/odds",
  "/explorer",
];

const leagueOptions = [
  { id: "39", label: "Premier League" },
  { id: "140", label: "La Liga" },
  { id: "135", label: "Serie A" },
  { id: "78", label: "Bundesliga" },
  { id: "61", label: "Ligue 1" },
  { id: "2", label: "Champions League" },
];

function NavItems({ onNavigate }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary navigation" className="space-y-1.5">
      {navigation.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            className={`group flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-bold transition ${
              active
                ? "bg-brand text-[#04100c] shadow-[0_10px_30px_rgba(49,223,164,0.18)]"
                : "text-ink-muted hover:bg-surface-soft hover:text-ink"
            }`}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <Icon
              className="size-[1.15rem] shrink-0"
              strokeWidth={active ? 2.4 : 1.9}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      className="flex items-center gap-3"
      href="/"
      aria-label="KickPulse home"
    >
      <span className="relative flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-brand text-[#04100c] shadow-[0_12px_34px_rgba(49,223,164,0.24)]">
        <FaFutbol className="size-5" />
        <span className="absolute -bottom-3 -right-3 size-7 rounded-full border border-[#04100c]/15" />
      </span>
      <span>
        <span className="block text-base font-black tracking-[-0.03em]">
          KickPulse
        </span>
        <span className="block text-[0.66rem] font-bold uppercase tracking-[0.15em] text-ink-muted">
          AI match analytics
        </span>
      </span>
    </Link>
  );
}

function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] border-r border-line bg-canvas/92 p-5 backdrop-blur-2xl lg:flex lg:flex-col">
      <Brand />
      <div className="mt-9 flex-1 overflow-y-auto pr-1">
        <p className="mb-3 px-3 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-muted">
          Workspace
        </p>
        <NavItems />
      </div>
      <div className="surface-flat mt-5 p-4">
        <div className="flex items-center gap-2 text-xs font-extrabold">
          <span className="size-2 rounded-full bg-brand" /> AI pipeline ready
        </div>
        <p className="mt-2 text-[0.7rem] leading-5 text-ink-muted">
          Forecasts, outcomes and model quality in one measured workflow.
        </p>
      </div>
    </aside>
  );
}

function MobileSidebar({ open, onClose }) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            aria-label="Close navigation"
            className="fixed inset-0 z-50 bg-[#020806]/70 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />
          <motion.aside
            aria-label="Mobile navigation"
            className="fixed inset-y-0 left-0 z-[60] w-[min(88vw,20rem)] border-r border-line bg-canvas p-5 lg:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button
                className="icon-button"
                onClick={onClose}
                type="button"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-8">
              <NavItems onNavigate={onClose} />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  return (
    <button
      aria-label={isDark ? "Use light theme" : "Use dark theme"}
      className="icon-button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      type="button"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function LeagueFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const league =
    searchParams.get("league") ??
    process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID ??
    "39";
  const season =
    searchParams.get("season") ??
    process.env.NEXT_PUBLIC_DEFAULT_SEASON ??
    "2024";

  const update = (key, value) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <label className="relative">
        <span className="sr-only">Competition</span>
        <select
          className="h-11 appearance-none rounded-[0.9rem] border border-line bg-canvas-elevated py-2 pl-3 pr-9 text-xs font-extrabold text-ink"
          onChange={(event) => update("league", event.target.value)}
          value={league}
        >
          {leagueOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
      </label>
      <label>
        <span className="sr-only">Season</span>
        <select
          className="h-11 rounded-[0.9rem] border border-line bg-canvas-elevated px-3 text-xs font-extrabold text-ink"
          onChange={(event) => update("season", event.target.value)}
          value={season}
        >
          {[2024, 2023, 2022].map((year) => (
            <option key={year} value={year}>
              {year}/{String(year + 1).slice(-2)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Topbar({ onMenu }) {
  const pathname = usePathname();
  const current = navigation.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
  const legacyRoute = legacyDataRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const contextLabel =
    pathname === "/"
      ? "Live model performance"
      : pathname.startsWith("/predictions")
        ? "Automatic fixture forecasts"
        : pathname.startsWith("/simulator")
          ? "Manual probability laboratory"
          : pathname.startsWith("/tracker")
            ? "Private browser storage"
            : "AI operations";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/82 px-4 py-3 backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-400 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="md:hidden">
            <button
              className="icon-button"
              onClick={onMenu}
              type="button"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold sm:text-base">
              {current?.label ?? "KickPulse"}
            </p>
            <p className="hidden text-[0.68rem] font-semibold text-ink-muted sm:block">
              {contextLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {legacyRoute ? (
            <LeagueFilter />
          ) : (
            <span className="chip hidden sm:inline-flex">
              <Sparkles className="size-3.5 text-accent" /> Measured AI
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const routeKey = useMemo(() => pathname, [pathname]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <DesktopSidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-70">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            className="mx-auto min-h-[calc(100vh-4.25rem)] max-w-400 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8"
            key={routeKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
