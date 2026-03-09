"use client";

import "./globals.css";
import { ChatProvider } from "@/lib/chat/chat-context";
import AppSidebar from "@/components/AppSidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <ChatProvider>
          <div className="flex h-screen">
            <AppSidebar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </ChatProvider>
      </body>
    </html>
  );
}
