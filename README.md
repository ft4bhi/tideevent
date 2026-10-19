# TideEvent — Online Event Booking & Management (MVP)

College industry project. Event discovery + booking inspired by the *experience* of
District.in (search → filter → details → book → ticket). No payments: booking reserves a seat.

## Repo layout

```
tideevent/
  specs/                 # 00–11: overview, requirements, stories, criteria,
                         # architecture, data model, DRF contract, design system,
                         # implementation plan, test plan, Django handoff + backend plan
  frontend/              # Next.js App Router + TypeScript + Tailwind + mock API layer
  backend/               # Django + DRF + PostgreSQL — see specs/11
```

## Quickstart (frontend)

```bash
cd frontend
cp .env.example .env.local   # enables development mock fixtures
npm install
npm run dev                  # http://localhost:3000
```

Mock mode is a development/test opt-in (`NEXT_PUBLIC_USE_MOCK=true`) and is never
available in production builds. Point at the real Django API with
`NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npx vitest run               # unit + mock-matrix tests
npx playwright test          # chromium + mobile, needs `npm run dev` (auto-started)
```

## Backend status

The Django + DRF + PostgreSQL backend lives in `backend/` (see `specs/11-django-backend-plan.md`
for milestone status). The frontend talks only to `lib/api/endpoints/*`. Mock fixtures are
development-only and opt-in via `NEXT_PUBLIC_USE_MOCK=true`; they are disabled by default
and never run in production. To use the real API:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_USE_MOCK=false
```

See `specs/06-api-contract.md` (DRF contract) and `specs/11-django-backend-plan.md`
(backend build plan).
