/**
 * Types and helpers for scheduling job (run) data.
 * Domain: Run = "Scheduling job"; statuses mapped to UI labels.
 */

export type RunStatus =
  | "completed"
  | "awaiting_guidance"
  | "failed"
  | "pending"
  | "executing";

/** Exception type labels for UI (from DECISION_VARIABLE_* in run outputs) */
export const EXCEPTION_TYPE_LABELS = {
  b2b: "Back-to-back conflict",
  overfill: "Capacity overfill",
  separation: "Competitive separation",
} as const;

export type ExceptionTypeKey = keyof typeof EXCEPTION_TYPE_LABELS;

export interface RunOutputs {
  total_scheduled?: number;
  success_rate?: number;
  spots_loaded?: number;
  stations_loaded?: number;
  email_status?: string;
  /** Resolved exception types in this run (from DECISION_VARIABLE_* not AWAITING_HUMAN_DECISION) */
  exception_types?: string[];
}

export interface RunSummary {
  id: string;
  createTime: string;
  status: RunStatus;
  kognitosUrl: string;
  outputs?: RunOutputs;
  /** For awaiting_guidance: run has an exception waiting; type may be unknown until astral is fetched */
  has_exception?: boolean;
  /** One-line hint for run list (awaiting_guidance / failed) */
  exception_summary?: string;
}

export interface ExceptionDetailItem {
  type: string;
  display_text?: string;
  resolution: string;
}

/** Human-readable resolution for A/B/C/D by exception type */
const RESOLUTION_LABELS: Record<string, Record<string, string>> = {
  [EXCEPTION_TYPE_LABELS.b2b]: {
    A: "Reschedule to next break (same station)",
    B: "Move to different station (same time)",
    C: "Reschedule to previous break (same station)",
    D: "Skip spot (rollover to next day)",
  },
  [EXCEPTION_TYPE_LABELS.overfill]: {
    A: "Reschedule to next break (same station)",
    B: "Move to different station (same time)",
    C: "Reschedule to previous break (same station)",
    D: "Skip spot (rollover to next day)",
  },
  [EXCEPTION_TYPE_LABELS.separation]: {
    A: "Move to different station (same time)",
    B: "Reschedule to later time (+2 hr, same station)",
    C: "Reschedule to earlier time (-2 hr, same station)",
    D: "Skip spot (rollover to next day)",
  },
};

export interface RunDetail extends RunSummary {
  /** Last Resolution Agent message (for awaiting_guidance) */
  astralMessage?: string | null;
  /** Exception details with display text and resolution (for run detail page) */
  exception_details?: ExceptionDetailItem[];
}

function runIdFromName(name: string): string {
  return name.split("/").pop() ?? "";
}

function getStatus(state: Record<string, unknown> | undefined): RunStatus {
  if (!state) return "pending";
  if (state.completed != null) return "completed";
  if (state.awaiting_guidance != null) return "awaiting_guidance";
  if (state.failed != null) return "failed";
  if (state.executing != null) return "executing";
  return "pending";
}

function getDecisionValue(outputs: Record<string, unknown>, key: string): string | undefined {
  const v = outputs[key];
  if (v && typeof v === "object" && "text" in v)
    return (v as { text?: string }).text;
  return undefined;
}

function parseOutputs(outputs: Record<string, unknown> | undefined): RunOutputs | undefined {
  if (!outputs) return undefined;
  const getNum = (key: string): number | undefined => {
    const v = outputs[key];
    if (v && typeof v === "object" && "number" in v) {
      const n = (v as { number?: { lo?: number } }).number?.lo;
      return typeof n === "number" ? n : undefined;
    }
    return undefined;
  };
  const getText = (key: string): string | undefined => {
    const v = outputs[key];
    if (v && typeof v === "object" && "text" in v)
      return (v as { text?: string }).text;
    return undefined;
  };
  const exception_types: string[] = [];
  const AWAITING = "AWAITING_HUMAN_DECISION";
  if (getDecisionValue(outputs, "DECISION_VARIABLE_resolution_choice") !== AWAITING)
    exception_types.push(EXCEPTION_TYPE_LABELS.b2b);
  if (getDecisionValue(outputs, "DECISION_VARIABLE_overfill_resolution") !== AWAITING)
    exception_types.push(EXCEPTION_TYPE_LABELS.overfill);
  if (getDecisionValue(outputs, "DECISION_VARIABLE_separation_resolution") !== AWAITING)
    exception_types.push(EXCEPTION_TYPE_LABELS.separation);

  return {
    total_scheduled: getNum("total_scheduled"),
    success_rate: getNum("success_rate"),
    spots_loaded: getNum("spots_loaded"),
    stations_loaded: getNum("stations_loaded"),
    email_status: getText("email_status"),
    ...(exception_types.length > 0 && { exception_types }),
  };
}

export function normalizeRun(
  raw: { name?: string; create_time?: string; state?: Record<string, unknown> },
  kognitosUrl: string
): RunSummary {
  const id = runIdFromName(raw.name ?? "");
  const status = getStatus(raw.state);
  const outputs =
    status === "completed" && raw.state?.completed && typeof raw.state.completed === "object"
      ? parseOutputs((raw.state.completed as { outputs?: Record<string, unknown> }).outputs)
      : undefined;
  const has_exception = status === "awaiting_guidance" || (outputs?.exception_types?.length ?? 0) > 0;
  let exception_summary: string | undefined;
  if (raw.state?.awaiting_guidance != null && typeof raw.state.awaiting_guidance === "object") {
    const ag = raw.state.awaiting_guidance as { exception?: string; description?: string };
    exception_summary = ag.description ?? ag.exception ?? "Needs decision";
  } else if (raw.state?.failed != null && typeof raw.state.failed === "object") {
    const f = raw.state.failed as { error?: string; description?: string };
    exception_summary = f.description ?? f.error ?? "Failed";
  }
  return {
    id,
    createTime: raw.create_time ?? "",
    status,
    kognitosUrl,
    outputs,
    ...(has_exception && { has_exception: true }),
    ...(exception_summary && { exception_summary }),
  };
}

export function statusLabel(status: RunStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "awaiting_guidance":
      return "Needs decision";
    case "failed":
      return "Failed";
    case "executing":
      return "In progress";
    default:
      return "Pending";
  }
}

const AWAITING = "AWAITING_HUMAN_DECISION";

function getText(outputs: Record<string, unknown>, key: string): string | undefined {
  const v = outputs[key];
  if (v && typeof v === "object" && "text" in v)
    return (v as { text?: string }).text;
  return undefined;
}

/**
 * Build exception details from raw run (completed outputs) for the run detail page.
 */
export function getExceptionDetailsFromRun(raw: {
  state?: Record<string, unknown>;
}): ExceptionDetailItem[] {
  const completed = raw.state?.completed;
  if (!completed || typeof completed !== "object") return [];
  const outputs = (completed as { outputs?: Record<string, unknown> }).outputs;
  if (!outputs || typeof outputs !== "object") return [];

  const items: ExceptionDetailItem[] = [];
  const b2bVal = getDecisionValue(outputs, "DECISION_VARIABLE_resolution_choice");
  const b2bText = getText(outputs, "EXCEPTION_B2B_CONFLICT");
  const overfillVal = getDecisionValue(outputs, "DECISION_VARIABLE_overfill_resolution");
  const overfillText = getText(outputs, "EXCEPTION_OVERFILL");
  const sepVal = getDecisionValue(outputs, "DECISION_VARIABLE_separation_resolution");
  const sepText = getText(outputs, "EXCEPTION_SEPARATION");

  if (b2bVal != null || b2bText) {
    items.push({
      type: EXCEPTION_TYPE_LABELS.b2b,
      display_text: b2bText,
      resolution:
        b2bVal == null || b2bVal === AWAITING
          ? "Awaiting resolution"
          : `${b2bVal}: ${RESOLUTION_LABELS[EXCEPTION_TYPE_LABELS.b2b]?.[b2bVal] ?? b2bVal}`,
    });
  }
  if (overfillVal != null || overfillText) {
    items.push({
      type: EXCEPTION_TYPE_LABELS.overfill,
      display_text: overfillText,
      resolution:
        overfillVal == null || overfillVal === AWAITING
          ? "Awaiting resolution"
          : `${overfillVal}: ${RESOLUTION_LABELS[EXCEPTION_TYPE_LABELS.overfill]?.[overfillVal] ?? overfillVal}`,
    });
  }
  if (sepVal != null || sepText) {
    items.push({
      type: EXCEPTION_TYPE_LABELS.separation,
      display_text: sepText,
      resolution:
        sepVal == null || sepVal === AWAITING
          ? "Awaiting resolution"
          : `${sepVal}: ${RESOLUTION_LABELS[EXCEPTION_TYPE_LABELS.separation]?.[sepVal] ?? sepVal}`,
    });
  }
  return items;
}
