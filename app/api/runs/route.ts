import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID, kognitosRunUrl } from "@/lib/kognitos";
import { normalizeRun } from "@/lib/runs";
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
  const period = (new URL(request.url).searchParams.get("period") || "all") as PeriodValue;
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
    let normalized = runs.map((r: { name?: string; create_time?: string; state?: Record<string, unknown> }) => {
      const id = (r.name ?? "").split("/").pop() ?? "";
      return normalizeRun(r, kognitosRunUrl(id));
    });
    if (period !== "all") {
      normalized = normalized.filter((r: { createTime?: string }) => isRunInPeriod(r.createTime ?? "", period));
    }
    return NextResponse.json({ runs: normalized, period });
  } catch (e) {
    console.error("[api/runs]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch runs" },
      { status: 500 }
    );
  }
}
