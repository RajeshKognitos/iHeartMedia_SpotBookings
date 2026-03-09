/**
 * Phase 3: Inspect run outputs — list output keys/types, decode Arrow tables if any.
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { req, ORG_ID, WORKSPACE_ID } = await import("../lib/kognitos");
  const AUTO_ID = process.env.KOGNITOS_AUTOMATION_ID!;
  const base = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTO_ID}`;

  // 1. Get runs to find a completed and an awaiting_guidance run
  const runsRes = await req(`${base}/runs?pageSize=20`);
  if (!runsRes.ok) throw new Error(`Runs failed: ${runsRes.status}`);
  const { runs } = await runsRes.json();

  const completedRun = runs.find((r: { state?: object }) => r.state?.completed);
  const awaitingRun = runs.find((r: { state?: object }) => r.state?.awaiting_guidance);

  const runIdFromName = (name: string) => name.split("/").pop();

  const schema: {
    completedRunId: string | null;
    outputs: { key: string; type: string; sample?: unknown }[];
    tables: { key: string; columns?: string[]; sampleRows?: unknown[] }[];
    awaitingRunId: string | null;
    exceptionStructure?: object;
  } = {
    completedRunId: completedRun ? runIdFromName(completedRun.name) : null,
    outputs: [],
    tables: [],
    awaitingRunId: awaitingRun ? runIdFromName(awaitingRun.name) : null,
  };

  if (completedRun) {
    const runId = runIdFromName(completedRun.name);
    const runRes = await req(`${base}/runs/${runId}`);
    if (!runRes.ok) throw new Error(`Run fetch failed: ${runRes.status}`);
    const runDetail = await runRes.json();
    const outputs = runDetail.state?.completed?.outputs ?? {};
    for (const [key, value] of Object.entries(outputs)) {
      const v = value as Record<string, unknown>;
      if (v.number !== undefined) {
        schema.outputs.push({ key, type: "number", sample: (v.number as { lo?: number }).lo });
      } else if (v.text !== undefined) {
        const text = v.text as string;
        schema.outputs.push({ key, type: "text", sample: text.length > 200 ? text.slice(0, 200) + "…" : text });
      } else if (v.null_value !== undefined) {
        schema.outputs.push({ key, type: "null", sample: null });
      } else if (v.table?.inline?.data) {
        schema.outputs.push({ key, type: "table", sample: "(see tables below)" });
        schema.tables.push({ key });
      } else {
        schema.outputs.push({ key, type: "unknown", sample: v });
      }
    }
  }

  if (awaitingRun) {
    const runId = runIdFromName(awaitingRun.name);
    const runRes = await req(`${base}/runs/${runId}`);
    if (!runRes.ok) throw new Error(`Awaiting run fetch failed: ${runRes.status}`);
    const runDetail = await runRes.json();
    schema.exceptionStructure = runDetail.state?.awaiting_guidance ?? null;
  }

  console.log(JSON.stringify(schema, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
