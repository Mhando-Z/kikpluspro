"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { EmptyState, MatchCard } from "@/components/football/FootballUI";

const liveStatuses = new Set(["1H", "HT", "2H", "ET", "P", "BT", "LIVE"]);

export function RealtimeLiveGrid({ initialMatches = [] }) {
  const [matches, setMatches] = useState(initialMatches);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return undefined;

    const channel = supabase
      .channel("kickpulse-live-fixtures")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fixtures" },
        (change) => {
          const row = change.new;
          if (!row?.payload) return;
          setMatches((current) => {
            const remaining = current.filter((item) => item.fixture?.id !== row.api_id);
            if (!liveStatuses.has(row.status_short)) return remaining;
            return [row.payload, ...remaining].sort(
              (left, right) => new Date(left.fixture.date) - new Date(right.fixture.date),
            );
          });
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <span className="chip">
          {connected ? <Wifi className="size-3 text-brand-strong" /> : <WifiOff className="size-3" />}
          {connected ? "Realtime connected" : "Cached feed"}
        </span>
      </div>
      {matches.length ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {matches.map((match, index) => <MatchCard index={index} key={match.fixture?.id} match={match} />)}
        </div>
      ) : (
        <EmptyState title="No matches are live" description="The scheduler will resume fast polling automatically when a tracked fixture starts." />
      )}
    </div>
  );
}

