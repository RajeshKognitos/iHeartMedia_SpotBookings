# Design System — Spot Bookings (iHeartMedia)

## Brand

**iHeartMedia brand colors** (from brand.iheart.com):

| Token   | Hex       | Use                    |
|--------|-----------|------------------------|
| Primary | `#C6002B` | Links, buttons, charts |
| Dark    | `#111820` | Text, headings        |
| Gray    | `#919395` | Muted text, borders   |

Theme tokens in `app/globals.css`: `--color-primary`, `--color-foreground`, `--color-muted-foreground`, `--color-border`, `--color-chart-1`, `--color-chart-2`, `--color-destructive`. All UI uses these; no hardcoded hex.

## Audience

- **Executives** — traffic at a glance, placement rate, conflicts count.
- **Process managers** — line-level report, exceptions, job detail, resolve in Kognitos.

## Token source

- **Theme:** `app/globals.css` — `@theme` block + `:root` for Recharts (raw HSL).
- **Tailwind:** Semantic utilities only (`bg-primary`, `text-muted-foreground`, `border-border`, etc.).

## Layout & navigation

- **Sidebar:** Always open; order: Traffic dashboard → Line items → Exceptions → Chat. Footer: “Powered by Kognitos”.
- **Main:** Full-height scroll; pages use `p-6 space-y-6`; sections use `rounded-lg border border-border bg-card p-4`.

## Components

- **Cards:** `rounded-lg border border-border bg-card p-4`.
- **Tables:** `w-full text-sm`, header `bg-muted/30`, row hover `hover:bg-muted/20`.
- **Status badges:** Completed = green tint, Needs decision = amber, Failed = destructive.
- **ErrorState** (`components/ErrorState.tsx`): Title, message, optional back link. Use for failed loads and not-found.
- **Empty states:** Bordered card, muted text, optional CTA; no shared component.

## Charts (Recharts)

- Bar/line colors: `hsl(var(--chart-1))`, `hsl(var(--chart-2))`, `hsl(var(--destructive))`.
- Grid: `stroke-muted`; tooltips default.

## Rules

- No hardcoded colors; use semantic tokens only.
- Domain language everywhere: Broadcast day, Spots placed, Placement rate, Conflicts, Needs decision.
- “View in Kognitos” / “Resolve in Kognitos” for deep links; open in new tab.
