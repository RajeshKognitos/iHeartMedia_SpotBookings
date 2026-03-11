import { supabaseAdmin } from "@/lib/supabase";
import { TABLES } from "@/lib/supabase";

export interface CacheRow {
  key: string;
  data: unknown;
  last_synced_at: string;
}

export async function getCache(key: string): Promise<CacheRow | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from(TABLES.data_cache)
    .select("key, data, last_synced_at")
    .eq("key", key)
    .single();
  if (error || !data) return null;
  return {
    key: data.key,
    data: data.data as unknown,
    last_synced_at: data.last_synced_at,
  };
}

export async function setCache(key: string, data: unknown): Promise<{ last_synced_at: string }> {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const last_synced_at = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from(TABLES.data_cache)
    .upsert({ key, data: data as Record<string, unknown>, last_synced_at }, { onConflict: "key" });
  if (error) throw new Error(`Cache write failed: ${error.message}`);
  return { last_synced_at };
}
