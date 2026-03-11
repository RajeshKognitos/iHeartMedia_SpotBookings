"use client";

import { timeAgo } from "@/lib/time-ago";

interface RefreshHeaderProps {
  lastSyncedAt: Date | number | null;
  onRefresh: () => void;
  refreshing?: boolean;
  className?: string;
}

export default function RefreshHeader({
  lastSyncedAt,
  onRefresh,
  refreshing = false,
  className = "",
}: RefreshHeaderProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-sm text-muted-foreground">
        Last synced {timeAgo(lastSyncedAt)}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
