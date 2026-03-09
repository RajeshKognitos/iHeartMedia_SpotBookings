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
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import dayjs from "dayjs";
import type { RunSummary } from "@/lib/runs";
import { statusLabel } from "@/lib/runs";

const PERIODS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "All", days: null as number | null },
] as const;

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodIndex, setPeriodIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/runs")
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 502 ? "Could not reach system" : "Failed to load traffic");
        return res.json();
      })
      .then((data: { runs: RunSummary[] }) => {
        if (!cancelled) setRuns(data.runs ?? []);
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
  }, []);

  const period = PERIODS[periodIndex];
  const cutoff = period.days ? dayjs().subtract(period.days, "day").toISOString() : null;
  const filteredRuns = useMemo(
    () => (cutoff ? runs.filter((r) => r.createTime && r.createTime >= cutoff) : runs),
    [runs, cutoff]
  );

  const completed = filteredRuns.filter((r) => r.status === "completed");
  const needsDecision = filteredRuns.filter((r) => r.status === "awaiting_guidance");
  const failed = filteredRuns.filter((r) => r.status === "failed");

  const totalSpotsScheduled = completed.reduce(
    (sum, r) => sum + (r.outputs?.total_scheduled ?? 0),
    0
  );
  const totalSpotsRequested = completed.reduce(
    (sum, r) => sum + (r.outputs?.spots_loaded ?? 0),
    0
  );
  const placementRate =
    totalSpotsRequested > 0
      ? Math.round((totalSpotsScheduled / totalSpotsRequested) * 100)
      : null;
  const avgSpotsPerDay =
    completed.length > 0 ? Math.round(totalSpotsScheduled / completed.length) : null;

  // Trend: broadcast days per day
  const runsByDay = useMemo(() => {
    const byDay: Record<string, { completed: number; total: number; placementRate: number }> = {};
    filteredRuns.forEach((r) => {
      const day = r.createTime ? dayjs(r.createTime).format("YYYY-MM-DD") : "—";
      if (!byDay[day]) byDay[day] = { completed: 0, total: 0, placementRate: 0 };
      byDay[day].total += 1;
      if (r.status === "completed") byDay[day].completed += 1;
      if (r.status === "completed" && r.outputs?.success_rate != null) {
        byDay[day].placementRate =
          (byDay[day].placementRate * (byDay[day].completed - 1) + r.outputs.success_rate) / byDay[day].completed;
      } else if (r.status === "completed") {
        byDay[day].placementRate = byDay[day].placementRate;
      }
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, v]) => ({
        date: dayjs(date).format("MMM D"),
        broadcastDays: v.total,
        placementRate: v.completed > 0 ? Math.round(v.placementRate) : 0,
      }));
  }, [filteredRuns]);

  // Success rate distribution (completed runs only)
  const successBuckets = useMemo(() => {
    const buckets = [
      { range: "95–100%", min: 95, max: 101, count: 0 },
      { range: "90–95%", min: 90, max: 95, count: 0 },
      { range: "80–90%", min: 80, max: 90, count: 0 },
      { range: "<80%", min: 0, max: 80, count: 0 },
    ];
    completed.forEach((r) => {
      const rate = r.outputs?.success_rate ?? 0;
      const b = buckets.find((b) => rate >= b.min && rate < b.max);
      if (b) b.count += 1;
    });
    return buckets.map((b) => ({
      name: b.range,
      value: b.count,
      fill: b.min >= 95 ? "hsl(var(--chart-1))" : b.min >= 90 ? "hsl(var(--chart-2))" : b.min >= 80 ? "hsl(215 16% 55%)" : "hsl(215 16% 45%)",
    }));
  }, [completed]);

  const statusChartData = [
    { name: "Traffic clear", value: completed.length, fill: "hsl(var(--chart-1))" },
    { name: "Awaiting resolution", value: needsDecision.length, fill: "hsl(var(--chart-2))" },
    { name: "Failed", value: failed.length, fill: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <div className="h-8 w-56 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-muted rounded-lg animate-pulse" />
          <div className="h-64 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Unable to load traffic</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Traffic &amp; Spot Bookings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Placement rate, conflicts, and broadcast-day traffic at a glance
          </p>
        </div>
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriodIndex(i)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                i === periodIndex ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Traffic at a glance — 6 cards */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Traffic at a glance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Broadcast days</p>
            <p className="text-xl font-semibold text-foreground mt-1">{filteredRuns.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">In selected period</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Spots placed</p>
            <p className="text-xl font-semibold text-foreground mt-1">{totalSpotsScheduled}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Across completed traffic</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Placement rate</p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {placementRate != null ? `${placementRate}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Spots scheduled vs requested</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Awaiting resolution</p>
            <p className="text-xl font-semibold text-foreground mt-1">{needsDecision.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Conflicts need your decision</p>
          </div>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-xs font-medium text-destructive">Failed traffic runs</p>
            <p className="text-xl font-semibold text-foreground mt-1">{failed.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Need attention</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Avg spots / broadcast day</p>
            <p className="text-xl font-semibold text-foreground mt-1">{avgSpotsPerDay ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Completed runs only</p>
          </div>
        </div>
      </section>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Broadcast days per day */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Spot bookings by day</h2>
          <p className="text-sm text-muted-foreground mb-4">Number of broadcast-day traffic runs per day</p>
          {runsByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data in this period</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={runsByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="broadcastDays" name="Broadcast days" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Placement rate over time */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Placement rate over time</h2>
          <p className="text-sm text-muted-foreground mb-4">Daily average placement rate (%) for completed traffic</p>
          {runsByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data in this period</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={runsByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="placementRate"
                    name="Placement rate %"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Success rate distribution + Traffic run status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Placement rate distribution</h2>
          <p className="text-sm text-muted-foreground mb-4">How many completed broadcast days fall in each rate band</p>
          {successBuckets.every((b) => b.value === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No completed traffic in this period</p>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={successBuckets} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Broadcast days" radius={4}>
                    {successBuckets.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Traffic run status</h2>
          <p className="text-sm text-muted-foreground mb-4">Runs by outcome in selected period</p>
          {statusChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No traffic in this period</p>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
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

      {/* Conflicts needing your decision */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium text-foreground mb-2">Conflicts needing your decision</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Scheduling conflicts (back-to-back, overfill, or competitive separation) are paused until you choose a resolution in Kognitos.
        </p>
        {needsDecision.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conflicts waiting — all traffic clear.</p>
        ) : (
          <ul className="space-y-2">
            {needsDecision.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <Link
                    href={`/jobs/${r.id}`}
                    className="font-medium text-primary hover:underline truncate block"
                  >
                    Broadcast day {r.id.slice(0, 8)}…
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.createTime ? dayjs(r.createTime).format("MMM D, YYYY HH:mm") : "—"}
                  </p>
                </div>
                <a
                  href={r.kognitosUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-medium text-primary hover:underline"
                >
                  Resolve in Kognitos →
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Failed traffic runs */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium text-foreground mb-2">Failed traffic runs</h2>
        <p className="text-sm text-muted-foreground mb-3">Runs that ended with an error and need attention or retry.</p>
        {failed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failed traffic runs.</p>
        ) : (
          <ul className="space-y-2">
            {failed.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <Link
                    href={`/jobs/${r.id}`}
                    className="font-medium text-primary hover:underline truncate block"
                  >
                    Broadcast day {r.id.slice(0, 8)}…
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.createTime ? dayjs(r.createTime).format("MMM D, YYYY HH:mm") : "—"}
                  </p>
                </div>
                <a
                  href={r.kognitosUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-medium text-primary hover:underline"
                >
                  View in Kognitos →
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent broadcast days */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium text-foreground mb-3">Recent broadcast days</h2>
        <p className="text-sm text-muted-foreground mb-3">Latest traffic runs — open for full traffic log and details.</p>
        {filteredRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spot bookings in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">Broadcast day</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Spots placed</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Placement rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.slice(0, 15).map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2">
                      <Link href={`/jobs/${r.id}`} className="text-primary hover:underline font-medium">
                        {r.id.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {r.createTime ? dayjs(r.createTime).format("MMM D, HH:mm") : "—"}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "completed"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : r.status === "awaiting_guidance"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : r.status === "failed"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {r.outputs?.total_scheduled ?? "—"}
                    </td>
                    <td className="py-2 text-right">
                      {r.outputs?.success_rate != null ? `${r.outputs.success_rate}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
