"use client";

import { Activity, DatabaseZap, ImageDown, KeyRound, LoaderCircle, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { API_FOOTBALL_ENDPOINTS } from "@/lib/api-football/endpoints";

const teamLogoJobs = [
  ["39", "2024"],
  ["140", "2024"],
  ["135", "2024"],
  ["78", "2024"],
  ["61", "2024"],
].map(([league, season]) => ({ endpoint: "teams", params: { league, season }, force: true }));

export function SyncConsole() {
  const [adminKey, setAdminKey] = useState("");
  const [endpointId, setEndpointId] = useState("fixtures");
  const selected = API_FOOTBALL_ENDPOINTS.find((item) => item.id === endpointId);
  const [params, setParams] = useState(selected.sample ?? {});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState(null);

  const changeEndpoint = (id) => {
    const next = API_FOOTBALL_ENDPOINTS.find((item) => item.id === id);
    setEndpointId(id);
    setParams(next?.sample ?? {});
    setResult(null);
  };

  const request = async (body) => {
    if (!adminKey) return toast.error("Enter the ADMIN_SYNC_KEY from your server environment.");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/sync", { method: "POST", headers: { "content-type": "application/json", "x-admin-key": adminKey }, body: JSON.stringify(body) });
      const payload = await response.json();
      setResult(payload);
      response.ok ? toast.success("Synchronization request completed") : toast.error(payload.error ?? "Sync failed");
    } catch (error) {
      setResult({ error: error.message });
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadHealth = async () => {
    if (!adminKey) return toast.error("Enter your admin key first.");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/health", { headers: { "x-admin-key": adminKey } });
      const payload = await response.json();
      setHealth(payload);
      if (!response.ok) toast.error(payload.error ?? "Unable to load health");
    } finally { setLoading(false); }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="surface-panel p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong"><DatabaseZap className="size-5" /></span><div><h2 className="font-black">Manual synchronization</h2><p className="text-xs text-ink-muted">Protected server-to-server trigger</p></div></div>
        <label className="mt-6 block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold"><KeyRound className="size-3.5" /> Admin key</span><input className="form-control" onChange={(event) => setAdminKey(event.target.value)} placeholder="ADMIN_SYNC_KEY" type="password" value={adminKey} /></label>
        <label className="mt-4 block"><span className="mb-1.5 block text-xs font-extrabold">Endpoint</span><select className="form-control" onChange={(event) => changeEndpoint(event.target.value)} value={endpointId}>{API_FOOTBALL_ENDPOINTS.map((item) => <option key={item.id} value={item.id}>{item.category} · {item.title}</option>)}</select></label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {selected.params.map((name) => <label key={name}><span className="mb-1.5 flex text-xs font-bold"><code>{name}</code>{selected.required.includes(name) ? <span className="ml-1 text-danger">*</span> : null}</span><input className="form-control" onChange={(event) => setParams((current) => ({ ...current, [name]: event.target.value }))} placeholder={selected.sample?.[name] ?? "Optional"} value={params[name] ?? ""} /></label>)}
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><button className="button-primary" disabled={loading} onClick={() => request({ endpoint: endpointId, params, force: true })} type="button">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />} Run endpoint</button><button className="button-secondary" disabled={loading} onClick={() => request({ mode: "due", limit: 10 })} type="button"><RefreshCw className="size-4" /> Run due jobs</button><button className="button-secondary sm:col-span-2 xl:col-span-1" disabled={loading} onClick={() => request({ jobs: teamLogoJobs })} type="button"><ImageDown className="size-4" /> Sync team logos</button></div>
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-brand-soft p-3 text-xs leading-5 text-brand-strong"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>The admin key stays in this request only and is never saved in browser storage.</p></div>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-5 sm:p-6"><div><h2 className="font-black">Worker health</h2><p className="mt-1 text-xs text-ink-muted">Recent jobs, failures and quota signals</p></div><button className="icon-button" disabled={loading} onClick={loadHealth} type="button" aria-label="Refresh worker health"><Activity className="size-4" /></button></div>
        <div className="p-5 sm:p-6">
          {health?.jobs?.length ? <div className="space-y-2">{health.jobs.slice(0, 8).map((job) => <div className="flex items-center gap-3 rounded-2xl bg-surface-soft p-3" key={job.id}><span className={`size-2 rounded-full ${job.last_error ? "bg-danger" : job.last_success_at ? "bg-brand" : "bg-warning"}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{job.job_key}</p><p className="mt-0.5 text-[0.65rem] text-ink-muted">Next: {job.next_run_at ? new Date(job.next_run_at).toLocaleString() : "not scheduled"}</p></div><span className="chip">{Math.round(job.interval_seconds / 60)}m</span></div>)}</div> : <div className="rounded-2xl border border-dashed border-line p-8 text-center"><Activity className="mx-auto size-6 text-ink-muted" /><p className="mt-3 text-sm font-black">Health data is locked</p><p className="mt-1 text-xs text-ink-muted">Enter your admin key and refresh.</p></div>}
          <pre className="mt-5 max-h-64 overflow-auto rounded-2xl bg-[#020806] p-4 text-[0.68rem] leading-5 text-[#b8d2c8] dark:bg-black/40"><code>{JSON.stringify(result ?? { status: "Ready for a protected sync request" }, null, 2)}</code></pre>
        </div>
      </section>
    </div>
  );
}
