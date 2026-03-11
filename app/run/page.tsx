"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import type { RunSummary, RunStatus } from "@/lib/runs";
import ErrorState from "@/components/ErrorState";
import StatusBadge from "@/components/StatusBadge";
import RefreshHeader from "@/components/RefreshHeader";

const CACHE_KEY_RUNS = "runs";
const DEFAULT_PERIOD = "all";
const PAGE_SIZE = 10;
type StatusFilter = "all" | "completed" | "awaiting_guidance" | "failed";

function downloadRunsCsv(runs: RunSummary[]) {
  const header = "Job ID,Started,Status,Spots scheduled,Success rate,Exception\n";
  const escape = (s: string | number | undefined) => {
    const t = (s ?? "").toString().replace(/"/g, '""');
    return t.includes(",") || t.includes('"') || t.includes("\n") ? `"${t}"` : t;
  };
  const rows = runs.map(
    (r) =>
      `${escape(r.id)},${escape(r.createTime ? dayjs(r.createTime).format("YYYY-MM-DD HH:mm") : "")},${escape(r.status)},${escape(r.outputs?.total_scheduled ?? "")},${escape(r.outputs?.success_rate != null ? `${r.outputs.success_rate}%` : "")},${escape(r.exception_summary)}`
  );
  const csv = header + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `job-runs-${dayjs().format("YYYY-MM-DD")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RunJobPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [sharepointUrl, setSharepointUrl] = useState("");
  const [broadcastDate, setBroadcastDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startSuccess, setStartSuccess] = useState<{ runId: string; kognitosUrl: string } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRunsLoading(true);
    setRunsError(null);
    fetch(`/api/cache?key=${encodeURIComponent(CACHE_KEY_RUNS)}`)
      .then((res) => {
        if (res.ok) return res.json() as Promise<{ data: { runs?: RunSummary[] }; last_synced_at: string }>;
        if (res.status === 404) return null;
        throw new Error("Failed to load cache");
      })
      .then((json) => {
        if (cancelled) return;
        if (json) {
          setRuns(json.data.runs ?? []);
          setLastSyncedAt(json.last_synced_at ? new Date(json.last_synced_at).getTime() : null);
          setRunsLoading(false);
          return;
        }
        return fetch("/api/cache/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: CACHE_KEY_RUNS }) })
          .then((r) => {
            if (!r.ok) throw new Error("Failed to refresh");
            return r.json() as Promise<{ data: { runs?: RunSummary[] }; last_synced_at: string }>;
          })
          .then((refreshed) => {
            if (cancelled) return;
            setRuns(refreshed.data.runs ?? []);
            setLastSyncedAt(refreshed.last_synced_at ? new Date(refreshed.last_synced_at).getTime() : null);
          });
      })
      .catch((e) => {
        if (!cancelled) setRunsError(e instanceof Error ? e.message : "Failed to load runs");
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const fetchRuns = useCallback(() => {
    setRunsLoading(true);
    setRunsError(null);
    fetch("/api/cache/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: CACHE_KEY_RUNS }) })
      .then((res) => {
        if (!res.ok) throw new Error("Refresh failed");
        return res.json() as Promise<{ data: { runs?: RunSummary[] }; last_synced_at: string }>;
      })
      .then((data) => {
        setRuns(data.data.runs ?? []);
        setLastSyncedAt(data.last_synced_at ? new Date(data.last_synced_at).getTime() : null);
      })
      .catch((e) => setRunsError(e instanceof Error ? e.message : "Failed to load runs"))
      .finally(() => setRunsLoading(false));
  }, []);

  const filteredRuns = useMemo(() => {
    if (statusFilter === "all") return runs;
    return runs.filter((r) => r.status === statusFilter);
  }, [runs, statusFilter]);

  const paginatedRuns = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredRuns.slice(start, start + PAGE_SIZE);
  }, [filteredRuns, page]);

  const totalPages = Math.ceil(filteredRuns.length / PAGE_SIZE) || 1;
  const from = filteredRuns.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, filteredRuns.length);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStartError(null);
    setStartSuccess(null);
    setStartLoading(true);
    const inputs: Record<string, string> = {};
    if (sharepointUrl.trim()) inputs.sharepoint_url = sharepointUrl.trim();
    if (broadcastDate.trim()) inputs.broadcast_date = broadcastDate.trim();

    const runStart = (fileIds: string[]) => {
      return fetch("/api/runs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, file_ids: fileIds.length > 0 ? fileIds : undefined }),
      });
    };

    if (files.length > 0) {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      fetch("/api/runs/upload", { method: "POST", body: formData })
        .then((res) => {
          const data = res.json();
          if (!res.ok) {
            if (res.status === 503) {
              return data.then((err: { error?: string }) => {
                throw new Error(err.error ?? "File upload not configured. Start without files or configure REST API.");
              });
            }
            return data.then((err: { error?: string }) => {
              throw new Error(err.error ?? `Upload failed (${res.status})`);
            });
          }
          return data;
        })
        .then((data: { file_ids: string[] }) => {
          return runStart(data.file_ids ?? []);
        })
        .then((res) => {
          const data = res.json();
          if (!res.ok) {
            return data.then((err: { error?: string }) => {
              throw new Error(err.error ?? `Failed to start job (${res.status})`);
            });
          }
          return data;
        })
        .then((data: { runId: string; kognitosUrl: string }) => {
          setStartSuccess(data);
          setFiles([]);
          fetchRuns();
        })
        .catch((e) => {
          setStartError(e instanceof Error ? e.message : "Failed to start job");
        })
        .finally(() => {
          setStartLoading(false);
        });
      return;
    }

    runStart([])
      .then((res) => {
        const data = res.json();
        if (!res.ok) {
          return data.then((err: { error?: string }) => {
            throw new Error(err.error ?? `Failed to start job (${res.status})`);
          });
        }
        return data;
      })
      .then((data: { runId: string; kognitosUrl: string }) => {
        setStartSuccess(data);
        fetchRuns();
      })
      .catch((e) => {
        setStartError(e instanceof Error ? e.message : "Failed to start job");
      })
      .finally(() => {
        setStartLoading(false);
      });
  }

  const handleRefresh = useCallback(() => {
    setRunsError(null);
    fetchRuns();
  }, [fetchRuns]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-primary hover:underline">← Home</Link>
        <RefreshHeader lastSyncedAt={lastSyncedAt} onRefresh={handleRefresh} refreshing={runsLoading} />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h1 className="text-xl font-semibold text-foreground mb-1">Run a scheduling job</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Upload input files and/or provide the input file URL (and optional broadcast date), then start a new job.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="files" className="block text-sm font-medium text-foreground mb-1">
              Upload files
            </label>
            <input
              id="files"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-primary-foreground file:cursor-pointer"
            />
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {files.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-foreground"
                  >
                    {f.name}
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-1.5 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${f.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="sharepoint_url" className="block text-sm font-medium text-foreground mb-1">
              Input file URL (SharePoint, optional)
            </label>
            <input
              id="sharepoint_url"
              type="url"
              value={sharepointUrl}
              onChange={(e) => setSharepointUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="broadcast_date" className="block text-sm font-medium text-foreground mb-1">
              Broadcast date (optional)
            </label>
            <input
              id="broadcast_date"
              type="text"
              value={broadcastDate}
              onChange={(e) => setBroadcastDate(e.target.value)}
              placeholder="e.g. 2025-03-10"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {startError && (
            <p className="text-sm text-destructive">{startError}</p>
          )}
          {startSuccess && (
            <p className="text-sm text-foreground">
              Job started.{" "}
              <Link href={`/jobs/${startSuccess.runId}`} className="text-primary hover:underline">View details</Link>
              {" · "}
              <a href={startSuccess.kognitosUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View in Kognitos</a>
            </p>
          )}
          <button
            type="submit"
            disabled={startLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {startLoading ? "Starting…" : "Start job"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-foreground">Job runs</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{filteredRuns.length} run{filteredRuns.length !== 1 ? "s" : ""} total</span>
            {filteredRuns.length > 0 && (
              <button
                type="button"
                onClick={() => downloadRunsCsv(filteredRuns)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                Download CSV
              </button>
            )}
          </div>
        </div>
        {filteredRuns.length > 0 && (
          <div className="px-4 pt-2 pb-3 flex flex-wrap items-center gap-2 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            {(["all", "completed", "awaiting_guidance", "failed"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setStatusFilter(f); setPage(0); }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "all" ? "All" : f === "completed" ? "Clear" : f === "awaiting_guidance" ? "Needs decision" : "Failed"}
              </button>
            ))}
          </div>
        )}
        {runsError && (
          <div className="p-4">
            <ErrorState title="Could not load runs" message={runsError} />
          </div>
        )}
        {!runsError && runsLoading && (
          <div className="p-6">
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <div className="mt-4 h-32 bg-muted rounded animate-pulse" />
          </div>
        )}
        {!runsError && !runsLoading && runs.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No runs yet. Start a job above to see it here.
          </div>
        )}
        {!runsError && !runsLoading && filteredRuns.length === 0 && runs.length > 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No runs match the selected status filter.
          </div>
        )}
        {!runsError && !runsLoading && paginatedRuns.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-foreground">Job ID</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground">Started</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground">Spots scheduled</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground">Success rate</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground">Exception</th>
                    <th className="text-left px-4 py-2 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRuns.map((run) => (
                    <tr key={run.id} className="border-b border-border hover:bg-muted/20">
                      <td className="px-4 py-2 text-foreground font-mono text-xs">{run.id.slice(0, 12)}…</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {run.createTime ? dayjs(run.createTime).format("MMM D, YYYY HH:mm") : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={run.status as RunStatus} />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {run.outputs?.total_scheduled ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {run.outputs?.success_rate != null ? `${run.outputs.success_rate}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate" title={run.exception_summary}>
                        {run.exception_summary ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/jobs/${run.id}`} className="text-primary hover:underline mr-2">View details</Link>
                        <a href={run.kognitosUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View in Kognitos</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {from}-{to} of {filteredRuns.length} runs
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={page}
                    onChange={(e) => setPage(Number(e.target.value))}
                    className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                  >
                    {Array.from({ length: totalPages }, (_, i) => (
                      <option key={i} value={i}>
                        Page {i + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
