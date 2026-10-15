# TideEvent frontend

Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind v4. No backend yet:
all data flows through typed functions in `lib/api/endpoints/*`, served by an explicit
mock provider (`lib/api/mock/`) while `NEXT_PUBLIC_USE_MOCK=true`.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

## Verify

```bash
npm run lint && npx tsc --noEmit && npm run build
npx vitest run
npx playwright test            # starts dev server automatically
```

## Structure

- `app/` — routes: `/`, `/events`, `/events/[id]`, `/login`, `/register`,
  `/events/[id]/book`, `/bookings/[id]`, `/my-bookings`, `/organizer/...`, `/admin/...`
- `components/` — `ui/` primitives, `layout/`, `events/`, `bookings/`, `organizer/`,
  `admin/`, `auth/` guards
- `features/auth/` — session context, login/register forms
- `lib/api/` — `client.ts` (base URL, errors), `endpoints/*`, `mock/` provider
- `lib/validation/` — Zod schemas (mirror these in Flask)
- `lib/utils/`, `types/`, `config/`, `e2e/` — Playwright journeys

## Conventions

- Server Components fetch via `lib/api/endpoints/*`; never `fetch` in components.
- Data-fetching server components sit inside `<Suspense>` (required by `cacheComponents`).
- Mock mode is explicit and bannered; HTTP failures are surfaced, never silently mocked.
- See `../specs/` for requirements, contracts, and the Flask handoff.
