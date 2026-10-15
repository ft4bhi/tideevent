# TideEvent — Online Event Booking & Management (MVP)

College industry project. Event discovery + booking inspired by the *experience* of
District.in (search → filter → details → book → ticket). No payments: booking reserves a seat.

## Repo layout

```
tideevent/
  specs/                 # 00–10: overview, requirements, stories, criteria,
                         # architecture, data model, API contract, design system,
                         # implementation plan, test plan, Flask handoff
  frontend/              # Next.js App Router + TypeScript + Tailwind + mock API layer
```

## Quickstart (frontend)

```bash
cd frontend
cp .env.example .env.local   # defaults run fully on mock data
npm install
npm run dev                  # http://localhost:3000
```

Demo accounts (mock mode): attendee `attendee@example.com / attendee123`,
organizer `organizer@example.com / organizer123`, admin `admin@example.com / admin12345`.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npx vitest run               # unit + mock-matrix tests
npx playwright test          # chromium + mobile, needs `npm run dev` (auto-started)
```

## Backend status

No backend yet. The UI talks only to `lib/api/endpoints/*`, which serves typed mock
data while `NEXT_PUBLIC_USE_MOCK=true` (default). Point at Flask later with:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_USE_MOCK=false
```

See `specs/06-api-contract.md` (endpoint contract) and `specs/10-flask-handoff.md`
(what the Flask team must implement, in order).
