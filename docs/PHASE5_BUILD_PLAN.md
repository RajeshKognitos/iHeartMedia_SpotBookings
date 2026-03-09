# Phase 5: Build Plan — Radio Traffic Scheduling Dashboard

## Tech stack (fixed)

- **Next.js** App Router, **TypeScript**, **Tailwind CSS**, **Vercel**
- **Charting:** Recharts (already in package.json)
- **UI:** Lattice UI (already in use: ThemeProvider, SidebarProvider, SidebarInset, chat components)
- **API:** Server-side only; `req()` from `lib/kognitos.ts`; no tokens in client

---

## Domain language (confirmed)

| API / internal | UI / domain term |
|----------------|-------------------|
| Run | **Scheduling job** |
| completed | **Completed** |
| awaiting_guidance | **Needs decision** |
| failed | **Failed** |
| pending / executing | **In progress** |
| Run ID | **Job ID** (short for display; full ID for links) |

---

## Pages and views

| Page | Route | Purpose |
|------|--------|---------|
| **Dashboard** | `/` (home) | Hero stats, status distribution, needs-decision + failed lists, optional trend |
| **Run detail** | `/jobs/[id]` | Single scheduling job: metrics, status, exception summary, "View in Kognitos" |
| **Review queue** | `/review` or Dashboard section | Jobs needing decision: list + astral message + "Resolve in Kognitos" (can be a section on Dashboard instead of separate page) |
| **Chat** | `/chat` | Existing; keep; update suggestions + system prompt for "scheduling jobs" |

**Decision:** Review queue = **section on Dashboard** ("Needs decision" + "Failed" lists with links). No separate `/review` page unless you prefer it later.

---

## Per-view: data, API, interactions

### 1. Dashboard (`/`)

- **Data shown:**  
  - Hero: total scheduling jobs (count), total spots scheduled (sum over completed), overall success rate (avg or aggregate).  
  - Chart: jobs by status (Completed / Needs decision / Failed) — donut or bar.  
  - Optional: runs per day (bar) and/or success rate over time (line).  
  - Lists: "Needs decision" (run id, date, link to Kognitos), "Failed" (same).  
  - Optional: recent jobs table (id, date, status, total_scheduled, success_rate) with link to run detail.
- **API calls:**  
  - `GET /api/runs` (server route) → calls Kognitos `.../runs?pageSize=50` (or 100), returns normalized list with status, create_time, and for completed runs: total_scheduled, success_rate, spots_loaded.  
  - All in one fetch; no client-side Kognitos calls.
- **Interactions:**  
  - Click job row/card → navigate to `/jobs/[id]`.  
  - "Open in Kognitos" / "Resolve in Kognitos" → open `kognitosUrl` in new tab (`target="_blank"`).  
  - Optional: filter by status, date range (client-side or query param).

### 2. Run detail (`/jobs/[id]`)

- **Data shown:**  
  - Job ID, status (Completed / Needs decision / Failed), create time.  
  - If completed: total_scheduled, success_rate, spots_loaded, stations_loaded, email_status.  
  - If needs decision: short exception description + astral `agent_message.content` (what to decide + options) + "Resolve in Kognitos".  
  - If failed: exception/error description + "View in Kognitos".  
  - Optional: show last EXCEPTION_* or DECISION_VARIABLE_* only when relevant (e.g. needs decision); keep text truncated or in expandable block.
- **API calls:**  
  - `GET /api/runs/[id]` → Kognitos run detail; returns normalized run + `kognitosUrl`.  
  - If status is awaiting_guidance: `GET /api/runs/[id]/astral-events` → Kognitos `.../runs/{id}/agents/astral/events?page_size=100`; return last `agent_message.content` (or first from end) for display.
- **Interactions:**  
  - "View in Kognitos" / "Resolve in Kognitos" → open `kognitosUrl` in new tab.  
  - Back to Dashboard (sidebar or link).

### 3. Chat (`/chat`)

- **Data shown:** Existing chat UI; conversation history in sidebar.  
- **API:** Existing `POST /api/chat`; tools already call Kognitos list_runs, get_run, get_automation.  
- **Customization (Phase 6):**  
  - Update system prompt (scheduling jobs, total_scheduled, success_rate, needs decision, failed).  
  - Update tool descriptions to domain language ("scheduling jobs", "job detail").  
  - Update SUGGESTIONS in chat page to scheduling-specific questions.  
  - Optionally add tool for "list runs needing decision" (filter list_runs result server-side).

---

## Data flow

### API layer (server)

- **`/api/runs`** (GET)  
  - Calls `req(\`/organizations/${ORG_ID}/workspaces/${WORKSPACE_ID}/automations/${AUTOMATION_ID}/runs?pageSize=50\`)`.  
  - Normalizes each run: `id` (from name), `createTime`, `status` (completed | awaiting_guidance | failed | pending | executing), `outputs` (for completed: total_scheduled, success_rate, spots_loaded, stations_loaded, email_status).  
  - Adds `kognitosUrl` via `kognitosRunUrl(runId)` (server-only; client never sees env).  
  - Returns `{ runs: RunSummary[] }`.  
  - No Arrow decoding (no table outputs).

- **`/api/runs/[id]`** (GET)  
  - Fetches run by id; normalizes state + outputs; adds `kognitosUrl`.  
  - Returns single run object for detail page.

- **`/api/runs/[id]/astral-events`** (GET)  
  - Fetches `.../runs/{id}/agents/astral/events?page_size=100`.  
  - Finds latest event with `agent_message.content`; returns `{ message: string }` or `{ message: null }`.  
  - Used only when run status is awaiting_guidance.

### Transform layer

- **Normalize run state:** Map `state.completed` → `status: "completed"`, `state.awaiting_guidance` → `"awaiting_guidance"`, `state.failed` → `"failed"`, else `"pending"` or `"executing"`.  
- **Normalize outputs:** From `state.completed.outputs` read number (`.number.lo`), text (`.text`); expose as `total_scheduled`, `success_rate`, etc.  
- **kognitosUrl:** Built in API with `kognitosRunUrl(runId)`; include in every run response so client can link out without env.

### UI layer

- Dashboard and run detail are Server Components or Client Components as needed; data fetched via fetch to `/api/runs` and `/api/runs/[id]` (or server component direct call to same logic).  
- Use Lattice components (Title, Text, Button, Card, etc.) and design tokens; Recharts for donut/bar/line.  
- Domain labels in UI: "Scheduling job", "Needs decision", "Completed", "Failed", "View in Kognitos", "Resolve in Kognitos".

---

## Navigation and layout

- **Sidebar:** Add `AppSidebar` (or equivalent) inside `SidebarProvider` in `app/layout.tsx`.  
  - Nav items: **Dashboard** (`/`), **Chat** (`/chat`).  
  - Below nav: **Conversations** (chat sessions) — reuse existing chat context pattern.  
  - Footer: "Powered by Kognitos" or similar.  
- **Content:** `SidebarInset` wraps `{children}`; each page renders in main content area.  
- Run detail is reached by link from Dashboard (no sidebar entry required).

---

## Edge cases

| Case | Handling |
|------|----------|
| No runs | Dashboard: hero numbers 0; empty lists; "No scheduling jobs yet" message. |
| No completed runs | Total spots scheduled = 0; success rate show "—" or "N/A"; status chart still shows other statuses. |
| No runs needing decision | "Needs decision" section empty; "All clear" or hide section. |
| No failed runs | "Failed" section empty or hide. |
| API error (Kognitos 4xx/5xx) | API route returns 5xx; Dashboard / run detail show error state with retry or message. |
| Run not found (invalid id) | `/api/runs/[id]` returns 404; run detail page shows "Job not found" + link back to Dashboard. |
| Loading | Skeleton or spinner for Dashboard and run detail while fetching. |
| Astral events empty for awaiting run | Run detail still shows "Needs decision" and "Resolve in Kognitos"; message area shows "No details" or omit message block. |

---

## File checklist (Phase 6)

- **API:** `app/api/runs/route.ts`, `app/api/runs/[id]/route.ts`, `app/api/runs/[id]/astral-events/route.ts`.  
- **Pages:** `app/page.tsx` (Dashboard), `app/jobs/[id]/page.tsx` (Run detail); `app/chat/page.tsx` (existing; update suggestions + copy).  
- **Layout / nav:** Add sidebar component with Dashboard + Chat + Conversations; ensure layout uses it.  
- **Types:** Shared types for RunSummary, RunDetail (id, status, createTime, outputs, kognitosUrl).  
- **Chat:** Update system prompt, tool descriptions, and SUGGESTIONS for scheduling domain.  
- **Design:** Use Lattice tokens; no hardcoded colors; Recharts with token-based colors.

---

## Build order (Phase 6)

1. API layer: `/api/runs`, `/api/runs/[id]`, `/api/runs/[id]/astral-events`.  
2. Types and normalization helpers (run state + outputs).  
3. Layout: sidebar with Dashboard + Chat + Conversations.  
4. Dashboard: hero stats, status chart, needs-decision + failed lists, optional recent jobs table.  
5. Run detail page: metrics, status, exception/astral message, Kognitos link.  
6. Empty, loading, error states.  
7. Chat: system prompt, tools, suggestions.  
8. Polish: responsive layout, transitions.

---

## Gate

This is the exact plan we will build in Phase 6. Confirm: **Ready to go, or any changes?**
