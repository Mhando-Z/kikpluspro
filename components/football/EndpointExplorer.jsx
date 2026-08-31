"use client";

import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Database,
  LoaderCircle,
  Play,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  API_FOOTBALL_ENDPOINTS,
  ENDPOINT_CATEGORIES,
} from "@/lib/api-football/endpoints";

export function EndpointExplorer() {
  const [category, setCategory] = useState("Fixtures");
  const visible = useMemo(
    () => API_FOOTBALL_ENDPOINTS.filter((item) => item.category === category),
    [category],
  );
  const [selectedId, setSelectedId] = useState("fixtures");
  const selected =
    API_FOOTBALL_ENDPOINTS.find((item) => item.id === selectedId) ?? visible[0];
  const [params, setParams] = useState(selected?.sample ?? {});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectEndpoint = (item) => {
    setSelectedId(item.id);
    setParams(item.sample ?? {});
    setResult(null);
  };

  const requestPath = useMemo(() => {
    if (!selected) return "";
    const query = new URLSearchParams({ endpoint: selected.id, ...params });
    return `/api/football?${query.toString()}`;
  }, [selected, params]);

  const run = async () => {
    if (selected.id === "status") {
      toast.error("Account status is server-only and is not exposed publicly.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(requestPath);
      const payload = await response.json();
      setResult({ ok: response.ok, status: response.status, payload });
    } catch (error) {
      setResult({ ok: false, status: 0, payload: { error: error.message } });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(requestPath);
    setCopied(true);
    toast.success("Request path copied");
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="surface-flat h-fit overflow-hidden">
        <div className="border-b border-line p-4">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <select
              className="form-control appearance-none pl-9"
              onChange={(event) => {
                const nextCategory = event.target.value;
                setCategory(nextCategory);
                const first = API_FOOTBALL_ENDPOINTS.find(
                  (item) => item.category === nextCategory,
                );
                if (first) selectEndpoint(first);
              }}
              value={category}
            >
              {ENDPOINT_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="max-h-[34rem] space-y-1 overflow-y-auto p-2">
          {visible.map((item) => (
            <button
              className={`w-full rounded-xl px-3 py-2.5 text-left transition ${selected?.id === item.id ? "bg-brand-soft text-brand-strong" : "hover:bg-surface-soft"}`}
              key={item.id}
              onClick={() => selectEndpoint(item)}
              type="button"
            >
              <span className="block text-xs font-extrabold">{item.title}</span>
              <code className="mt-1 block truncate text-[0.64rem] text-ink-muted">
                {item.path}
              </code>
            </button>
          ))}
        </div>
      </aside>

      <motion.section
        className="surface-panel overflow-hidden"
        key={selected.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="border-b border-line p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <span className="chip">
                <Database className="size-3" /> {selected.method}
              </span>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">
                {selected.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
                {selected.description}
              </p>
            </div>
            <span className="chip shrink-0">
              TTL {Math.round(selected.freshnessSeconds / 60)} min
            </span>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">
              Parameters
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {selected.params.length ? (
                selected.params.map((name) => (
                  <label className="block" key={name}>
                    <span className="mb-1.5 flex items-center gap-1 text-xs font-bold">
                      <code>{name}</code>
                      {selected.required.includes(name) ? (
                        <span className="text-danger">*</span>
                      ) : null}
                    </span>
                    <input
                      className="form-control"
                      onChange={(event) =>
                        setParams((current) => ({
                          ...current,
                          [name]: event.target.value,
                        }))
                      }
                      placeholder={selected.sample?.[name] ?? "Optional"}
                      value={params[name] ?? ""}
                    />
                  </label>
                ))
              ) : (
                <p className="col-span-2 rounded-2xl bg-surface-soft p-4 text-xs text-ink-muted">
                  This reference endpoint does not require parameters.
                </p>
              )}
            </div>
            <div className="mt-5 rounded-2xl bg-[#020806] p-4 text-[#b8d2c8] dark:bg-black/40">
              <div className="flex items-start justify-between gap-3">
                <code className="break-all text-xs leading-5">
                  GET {requestPath}
                </code>
                <button
                  className="shrink-0 text-brand"
                  onClick={copy}
                  type="button"
                  aria-label="Copy request"
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <button
              className="button-primary mt-4 w-full"
              disabled={loading}
              onClick={run}
              type="button"
            >
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}{" "}
              Load cached response
            </button>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">
              Response preview
            </p>
            <pre className="mt-3 min-h-80 max-h-[34rem] overflow-auto rounded-2xl border border-line bg-[#020806] p-4 text-[0.7rem] leading-5 text-[#b8d2c8] dark:bg-black/40">
              <code>
                {result
                  ? JSON.stringify(result, null, 2)
                  : "Run the request to inspect the Supabase cache response.\n\nThe frontend never sends your API-Football key."}
              </code>
            </pre>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
