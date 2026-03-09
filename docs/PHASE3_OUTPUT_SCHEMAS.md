# Phase 3: Run Output Schemas — Radio Traffic Scheduling

## Summary

- **No table outputs.** The automation uses only scalar/text outputs (and one null). Traffic logs and reports are sent via email; they are not exposed as Arrow IPC tables in the run API.
- **Completed runs** expose metrics and exception display text in `state.completed.outputs`.
- **Awaiting-guidance runs** expose `state.awaiting_guidance` with exception reference and description; Resolution Agent (astral) events provide human-readable messages and options.

---

## Completed run: `state.completed.outputs`

| Output key | Type | Description / Use in app |
|------------|------|---------------------------|
| `stations_loaded` | number | Count of active stations loaded from Stations.csv |
| `spots_loaded` | number | Total spot requests from Spots.csv |
| `config_parameters` | number | Config rows applied (e.g. break capacity, separation) |
| `total_scheduled` | number | **Hero:** Spots successfully placed in the schedule |
| `success_rate` | number | **Hero:** Scheduling success % (0–100) |
| `csv_outputs_generated` | number | Number of report CSVs (e.g. 3) |
| `email_status` | text | e.g. "Email sent successfully to …" |
| `email_send_result` | null | Outlook send result (often null) |
| `EXCEPTION_B2B_CONFLICT` | text | Formatted exception text (back-to-back conflict) — for display if present |
| `EXCEPTION_OVERFILL` | text | Formatted exception text (capacity overfill) |
| `EXCEPTION_SEPARATION` | text | Formatted exception text (separation rule) |
| `DECISION_VARIABLE_resolution_choice` | text | "AWAITING_HUMAN_DECISION" or user choice (A/B/C/D) |
| `DECISION_VARIABLE_overfill_resolution` | text | Same |
| `DECISION_VARIABLE_separation_resolution` | text | Same |

**For the dashboard:** Prefer `total_scheduled`, `success_rate`, `stations_loaded`, `spots_loaded`, `email_status`. Use `EXCEPTION_*` and `DECISION_VARIABLE_*` only for run-detail or review context; they can be long/formatted text.

---

## Awaiting-guidance run: `state.awaiting_guidance`

```json
{
  "exception": "organizations/…/exceptions/{EXCEPTION_ID}",
  "description": "assertion failed",
  "location": { "start_byte": "…", "end_byte": "…" }
}
```

- **exception:** Full resource path to the exception (for linking or Resolution Agent).
- **description:** Short reason (e.g. "assertion failed" = waiting for human decision).
- **location:** Code location of the assert.

**Resolution Agent (astral) events:** `GET .../runs/{RUN_ID}/agents/astral/events?page_size=100`  
- Events can include `agent_message.content` (human-readable summary and options A/B/C/D) and `thinking.content` (context). Use these to show “what needs a decision” in a review queue.

---

## Tables

**None.** No `table.inline.data` (Arrow IPC) in run outputs. Traffic log, exception report, and break utilization are delivered by email, not as API table outputs.

---

## Suggested app usage

- **Dashboard hero stats:** `total_scheduled`, `success_rate`, run count by status.
- **Run list:** Run ID, create_time, status (completed / needs decision / failed), and for completed runs: `total_scheduled`, `success_rate`.
- **Run detail:** All scalar outputs; show `EXCEPTION_*` and `DECISION_VARIABLE_*` only when relevant (e.g. needs decision or post-resolution context).
- **Review queue (needs decision):** Runs with `awaiting_guidance`; optionally fetch astral events and show `agent_message.content` (and link “Open in Kognitos” to resolve).
