# 11 — Django Backend Plan (for review; no implementation yet)

Stack: Python 3.12 (system) + Django 5.2 LTS + DRF 3.18 + psycopg 3 + pytest-django,
PostgreSQL on Neon. Versions pinned in `backend/requirements.txt` at B0 and
re-verified then. Small milestones, student-readable diffs, gates per phase.
**Do not start B0 until the owner approves this plan.**

## Decisions needed from the owner (defaults recommended)
| # | Decision | Recommended default | If you disagree |
|---|---|---|---|
| D1 | `is_staff`/`is_superuser` vs business ADMIN | superuser ⇒ ADMIN enforced; `is_staff` auto-synced for ADMINs; permissions check `role`+`status` | — |
| D2 | RS capacity | Derived from sellable seats (no stored column) | store cached count (drift risk) |
| D3 | GA duplicates | Repeat purchases allowed; max 10/request | keep one-active-per-event (breaks multi-order) |
| D4 | Seat holds | None in MVP; races → 409 for loser | hold+expiry system (major scope) |
| D5 | Cancel cutoff | Until event `starts_at` | different window |
| D6 | Suspended/cancelled visibility | Public 404; owners see banner; admins see all | public "unavailable" page |
| D7 | Existing-attendee invites | Policy A: log in as invited email → accept upgrades to ORGANIZER | Policy B: refuse, admin upgrades manually |
| D8 | Admin event-cancel UI | Include now (1 endpoint + status action) | Backend-only, defer UI |
| D9 | Local DB | Neon only (`DATABASE_URL` + `DIRECT_URL`); no docker fallback | add `docker-compose.yml` |
| D10 | Pins | Django~=5.2, DRF~=3.18, psycopg[binary]~=3.3, pytest-django | — |

Silence = defaults adopted.

## Phase B0 — Scaffold + DB wiring [COMPLETE]
Deliverables: `backend/` per `04 §2` (manage.py, single env-driven
`config/settings.py` — chosen over split dev/prod files for student readability;
env branches cover the differences), three empty apps, pytest.ini, `requirements.txt` pinned, `.env.example` (placeholders only),
`README.md` (venv, env, migrate, createsuperuser, test commands), Neon wiring
(pooled `DATABASE_URL` app traffic with `CONN_MAX_AGE=0`; direct `DIRECT_URL` for
migrations; `sslmode=require`), `createsuperuser` smoke path, CI-less local gates.
Files: `backend/**`, `.gitignore` (+= `.env`, `__pycache__/`, `.venv/`).
Migrations: none yet (admin/auth/contenttypes built-ins only).
Tests: `test_settings.py` (env parsing, DB engine, TZ) + `pytest --collect-only`.
Risks: Neon connectivity from owner network (verify with `migrate --check` only;
destructive ops forbidden this milestone).
Acceptance: `python manage.py check`, `migrate` plans cleanly, pytest collects.

## Phase B1 — Accounts, auth, invitations [COMPLETE — approved]
Deliverables: custom User (email login, role/status, mapping D1), session + CSRF
auth endpoints, `me`, invitation model + endpoints + console email, resend/revoke,
Django-admin registration for User/Invitation.
Files: `apps/accounts/{models,serializers,views,urls,permissions,emails}.py`,
`config/urls.py`, `config/settings/*` (auth, CORS, throttles, email).
Migrations: `accounts/0001_initial` (User + Invitation) — **first production
migration; User must be complete before it is created.**
Tests: registration attendee-only; ORGANIZER/ADMIN rejected; login/logout/me;
suspended blocked; invitation hash/expiry/binding/single-use (incl. double-accept
race); existing-email policy; self-suspend blocked; createsuperuser→ADMIN.
Acceptance: all §15 auth/invitation cases green; manual login via DRF browsable API.

## Phase B2 — Events + inventory [COMPLETE — awaiting review]
Delivered as specified, with three small clarifications recorded in `06`:
`template_id` accepted at create time (alternative to hand-built sections);
new `409 EVENT_TERMINAL` code; sections bulk-replace may clear (empty list),
after which `layout` from-template can refill. Locks are bookings-aware and
dormant until B3. Gates green: check, migrate (events 0001+0002), pytest 57,
ruff clean. No frontend changes; no Neon writes (read-only connectivity only).
Original scope (all delivered): Event (ACTIVE default, immediate publish),
Section/Row/Seat, TicketType, VenueLayoutTemplate + 5 seeds (data migration),
layout CRUD + locks, public list/detail with availability payloads, owner/admin
visibility rules. Migrations: `events/0001_initial` (+ template seed).
Tests: ACTIVE-on-create; future-date/tz validation; mode immutability +
inventory locks after bookings; template instantiation; visibility matrix;
invalid layouts.
Acceptance: organizer creates RS + GA events ACTIVE; public sees availability.

## Phase B3 — Bookings + concurrency (highest risk) [COMPLETE — awaiting review]
Delivered: Booking/BookingSeat(partial-unique)/BookingItem models + migration;
atomic RS/GA create with locks, reference retry, cancel + release; organizer
bookings populated; B2 locks live. Gates green: check, migrate, pytest 73 +
3 PG-skipped, ruff clean. PG row-lock proof UNVERIFIED locally (no test DB
available): harness `tests/test_postgres_concurrency.py` runs on
`TEST_POSTGRES_URL` (refuses non-`*_test` targets); owner runbook in README.
No frontend changes; no Neon writes.
Deliverables: Booking/BookingSeat/BookingItem, atomic book endpoints (both modes),
partial-unique active seat, cancel + release, reference generator with retry,
organizer bookings populated (envelope handler + throttles already landed in B1).
Files: `apps/bookings/*`, `tests/test_concurrency.py` (ThreadPoolExecutor races:
last GA tickets → exactly capacity confirms; same seat twice → 1×201 + 1×409).
Migrations: `bookings/0001_initial`.
Tests: full §15 booking list (capacity, duplicates, invalid seats/qty, suspended/
cancelled blocks, cancel release, rollback on IntegrityError, unique refs).
Acceptance: concurrency tests pass ≥5 consecutive runs; no overbooking possible.

## Phase B4 — Admin
Deliverables: event list/filter, suspend/reactivate/cancel with reasons, user
search + status toggle, invitation admin, all-bookings list; Django-admin polish.
Files: `apps/*/admin.py`, admin viewsets, `config/` permission wiring.
Tests: non-admin 403s on every admin route; suspend blocks bookings; cancel
terminal; bookings preserved post-suspend/cancel.
Acceptance: AC-15..AC-18, AC-22 against live API.

## Phase B5 — Frontend retirement (approval queue → lifecycle, attendee-only register)
Deliverables (small PRs, frontend gates stay green): register drops role selector;
`EventStatus` ACTIVE/SUSPENDED/CANCELLED; remove resubmit/approval UI
(organizer edit, admin queue → status actions); suspend/reason UI; `client.ts`
CSRF header; error-code updates; mock provider extended to new lifecycle +
invitations skeleton; Vitest T-07 rewrite; affected E2E updated (E-08/E-09/E-11/E-12
rewritten, rest intact).
Files: `frontend/types/domain.ts`, `lib/api/{client,endpoints/*,mock/*}`,
`lib/validation/*`, organizer/admin components, `e2e/*.spec.ts`, `specs/09 §6`.
Acceptance: tsc/eslint/build/vitest/playwright green on mocks with new model.

## Phase B6 — Frontend booking modes + invitations UI
Deliverables: `SeatMap` + `TicketSelector` + booking confirm per mode;
`LayoutEditor` + template picker (organizer); `/invite/accept` + admin invite panel;
ticket/cancel UI; mock seats/inventory/templates; E-15..E-20 E2E; mobile + keyboard
pass incl. seat buttons.
Acceptance: AC-03/06/07/11/21/22 on mocks; 360px + keyboard verified.

## Phase B7 — Live verification + cutover
Deliverables: seed script parity (same demo accounts/events), Playwright vs Django
(`NEXT_PUBLIC_USE_MOCK=false`), contract mismatches fixed in either layer with spec
updates, deployment notes (env, migrate with `DIRECT_URL`, createsuperuser,
SMTP), final full gates both sides.
Acceptance: 38+ E2E green live; pytest green; migration-from-zero green;
no mock fallback when `USE_MOCK=false`.

## Cross-phase rules
- Migrations are append-only after B1; data migrations for seeds/templates.
- No credentials in code/specs/git; `.env` ignored; rotate the shared Neon password
  before any deployment (already flagged as exposed).
- Every new endpoint documented in `06` first; every behavior change updates
  `01/02/03/05/09` in the same milestone.
- Estimated shape (not promises): B0–B1 small, B2–B3 the bulk, B4–B7 integration-sized.
