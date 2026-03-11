/**
 * Human-readable "time ago" from a past date (e.g. "2 min ago", "1 hour ago").
 */
export function timeAgo(date: Date | number | null | undefined): string {
  if (date == null) return "Never synced";
  const now = Date.now();
  const ts = typeof date === "number" ? date : date.getTime();
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 0) return "Just now";
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  if (d === 1) return "1 day ago";
  if (d < 7) return `${d} days ago`;
  return "Over a week ago";
}
