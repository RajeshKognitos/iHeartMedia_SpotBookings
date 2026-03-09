import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID, kognitosRunUrl } from "@/lib/kognitos";
import { normalizeRun, getExceptionDetailsFromRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!AUTOMATION_ID) {
    return NextResponse.json(
      { error: "KOGNITOS_AUTOMATION_ID not configured" },
      { status: 503 }
    );
  }
  const RUN_PATH = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs/${id}`;
  try {
    const res = await req(RUN_PATH);
    if (!res.ok) {
      if (res.status === 404)
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      return NextResponse.json(
        { error: `Kognitos API error: ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    const raw = await res.json();
    const run = normalizeRun(raw, kognitosRunUrl(id));
    const exception_details = getExceptionDetailsFromRun(raw);
    return NextResponse.json({ ...run, exception_details });
  } catch (e) {
    console.error("[api/runs/[id]]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch run" },
      { status: 500 }
    );
  }
}
