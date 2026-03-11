"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import type { RunDetail } from "@/lib/runs";
import StatusBadge from "@/components/StatusBadge";
import type { ReportLineItem } from "@/lib/report-line-items";
import ErrorState from "@/components/ErrorState";

const LINE_ITEMS_PREVIEW = 10;

export default function JobDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [run, setRun] = useState<RunDetail | null>(null);
  const [astralMessage, setAstralMessage] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<ReportLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/runs/${id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Broadcast day not found");
          throw new Error("Failed to load traffic run");
        }
        return res.json();
      })
      .then((data: RunDetail) => {
        if (cancelled) return;
        setRun(data);
        if (data.status === "awaiting_guidance") {
          return fetch(`/api/runs/${id}/astral-events`).then((r) => r.json());
        }
      })
      .then((eventsData?: { message?: string | null }) => {
        if (cancelled) return;
        if (eventsData?.message != null) setAstralMessage(eventsData.message);
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
  }, [id]);

  useEffect(() => {
    if (!id || !run || run.status !== "completed") return;
    let cancelled = false;
    fetch(`/api/report-line-items?run_id=${id}`)
      .then((res) => res.ok ? res.json() : { line_items: [] })
      .then((data: { line_items: ReportLineItem[] }) => {
        if (!cancelled) setLineItems(data.line_items ?? []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id, run?.status]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-6">
        <ErrorState message={error ?? "Broadcast day not found"} backHref="/" />
      </div>
    );
  }

  const isAwaiting = run.status === "awaiting_guidance";
  const spotsRequested = run.outputs?.spots_loaded;
  const stationsCount = run.outputs?.stations_loaded;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Broadcast day traffic</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono">{run.id}</p>
          {run.createTime && (
            <p className="text-sm text-muted-foreground mt-1">
              {dayjs(run.createTime).format("dddd, MMM D, YYYY [at] HH:mm")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={run.status} className="text-sm px-3 py-1" />
          <a
            href={run.kognitosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            {isAwaiting ? "Resolve in Kognitos →" : "View traffic log in Kognitos →"}
          </a>
        </div>
      </div>

      {/* Traffic summary — always show when we have outputs or context */}
      {(spotsRequested != null || stationsCount != null) && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h2 className="text-sm font-medium text-foreground mb-2">Traffic summary</h2>
          <p className="text-sm text-muted-foreground">
            {spotsRequested != null && stationsCount != null
              ? `${spotsRequested} spot requests across ${stationsCount} station(s).`
              : spotsRequested != null
                ? `${spotsRequested} spot requests.`
                : stationsCount != null
                  ? `${stationsCount} station(s) in this run.`
                  : null}
          </p>
        </div>
      )}

      {run.status === "completed" && run.outputs && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Placement results</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Spots placed into the broadcast schedule; traffic log and reports are sent via email.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Spots placed</dt>
              <dd className="font-medium text-foreground">{run.outputs.total_scheduled ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Placement rate</dt>
              <dd className="font-medium text-foreground">
                {run.outputs.success_rate != null ? `${run.outputs.success_rate}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Spots requested</dt>
              <dd className="font-medium text-foreground">{run.outputs.spots_loaded ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Stations</dt>
              <dd className="font-medium text-foreground">{run.outputs.stations_loaded ?? "—"}</dd>
            </div>
            {run.outputs.email_status && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Traffic log / report</dt>
                <dd className="font-medium text-foreground">{run.outputs.email_status}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {run.exception_details && run.exception_details.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Exception details</h2>
          <div className="space-y-4">
            {run.exception_details.map((ex, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <p className="font-medium text-foreground mb-1">{ex.type}</p>
                {ex.display_text && (
                  <pre className="whitespace-pre-wrap text-muted-foreground text-xs mb-2 overflow-x-auto max-h-40 overflow-y-auto">
                    {ex.display_text}
                  </pre>
                )}
                <p className="text-foreground">
                  <span className="text-muted-foreground">Resolution: </span>
                  {ex.resolution}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {lineItems.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-medium text-foreground mb-3">Report line items</h2>
          <p className="text-sm text-muted-foreground mb-3">
            {lineItems.length} line(s) from this broadcast day’s final report.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-medium text-foreground px-3 py-2">Input</th>
                  <th className="text-left font-medium text-foreground px-3 py-2">Exception detail</th>
                  <th className="text-left font-medium text-foreground px-3 py-2">Output</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.slice(0, LINE_ITEMS_PREVIEW).map((item, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2 text-foreground max-w-[12rem] truncate" title={item.input}>{item.input || "—"}</td>
                    <td className="px-3 py-2 text-foreground max-w-[12rem] truncate" title={item.exception_detail}>{item.exception_detail || "—"}</td>
                    <td className="px-3 py-2 text-foreground max-w-[12rem] truncate" title={item.output}>{item.output || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lineItems.length > LINE_ITEMS_PREVIEW && (
            <Link href="/line-items" className="text-sm font-medium text-primary hover:underline mt-3 inline-block">
              View all line items →
            </Link>
          )}
        </div>
      )}

      {isAwaiting && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-lg font-medium text-foreground mb-2">Scheduling conflict — your decision needed</h2>
          <p className="text-sm text-muted-foreground mb-3">
            This broadcast day is paused on a conflict (e.g. back-to-back same advertiser, break overfill, or competitive separation). Choose a resolution in Kognitos to continue.
          </p>
          {astralMessage ? (
            <div className="text-sm text-foreground whitespace-pre-wrap rounded-md bg-background/80 p-3 border border-border mb-3">
              {astralMessage}
            </div>
          ) : null}
          <a
            href={run.kognitosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Resolve in Kognitos →
          </a>
        </div>
      )}

      {run.status === "failed" && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h2 className="text-lg font-medium text-foreground mb-2">Traffic run failed</h2>
          <p className="text-sm text-muted-foreground">
            This broadcast-day run ended with an error. Open Kognitos to see details and retry.
          </p>
          <a
            href={run.kognitosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-sm font-medium text-primary hover:underline"
          >
            View in Kognitos →
          </a>
        </div>
      )}

      <Link href="/" className="text-sm text-primary hover:underline">
        ← Back to Traffic &amp; Spot Bookings
      </Link>
    </div>
  );
}
