# Run Execution API (Start scheduling job)

## Endpoint

We use the **Kognitos app API** (same base as existing routes):

- **Start a run:** `POST /organizations/{ORG_ID}/workspaces/{WORKSPACE_ID}/automations/{AUTOMATION_ID}/runs`
- **Auth:** `Authorization: Bearer {KOGNITOS_TOKEN}` (same as GET runs).

## Request body

Runs can carry **user_inputs** (see `RawRun.user_inputs` in `lib/types.ts`). The start-run request body is:

```json
{
  "user_inputs": {
    "<input_name>": { "text": "<value>" },
    ...
  }
}
```

Input names and meaning are defined by the automation (e.g. SharePoint URL, broadcast date). To discover them:

1. **From automation:** `GET /automations/{AUTOMATION_ID}` — check for an `input_schema`, `prompts`, or similar in the response.
2. **From existing runs:** Fetch a run that was started from the Kognitos UI and inspect `user_inputs` keys.

For the Spot Bookings automation (SharePoint + Excel), typical inputs may include a **SharePoint URL** for the source file and optionally a **broadcast date** or similar. The app sends a generic `inputs: Record<string, string>` from the UI and maps them to `user_inputs` in this shape.

## Alternative: REST API

Kognitos also exposes **rest-api.app.kognitos.com** (V1 invoke, V2 runs) with `x-api-key` and different parameters (`agent_id`, `inputs`, `file_ids`). If the app API does not support POST on runs, we would add REST API support and map our `AUTOMATION_ID` to the required identifier (e.g. `agent_id` or `share_id`).

## App routes

- **POST `/api/runs/start`** — Body: `{ inputs?: Record<string, string>; file_ids?: string[] }`. If `file_ids` is provided and REST is configured, calls Kognitos REST `POST /v2/runs` with `agent_id`, `file_ids`, and `inputs`. Otherwise calls app API `POST .../runs` with `user_inputs` from `inputs`. Returns `{ runId, kognitosUrl }` or error.
- **POST `/api/runs/upload`** — Multipart form field `files` (multiple). Requires `KOGNITOS_REST_API_URL` and `KOGNITOS_API_KEY`. Uses REST `POST /v2/files` for presigned URL, uploads to S3, returns `{ file_ids: string[] }`. If REST is not configured, returns 503.
