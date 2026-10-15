# 04 — Architecture

## 1. Guiding decisions (simplest viable)
- Next.js App Router stays the **frontend only**. No Next.js API routes as permanent backend, no Node DB. A `lib/api/` service boundary isolates all data access so Flask can replace the mock without touching pages.
- Server Components by default for listing/details; Client Components only for interactivity (forms, filters, booking confirm, admin actions).
- Auth state via a lightweight session context fed by `GET /auth/me`; cookie-based session (Flask `HttpOnly`, `SameSite=Lax`) — no localStorage tokens. Mock mode simulates the same shape in memory.
- Forms: React Hook Form + Zod (to be installed). Validation schemas live in `lib/validation/`, shared by client UX and (documented for) Flask.

## 2. Directory structure (target; create only as needed)
```
frontend/
  app/
    (public)/page.tsx            # /
    (public)/events/page.tsx     # /events
    (public)/events/[id]/page.tsx
    (public)/login/page.tsx
    (public)/register/page.tsx
    (attendee)/events/[id]/book/page.tsx
    (attendee)/bookings/[id]/page.tsx
    (attendee)/my-bookings/page.tsx
    (organizer)/organizer/page.tsx
    (organizer)/organizer/events/page.tsx
    (organizer)/organizer/events/new/page.tsx
    (organizer)/organizer/events/[id]/edit/page.tsx
    (organizer)/organizer/events/[id]/bookings/page.tsx
    (admin)/admin/page.tsx
    (admin)/admin/events/page.tsx
    (admin)/admin/users/page.tsx
    (admin)/admin/bookings/page.tsx
    layout.tsx  error.tsx  not-found.tsx  loading.tsx
  src/  (preferred; else repo-root aliases — DECISION NEEDED, default: introduce `src/` in Milestone M1)
    components/ui/        # button, input, card, badge, skeleton, dialog, table, empty-state, alert
    components/layout/    # navbar, footer, container, route-guard
    components/events/    # event-card, event-grid, event-filters, event-details
    components/bookings/  # booking-summary, ticket-card, booking-status
    components/forms/     # form-field, shared controls
    features/{auth,events,bookings,organizer,admin}/  # hooks + types per domain
    lib/api/              # client.ts, errors.ts, endpoints/{auth,events,bookings,organizer,admin}.ts, mock/ provider
    lib/validation/       # auth.ts, event.ts schemas (zod)
    lib/utils/            # format.ts (dates, INR), cn.ts
    types/                # domain.ts (User, Event, Booking)
    config/               # site.ts (categories, cities, env flags)
```
Route groups `(public)` etc. share layouts/guards without affecting URLs. **Decision recorded (M1 review, defaults approved): keep root-level folders (`app/`, `components/`, `lib/`, `types/`, `config/`, `features/`) — no `src/` migration.** Rationale: `@/*` already maps to repo root and the scaffold lives at root; migration adds risk with zero MVP benefit.

## 3. Data-access boundary
```
Page/Component → features/*/hooks → lib/api/endpoints/* → client.ts → (HTTP Flask | mock provider)
```
- `client.ts`: base URL from `NEXT_PUBLIC_API_BASE_URL`, JSON parse, status → typed `ApiError { code, message, status }`.
- Endpoint modules expose typed functions, e.g. `listEvents(params): Promise<EventList>` — never raw `fetch` in components.
- `mock/` implements the same function signatures over seeded in-memory data + simulated latency/errors; selected by `NEXT_PUBLIC_USE_MOCK !== 'false'`. Explicit banner in mock mode. **No silent fallback**: HTTP errors propagate to error states. Mock session persists tab-scoped in `sessionStorage` (demo-only, survives reloads); production auth uses HttpOnly cookies per `06-api-contract.md`.
- Guards: `requireUser()` / `requireRole()` helpers run server-side (cookie read when backend live; mock session in dev) + client `RouteGuard` for UX.

## 4. Rendering & state
- `page.tsx` (Server) fetches via service → passes to client islands (`EventFilters`, `BookingConfirm`, `ApprovalActions`).
- URL search params are the filter source of truth on `/events` (shareable links).
- No global store library; React state + context suffice for MVP.

## 5. Config & env
- `NEXT_PUBLIC_API_BASE_URL` (required when mock off), `NEXT_PUBLIC_USE_MOCK` (`true` default in dev), `NEXT_PUBLIC_MOCK_LABEL=true` (shows demo badge).
- `.env.example` documents `http://localhost:5000/api/v1`.

## 6. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Next 16 `cacheComponents` caching stale lists | `cache: 'no-store'` on user-scoped fetches; explicit `revalidate` tags documented per endpoint |
| Auth cookie vs mock divergence | Identical `Session` type + `me()` shape in both providers; contract test in `09-test-plan.md` |
| Over-abstracting empty folders | Create files only when a feature needs them (M-plan enforces) |
| shadcn/Tailwind v4 setup friction | Install `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `zod`, `react-hook-form`; shadcn components hand-added under `components/ui` (no full CLI init if it conflicts with v4) |
