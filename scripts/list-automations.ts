import { config } from "dotenv";
import { resolve } from "path";

// Load .env before loading kognitos (which validates env at import time)
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { ORG_ID, WORKSPACE_ID, req } = await import("../lib/kognitos");
  const path = `/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations?pageSize=50`;
  const res = await req(path);
  if (!res.ok) {
    console.error("API error:", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main();
