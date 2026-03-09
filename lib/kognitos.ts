const TOKEN = process.env.KOGNITOS_TOKEN;
const ORG_ID = process.env.KOGNITOS_ORG_ID;
const WORKSPACE_ID = process.env.KOGNITOS_WORKSPACE_ID;
const BASE_URL = process.env.KOGNITOS_BASE_URL;
const AUTOMATION_ID = process.env.KOGNITOS_AUTOMATION_ID;

const required: Record<string, string | undefined> = {
  KOGNITOS_TOKEN: TOKEN,
  KOGNITOS_ORG_ID: ORG_ID,
  KOGNITOS_WORKSPACE_ID: WORKSPACE_ID,
  KOGNITOS_BASE_URL: BASE_URL,
};

for (const [name, value] of Object.entries(required)) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
}

if (!AUTOMATION_ID) {
  console.warn("KOGNITOS_AUTOMATION_ID not set — some features will be unavailable");
}

export { ORG_ID, WORKSPACE_ID, BASE_URL, AUTOMATION_ID };

export const APP_URL = BASE_URL!.replace("/api/v1", "");

export function kognitosRunUrl(runId: string): string {
  return `${APP_URL}/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs/${runId}`;
}

export async function req(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}
