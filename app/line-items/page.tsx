"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import type { ReportLineItem } from "@/lib/report-line-items";
import ErrorState from "@/components/ErrorState";

const PERIODS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "All", days: null as number | null },
] as const;

function downloadCsv(items: ReportLineItem[]) {
  const header = "Broadcast day,Input,Exception detail,Output,Job ID\n";
  const escape = (s: string) => {
    const t = (s ?? "").replace(/"/g, '""');
    return t.includes(",") || t.includes('"') || t.includes("\n") ? `"${t}"` : t;
  };
  const rows = items.map(
    (i) =>
      `${escape(i.broadcast_day)},${escape(i.input)},${escape(i.exception_detail)},${escape(i.output)},${escape(i.source_run_id ?? i.run_id ?? "")}`
  );
  const csv = header + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `line-items-${dayjs().format("YYYY-MM-DD")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LineItemsPage() {
  const [lineItems, setLineItems] = useState<ReportLineItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodIndex, setPeriodIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterException, setFilterException] = useState<"all" | "yes" | "no">("all");

  const period = PERIODS[periodIndex];
  const daysParam = period.days === null ? "all" : String(period.days);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/report-line-items?days=${daysParam}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load line items");
        return res.json();
      })
      .then((data: { line_items: ReportLineItem[]; total: number }) => {
        if (!cancelled) {
          setLineItems(data.line_items ?? []);
          setTotal(data.total ?? 0);
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
  }, [daysParam]);

  const sorted = useMemo(
    () =>
      [...lineItems].sort((a, b) => {
        const d = b.broadcast_day.localeCompare(a.broadcast_day);
        if (d !== 0) return d;
        return (a.input + a.exception_detail + a.output).localeCompare(
          b.input + b.exception_detail + b.output
        );
      }),
    [lineItems]
  );

  const uniqueDays = useMemo(() => {
    const set = new Set(sorted.map((i) => i.broadcast_day).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [sorted]);

  const filtered = useMemo(() => {
    let list = sorted;
    if (filterDay) list = list.filter((i) => i.broadcast_day === filterDay);
    if (filterException === "yes") list = list.filter((i) => (i.exception_detail ?? "").trim() !== "");
    if (filterException === "no") list = list.filter((i) => (i.exception_detail ?? "").trim() === "");
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (i) =>
          (i.input ?? "").toLowerCase().includes(q) ||
          (i.exception_detail ?? "").toLowerCase().includes(q) ||
          (i.output ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [sorted, filterDay, filterException, searchQuery]);

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
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Report line items</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Line-level details from the final report (input → exception detail → output). One row per unique line per broadcast day.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriodIndex(i)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                periodIndex === i
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All days</option>
          {uniqueDays.map((d) => (
            <option key={d} value={d}>
              {dayjs(d).format("MMM D, YYYY")}
            </option>
          ))}
        </select>
        <select
          value={filterException}
          onChange={(e) => setFilterException(e.target.value as "all" | "yes" | "no")}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="all">All lines</option>
          <option value="yes">With exception</option>
          <option value="no">Without exception</option>
        </select>
        <input
          type="search"
          placeholder="Search input, exception, output…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground min-w-[12rem]"
        />
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(filtered)}
            className="rounded-lg border border-border bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Export CSV
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <section className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No report line items yet. We look for a table in the email HTML output
            (<code className="rounded bg-muted px-1.5 py-0.5 text-xs">email_html_body</code> or <code className="rounded bg-muted px-1.5 py-0.5 text-xs">report_email_html</code>), or a table output <code className="rounded bg-muted px-1.5 py-0.5 text-xs">final_report</code>. If your report table uses different structure, we may need to adjust the parser.
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Line items</h2>
            <span className="text-sm text-muted-foreground">
              {filtered.length === total ? `${total} lines` : `${filtered.length} of ${total} lines`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Broadcast day</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Input</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Exception detail</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5">Output</th>
                  <th className="text-left font-medium text-foreground px-4 py-2.5 w-24">Job</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr
                    key={`${item.broadcast_day}-${item.input}-${item.exception_detail}-${item.output}-${i}`}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2.5 text-foreground whitespace-nowrap">
                      {item.broadcast_day ? dayjs(item.broadcast_day).format("MMM D, YYYY") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-foreground max-w-xs truncate" title={item.input}>
                      {item.input || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-foreground max-w-xs truncate" title={item.exception_detail}>
                      {item.exception_detail || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-foreground max-w-xs truncate" title={item.output}>
                      {item.output || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {(item.source_run_id ?? item.run_id) && (
                        <Link
                          href={`/jobs/${item.source_run_id ?? item.run_id}`}
                          className="text-primary hover:underline text-xs font-medium"
                        >
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
