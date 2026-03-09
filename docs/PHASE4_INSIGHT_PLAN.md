# Phase 4: Domain Thinking — Insight Plan

## Audience

- **Primary:** Traffic Manager (SME) — runs scheduling jobs, resolves conflicts in Kognitos, needs to see processing health and what needs their decision.
- **Secondary:** Ops lead — may care about volume and trend (jobs per week, success rate over time).

---

## What each output answers & what action it enables

| Output / data | Question it answers | Action it enables |
|---------------|---------------------|-------------------|
| Run status (completed / needs decision / failed) | Is this job done, stuck, or broken? | Triage: open Kognitos for “needs decision” or failed. |
| `total_scheduled` (per run) | How many spots actually got placed in this job? | Gauge success of a run; compare across runs. |
| `success_rate` (per run) | What % of requested spots were scheduled? | Quick health check per job; spot low-success runs. |
| `spots_loaded` | How many spots were in the request? | Context for success_rate; sense of scale. |
| `stations_loaded` | How many stations in play? | Context only. |
| `email_status` | Did the summary email go out? | Confirm delivery for completed runs. |
| Exception text (EXCEPTION_*), astral `agent_message` | What conflict is blocking the run? What are the options? | Decide in Kognitos (A/B/C/D); understand run detail. |
| Run create_time | When was this job run? | Sort/filter; trend over time. |

---

## Proposed insights (question → source → action → visualization)

### 1. Hero stats — processing health

| # | Question | Source | Action | Visualization |
|---|----------|--------|--------|----------------|
| 1.1 | How many scheduling jobs (runs) are there recently? | Run list, count | None (orientation) | **Number** — e.g. “Scheduling jobs (last 30 days)” or “Total runs” with time scope. |
| 1.2 | How many spots were scheduled in total (across completed runs)? | Sum of `total_scheduled` for completed runs | None (orientation) | **Number** — “Total spots scheduled” (with scope). |
| 1.3 | What’s the overall scheduling success rate? | Completed runs: avg of `success_rate` or (sum total_scheduled / sum spots_loaded) | Spot bad periods | **Number** or **gauge** — “Avg success rate” or aggregate rate. |

### 2. Action items — what needs attention now

| # | Question | Source | Action | Visualization |
|---|----------|--------|--------|----------------|
| 2.1 | Which jobs are waiting on my decision? | Runs with `state.awaiting_guidance` | Open in Kognitos to resolve | **List/cards** — “Needs decision” count + list with run id, date; “Open in Kognitos” link. |
| 2.2 | What exactly do I need to decide? (for one job) | Astral events `agent_message.content` for that run | Read options, then open Kognitos | **Run detail or review queue** — show message + “Resolve in Kognitos”. |
| 2.3 | Which jobs failed? | Runs with `state.failed` | Open in Kognitos to debug | **List** — “Failed” count + list; link to run in Kognitos. |

### 3. Entity-level view — drill into one scheduling job

| # | Question | Source | Action | Visualization |
|---|----------|--------|--------|----------------|
| 3.1 | What happened in this job? | Run detail: outputs (total_scheduled, success_rate, spots_loaded, stations_loaded, email_status); state | Follow up or open in Kognitos | **Run detail page** — metrics, status, optional exception summary, “View in Kognitos”. |
| 3.2 | What conflict blocked this run? (if awaiting_guidance) | Run’s awaiting_guidance + astral agent_message | Resolve in Kognitos | **Same run detail** or review queue card — short message + link. |

### 4. Distribution — where is volume / status?

| # | Question | Source | Action | Visualization |
|---|----------|--------|--------|----------------|
| 4.1 | How are jobs split by status? | Run list by state (completed / awaiting_guidance / failed) | Triage by status | **Donut or bar** — “By status” (e.g. Completed / Needs decision / Failed). |

### 5. Trend over time

| # | Question | Source | Action | Visualization |
|---|----------|--------|--------|----------------|
| 5.1 | Are scheduling jobs steady or spiking? | Run list, group by day/week by create_time | None (awareness) | **Bar or line** — runs per day or per week. |
| 5.2 | Is success rate improving or dropping? | Completed runs: success_rate + create_time | Investigate drops | **Line** — avg or aggregate success rate over time (by day/week). |

### 6. Comparison

| # | Question | Source | Action | Visualization |
|---|----------|--------|--------|----------------|
| 6.1 | Which status has the most runs? | Same as 4.1 | Same as 4.1 | Covered by 4.1. |

---

## What we are NOT adding

- **Charts for the sake of it** — every chart above answers a specific question.
- **Station-level distribution** — we don’t have per-station data in the API (only in email); no “spots by station” chart without new automation outputs.
- **Revenue at risk** — revenue appears only inside exception text, not as a structured field; we could parse later if needed, but not in initial scope.

---

## Summary for build

- **Dashboard:** Hero numbers (total runs, total spots scheduled, avg/overall success rate); status distribution (donut/bar); “Needs decision” and “Failed” lists with links to Kognitos; optional small trend (runs over time, success over time).
- **Run detail:** One page per run — metrics, status, exception summary if any, “View in Kognitos”.
- **Review queue (or section):** Jobs awaiting_guidance with astral message and “Resolve in Kognitos”.
- **Domain language:** Run = “Scheduling job”; completed = “Completed”; awaiting_guidance = “Needs decision”; failed = “Failed”.
