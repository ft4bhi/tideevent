# 06 — API Contract (Django REST Framework, `/api/v1`, 2026-10-16)

**Status:** proposed — Django backend does not exist yet. Replaces the Flask
revision entirely. Frontend keeps working on mocks; integration is incremental
per `11-django-backend-plan.md`. New endpoints must be documented here first.

Base URL: `{NEXT_PUBLIC_API_BASE_URL}` e.g. `http://localhost:8000/api/v1` (trailing
slashes per DRF router conventions; frontend client normalizes).
Auth: DRF `SessionAuthentication` — sessionid cookie (`HttpOnly`, `SameSite=Lax`,
`Secure` in prod) + `csrftoken` cookie; mutating requests send
`X-CSRFToken: <csrftoken>` (frontend `client.ts` change, planned). CORS:
allowlist the Next origin with `CORS_ALLOW_CREDENTIALS=True`. No tokens in
localStorage. IDs: UUIDs. Times: ISO-8601 UTC. Pagination: `?page=&per_page=`
(default 20) → `{ data, meta: { total, page, per_page } }` (keeps frontend `Paged`
shape). Errors: `{ "error": { "code": "SNAKE_CODE", "message": "Human readable",
"fields"?: {…} } }` via a custom DRF exception handler.
**Session-auth note:** DRF coerces anonymous 401 → 403 (no `WWW-Authenticate`
header), so unauthenticated requests receive **403 `FORBIDDEN`** ("Authentication
credentials were not provided"). Clients treat 401/403 as login-required.

## Auth (`/auth/`)
| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /auth/register` | public | `{ name, email, password }` — role NOT accepted | 201 `{ user }` + session (auto-login, preserves current UX) | 422 validation, 409 `EMAIL_EXISTS` (role field → 422 `ROLE_NOT_ALLOWED`) |
| `POST /auth/login` | public | `{ email, password }` | 200 `{ user }` + cookies | 400 `INVALID_CREDENTIALS`, 403 `ACCOUNT_SUSPENDED` |
| `POST /auth/logout` | session | — | 204/200, clears cookie | — |
| `GET /auth/me` | optional session | — | 200 `{ user }` or `{ user: null }` (unchanged guard behavior) | — |

`User`: `{ id, name, email, role, status, created_at }` — never password data.
Rate-limit login + invitation endpoints (e.g. AnonRateThrottle 10/min).

## Organizer invitations
| Method & path | Auth | Notes |
|---|---|---|
| `POST /admin/invitations` | admin | `{ email }` → 201 invitation `{ id, email, status, expires_at, email_sent }`; revokes prior PENDING for email; send failure keeps PENDING + `email_sent:false` |
| `GET /admin/invitations` | admin | `?status=` filter, paginated |
| `POST /admin/invitations/:id/resend` | admin | rotates to a fresh token (old link dies), re-sends; 200 `{ email_sent }` (non-PENDING → 410) |
| `POST /admin/invitations/:id/revoke` | admin | PENDING → REVOKED |
| `GET /invitations/validate?token=` | public | 200 `{ email, expires_at, valid }` / 404 `INVITATION_INVALID`, 410 `INVITATION_EXPIRED`/`INVITATION_USED`; expired/used/revoked reported as 200 `{ valid: false, code, message }` |
| `POST /invitations/accept` | optional session | `{ token, name?, password }` → atomic consume (`select_for_update` + conditional update); creates ORGANIZER or upgrades logged-in matching ATTENDEE; anonymous + existing email → 409 `INVITATION_LOGIN_REQUIRED`; logged-in different email → 403 `INVITATION_EMAIL_MISMATCH`; consumed → 410 `INVITATION_USED`; revoked → 410 `INVITATION_REVOKED`; never ADMIN |

## Public events
| Method & path | Notes |
|---|---|
| `GET /events` | ACTIVE + upcoming only; `q?, category?, city?, date?/preset?, page?, per_page?`; includes `starting_price_inr`, `remaining`, `sold_out`, `booking_mode` |
| `GET /events/:id` | ACTIVE public; SUSPENDED/CANCELLED → owner sees with status banner, admin sees, others 404 `EVENT_NOT_FOUND`; includes full inventory (sections/rows/seats with `booked` flags, or ticket types with `remaining`) |

## Organizer (`/organizer/`, role ORGANIZER/ADMIN, owners only)
| Method & path | Notes |
|---|---|
| `GET /organizer/events` | own events, paginated |
| `POST /organizer/events` | metadata + `booking_mode` + inventory (nested `sections`/`ticket_types`, or `template_id` for RS); creates **ACTIVE** immediately; 201 |
| `PATCH /organizer/events/:id` | partial metadata (+ full inventory replacement while unlocked); mode/inventory locked per `05` after bookings (`INVENTORY_LOCKED`/`MODE_IMMUTABLE` 409); `status` rejected (admin-managed); 403 `NOT_EVENT_OWNER` |
| Inventory | `POST /organizer/events/:id/sections` (bulk replace, empty clears), `/organizer/sections/:id/rows` (bulk replace), `/organizer/events/:id/ticket-types` (bulk replace), `POST /organizer/events/:id/layout { template_id }` (RS, empty layout only) + `GET` layout |
| `GET /organizer/events/:id/bookings` | own event only; bookings with seats/lines + attendee info (B2 returns the empty envelope; populated in B3) |

## Attendee bookings
| Method & path | Notes |
|---|---|
| `POST /events/:id/bookings` | `{ seats: [seat_ids] }` (RS) or `{ items: [{ ticket_type_id, quantity 1–10 }] }` (GA); transactional; 201 `{ booking }`; 409 `EVENT_SOLD_OUT` / `SEAT_UNAVAILABLE` / `TICKETS_UNAVAILABLE`, 403 `EVENT_UNAVAILABLE` (suspended/cancelled) or `FORBIDDEN` (anonymous), 404 |
| `GET /bookings/me` | own, paginated, with event summary + seats/lines |
| `GET /bookings/:id` | owner / own-event organizer / admin; else 403 `BOOKING_FORBIDDEN`, 404 |
| `POST /bookings/:id/cancel` | own CONFIRMED booking before `starts_at` → CANCELLED + inventory released; else 409 `BOOKING_NOT_CANCELLABLE` |

## Admin
| Method & path | Notes |
|---|---|
| `GET /admin/events?status=` | all events, filter ACTIVE/SUSPENDED/CANCELLED, paginated |
| `PATCH /admin/events/:id/suspend` | `{ reason }` (required) → SUSPENDED; bookings preserved |
| `PATCH /admin/events/:id/reactivate` | SUSPENDED → ACTIVE (cancelled → 409 `EVENT_TERMINAL`) |
| `PATCH /admin/events/:id/cancel` | `{ reason }` (required) → CANCELLED (terminal) |
| `GET /admin/users?q=` / `PATCH /admin/users/:id` | list/search; `{ status }` toggle (self-suspend blocked) |
| `GET /admin/bookings` | all, paginated, with seats/lines |

## Validation rules (DRF serializers; Zod mirrors updated in frontend phase)
- email RFC-valid ≤254, stored lowercase, unique; password ≥8 (Django validators +
  zxcvbn-style minimum via `MinimumLengthValidator`; Argon2/bcrypt hasher — default
  PBKDF2 acceptable, note hasher choice in backend README).
- event title 3–120; description 10–5000; `starts_at` future on create, tz-aware;
  poster valid http(s) if present; GA `capacity` 1–100000; RS ≥1 sellable seat;
  prices ≥0 ints; reason ≥10 chars for suspend/cancel; GA quantity 1–10/line.
