import { NextResponse } from "next/server";
import { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID, kognitosRunUrl } from "@/lib/kognitos";
import { isRestConfigured, startRunWithFiles } from "@/lib/kognitos-rest";

export const dynamic = "force-dynamic";

const RUNS_PATH = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs`;

export async function POST(request: Request) {
  if (!AUTOMATION_ID) {
    return NextResponse.json(
      { error: "KOGNITOS_AUTOMATION_ID not configured" },
      { status: 503 }
    );
  }
  let body: { inputs?: Record<string, string>; file_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const inputs = body.inputs ?? {};
  const fileIds = Array.isArray(body.file_ids) ? body.file_ids.filter((id) => typeof id === "string") : [];

  if (fileIds.length > 0) {
    if (!isRestConfigured()) {
      return NextResponse.json(
        { error: "File upload not configured. Set KOGNITOS_REST_API_URL and KOGNITOS_API_KEY to start runs with files." },
        { status: 503 }
      );
    }
    try {
      const { runId } = await startRunWithFiles(AUTOMATION_ID, fileIds, Object.keys(inputs).length > 0 ? inputs : undefined);
      return NextResponse.json({
        runId,
        kognitosUrl: kognitosRunUrl(runId),
      });
    } catch (e) {
      console.error("[api/runs/start]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to start run with files" },
        { status: 500 }
      );
    }
  }

  const user_inputs: Record<string, { text?: string }> = {};
  for (const [key, value] of Object.entries(inputs)) {
    if (key && typeof value === "string") {
      user_inputs[key] = { text: value };
    }
  }
  try {
    const res = await req(RUNS_PATH, {
      method: "POST",
      body: JSON.stringify({ user_inputs }),
    });
    if (!res.ok) {
      const text = await res.text();
      const message = res.status === 403 ? "Cannot start runs (check token permissions)" : `Kognitos API error: ${res.status}`;
      return NextResponse.json(
        { error: message, details: text || undefined },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    const data = (await res.json()) as { name?: string; run_id?: string };
    const runId =
      data.run_id ??
      (typeof data.name === "string" ? data.name.split("/").pop() ?? "" : "");
    if (!runId) {
      return NextResponse.json(
        { error: "Start succeeded but no run ID in response" },
        { status: 502 }
      );
    }
    return NextResponse.json({
      runId,
      kognitosUrl: kognitosRunUrl(runId),
    });
  } catch (e) {
    console.error("[api/runs/start]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to start run" },
      { status: 500 }
    );
  }
}
