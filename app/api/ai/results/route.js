import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  try {
    const body = await request.json();
    const fixtureIds = [...new Set((body.fixtureIds ?? []).filter((id) => UUID.test(String(id))))].slice(0, 100);
    if (!fixtureIds.length) return NextResponse.json({ results: [] });
    const supabase = createServerSupabaseClient({ serviceRole: true });
    if (!supabase) return NextResponse.json({ error: "Supabase server credentials are not configured." }, { status: 503 });
    const { data, error } = await supabase
      .from("ai_fixtures")
      .select("id,status,result,home_goals,away_goals,updated_at")
      .in("id", fixtureIds);
    if (error) throw error;
    return NextResponse.json({
      results: (data ?? []).map((fixture) => ({
        id: fixture.id,
        status: fixture.status,
        result: fixture.result,
        score: fixture.home_goals === null || fixture.away_goals === null ? null : { home: fixture.home_goals, away: fixture.away_goals },
        settledAt: fixture.result ? fixture.updated_at : null,
      })),
    }, { headers: { "cache-control": "private, max-age=0, must-revalidate" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check fixture results." }, { status: 400 });
  }
}
