# Design System — Spot Bookings Console

## Brand

**Enterprise-grade, high-contrast palette:**

- **Primary:** Charcoal (`hsl(220 18% 18%)`) — most buttons, links, active nav. White text on primary buttons.
- **Accent:** Yellow `#f2ff70` (`--color-accent`) — brand color. Used where it’s readable: primary chart on Home, CTAs with dark text. Always with dark text (`--color-accent-foreground`), never yellow-on-white.
- **Background:** White — page and cards.
- **Text:** Near-black for body; muted gray for secondary.
- **Charts:** Chart-1 = yellow (accent); chart-2 = slate blue.

Theme tokens: `--color-primary`, `--color-accent`, `--color-accent-foreground`, `--color-foreground`, `--color-muted-foreground`, `--color-border`, `--color-chart-1`, `--color-chart-2`, `--color-destructive`. No hardcoded hex.

## Audience

- **Executives** — traffic at a glance, placement rate, conflicts count.
- **Process managers** — line-level report, exceptions, job detail, resolve in Kognitos.

## Token source

- **Theme:** `app/globals.css` — `@theme` block + `:root` for Recharts (raw HSL).
- **Tailwind:** Semantic utilities only (`bg-primary`, `text-muted-foreground`, `border-border`, etc.).

## Layout & navigation

- **Sidebar:** Always open; order: Home → Run job → Exceptions → Customers → Line items → Chat. Footer: “Powered by Kognitos”.
- **Home:** Single scrollable page with period at top and three sections: (A) How we’re doing — hero KPIs, spot bookings by day, run status; (B) What needs action — exception count and preview, “View all → Exceptions”; (C) Customers — count, revenue, top advertisers, “View all → Customers”. Footer links to Line items and Chat.
- **Run job** (`/run`): Execute the scheduling process: top = form (file upload, input URL, optional broadcast date) and "Start job"; bottom = run list with "X runs total", Download CSV, status filter tabs (All / Clear / Needs decision / Failed), pagination, and table with **StatusBadge** pills (Completed, Needs decision, Failed, etc.).
- **Main:** Full-height scroll; pages use `p-6 space-y-6`; sections use `rounded-lg border border-border bg-card p-4`. Exceptions and Customers pages accept `?period=` and sync the period when opened from Home “View all”. `/stats` redirects to `/`.

## Components

- **Cards:** `rounded-lg border border-border bg-card p-4`.
- **Tables:** `w-full text-sm`, header `bg-muted/30`, row hover `hover:bg-muted/20`.
- **StatusBadge** (`components/StatusBadge.tsx`): Pill-style status (Completed = emerald, Needs decision = amber, Failed = destructive, In progress = blue, Pending = muted). Used on Run job table, job detail, and exceptions list.
- **KpiCard** (`components/KpiCard.tsx`): Metric card with optional icon circle and variant (default, warning, destructive). Used on Home for hero KPIs.
- **ErrorState** (`components/ErrorState.tsx`): Title, message, optional back link. Use for failed loads and not-found.
- **Empty states:** Bordered card, muted text, optional CTA; no shared component.

## Charts (Recharts)

- Bar/line colors: `hsl(var(--chart-1))`, `hsl(var(--chart-2))`, `hsl(var(--destructive))`.
- Grid: `stroke-muted`; tooltips default.

## Rules

- No hardcoded colors; use semantic tokens only.
- Domain language everywhere: Broadcast day, Spots placed, Placement rate, Conflicts, Needs decision.
- “View in Kognitos” / “Resolve in Kognitos” for deep links; open in new tab.
