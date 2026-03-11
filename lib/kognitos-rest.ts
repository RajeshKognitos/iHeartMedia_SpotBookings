/**
 * Kognitos REST API (rest-api.app.kognitos.com) for file upload and starting runs with file_ids.
 * Optional: only used when KOGNITOS_REST_API_URL and KOGNITOS_API_KEY are set.
 */

const REST_BASE = process.env.KOGNITOS_REST_API_URL;
const API_KEY = process.env.KOGNITOS_API_KEY;

export function isRestConfigured(): boolean {
  return Boolean(REST_BASE && API_KEY);
}

export async function restReq(path: string, options: RequestInit = {}): Promise<Response> {
  if (!REST_BASE || !API_KEY) {
    throw new Error("Kognitos REST API not configured (KOGNITOS_REST_API_URL, KOGNITOS_API_KEY)");
  }
  const url = `${REST_BASE.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...options,
    headers: {
      "x-api-key": API_KEY,
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
}

/** Request presigned upload for one file; returns { id, upload_url, upload_fields } */
export async function getPresignedUpload(fileName: string, agentId?: string): Promise<{
  id: string;
  upload_url: string;
  upload_fields: Record<string, string>;
  file_field?: string;
}> {
  const body: { file_name: string; agent_id?: string } = { file_name: fileName };
  if (agentId) body.agent_id = agentId;
  const res = await restReq("/v2/files", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Presigned request failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as {
    id?: string;
    upload_url?: string;
    upload_fields?: Record<string, string>;
    file_field?: string;
  };
  if (!data.id || !data.upload_url || !data.upload_fields) {
    throw new Error("Invalid presigned response: missing id, upload_url, or upload_fields");
  }
  return {
    id: data.id,
    upload_url: data.upload_url,
    upload_fields: data.upload_fields,
    file_field: data.file_field ?? "file",
  };
}

/** Upload file buffer to presigned S3 URL; returns file id (already have it from getPresignedUpload). */
export async function uploadToPresigned(
  uploadUrl: string,
  uploadFields: Record<string, string>,
  file: { name: string; buffer: Buffer },
  fileFieldName: string = "file"
): Promise<void> {
  const form = new FormData();
  for (const [k, v] of Object.entries(uploadFields)) {
    form.append(k, v);
  }
  form.append(fileFieldName, new Blob([file.buffer]), file.name);
  const res = await fetch(uploadUrl, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
}

/** Start a run via REST API with file_ids and optional inputs. Returns { run_id } or similar. */
export async function startRunWithFiles(
  agentId: string,
  fileIds: string[],
  inputs?: Record<string, string>
): Promise<{ runId: string }> {
  const body: { agent_id: string; file_ids: string[]; inputs?: Record<string, unknown> } = {
    agent_id: agentId,
    file_ids: fileIds,
  };
  if (inputs && Object.keys(inputs).length > 0) {
    body.inputs = inputs;
  }
  const res = await restReq("/v2/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Start run failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { run_id?: string; id?: string };
  const runId = data.run_id ?? data.id;
  if (!runId) {
    throw new Error("Start run response missing run_id");
  }
  return { runId: String(runId) };
}
