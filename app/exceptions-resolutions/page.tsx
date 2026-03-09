"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import type { ReportLineItem } from "@/lib/report-line-items";
import { PERIOD_OPTIONS, type PeriodValue } from "@/lib/periods";
import ErrorState from "@/components/ErrorState";

export default function ExceptionsResolutionsPage() {
  const [lineItems, setLineItems] = useState<ReportLineItem[]>([]);
  const [runResolutions, setRunResolutions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodValue>("30d");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/report-line-items?period=${period}&exceptions_only=true`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((data: { line_items: ReportLineItem[]; run_resolutions?: Record<string, string> }) => {
        if (!cancelled) {
          setLineItems(data.line_items ?? []);
          setRunResolutions(data.run_resolutions ?? {});
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodValue)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Link href="/" className="text-sm text-primary hover:underline">← Dashboard</Link>
        </div>
      </div>

      {sorted.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No exceptions in this period.</p>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Exception lines</h2>
            <span className="text-sm text-muted-foreground">{sorted.length} lines</span>
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
                    <td className="px-4 py-2.5 text-foreground max-w-[14rem] truncate" title={runResolutions[item.source_run_id ?? item.run_id ?? ""]}>
                      {runResolutions[item.source_run_id ?? item.run_id ?? ""] ?? "—"}
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
