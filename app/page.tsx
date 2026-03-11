"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
import { PERIOD_OPTIONS, type PeriodValue } from "@/lib/periods";
import type { ReportLineItem } from "@/lib/report-line-items";
import { getResolutionForLine } from "@/lib/report-line-items";
import type { CustomerStatRow } from "@/app/api/customer-stats/route";
import KpiCard, {
  IconCalendar,
  IconCheck,
  IconPercent,
  IconAlert,
  IconX,
  IconChart,
  IconLightning,
} from "@/components/KpiCard";
import RefreshHeader from "@/components/RefreshHeader";

const EXCEPTION_PREVIEW = 10;
const CUSTOMER_PREVIEW = 10;

function applyHomeData(
  data: { runs?: RunSummary[]; exceptionItems?: ReportLineItem[]; runResolutions?: Record<string, string>; runExceptionDetails?: Record<string, { type: string; resolution: string }[]>; customers?: CustomerStatRow[] },
  lastSyncedAt: string | null,
  setRuns: (v: RunSummary[]) => void,
  setExceptionItems: (v: ReportLineItem[]) => void,
  setRunResolutions: (v: Record<string, string>) => void,
  setRunExceptionDetails: (v: Record<string, { type: string; resolution: string }[]>) => void,
  setCustomers: (v: CustomerStatRow[]) => void,
  setLastSyncedAt: (v: number | null) => void
) {
  setRuns(data.runs ?? []);
  setExceptionItems(data.exceptionItems ?? []);
  setRunResolutions(data.runResolutions ?? {});
  setRunExceptionDetails(data.runExceptionDetails ?? {});
  setCustomers(data.customers ?? []);
  setLastSyncedAt(lastSyncedAt ? new Date(lastSyncedAt).getTime() : null);
}

export default function HomePage() {
  const [period, setPeriod] = useState<PeriodValue>("30d");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [exceptionItems, setExceptionItems] = useState<ReportLineItem[]>([]);
  const [runResolutions, setRunResolutions] = useState<Record<string, string>>({});
  const [runExceptionDetails, setRunExceptionDetails] = useState<Record<string, { type: string; resolution: string }[]>>({});
  const [customers, setCustomers] = useState<CustomerStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const key = `home-${period}`;
    fetch(`/api/cache?key=${encodeURIComponent(key)}`)
      .then((res) => {
        if (res.ok) return res.json() as Promise<{ data: Record<string, unknown>; last_synced_at: string }>;
        if (res.status === 404) return null;
        throw new Error("Failed to load cache");
      })
      .then((json) => {
        if (cancelled) return;
        if (json) {
          const d = json.data as { runs?: RunSummary[]; exceptionItems?: ReportLineItem[]; runResolutions?: Record<string, string>; runExceptionDetails?: Record<string, { type: string; resolution: string }[]>; customers?: CustomerStatRow[] };
          applyHomeData(d, json.last_synced_at, setRuns, setExceptionItems, setRunResolutions, setRunExceptionDetails, setCustomers, setLastSyncedAt);
          setLoading(false);
          return;
        }
        return fetch("/api/cache/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
          .then((r) => {
            if (!r.ok) throw new Error("Failed to refresh");
            return r.json() as Promise<{ data: Record<string, unknown>; last_synced_at: string }>;
          })
          .then((refreshed) => {
            if (cancelled) return;
            const d = refreshed.data as { runs?: RunSummary[]; exceptionItems?: ReportLineItem[]; runResolutions?: Record<string, string>; runExceptionDetails?: Record<string, { type: string; resolution: string }[]>; customers?: CustomerStatRow[] };
            applyHomeData(d, refreshed.last_synced_at, setRuns, setExceptionItems, setRunResolutions, setRunExceptionDetails, setCustomers, setLastSyncedAt);
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
    const key = `home-${period}`;
    fetch("/api/cache/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
      .then((res) => {
        if (!res.ok) throw new Error("Refresh failed");
        return res.json() as Promise<{ data: Record<string, unknown>; last_synced_at: string }>;
      })
      .then((json) => {
        const d = json.data as { runs?: RunSummary[]; exceptionItems?: ReportLineItem[]; runResolutions?: Record<string, string>; runExceptionDetails?: Record<string, { type: string; resolution: string }[]>; customers?: CustomerStatRow[] };
        applyHomeData(d, json.last_synced_at, setRuns, setExceptionItems, setRunResolutions, setRunExceptionDetails, setCustomers, setLastSyncedAt);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Refresh failed"))
      .finally(() => setLoading(false));
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

  const completionsPerPeriod = useMemo(() => {
    const byWeek: Record<string, { autoCompleted: number; manuallyResolved: number }> = {};
    runs.forEach((r) => {
      const weekKey = r.createTime
        ? dayjs(r.createTime).startOf("week").format("YYYY-MM-DD")
        : "";
      if (!weekKey) return;
      if (!byWeek[weekKey]) byWeek[weekKey] = { autoCompleted: 0, manuallyResolved: 0 };
      if (r.status === "completed") byWeek[weekKey].autoCompleted += 1;
      else if (r.status === "awaiting_guidance" || r.status === "failed")
        byWeek[weekKey].manuallyResolved += 1;
    });
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([weekStart, v]) => ({
        period: `Week of ${dayjs(weekStart).format("MMM D")}`,
        autoCompleted: v.autoCompleted,
        manuallyResolved: v.manuallyResolved,
      }));
  }, [runs]);

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
        </div>
      </div>

      {/* Section A — How we're doing */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">How we’re doing</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Broadcast days" value={runs.length} icon={<IconCalendar />} />
          <KpiCard label="Spots placed" value={totalSpotsScheduled} icon={<IconCheck />} />
          <KpiCard label="Placement rate" value={placementRate != null ? `${placementRate}%` : "—"} icon={<IconPercent />} />
          <KpiCard label="Awaiting resolution" value={needsDecision.length} icon={<IconAlert />} variant="warning" />
          <KpiCard label="Failed" value={failed.length} icon={<IconX />} variant="destructive" />
          <KpiCard label="Avg spots / day" value={avgSpotsPerDay ?? "—"} icon={<IconChart />} />
        </div>

        {/* Kognitos automation insights */}
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <IconLightning />
            </span>
            Kognitos automation insights
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total runs</p>
              <p className="text-2xl font-semibold text-foreground mt-0.5">{runs.length}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">STP rate</p>
              <p className="text-2xl font-semibold text-foreground mt-0.5">{placementRate != null ? `${placementRate}%` : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time saved</p>
              <p className="text-2xl font-semibold text-foreground mt-0.5">—</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue (period)</p>
              <p className="text-2xl font-semibold text-foreground mt-0.5">{totalRevenue > 0 ? `$${totalRevenue.toFixed(0)}` : "—"}</p>
            </div>
          </div>
          {completionsPerPeriod.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground mb-2">Completions per period</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-foreground">Period</th>
                      <th className="text-right py-2 font-medium text-foreground">Auto-completed</th>
                      <th className="text-right py-2 font-medium text-foreground">Manually resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completionsPerPeriod.map((row) => (
                      <tr key={row.period} className="border-b border-border/50">
                        <td className="py-2 text-foreground">{row.period}</td>
                        <td className="py-2 text-right text-muted-foreground">{row.autoCompleted}</td>
                        <td className="py-2 text-right text-muted-foreground">{row.manuallyResolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
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
                      <td className="px-4 py-2 text-foreground truncate max-w-[14rem]" title={getResolutionForLine(item, runExceptionDetails)}>
                        {getResolutionForLine(item, runExceptionDetails)}
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
