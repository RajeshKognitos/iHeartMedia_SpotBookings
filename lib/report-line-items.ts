/**
 * Final report line items: input | exception detail (if any) | output.
 * Sources (tried in order):
 * 1. Table output: set_output("final_report", value=...) in automation.
 * 2. Email HTML: set_output("report_email_html", value=email_body) — we parse the table from the HTML.
 */

import * as cheerio from "cheerio";
import { decodeArrowTable } from "@/lib/arrow";

/** Output key for the final report table (set_output("final_report", value=...) in automation). */
export const FINAL_REPORT_OUTPUT_KEY = "final_report";

/** Output keys for email HTML containing the report table (automation may use either). */
export const REPORT_EMAIL_HTML_OUTPUT_KEYS = ["email_html_body", "report_email_html"] as const;

export interface ReportLineItem {
  /** Run ID this line came from (before dedupe) */
  run_id: string;
  /** Run create time (ISO) */
  create_time: string;
  /** Date only (YYYY-MM-DD) for grouping and dedupe */
  broadcast_day: string;
  /** Input column from report (e.g. Spot ID, Status) */
  input: string;
  /** Exception detail if any */
  exception_detail: string;
  /** Output column from report (e.g. Priority) */
  output: string;
  /** Advertiser / customer name (from Advertiser column) */
  advertiser?: string;
  /** Revenue in dollars (from S_Value column) */
  revenue?: number;
  /** First run ID we kept for this (day, line) after dedupe */
  source_run_id?: string;
}

const INPUT_KEYS = ["input"];
const EXCEPTION_KEYS = ["exception_detail", "exception detail", "exceptiondetail"];
const OUTPUT_KEYS = ["output"];
const ADVERTISER_KEYS = ["advertiser"];
const S_VALUE_KEYS = ["s_value", "s value"];

function pickColumn(row: Record<string, unknown>, keys: string[]): string {
  const lower = (k: string) => k.toLowerCase().replace(/\s+/g, "_");
  for (const key of keys) {
    for (const [k, v] of Object.entries(row)) {
      if (lower(k) === lower(key) && v != null) return String(v);
    }
  }
  // Fallback: first column that looks like it (by name substring)
  for (const [k, v] of Object.entries(row)) {
    if (v != null && typeof v === "string") {
      if (k.toLowerCase().includes("input")) return v;
      if (k.toLowerCase().includes("exception")) return v;
      if (k.toLowerCase().includes("output")) return v;
    }
  }
  return "";
}

function pickRevenue(row: Record<string, unknown>): number | undefined {
  const lower = (k: string) => k.toLowerCase().replace(/\s+/g, "_");
  for (const key of S_VALUE_KEYS) {
    for (const [k, v] of Object.entries(row)) {
      if (lower(k) === lower(key) && v != null) {
        const s = String(v).replace(/[$,\s]/g, "");
        const n = parseFloat(s);
        if (!Number.isNaN(n)) return n;
        return undefined;
      }
    }
  }
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase().includes("value") && v != null) {
      const s = String(v).replace(/[$,\s]/g, "");
      const n = parseFloat(s);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function normalizeRow(
  row: Record<string, unknown>,
  runId: string,
  createTime: string
): ReportLineItem {
  const broadcast_day =
    createTime.slice(0, 10) ||
    new Date(createTime).toISOString().slice(0, 10);
  const advertiser = pickColumn(row, ADVERTISER_KEYS) || undefined;
  const revenue = pickRevenue(row);
  return {
    run_id: runId,
    create_time: createTime,
    broadcast_day,
    input: pickColumn(row, INPUT_KEYS),
    exception_detail: pickColumn(row, EXCEPTION_KEYS),
    output: pickColumn(row, OUTPUT_KEYS),
    ...(advertiser && { advertiser }),
    ...(revenue != null && { revenue }),
  };
}

/** Normalize header text for column mapping (lowercase, collapse spaces). */
function normHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, "_").trim();
}

type ParsedColumn = "input" | "exception_detail" | "output" | "advertiser" | "revenue";

/** Map header index to our column type. */
function headerToColumn(normalized: string): ParsedColumn | null {
  if (normalized === "input" || normalized.includes("input") || normalized === "spot_id") return "input";
  if (normalized === "advertiser") return "advertiser";
  if (normalized === "s_value" || normalized === "svalue") return "revenue";
  if (
    normalized === "exception_detail" ||
    normalized === "exceptiondetail" ||
    normalized.includes("exception")
  )
    return "exception_detail";
  if (normalized === "output" || normalized.includes("output") || normalized === "priority") return "output";
  return null;
}

/** True if this row looks like a header row. */
function looksLikeHeaderRow(row: Record<string, string>): boolean {
  const i = (row.input ?? "").trim().toLowerCase();
  const e = (row.exception_detail ?? "").trim().toLowerCase();
  const o = (row.output ?? "").trim().toLowerCase();
  return (
    ((i === "spot id" || i === "spot_id") && e === "advertiser" && (o === "priority" || o === "status")) ||
    (i === "status" && (e === "exception type" || e === "exception_type") && o === "priority")
  );
}

/**
 * Extract the report table from email HTML.
 * Looks for a table in a section with "report" or "output" in class/id, or the first table with a thead.
 * Returns rows as { input, exception_detail, output } keyed by column mapping from header row.
 */
export function parseReportTableFromHtml(html: string): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  if (!html || typeof html !== "string") return rows;
  try {
    const $ = cheerio.load(html);
    // Prefer table inside a section that looks like the report (class/id containing "report" or "output")
    let $tables = $('[class*="report"], [id*="report"], [class*="output"], [id*="output"] table');
    if ($tables.length === 0) $tables = $("table");
    const $table = $tables.first();
    if ($tables.length === 0 || !$table.length) return rows;

    const $headerCells = $table.find("thead tr:first th, thead tr:first td, tr:first th, tr:first td");
    const headers: string[] = [];
    $headerCells.each((_, el) => {
      headers.push(normHeader($(el).text()));
    });
    const colMap: ParsedColumn[] = headers.map((h) => {
      const c = headerToColumn(h);
      return c ?? "input";
    });
    const usePositional =
      !headers.some((h) => headerToColumn(h) === "input") &&
      !headers.some((h) => headerToColumn(h) === "output");
    const $bodyRows = $table.find("tbody tr");
    const $dataRows =
      $bodyRows.length > 0 ? $bodyRows : $table.find("tr").slice(1);
    $dataRows.each((_, tr) => {
      const cells: string[] = [];
      $(tr)
        .find("td, th")
        .each((__, cell) => {
          cells.push($(cell).text().trim());
        });
      if (cells.length === 0) return;
      const row: Record<string, string | number> = { input: "", exception_detail: "", output: "" };
      if (usePositional) {
        row.input = cells[0] ?? "";
        row.exception_detail = cells[1] ?? "";
        row.output = cells[2] ?? "";
        if (cells[3] != null) row.advertiser = cells[3];
        if (cells[4] != null) {
          const n = parseFloat(String(cells[4]).replace(/[$,\s]/g, ""));
          if (!Number.isNaN(n)) row.revenue = n;
        }
      } else {
        colMap.forEach((col, i) => {
          const val = cells[i] ?? "";
          if (col === "revenue") {
            const n = parseFloat(String(val).replace(/[$,\s]/g, ""));
            if (!Number.isNaN(n)) row.revenue = n;
          } else {
            row[col] = val;
          }
        });
      }
      rows.push(row);
    });
    return rows.filter((row) => !looksLikeHeaderRow(row as Record<string, string>));
  } catch {
    // ignore parse errors
  }
  return rows;
}

function getTextOutput(outputs: Record<string, unknown>, key: string): string | undefined {
  const v = outputs[key];
  if (v && typeof v === "object" && "text" in v) return (v as { text?: string }).text;
  return undefined;
}

/**
 * Extract report line items from a completed run's outputs.
 * Tries (1) final_report table (Arrow), then (2) report_email_html (email HTML with the output table).
 */
export function getReportLineItemsFromRun(raw: {
  name?: string;
  create_time?: string;
  state?: Record<string, unknown>;
}): ReportLineItem[] {
  const completed = raw.state?.completed;
  if (!completed || typeof completed !== "object") return [];
  const outputs = (completed as { outputs?: Record<string, unknown> }).outputs;
  if (!outputs || typeof outputs !== "object") return [];

  const runId = (raw.name ?? "").split("/").pop() ?? "";
  const createTime = raw.create_time ?? "";

  // 1. Try Arrow table output
  const tableOutput = outputs[FINAL_REPORT_OUTPUT_KEY];
  if (tableOutput && typeof tableOutput === "object") {
    const b64 = (tableOutput as { table?: { inline?: { data?: string } } }).table?.inline?.data;
    if (b64 && typeof b64 === "string") {
      try {
        const rows = decodeArrowTable(b64);
        return rows.map((row) => normalizeRow(row as Record<string, unknown>, runId, createTime));
      } catch {
        // fall through to HTML
      }
    }
  }

  // 2. Try email HTML output (table in a specific section)
  let html: string | undefined;
  for (const key of REPORT_EMAIL_HTML_OUTPUT_KEYS) {
    html = getTextOutput(outputs, key);
    if (html) break;
  }
  if (html) {
    const parsed = parseReportTableFromHtml(html);
    return parsed.map((row) => {
      const revenue = typeof row.revenue === "number" ? row.revenue : undefined;
      const advertiser = typeof row.advertiser === "string" && row.advertiser ? row.advertiser : undefined;
      return {
        run_id: runId,
        create_time: createTime,
        broadcast_day: createTime.slice(0, 10) || new Date(createTime).toISOString().slice(0, 10),
        input: String(row.input ?? ""),
        exception_detail: String(row.exception_detail ?? ""),
        output: String(row.output ?? ""),
        ...(advertiser && { advertiser }),
        ...(revenue != null && { revenue }),
      };
    });
  }

  return [];
}

/**
 * Dedupe line items by (broadcast_day, content): keep one row per unique line per day.
 * When multiple runs for the same day have the same line, keep the first occurrence (by create_time).
 */
export function dedupeLineItemsByDay(items: ReportLineItem[]): ReportLineItem[] {
  const seen = new Map<string, ReportLineItem>();
  const key = (item: ReportLineItem) =>
    `${item.broadcast_day}\t${item.input}\t${item.exception_detail}\t${item.output}\t${item.advertiser ?? ""}\t${item.revenue ?? ""}`;

  const sorted = [...items].sort(
    (a, b) => a.create_time.localeCompare(b.create_time)
  );
  for (const item of sorted) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.set(k, { ...item, source_run_id: item.run_id });
    }
  }
  return Array.from(seen.values());
}
