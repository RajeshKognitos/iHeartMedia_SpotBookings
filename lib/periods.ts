/**
 * Period presets for dashboard and stats (7/30/90 days, this month, last month, all).
 */

export const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "All", value: "all" },
] as const;

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

/** Return ISO cutoff (>=) for the period, or null for "all". */
export function periodToCutoff(period: PeriodValue): string | null {
  const now = new Date();
  if (period === "all") return null;
  if (period === "7d") {
    const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString();
  }
  if (period === "30d") {
    const d = new Date(now); d.setDate(d.getDate() - 30); return d.toISOString();
  }
  if (period === "90d") {
    const d = new Date(now); d.setDate(d.getDate() - 90); return d.toISOString();
  }
  if (period === "this_month") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1); return d.toISOString();
  }
  if (period === "last_month") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.toISOString();
  }
  return null;
}

/** For "last_month", also need end: end of last month. So filter create_time >= start && create_time < end. */
export function periodToRange(period: PeriodValue): { start: string; end: string } | null {
  const now = new Date();
  if (period === "all") return null;
  if (period === "7d") {
    const end = new Date(now); end.setDate(end.getDate() + 1);
    const start = new Date(now); start.setDate(start.getDate() - 7);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (period === "30d") {
    const end = new Date(now); end.setDate(end.getDate() + 1);
    const start = new Date(now); start.setDate(start.getDate() - 30);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (period === "90d") {
    const end = new Date(now); end.setDate(end.getDate() + 1);
    const start = new Date(now); start.setDate(start.getDate() - 90);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  return null;
}

/** Single cutoff: include run if create_time >= cutoff. For this_month/last_month we use range in filter. */
export function isRunInPeriod(createTime: string, period: PeriodValue): boolean {
  if (period === "all") return true;
  const range = periodToRange(period);
  if (!range) return true;
  return createTime >= range.start && createTime < range.end;
}
