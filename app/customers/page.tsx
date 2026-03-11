"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CustomerStatRow } from "@/app/api/customer-stats/route";
import { PERIOD_OPTIONS, type PeriodValue } from "@/lib/periods";
import ErrorState from "@/components/ErrorState";

const PERIOD_VALUES: PeriodValue[] = ["7d", "30d", "90d", "this_month", "last_month", "all"];

function CustomersContent() {
  const searchParams = useSearchParams();
  const periodParam = searchParams.get("period") as PeriodValue | null;
  const [customers, setCustomers] = useState<CustomerStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodValue>(
    periodParam && PERIOD_VALUES.includes(periodParam) ? periodParam : "30d"
  );

  useEffect(() => {
    if (periodParam && PERIOD_VALUES.includes(periodParam)) setPeriod(periodParam);
  }, [periodParam]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/customer-stats?period=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load customer stats");
        return res.json();
      })
      .then((data: { customers: CustomerStatRow[] }) => {
        if (!cancelled) setCustomers(data.customers ?? []);
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
          <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Per-advertiser: lines (spots), exceptions, revenue
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
          <Link href="/" className="text-sm text-primary hover:underline">← Home</Link>
        </div>
      </div>

      {customers.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No customer data in this period.</p>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">By advertiser</h2>
            <span className="text-sm text-muted-foreground">
              {customers.length} advertiser{customers.length !== 1 ? "s" : ""}
              {customers.reduce((s, c) => s + c.revenue_total, 0) > 0 &&
                ` · $${customers.reduce((s, c) => s + c.revenue_total, 0).toFixed(2)} revenue`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Advertiser</th>
                  <th className="text-right font-medium text-foreground px-4 py-2.5">Lines (spots)</th>
                  <th className="text-right font-medium text-foreground px-4 py-2.5">Exceptions</th>
                  <th className="text-right font-medium text-foreground px-4 py-2.5">Revenue ($)</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.advertiser} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{c.advertiser}</td>
                    <td className="px-4 py-2.5 text-right">{c.line_count}</td>
                    <td className="px-4 py-2.5 text-right">{c.exception_count}</td>
                    <td className="px-4 py-2.5 text-right">{c.revenue_total.toFixed(2)}</td>
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

export default function CustomerStatsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-8 w-48 bg-muted rounded animate-pulse" /></div>}>
      <CustomersContent />
    </Suspense>
  );
}
