import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID, kognitosRunUrl } from "@/lib/kognitos";
import { normalizeRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

const RUNS_PATH = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs`;

export async function GET() {
  if (!AUTOMATION_ID) {
    return NextResponse.json(
      { error: "KOGNITOS_AUTOMATION_ID not configured" },
      { status: 503 }
    );
  }
  try {
    const res = await req(`${RUNS_PATH}?pageSize=50`);
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Kognitos API error: ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    const data = await res.json();
    const runs = data.runs ?? [];
    const normalized = runs.map((r: { name?: string; create_time?: string; state?: Record<string, unknown> }) => {
      const id = (r.name ?? "").split("/").pop() ?? "";
      return normalizeRun(r, kognitosRunUrl(id));
    });
    return NextResponse.json({ runs: normalized });
  } catch (e) {
    console.error("[api/runs]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch runs" },
      { status: 500 }
    );
  }
}
