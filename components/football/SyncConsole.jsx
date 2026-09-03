"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  ImageDown,
  KeyRound,
  Link2,
  LoaderCircle,
  Play,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { API_FOOTBALL_ENDPOINTS } from "@/lib/api-football/endpoints";

function percent(value) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

export function SyncConsole() {
  const [adminKey, setAdminKey] = useState("");
  const [endpointId, setEndpointId] = useState("fixtures");
  const selected = API_FOOTBALL_ENDPOINTS.find((item) => item.id === endpointId);
  const [params, setParams] = useState(selected.sample ?? {});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState(null);
  const [assets, setAssets] = useState(null);
  const [assetError, setAssetError] = useState(null);

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
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      setResult(payload);
      if (payload.teamAssets) {
        setAssets(payload.teamAssets);
        setAssetError(null);
      }
      response.ok
        ? toast.success(body.mode?.startsWith("team-assets") ? "Team catalog and logo links updated" : "Synchronization request completed")
        : toast.error(payload.error ?? "Sync failed");
    } catch (error) {
      setResult({ error: error.message });
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const reconcileAssets = async () => {
    if (!adminKey) return toast.error("Enter your admin key first.");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/team-assets", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
      });
      const payload = await response.json();
      setResult(payload);
      if (!response.ok) throw new Error(payload.error ?? "Asset reconciliation failed");
      setAssets(payload);
      setAssetError(null);
      toast.success("Cached team assets reconciled");
    } catch (error) {
      setAssetError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadHealth = async () => {
    if (!adminKey) return toast.error("Enter your admin key first.");
    setLoading(true);
    try {
      const headers = { "x-admin-key": adminKey };
      const [healthResponse, assetResponse] = await Promise.all([
        fetch("/api/admin/health", { headers }),
        fetch("/api/admin/team-assets", { headers }),
      ]);
      const [healthPayload, assetPayload] = await Promise.all([
        healthResponse.json(),
        assetResponse.json(),
      ]);
      setHealth(healthPayload);
      if (assetResponse.ok) {
        setAssets(assetPayload);
        setAssetError(null);
      } else {
        setAssetError(assetPayload.error ?? "Unable to load team-asset coverage");
      }
      if (!healthResponse.ok) toast.error(healthPayload.error ?? "Unable to load health");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="surface-panel p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong"><DatabaseZap className="size-5" /></span>
          <div><h2 className="font-black">Manual synchronization</h2><p className="text-xs text-ink-muted">Protected server-to-server trigger</p></div>
        </div>

        <label className="mt-6 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold"><KeyRound className="size-3.5" /> Admin key</span>
          <input className="form-control" onChange={(event) => setAdminKey(event.target.value)} placeholder="ADMIN_SYNC_KEY" type="password" value={adminKey} />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-extrabold">Endpoint</span>
          <select className="form-control" onChange={(event) => changeEndpoint(event.target.value)} value={endpointId}>
            {API_FOOTBALL_ENDPOINTS.map((item) => <option key={item.id} value={item.id}>{item.category} · {item.title}</option>)}
          </select>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {selected.params.map((name) => (
            <label key={name}>
              <span className="mb-1.5 flex text-xs font-bold"><code>{name}</code>{selected.required.includes(name) ? <span className="ml-1 text-danger">*</span> : null}</span>
              <input className="form-control" onChange={(event) => setParams((current) => ({ ...current, [name]: event.target.value }))} placeholder={selected.sample?.[name] ?? "Optional"} value={params[name] ?? ""} />
            </label>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button className="button-primary" disabled={loading} onClick={() => request({ endpoint: endpointId, params, force: true })} type="button">
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />} Run endpoint
          </button>
          <button className="button-secondary" disabled={loading} onClick={() => request({ mode: "due", limit: 10 })} type="button"><RefreshCw className="size-4" /> Run due jobs</button>
          <button className="button-secondary" disabled={loading} onClick={() => request({ mode: "team-assets" })} type="button"><ImageDown className="size-4" /> Sync team assets</button>
          <button className="button-secondary" disabled={loading} onClick={() => request({ mode: "team-assets-expansion" })} type="button"><ImageDown className="size-4" /> Sync expansion league teams</button>
          <button className="button-secondary" disabled={loading} onClick={() => request({ mode: "team-assets-targeted" })} type="button"><ImageDown className="size-4" /> Sync missing UCL teams</button>
          <button className="button-secondary" disabled={loading} onClick={reconcileAssets} type="button"><SearchCheck className="size-4" /> Reconcile cached assets</button>
        </div>

        <div className="mt-4 rounded-2xl bg-brand-soft p-3 text-xs leading-5 text-brand-strong">
          <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>The admin key stays in this request only and is never saved in browser storage.</p></div>
          <div className="mt-2 flex items-start gap-2"><Link2 className="mt-0.5 size-4 shrink-0" /><p>The targeted UCL repair uses five country catalog calls. Duplicate historical identities inherit the canonical logo without duplicating the unique API team ID.</p></div>
          <div className="mt-2 flex items-start gap-2"><UsersRound className="mt-0.5 size-4 shrink-0" /><p>The expansion repair uses only England, Belgium and Scotland, then reconciles E1, B1 and SC0 from the refreshed catalog.</p></div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-5 sm:p-6">
          <div><h2 className="font-black">Worker and asset health</h2><p className="mt-1 text-xs text-ink-muted">Quota signals, catalog coverage and unresolved identities</p></div>
          <button className="icon-button" disabled={loading} onClick={loadHealth} type="button" aria-label="Refresh worker and asset health"><Activity className="size-4" /></button>
        </div>
        <div className="p-5 sm:p-6">
          {assets ? (
            <div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                {[
                  { label: "Logo coverage", value: percent(assets.coverage), icon: CheckCircle2 },
                  { label: "Logos resolved", value: assets.assetsResolved ?? assets.linked ?? 0, icon: ImageDown },
                  { label: "API IDs linked", value: assets.identityLinked ?? 0, icon: Link2 },
                  { label: "Catalog teams", value: assets.catalogTeams ?? 0, icon: UsersRound },
                  { label: "Needs logo", value: assets.unresolvedCount ?? 0, icon: AlertTriangle },
                ].map(({ label, value, icon: Icon }) => (
                  <div className="rounded-2xl bg-surface-soft p-3" key={label}>
                    <Icon className="size-4 text-brand-strong" />
                    <p className="mt-2 text-lg font-black">{value}</p>
                    <p className="text-[0.65rem] font-bold text-ink-muted">{label}</p>
                  </div>
                ))}
              </div>
              {assets.unresolved?.length ? (
                <div className="mt-4 rounded-2xl border border-line p-3">
                  <div className="flex items-center justify-between"><p className="text-xs font-black">Needs review</p><span className="chip">first {Math.min(8, assets.unresolved.length)}</span></div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {assets.unresolved.slice(0, 8).map((team) => <span className="chip" key={team.canonicalKey}>{team.name} · {team.countryCode}</span>)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {assetError ? <div className="mt-4 flex items-start gap-2 rounded-2xl bg-warning/10 p-3 text-xs text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{assetError}</p></div> : null}

          {health?.jobs?.length ? (
            <div className="mt-5 space-y-2">
              {health.jobs.slice(0, 8).map((job) => (
                <div className="flex items-center gap-3 rounded-2xl bg-surface-soft p-3" key={job.id}>
                  <span className={`size-2 rounded-full ${job.last_error ? "bg-danger" : job.last_success_at ? "bg-brand" : "bg-warning"}`} />
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{job.job_key}</p><p className="mt-0.5 text-[0.65rem] text-ink-muted">Next: {job.next_run_at ? new Date(job.next_run_at).toLocaleString() : "not scheduled"}</p></div>
                  <span className="chip">{Math.round(job.interval_seconds / 60)}m</span>
                </div>
              ))}
            </div>
          ) : !assets ? (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center"><Activity className="mx-auto size-6 text-ink-muted" /><p className="mt-3 text-sm font-black">Health data is locked</p><p className="mt-1 text-xs text-ink-muted">Enter your admin key and refresh.</p></div>
          ) : null}

          <pre className="mt-5 max-h-64 overflow-auto rounded-2xl bg-[#020806] p-4 text-[0.68rem] leading-5 text-[#b8d2c8] dark:bg-black/40"><code>{JSON.stringify(result ?? { status: "Ready for a protected sync request" }, null, 2)}</code></pre>
        </div>
      </section>
    </div>
  );
}
