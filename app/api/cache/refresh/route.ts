import { NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/cache-db";

export const dynamic = "force-dynamic";

const VALID_PERIODS = ["7d", "30d", "90d", "this_month", "last_month", "all"] as const;

function parseKey(key: string): { type: string; period?: string } | null {
  if (key === "runs") return { type: "runs" };
  if (key.startsWith("home-") && VALID_PERIODS.includes(key.slice(5) as typeof VALID_PERIODS[number]))
    return { type: "home", period: key.slice(5) };
  if (key.startsWith("exceptions-") && VALID_PERIODS.includes(key.slice(11) as typeof VALID_PERIODS[number]))
    return { type: "exceptions", period: key.slice(11) };
  if (key.startsWith("customers-") && VALID_PERIODS.includes(key.slice(10) as typeof VALID_PERIODS[number]))
    return { type: "customers", period: key.slice(10) };
  if (key.startsWith("line_items-") && VALID_PERIODS.includes(key.slice(11) as typeof VALID_PERIODS[number]))
    return { type: "line_items", period: key.slice(11) };
  return null;
}

/**
 * POST /api/cache/refresh
 * Body: { key: "home-30d" | "runs" | "exceptions-30d" | "customers-30d" | "line_items-30d" }
 * Fetches fresh data from our APIs (which call Kognitos), saves to DB, returns { data, last_synced_at }.
 */
export async function POST(request: Request) {
  let body: { key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const key = body.key;
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }
  const parsed = parseKey(key);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  // Build origin from headers so serverless (Vercel) calls the correct host, not an internal URL
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;

  try {
    let data: unknown;

    if (parsed.type === "home" && parsed.period) {
      const [runsRes, itemsRes, customersRes] = await Promise.all([
        fetch(`${origin}/api/runs?period=${parsed.period}`),
        fetch(`${origin}/api/report-line-items?period=${parsed.period}&exceptions_only=true`),
        fetch(`${origin}/api/customer-stats?period=${parsed.period}`),
      ]);
      if (!runsRes.ok) console.warn("[cache/refresh] /api/runs returned", runsRes.status);
      if (!itemsRes.ok) console.warn("[cache/refresh] /api/report-line-items returned", itemsRes.status);
      if (!customersRes.ok) console.warn("[cache/refresh] /api/customer-stats returned", customersRes.status);
      const runsData = runsRes.ok ? (await runsRes.json()) as { runs?: unknown[] } : { runs: [] };
      const itemsData = itemsRes.ok ? (await itemsRes.json()) as { line_items?: unknown[]; run_resolutions?: Record<string, string>; run_exception_details?: Record<string, unknown[]> } : { line_items: [], run_resolutions: {}, run_exception_details: {} };
      const customersData = customersRes.ok ? (await customersRes.json()) as { customers?: unknown[] } : { customers: [] };
      data = {
        runs: runsData.runs ?? [],
        exceptionItems: itemsData.line_items ?? [],
        runResolutions: itemsData.run_resolutions ?? {},
        runExceptionDetails: itemsData.run_exception_details ?? {},
        customers: customersData.customers ?? [],
        period: parsed.period,
      };
    } else if (parsed.type === "runs") {
      const res = await fetch(`${origin}/api/runs?period=all`);
      const runsData = res.ok ? (await res.json()) as { runs?: unknown[] } : { runs: [] };
      data = { runs: runsData.runs ?? [] };
    } else if (parsed.type === "exceptions" && parsed.period) {
      const res = await fetch(`${origin}/api/report-line-items?period=${parsed.period}&exceptions_only=true`);
      const itemsData = res.ok ? (await res.json()) as { line_items?: unknown[]; run_resolutions?: Record<string, string>; run_exception_details?: Record<string, unknown[]> } : { line_items: [], run_resolutions: {}, run_exception_details: {} };
      data = {
        lineItems: itemsData.line_items ?? [],
        runResolutions: itemsData.run_resolutions ?? {},
        runExceptionDetails: itemsData.run_exception_details ?? {},
      };
    } else if (parsed.type === "customers" && parsed.period) {
      const res = await fetch(`${origin}/api/customer-stats?period=${parsed.period}`);
      const customersData = res.ok ? (await res.json()) as { customers?: unknown[] } : { customers: [] };
      data = { customers: customersData.customers ?? [] };
    } else if (parsed.type === "line_items" && parsed.period) {
      const res = await fetch(`${origin}/api/report-line-items?period=${parsed.period}`);
      const itemsData = res.ok ? (await res.json()) as { line_items?: unknown[]; total?: number } : { line_items: [], total: 0 };
      data = {
        lineItems: itemsData.line_items ?? [],
        total: itemsData.total ?? 0,
      };
    } else {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const last_synced_at = new Date().toISOString();
    // Only persist non-empty data so we don't cache "no data" (e.g. after a failed Kognitos fetch)
    const d = data as { runs?: unknown[]; exceptionItems?: unknown[]; customers?: unknown[] };
    const isEmpty =
      (parsed.type === "home" &&
        (d.runs?.length ?? 0) === 0 &&
        (d.exceptionItems?.length ?? 0) === 0 &&
        (d.customers?.length ?? 0) === 0) ||
      (parsed.type === "runs" && (d.runs?.length ?? 0) === 0);
    try {
      if (!isEmpty) await setCache(key, data);
    } catch {
      // Supabase not configured or table missing: still return data
    }
    return NextResponse.json({ data, last_synced_at });
  } catch (e) {
    console.error("[api/cache/refresh]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
