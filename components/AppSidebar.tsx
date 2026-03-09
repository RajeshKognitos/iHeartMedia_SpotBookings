"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChatContext } from "@/lib/chat/chat-context";

export default function AppSidebar() {
  const pathname = usePathname();
  const { sessions, activeSessionId, setActiveSessionId } = useChatContext();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="p-4 border-b border-border">
        <Link href="/" className="font-semibold text-foreground hover:text-primary transition-colors">
          Spot Bookings
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">Traffic &amp; ad placement</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        <Link
          href="/"
          className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          Traffic dashboard
        </Link>
        <Link
          href="/line-items"
          className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/line-items"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          Line items
        </Link>
        <Link
          href="/exceptions"
          className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/exceptions"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          Exceptions
        </Link>
        <Link
          href="/chat"
          className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/chat"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          Chat
        </Link>
      </nav>
      {sessions.length > 0 && (
        <div className="border-t border-border px-2 py-3">
          <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">Conversations</p>
          <div className="space-y-0.5">
            {sessions.slice(0, 10).map((s) => (
              <Link
                key={s.id}
                href="/chat"
                onClick={() => setActiveSessionId(s.id)}
                className={`block rounded-md px-3 py-1.5 text-sm truncate ${
                  activeSessionId === s.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {s.title || "New conversation"}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-border p-3">
        <p className="text-xs text-muted-foreground">Powered by Kognitos</p>
      </div>
    </aside>
  );
}
