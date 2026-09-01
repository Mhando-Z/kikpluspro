"use client";

import { motion } from "framer-motion";
import { ExternalLink, LoaderCircle, Radio, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { buildLiveScoreWidgetUrl, LIVE_SCORE_VIEWS } from "@/lib/live-scores/widget";

export function LiveScoreWidget() {
  const { resolvedTheme } = useTheme();
  const [view, setView] = useState("all");
  const [loadedSrc, setLoadedSrc] = useState(null);
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const src = useMemo(() => buildLiveScoreWidgetUrl({ view, theme }), [theme, view]);
  const loaded = loadedSrc === src;

  return (
    <section className="surface-panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black">
            <span className="live-dot" /> Live football scores
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-muted">Choose a view; the provider refreshes the embedded scoreboard.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" role="tablist" aria-label="Scoreboard view">
          {Object.entries(LIVE_SCORE_VIEWS).map(([key, item]) => {
            const active = view === key;
            return (
              <button
                aria-selected={active}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-extrabold transition ${
                  active ? "bg-brand text-[#04100c]" : "bg-surface-soft text-ink-muted hover:text-ink"
                }`}
                key={key}
                onClick={() => setView(key)}
                role="tab"
                type="button"
              >
                {key === "live" ? <Radio className="mr-1.5 inline size-3.5" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[42rem] bg-canvas-elevated">
        {!loaded ? (
          <div className="absolute inset-x-0 top-0 z-10 flex h-20 items-center justify-center gap-2 bg-canvas-elevated text-xs font-bold text-ink-muted">
            <LoaderCircle className="size-4 animate-spin text-brand-strong" /> Loading live scores…
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <motion.iframe
            animate={{ opacity: loaded ? 1 : 0.45 }}
            className="block h-[72vh] min-h-[42rem] w-full min-w-[650px] bg-canvas-elevated"
            key={src}
            loading="eager"
            onLoad={() => setLoadedSrc(src)}
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            src={src}
            title={`${LIVE_SCORE_VIEWS[view].label} football scores from LiveXscores`}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      <div className="grid gap-3 border-t border-line p-4 text-xs sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
        <p className="flex items-start gap-2 leading-5 text-ink-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" />
          Display feed by LiveXscores. KickPulse keeps pre-match probabilities immutable and settles them only from completed Football-Data results.
        </p>
        <a
          className="button-secondary"
          href="https://livescore.football-data.co.uk/"
          rel="noreferrer"
          target="_blank"
        >
          Open source site <ExternalLink className="size-3.5" />
        </a>
      </div>
    </section>
  );
}
