import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID } from "@/lib/kognitos";
import {
  getReportLineItemsFromRun,
  dedupeLineItemsByDay,
  type ReportLineItem,
} from "@/lib/report-line-items";

export const dynamic = "force-dynamic";

const RUNS_PATH = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs`;

export async function GET(request: Request) {
  if (!AUTOMATION_ID) {
    return NextResponse.json(
      { error: "KOGNITOS_AUTOMATION_ID not configured" },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  const runIdParam = searchParams.get("run_id");
  const days =
    daysParam === "7"
      ? 7
      : daysParam === "30"
        ? 30
        : null;

  try {
    if (runIdParam) {
      const runRes = await req(`${RUNS_PATH}/${runIdParam}`);
      if (!runRes.ok) {
        if (runRes.status === 404)
          return NextResponse.json({ line_items: [], total: 0 });
        return NextResponse.json(
          { error: `Kognitos API error: ${runRes.status}` },
          { status: runRes.status >= 500 ? 502 : runRes.status }
        );
      }
      const raw = await runRes.json();
      const items = getReportLineItemsFromRun(raw);
      return NextResponse.json({ line_items: items, total: items.length });
    }

    const res = await req(`${RUNS_PATH}?pageSize=100`);
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Kognitos API error: ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    const data = await res.json();
    const runs = data.runs ?? [];
    const completed = runs.filter(
      (r: { state?: Record<string, unknown> }) => r.state?.completed != null
    );

    const allItems: ReportLineItem[] = [];
    const cutoff = days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    for (const run of completed) {
      if (cutoff && (run.create_time ?? "") < cutoff) continue;
      const id = (run.name ?? "").split("/").pop() ?? "";
      const runRes = await req(
        `${RUNS_PATH}/${id}`
      );
      if (!runRes.ok) continue;
      const raw = await runRes.json();
      const items = getReportLineItemsFromRun(raw);
      allItems.push(...items);
    }

    const deduped = dedupeLineItemsByDay(allItems);
    return NextResponse.json({
      line_items: deduped,
      total: deduped.length,
      period_days: days ?? null,
    });
  } catch (e) {
    console.error("[api/report-line-items]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch line items" },
      { status: 500 }
    );
  }
}
