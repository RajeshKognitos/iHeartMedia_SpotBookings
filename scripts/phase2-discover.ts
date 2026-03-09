import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { req, ORG_ID, WORKSPACE_ID } = await import("../lib/kognitos");
  const AUTO_ID = process.env.KOGNITOS_AUTOMATION_ID;
  if (!AUTO_ID) {
    console.error("KOGNITOS_AUTOMATION_ID not set");
    process.exit(1);
  }

  const base = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTO_ID}`;

  // 1. Get automation details
  const autoRes = await req(base);
  if (!autoRes.ok) {
    console.error("Automation fetch failed:", autoRes.status, await autoRes.text());
    process.exit(1);
  }
  const automation = await autoRes.json();

  // 2. Get runs
  const runsRes = await req(`${base}/runs?pageSize=20`);
  if (!runsRes.ok) {
    console.error("Runs fetch failed:", runsRes.status, await runsRes.text());
    process.exit(1);
  }
  const runsData = await runsRes.json();

  console.log(JSON.stringify({ automation, runs: runsData }, null, 2));
}

main();
