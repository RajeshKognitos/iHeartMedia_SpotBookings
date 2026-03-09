import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID } from "@/lib/kognitos";
import {
  getReportLineItemsFromRun,
  dedupeLineItemsByDay,
  type ReportLineItem,
} from "@/lib/report-line-items";
import { getExceptionDetailsFromRun } from "@/lib/runs";
import { isRunInPeriod, type PeriodValue } from "@/lib/periods";

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
  const periodParam = (searchParams.get("period") || searchParams.get("days") || "all") as PeriodValue;
  const period = ["7d", "30d", "90d", "this_month", "last_month", "all"].includes(periodParam)
    ? periodParam
    : (searchParams.get("days") === "7" ? "7d" : searchParams.get("days") === "30" ? "30d" : "all");
  const runIdParam = searchParams.get("run_id");
  const exceptionsOnly = searchParams.get("exceptions_only") === "true";

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

    for (const run of completed) {
      if (!isRunInPeriod(run.create_time ?? "", period)) continue;
      const id = (run.name ?? "").split("/").pop() ?? "";
      const runRes = await req(
        `${RUNS_PATH}/${id}`
      );
      if (!runRes.ok) continue;
      const raw = await runRes.json();
      const items = getReportLineItemsFromRun(raw);
      allItems.push(...items);
    }

    let result = dedupeLineItemsByDay(allItems);
    if (exceptionsOnly) {
      result = result.filter((i) => (i.exception_detail ?? "").trim() !== "");
    }

    let run_resolutions: Record<string, string> = {};
    if (exceptionsOnly && result.length > 0) {
      const runIds = [...new Set(result.map((i) => i.source_run_id ?? i.run_id).filter(Boolean))];
      for (const rid of runIds) {
        const runRes = await req(`${RUNS_PATH}/${rid}`);
        if (!runRes.ok) continue;
        const raw = await runRes.json();
        const details = getExceptionDetailsFromRun(raw);
        run_resolutions[rid] = details.map((d) => `${d.type}: ${d.resolution}`).join("; ") || "—";
      }
    }

    return NextResponse.json({
      line_items: result,
      total: result.length,
      period,
      ...(exceptionsOnly && { run_resolutions }),
    });
  } catch (e) {
    console.error("[api/report-line-items]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch line items" },
      { status: 500 }
    );
  }
}
