# TideEvent frontend

Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind v4. All data flows
through typed functions in `lib/api/endpoints/*`. By default those call the Django
REST API; an isolated mock provider (`lib/api/mock/`) serves development fixtures only
when mock mode is explicitly opted into.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

`.env.example` enables development mock fixtures by default so the UI runs without a
backend. Set `NEXT_PUBLIC_USE_MOCK=false` (or remove it) to use the Django API, which
must be running per `../specs/11-django-backend-plan.md`.

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
- `lib/validation/` — Zod schemas (mirror DRF serializer rules)
- `lib/utils/`, `types/`, `config/`, `e2e/` — Playwright journeys

## Conventions

- Server Components fetch via `lib/api/endpoints/*`; never `fetch` in components.
- Data-fetching server components sit inside `<Suspense>` (required by `cacheComponents`).
- Mock mode is opt-in and development/test-only (`NEXT_PUBLIC_USE_MOCK=true`), decided
  solely by `isMockMode()` in `lib/api/client.ts`; it is never available in production.
  HTTP failures are surfaced to the user, never silently replaced with mock data.
- See `../specs/` for requirements, the DRF contract, and the Django backend plan.
