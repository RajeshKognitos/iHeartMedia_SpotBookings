"use client";

import { statusLabel, type RunStatus } from "@/lib/runs";

const STATUS_STYLES: Record<RunStatus, string> = {
  completed: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
  awaiting_guidance: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  executing: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30",
  pending: "bg-muted text-muted-foreground border-border",
};

interface StatusBadgeProps {
  status: RunStatus;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}
