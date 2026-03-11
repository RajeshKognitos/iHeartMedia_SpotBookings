import { NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/cache-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/cache?key=home-30d
 * Returns cached data and last_synced_at from DB. 404 if no cache.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.length > 128) {
    return NextResponse.json({ error: "Missing or invalid key" }, { status: 400 });
  }
  try {
    const row = await getCache(key);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      data: row.data,
      last_synced_at: row.last_synced_at,
    });
  } catch (e) {
    console.error("[api/cache GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cache read failed" },
      { status: 500 }
    );
  }
}
