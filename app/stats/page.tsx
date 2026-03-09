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
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import dayjs from "dayjs";
import type { RunSummary } from "@/lib/runs";
import { PERIOD_OPTIONS, type PeriodValue } from "@/lib/periods";

export default function SpotBookingStatsPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodValue>("30d");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/runs?period=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load runs");
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
  }, [period]);

  const completed = useMemo(() => runs.filter((r) => r.status === "completed"), [runs]);

  const byDay = useMemo(() => {
    const map: Record<string, { spots: number; requested: number; runs: number; rateSum: number; rateCount: number }> = {};
    completed.forEach((r) => {
      const day = r.createTime ? dayjs(r.createTime).format("YYYY-MM-DD") : "";
      if (!day) return;
      if (!map[day]) map[day] = { spots: 0, requested: 0, runs: 0, rateSum: 0, rateCount: 0 };
      map[day].spots += r.outputs?.total_scheduled ?? 0;
      map[day].requested += r.outputs?.spots_loaded ?? 0;
      map[day].runs += 1;
      if (r.outputs?.success_rate != null) {
        map[day].rateSum += r.outputs.success_rate;
        map[day].rateCount += 1;
      }
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: dayjs(date).format("MMM D"),
        dateKey: date,
        spots: v.spots,
        requested: v.requested,
        runs: v.runs,
        placementRate: v.rateCount > 0 ? Math.round(v.rateSum / v.rateCount) : 0,
      }));
  }, [completed]);

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
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Error</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Link href="/" className="text-sm text-primary hover:underline mt-2 inline-block">← Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Spot booking stats</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Volume and placement rate by day
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Spots placed by day</h2>
          {byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data in this period</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="spots" name="Spots placed" fill="hsl(var(--chart-1))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Placement rate over time</h2>
          {byDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No data in this period</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="placementRate" name="Placement rate %" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {byDay.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <h2 className="text-lg font-medium text-foreground px-4 py-3 border-b border-border">By day</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-medium text-foreground px-4 py-2">Date</th>
                  <th className="text-right font-medium text-foreground px-4 py-2">Broadcast days</th>
                  <th className="text-right font-medium text-foreground px-4 py-2">Spots placed</th>
                  <th className="text-right font-medium text-foreground px-4 py-2">Placement rate</th>
                </tr>
              </thead>
              <tbody>
                {[...byDay].reverse().map((row) => (
                  <tr key={row.dateKey} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2 text-foreground">{row.date}</td>
                    <td className="px-4 py-2 text-right">{row.runs}</td>
                    <td className="px-4 py-2 text-right">{row.spots}</td>
                    <td className="px-4 py-2 text-right">{row.placementRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
