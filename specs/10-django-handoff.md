# 10 — Django Handoff (replaces Flask handoff, 2026-10-16)

The Flask handoff is retired — there is no Flask backend and there will not be one.
This note orients implementers; the build order and gates live in
`specs/11-django-backend-plan.md`.

## Where things stand
- `frontend/` is complete and green on mock data (approval-queue model). It must
  keep passing its gates while integration proceeds incrementally.
- `backend/` does not exist yet. Phase B0 creates it with pinned requirements,
  env handling, and a migration-from-zero check.
- Contract: `specs/06-api-contract.md` (DRF). Models: `specs/05-data-model.md`.

## Build order (detail in `11`)
B0 scaffold + DB wiring → B1 accounts/auth/invitations → B2 events/inventory →
B3 bookings + concurrency → B4 admin → B5 frontend retirement (approval UI,
attendee-only register, CSRF) → B6 frontend booking modes + invitations UI →
B7 live verification (Playwright against Django, mock parity).

## Parity rules for integrators
- Error envelope `{ error: { code, message, fields? } }` with the SNAKE codes in
  `06` — frontend messages key off them; do not invent ad-hoc shapes.
- Keep `Paged { data, meta }` listings and `GET /auth/me → { user: null }`.
- Never trust `booked_count`-style counters from clients; derive from CONFIRMED rows.
- Invitation tokens: hash at rest, single-use, honest `email_sent`.
- Credentials only in environment (pooled `DATABASE_URL`, direct `DIRECT_URL`);
  rotate the previously shared Neon password before any deployment.
