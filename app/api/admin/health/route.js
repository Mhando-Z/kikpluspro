import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const expectedKey = process.env.ADMIN_SYNC_KEY;
  if (!expectedKey || request.headers.get("x-admin-key") !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient({ serviceRole: true });
  if (!supabase) {
    return NextResponse.json({ mode: "demo", jobs: [], runs: [] });
  }

  const [{ data: jobs, error: jobsError }, { data: runs, error: runsError }] =
    await Promise.all([
      supabase
        .from("sync_jobs")
        .select("id,job_key,endpoint_id,interval_seconds,is_active,next_run_at,last_success_at,last_error,consecutive_failures")
        .order("priority", { ascending: false })
        .limit(30),
      supabase
        .from("sync_runs")
        .select("id,endpoint_id,status,records_received,records_written,rate_limit_remaining,error_message,started_at,completed_at,duration_ms")
        .order("started_at", { ascending: false })
        .limit(30),
    ]);

  if (jobsError || runsError) {
    return NextResponse.json(
      { error: jobsError?.message ?? runsError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ mode: "supabase", jobs, runs });
}

