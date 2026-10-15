# 07 — UI Design System

District.in is an **experience reference** (discover → details → book), not a visual copy. Original TideEvent branding.

## 1. Tokens
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#F8F8F5` warm white | page background |
| `--ink` | `#202B3C` deep navy | primary text/headings |
| `--accent` | `#B95F43` muted terracotta | primary buttons, active states |
| `--accent-hover` | `#A9553B` | hover; also meets AA for small white text |
| `--surface` | `#FFFFFF` | cards, nav, dialogs |
| `--border` | `#E7E7E2` | borders, dividers |
| `--muted` | `#687386` | secondary text |
| Font | Geist (already in scaffold) | headings + body; mono for ticket IDs |

Rules: subtle borders over shadows; no gradients; generous whitespace; one primary action per step; Lucide icons only (no emojis).

## 2. Layout primitives
- `Container`: max-w-6xl, px-4→8 responsive.
- `Navbar`: brand mark + Explore / My Bookings (authed) / Organizer / Admin (role-gated) + Search shortcut + Login/Avatar menu; mobile hamburger; sticky, white/translucent, bottom-border.
- `Footer`: brand, category links, college-project note ("Demo — no payments").
- `PageHeader`: title + subtitle + optional action (e.g. Create Event).

## 3. Components (add to `components/ui/` only as needed)
`Button` (primary terracotta / secondary outline / ghost / destructive), `Input`, `Select`, `Textarea`, `DateInput`, `Card`, `Badge` (status: APPROVED green / PENDING amber / REJECTED red / CONFIRMED navy / SOLD OUT slate; category + Free/₹), `Skeleton`, `EmptyState` (icon + title + copy + action), `Alert` (error/success/info), `Dialog` (reject-reason, confirm booking), `Table` → stacked cards on mobile, `Avatar`, `Tabs` (admin/organizer lists), `FormField` (label + error binding for RHF).

## 4. Domain components
- `EventCard`: 4:3 poster (`next/image`), category badge, title (2-line clamp), date + venue rows with icons, footer price + availability; full-width tap → details.
- `EventGrid`: responsive 1/2/3 cols; skeletons while loading.
- `EventFilters`: search input + category chips + city select + date presets + native date; reflects URL params.
- `EventDetails`: 2-col desktop (poster | info + sticky booking panel), stacked mobile; availability bar; organizer row; Book Now / Sold out / Under review states.
- `TicketCard`: dashed divider, mono ticket ID, status badge, event meta, attendee; print-friendly; mock-mode "Demonstration data" ribbon.

## 5. Page states (every API page)
loading (skeletons) · loaded · empty (`EmptyState`) · validation (inline) · 401 (login prompt w/ `next`) · 403 (forbidden card) · 404 (not-found) · 500/network (`Alert` + retry) · success (confirmation) · disabled/sold-out (disabled button + reason). Never blank screens or fake success.

## 6. Accessibility & responsive
Semantic landmarks; `label` per input; `aria-live` for toasts/status; focus-visible rings in accent; contrast: body ink on warm-white (AAA), muted for secondary only (≥14px), buttons use accent-hover for small text. Breakpoints: 360 (1 col) / 768 (2 col, hamburger→full nav at lg) / 1024 (3 col, 2-col details). Tables → definition-list cards <640px. Tap targets ≥44px primary.

## 7. Imagery
Remote poster URLs (Unsplash source / picsum) allowlisted in `next.config.ts` `images.remotePatterns`; fallback placeholder block with category icon if URL missing/broken. No District assets.
