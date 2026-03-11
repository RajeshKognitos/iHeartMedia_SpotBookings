"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import dayjs from "dayjs";
import type { RunSummary } from "@/lib/runs";
import { statusLabel } from "@/lib/runs";
import { PERIOD_OPTIONS, type PeriodValue } from "@/lib/periods";
import type { ReportLineItem } from "@/lib/report-line-items";
import type { CustomerStatRow } from "@/app/api/customer-stats/route";

const EXCEPTION_PREVIEW = 10;
const CUSTOMER_PREVIEW = 10;

export default function HomePage() {
  const [period, setPeriod] = useState<PeriodValue>("30d");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [exceptionItems, setExceptionItems] = useState<ReportLineItem[]>([]);
  const [runResolutions, setRunResolutions] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<CustomerStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/runs?period=${period}`).then((r) => (r.ok ? r.json() : { runs: [] })),
      fetch(`/api/report-line-items?period=${period}&exceptions_only=true`).then((r) =>
        r.ok ? r.json() : { line_items: [], run_resolutions: {} }
      ),
      fetch(`/api/customer-stats?period=${period}`).then((r) => (r.ok ? r.json() : { customers: [] })),
    ])
      .then(([runsData, itemsData, customersData]) => {
        if (cancelled) return;
        setRuns((runsData as { runs?: RunSummary[] }).runs ?? []);
        setExceptionItems((itemsData as { line_items?: ReportLineItem[] }).line_items ?? []);
        setRunResolutions((itemsData as { run_resolutions?: Record<string, string> }).run_resolutions ?? {});
        setCustomers((customersData as { customers?: CustomerStatRow[] }).customers ?? []);
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

  const completed = useMemo(() => runs.filter((r) => r.status === "completed"), [runs]);
  const needsDecision = useMemo(() => runs.filter((r) => r.status === "awaiting_guidance"), [runs]);
  const failed = useMemo(() => runs.filter((r) => r.status === "failed"), [runs]);

  const totalSpotsScheduled = useMemo(
    () => completed.reduce((sum, r) => sum + (r.outputs?.total_scheduled ?? 0), 0),
    [completed]
  );
  const totalSpotsRequested = useMemo(
    () => completed.reduce((sum, r) => sum + (r.outputs?.spots_loaded ?? 0), 0),
    [completed]
  );
  const placementRate =
    totalSpotsRequested > 0 ? Math.round((totalSpotsScheduled / totalSpotsRequested) * 100) : null;
  const avgSpotsPerDay = completed.length > 0 ? Math.round(totalSpotsScheduled / completed.length) : null;

  const runsByDay = useMemo(() => {
    const byDay: Record<string, { total: number }> = {};
    runs.forEach((r) => {
      const day = r.createTime ? dayjs(r.createTime).format("YYYY-MM-DD") : "";
      if (!day) return;
      if (!byDay[day]) byDay[day] = { total: 0 };
      byDay[day].total += 1;
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, v]) => ({ date: dayjs(date).format("MMM D"), broadcastDays: v.total }));
  }, [runs]);

  const statusChartData = useMemo(
    () =>
      [
        { name: "Clear", value: completed.length, fill: "hsl(var(--chart-1))" },
        { name: "Awaiting resolution", value: needsDecision.length, fill: "hsl(var(--chart-2))" },
        { name: "Failed", value: failed.length, fill: "hsl(var(--destructive))" },
      ].filter((d) => d.value > 0),
    [completed.length, needsDecision.length, failed.length]
  );

  const exceptionPreview = useMemo(
    () =>
      [...exceptionItems]
        .sort((a, b) => b.broadcast_day.localeCompare(a.broadcast_day))
        .slice(0, EXCEPTION_PREVIEW),
    [exceptionItems]
  );

  const customerPreview = useMemo(() => customers.slice(0, CUSTOMER_PREVIEW), [customers]);
  const totalRevenue = useMemo(
    () => customers.reduce((sum, c) => sum + c.revenue_total, 0),
    [customers]
  );

  if (loading) {
    return (
      <div className="p-6 space-y-8">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-9 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-56 bg-muted rounded-lg animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Unable to load</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Link href="/" className="text-sm text-primary hover:underline mt-2 inline-block">Reload</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header + period */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Spot Bookings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">How we’re doing, what needs action, and how customers are doing</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodValue)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Section A — How we're doing */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">How we’re doing</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Broadcast days</p>
            <p className="text-xl font-semibold text-foreground mt-1">{runs.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Spots placed</p>
            <p className="text-xl font-semibold text-foreground mt-1">{totalSpotsScheduled}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Placement rate</p>
            <p className="text-xl font-semibold text-foreground mt-1">{placementRate != null ? `${placementRate}%` : "—"}</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Awaiting resolution</p>
            <p className="text-xl font-semibold text-foreground mt-1">{needsDecision.length}</p>
          </div>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-xs font-medium text-destructive">Failed</p>
            <p className="text-xl font-semibold text-foreground mt-1">{failed.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Avg spots / day</p>
            <p className="text-xl font-semibold text-foreground mt-1">{avgSpotsPerDay ?? "—"}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground mb-2">Spot bookings by day</p>
            {runsByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No data in this period</p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={runsByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="broadcastDays" name="Runs" fill="hsl(var(--chart-1))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground mb-2">Run status</p>
            {statusChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No runs in this period</p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusChartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Runs" radius={4}>
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section B — What needs action */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">What needs action</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {exceptionItems.length} exception line{exceptionItems.length !== 1 ? "s" : ""} in period
            </p>
            <Link
              href={`/exceptions-resolutions?period=${period}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              View all →
            </Link>
          </div>
          {exceptionPreview.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No exceptions in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left font-medium text-foreground px-4 py-2">Broadcast day</th>
                    <th className="text-left font-medium text-foreground px-4 py-2">Advertiser</th>
                    <th className="text-left font-medium text-foreground px-4 py-2 max-w-[12rem]">Exception</th>
                    <th className="text-left font-medium text-foreground px-4 py-2 max-w-[14rem]">Resolution</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {exceptionPreview.map((item, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2 whitespace-nowrap text-foreground">
                        {item.broadcast_day ? dayjs(item.broadcast_day).format("MMM D, YYYY") : "—"}
                      </td>
                      <td className="px-4 py-2 text-foreground">{item.advertiser || "—"}</td>
                      <td className="px-4 py-2 text-foreground truncate max-w-[12rem]" title={item.exception_detail}>
                        {item.exception_detail || "—"}
                      </td>
                      <td className="px-4 py-2 text-foreground truncate max-w-[14rem]" title={runResolutions[item.source_run_id ?? item.run_id ?? ""]}>
                        {runResolutions[item.source_run_id ?? item.run_id ?? ""] ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {(item.source_run_id ?? item.run_id) && (
                          <Link
                            href={`/jobs/${item.source_run_id ?? item.run_id}`}
                            className="text-primary hover:underline text-xs font-medium"
                          >
                            Job
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Section C — Customers */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Customers (advertisers)</h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {customers.length} advertiser{customers.length !== 1 ? "s" : ""}
              {totalRevenue > 0 && ` · $${totalRevenue.toFixed(2)} revenue`}
            </p>
            <Link href={`/customers?period=${period}`} className="text-sm font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          {customerPreview.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No customer data in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left font-medium text-foreground px-4 py-2">Advertiser</th>
                    <th className="text-right font-medium text-foreground px-4 py-2">Lines</th>
                    <th className="text-right font-medium text-foreground px-4 py-2">Exceptions</th>
                    <th className="text-right font-medium text-foreground px-4 py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPreview.map((c) => (
                    <tr key={c.advertiser} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium text-foreground">{c.advertiser}</td>
                      <td className="px-4 py-2 text-right">{c.line_count}</td>
                      <td className="px-4 py-2 text-right">{c.exception_count}</td>
                      <td className="px-4 py-2 text-right">${c.revenue_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Footer links */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-border">
        <Link href="/line-items" className="text-sm font-medium text-primary hover:underline">
          Full report (line items)
        </Link>
        <Link href="/chat" className="text-sm font-medium text-primary hover:underline">
          Chat
        </Link>
      </div>
    </div>
  );
}
