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
import { EXCEPTION_TYPE_LABELS } from "@/lib/runs";
import StatusBadge from "@/components/StatusBadge";

const TYPE_COLORS: Record<string, string> = {
  [EXCEPTION_TYPE_LABELS.b2b]: "hsl(var(--chart-1))",
  [EXCEPTION_TYPE_LABELS.overfill]: "hsl(var(--chart-2))",
  [EXCEPTION_TYPE_LABELS.separation]: "hsl(214 45% 35%)",
  "Awaiting resolution": "hsl(var(--destructive))",
};

export default function ExceptionsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/runs")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load traffic");
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

  const runsWithExceptions = useMemo(
    () =>
      runs.filter(
        (r) =>
          r.status === "awaiting_guidance" ||
          (r.outputs?.exception_types?.length ?? 0) > 0
      ),
    [runs]
  );

  const distributionByType = useMemo(() => {
    const counts: Record<string, number> = {
      [EXCEPTION_TYPE_LABELS.b2b]: 0,
      [EXCEPTION_TYPE_LABELS.overfill]: 0,
      [EXCEPTION_TYPE_LABELS.separation]: 0,
      "Awaiting resolution": 0,
    };
    runs.forEach((r) => {
      if (r.status === "awaiting_guidance") {
        counts["Awaiting resolution"] += 1;
        return;
      }
      r.outputs?.exception_types?.forEach((t) => {
        if (t in counts) counts[t] += 1;
      });
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name,
        value,
        fill: TYPE_COLORS[name] ?? "hsl(var(--muted-foreground))",
      }))
      .sort((a, b) => b.value - a.value);
  }, [runs]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Error</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Exceptions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Scheduling conflicts by type — back-to-back, capacity overfill, and competitive separation. Resolve awaiting items in Kognitos.
        </p>
      </div>

      {/* Exception distribution by type */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium text-foreground mb-2">Exception distribution by type</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Count of exceptions (resolved in completed runs) and runs still awaiting your resolution.
        </p>
        {distributionByType.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No exceptions in the current run set.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionByType}
                layout="vertical"
                margin={{ left: 0, right: 24 }}
              >
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="value" name="Count" radius={4}>
                  {distributionByType.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Total with exceptions</p>
          <p className="text-xl font-semibold text-foreground mt-1">
            {runsWithExceptions.length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Runs (resolved or awaiting)</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Awaiting resolution</p>
          <p className="text-xl font-semibold text-foreground mt-1">
            {runs.filter((r) => r.status === "awaiting_guidance").length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Need your decision</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Resolved (B2B)</p>
          <p className="text-xl font-semibold text-foreground mt-1">
            {distributionByType.find((d) => d.name === EXCEPTION_TYPE_LABELS.b2b)?.value ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Back-to-back conflicts</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Resolved (overfill)</p>
          <p className="text-xl font-semibold text-foreground mt-1">
            {distributionByType.find((d) => d.name === EXCEPTION_TYPE_LABELS.overfill)?.value ?? 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Capacity overfill</p>
        </div>
      </div>

      {/* All runs with exceptions */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-medium text-foreground mb-2">Runs with exceptions</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Broadcast days that had at least one scheduling conflict (resolved or awaiting).
        </p>
        {runsWithExceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No runs with exceptions.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">
                    Broadcast day
                  </th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">
                    Exception type(s)
                  </th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {runsWithExceptions.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/50 hover:bg-muted/30"
                  >
                    <td className="py-2">
                      <Link
                        href={`/jobs/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.id.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {r.createTime
                        ? dayjs(r.createTime).format("MMM D, YYYY HH:mm")
                        : "—"}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "completed"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : r.status === "awaiting_guidance"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <StatusBadge status={r.status} />
                      </span>
                    </td>
                    <td className="py-2">
                      {r.status === "awaiting_guidance" ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          Awaiting resolution
                        </span>
                      ) : (
                        (r.outputs?.exception_types ?? []).join(", ") || "—"
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <a
                        href={r.kognitosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs font-medium"
                      >
                        {r.status === "awaiting_guidance"
                          ? "Resolve →"
                          : "View →"}
                      </a>
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
