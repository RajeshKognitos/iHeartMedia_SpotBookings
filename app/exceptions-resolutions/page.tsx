"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import type { ReportLineItem } from "@/lib/report-line-items";
import { getResolutionForLine } from "@/lib/report-line-items";
import { PERIOD_OPTIONS, type PeriodValue } from "@/lib/periods";
import ErrorState from "@/components/ErrorState";
import RefreshHeader from "@/components/RefreshHeader";

const PERIOD_VALUES: PeriodValue[] = ["7d", "30d", "90d", "this_month", "last_month", "all"];

function ExceptionsContent() {
  const searchParams = useSearchParams();
  const periodParam = searchParams.get("period") as PeriodValue | null;
  const [period, setPeriod] = useState<PeriodValue>(
    periodParam && PERIOD_VALUES.includes(periodParam) ? periodParam : "30d"
  );
  const [lineItems, setLineItems] = useState<ReportLineItem[]>([]);
  const [runResolutions, setRunResolutions] = useState<Record<string, string>>({});
  const [runExceptionDetails, setRunExceptionDetails] = useState<Record<string, { type: string; resolution: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (periodParam && PERIOD_VALUES.includes(periodParam)) setPeriod(periodParam);
  }, [periodParam]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const key = `exceptions-${period}`;
    fetch(`/api/cache?key=${encodeURIComponent(key)}`)
      .then((res) => {
        if (res.ok) return res.json() as Promise<{ data: { lineItems?: ReportLineItem[]; runResolutions?: Record<string, string>; runExceptionDetails?: Record<string, { type: string; resolution: string }[]> }; last_synced_at: string }>;
        if (res.status === 404) return null;
        throw new Error("Failed to load cache");
      })
      .then((json) => {
        if (cancelled) return;
        if (json) {
          setLineItems(json.data.lineItems ?? []);
          setRunResolutions(json.data.runResolutions ?? {});
          setRunExceptionDetails(json.data.runExceptionDetails ?? {});
          setLastSyncedAt(json.last_synced_at ? new Date(json.last_synced_at).getTime() : null);
          setLoading(false);
          return;
        }
        return fetch("/api/cache/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
          .then((r) => {
            if (!r.ok) throw new Error("Failed to refresh");
            return r.json() as Promise<{ data: { lineItems?: ReportLineItem[]; runResolutions?: Record<string, string>; runExceptionDetails?: Record<string, { type: string; resolution: string }[]> }; last_synced_at: string }>;
          })
          .then((refreshed) => {
            if (cancelled) return;
            setLineItems(refreshed.data.lineItems ?? []);
            setRunResolutions(refreshed.data.runResolutions ?? {});
            setRunExceptionDetails(refreshed.data.runExceptionDetails ?? {});
            setLastSyncedAt(refreshed.last_synced_at ? new Date(refreshed.last_synced_at).getTime() : null);
          });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [period]);

  const handleRefresh = useCallback(() => {
    setError(null);
    setLoading(true);
    const key = `exceptions-${period}`;
    fetch("/api/cache/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
      .then((res) => {
        if (!res.ok) throw new Error("Refresh failed");
        return res.json() as Promise<{ data: { lineItems?: ReportLineItem[]; runResolutions?: Record<string, string>; runExceptionDetails?: Record<string, { type: string; resolution: string }[]> }; last_synced_at: string }>;
      })
      .then((json) => {
        setLineItems(json.data.lineItems ?? []);
        setRunResolutions(json.data.runResolutions ?? {});
        setRunExceptionDetails(json.data.runExceptionDetails ?? {});
        setLastSyncedAt(json.last_synced_at ? new Date(json.last_synced_at).getTime() : null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [period]);

  const sorted = useMemo(
    () =>
      [...lineItems].sort((a, b) => {
        const d = b.broadcast_day.localeCompare(a.broadcast_day);
        if (d !== 0) return d;
        return (a.input + a.exception_detail).localeCompare(b.input + b.exception_detail);
      }),
    [lineItems]
  );

  function downloadCsv() {
    const header = "Broadcast day,Input,Advertiser,Exception detail,Resolution,Job ID\n";
    const escape = (s: string | undefined) => {
      const t = (s ?? "").replace(/"/g, '""');
      return t.includes(",") || t.includes('"') || t.includes("\n") ? `"${t}"` : t;
    };
    const rows = sorted.map(
      (item) =>
        `${escape(item.broadcast_day)},${escape(item.input)},${escape(item.advertiser)},${escape(item.exception_detail)},${escape(getResolutionForLine(item, runExceptionDetails))},${escape(item.source_run_id ?? item.run_id ?? "")}`
    );
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exceptions-${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message={error} backHref="/" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Exceptions &amp; resolutions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Spot bookings that had exceptions and how they were resolved
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RefreshHeader lastSyncedAt={lastSyncedAt} onRefresh={handleRefresh} refreshing={loading} />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodValue)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Link href="/" className="text-sm text-primary hover:underline">← Home</Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No exceptions in this period.</p>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-foreground">Exception lines</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{sorted.length} exception{sorted.length !== 1 ? "s" : ""} total</span>
              <button
                type="button"
                onClick={downloadCsv}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                Download CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Broadcast day</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Input</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Advertiser</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Exception detail</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Resolution</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5 w-24">Job</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, i) => (
                  <tr
                    key={`${item.broadcast_day}-${item.input}-${i}`}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">
                      {item.broadcast_day ? dayjs(item.broadcast_day).format("MMM D, YYYY") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-foreground max-w-[10rem] truncate" title={item.input}>{item.input || "—"}</td>
                    <td className="px-4 py-2.5 text-foreground">{item.advertiser || "—"}</td>
                    <td className="px-4 py-2.5 text-foreground max-w-xs truncate" title={item.exception_detail}>{item.exception_detail || "—"}</td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const res = getResolutionForLine(item, runExceptionDetails);
                        const isAwaiting = !res || res === "—" || res.toLowerCase().includes("awaiting");
                        return (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium max-w-[14rem] truncate ${
                              isAwaiting ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30" : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
                            }`}
                            title={res}
                          >
                            {res}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5">
                      {(item.source_run_id ?? item.run_id) && (
                        <Link href={`/jobs/${item.source_run_id ?? item.run_id}`} className="text-primary hover:underline text-xs font-medium">
                          View job
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default function ExceptionsResolutionsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 bg-muted rounded animate-pulse" /></div>}>
      <ExceptionsContent />
    </Suspense>
  );
}
