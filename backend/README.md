# TideEvent backend (Django)

Python 3.12 + Django 5.2 LTS + Django REST Framework + PostgreSQL (Neon).
Built in small phases per `../specs/11-django-backend-plan.md` (awaiting approval
for B1+; B0 scaffold only).

## Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # fill in Neon values when available (see below)
```

## Run

```bash
.venv/bin/python manage.py check
.venv/bin/python manage.py migrate     # uses DIRECT_URL when set (see below)
.venv/bin/python manage.py runserver   # http://127.0.0.1:8000/admin/
```

## First administrator (only ADMIN path — no public registration)

```bash
.venv/bin/python manage.py createsuperuser  # prompts email + name + password
```

`createsuperuser` always creates `role=ADMIN` (`is_staff`/`is_superuser` set;
a superuser with any other role is rejected). Django admin login respects
SUSPENDED status. The API never returns password data.

## Auth model (summary)

- Session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` outside DEBUG) + `csrftoken`
  cookie (readable by JS) sent back as `X-CSRFToken` on mutations.
- SPA bootstrap: `GET /api/v1/auth/me` sets the CSRF cookie and returns
  `{user}` or `{user:null}`.
- Public registration creates ATTENDEE only (`role` in payload → 422).
- Suspended accounts: login refused (403 `ACCOUNT_SUSPENDED`); active sessions
  fail permission checks; Django admin login also blocked.
- Anonymous requests get 403 `FORBIDDEN` under session auth (DRF coerces 401).
- Auth endpoints throttled at 10/min per IP.

## Organizer invitations (summary)

Admin creates → token emailed as single-use link
(`{FRONTEND_URL}/invite/accept?token=…`, 7-day expiry). Only the SHA-256 hash is
stored. Accept is atomic (row lock + conditional consume): new emails become
ORGANIZER; existing attendees must log in as the invited email first (no silent
promotion, no ADMIN creation). Failures (expired/used/revoked/invalid) have
explicit codes; email failures report `email_sent:false` with resend/revoke.
Local dev prints mail via the console backend.

## Events & inventory (B2)

Models (`apps/events`): `Event` (ACTIVE/SUSPENDED/CANCELLED, RS/GA modes),
`VenueLayoutTemplate` (5 seeded via data migration), `EventSection/Row/Seat`,
`TicketType`. Valid creations publish ACTIVE immediately — no approval queue.
GA capacity is stored; RS capacity derives from sellable seats.

Key rules: organizers own their events only (`403 NOT_EVENT_OWNER`);
`status` is admin-managed (organizer PATCH with `status` → 422);
suspend/reactivate/cancel are admin-only with required reasons (cancel terminal,
`409 EVENT_TERMINAL`); inventory replacement and mode changes lock once
confirmed bookings exist (always unlocked until B3 adds bookings);
`GET /organizer/events/:id/bookings` returns the empty envelope until B3.

## Database (Neon)

- App traffic: `DATABASE_URL` must be the **pooled** string (`-pooler` hostname),
  `CONN_MAX_AGE=0`, `sslmode=require`. Never add client-side pooling on top.
- Migrations: `DATABASE_URL="$DIRECT_URL" .venv/bin/python manage.py migrate`
  with the **direct** string.
- No `DATABASE_URL`: falls back to local SQLite with a warning (dev/tests only —
  never rely on it for concurrency behavior).
- Credentials live only in `.env` (git-ignored). The password shared earlier in
  chat is treated as exposed: **rotate it in the Neon console before deployment.**

## Tests & lint

```bash
.venv/bin/pytest -q        # 57 tests: accounts, sessions/CSRF, invitations,
                           # concurrency (sqlite) + production-safety subprocess
.venv/bin/ruff check .
```

Notes: invitation concurrency uses threads + retry-on-lock; SQLite validates the
single-consume guarantee, PostgreSQL row-locking gets a dedicated gated test in
milestone B3. Auth throttle is relaxed by fixture except in its own test.

## Layout

- `config/` — settings (single env-driven file), root URLs, wsgi/asgi.
- `apps/accounts/` — custom user + invitations + auth APIs (phase B1).
- `apps/events/` — events, venue templates, sections/rows/seats, ticket types (B2).
- `apps/bookings/` — bookings, seats/lines, cancel, concurrency (B3).
- `tests/` — pytest-django suite (settings checks now; per-app tests per phase).
