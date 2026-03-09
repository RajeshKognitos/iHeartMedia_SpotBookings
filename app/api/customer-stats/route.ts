import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID } from "@/lib/kognitos";
import {
  getReportLineItemsFromRun,
  dedupeLineItemsByDay,
  type ReportLineItem,
} from "@/lib/report-line-items";
import { isRunInPeriod, type PeriodValue } from "@/lib/periods";

export const dynamic = "force-dynamic";

const RUNS_PATH = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs`;

export interface CustomerStatRow {
  advertiser: string;
  line_count: number;
  exception_count: number;
  revenue_total: number;
}

export async function GET(request: Request) {
  if (!AUTOMATION_ID) {
    return NextResponse.json(
      { error: "KOGNITOS_AUTOMATION_ID not configured" },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get("period") || "all") as PeriodValue;

  try {
    const res = await req(`${RUNS_PATH}?pageSize=100`);
    if (!res.ok) {
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
      const runRes = await req(`${RUNS_PATH}/${id}`);
      if (!runRes.ok) continue;
      const raw = await runRes.json();
      const items = getReportLineItemsFromRun(raw);
      allItems.push(...items);
    }

    const deduped = dedupeLineItemsByDay(allItems);

    const byAdvertiser = new Map<string, { line_count: number; exception_count: number; revenue_total: number }>();
    const emptyLabel = "(Unknown)";

    for (const item of deduped) {
      const name = (item.advertiser ?? "").trim() || emptyLabel;
      const cur = byAdvertiser.get(name) ?? { line_count: 0, exception_count: 0, revenue_total: 0 };
      cur.line_count += 1;
      if ((item.exception_detail ?? "").trim() !== "") cur.exception_count += 1;
      cur.revenue_total += item.revenue ?? 0;
      byAdvertiser.set(name, cur);
    }

    const rows: CustomerStatRow[] = Array.from(byAdvertiser.entries())
      .map(([advertiser, v]) => ({
        advertiser,
        line_count: v.line_count,
        exception_count: v.exception_count,
        revenue_total: Math.round(v.revenue_total * 100) / 100,
      }))
      .sort((a, b) => b.line_count - a.line_count);

    return NextResponse.json({ customers: rows, period });
  } catch (e) {
    console.error("[api/customer-stats]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch customer stats" },
      { status: 500 }
    );
  }
}
