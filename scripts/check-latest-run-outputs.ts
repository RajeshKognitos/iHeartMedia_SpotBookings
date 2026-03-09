/**
 * One-off: fetch latest run and list output keys + type and snippet for text outputs.
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { req, ORG_ID, WORKSPACE_ID, AUTOMATION_ID } = await import("../lib/kognitos");
  const base = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}`;

  const runsRes = await req(`${base}/runs?pageSize=5`);
  if (!runsRes.ok) {
    console.error("Runs fetch failed:", runsRes.status, await runsRes.text());
    process.exit(1);
  }
  const { runs } = (await runsRes.json()) as { runs: Array<{ name: string; create_time: string; state?: unknown }> };
  const latest = runs?.[0];
  if (!latest) {
    console.log("No runs found.");
    return;
  }

  // Use latest *completed* run so we see outputs (latest by time might be pending/awaiting)
  const completedRun = runs.find((r: { state?: Record<string, unknown> }) => r.state?.completed != null) ?? latest;
  const runId = completedRun.name.split("/").pop();
  const stateKeys = (completedRun as { state?: Record<string, unknown> }).state ? Object.keys((completedRun as { state?: Record<string, unknown> }).state!) : [];
  console.log("Run:", runId, "created:", completedRun.create_time, "state:", stateKeys);

  const runRes = await req(`${base}/runs/${runId}`);
  if (!runRes.ok) {
    console.error("Run detail failed:", runRes.status);
    process.exit(1);
  }
  const run = await runRes.json();
  const outputs = run.state?.completed?.outputs ?? {};
  console.log("\nOutput keys:", Object.keys(outputs));

  for (const [key, value] of Object.entries(outputs)) {
    const v = value as Record<string, unknown>;
    if (v && typeof v === "object" && "text" in v) {
      const text = (v as { text?: string }).text ?? "";
      const isHtml = /<\s*(html|table|div|tr|td|th|body)/i.test(text);
      console.log(`\n--- ${key} (text, length=${text.length}, looks like HTML: ${isHtml}) ---`);
      console.log(text.slice(0, 800) + (text.length > 800 ? "\n..." : ""));
    } else if (v && typeof v === "object" && "number" in v) {
      const n = (v as { number?: { lo?: number } }).number?.lo;
      console.log(`\n--- ${key} (number): ${n}`);
    } else {
      console.log(`\n--- ${key} (type: ${typeof value}) ---`);
    }
  }

  const htmlOutput = (outputs as Record<string, { text?: string }>).email_html_body?.text;
  if (htmlOutput) {
    const { parseReportTableFromHtml } = await import("../lib/report-line-items");
    const rows = parseReportTableFromHtml(htmlOutput);
    console.log("\n=== Parsed report table from email_html_body ===");
    console.log("Rows extracted:", rows.length);
    if (rows.length > 0) {
      console.log("First row keys:", Object.keys(rows[0]));
      console.log("Sample row:", JSON.stringify(rows[0], null, 2).slice(0, 400));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
