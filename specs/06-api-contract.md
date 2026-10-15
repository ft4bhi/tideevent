# 06 — API Contract (proposed Flask REST, `/api/v1`)

**Status:** proposed — no backend exists yet. Frontend `lib/api/` will be built against this contract with a mock implementing identical types. Any endpoint added during implementation must be documented here first.

Base URL: `{NEXT_PUBLIC_API_BASE_URL}` e.g. `http://localhost:5000/api/v1`.
Auth: backend-managed **HttpOnly session cookie** (`SameSite=Lax`, `Secure` in prod) set on login/register; `GET /auth/me` resolves session. No tokens in localStorage. CSRF: Flask-WTF / double-submit cookie for mutating routes (document final choice before integration).
IDs: UUIDs. Times: ISO-8601 UTC. Errors: `{ "error": { "code": "SNAKE_CODE", "message": "Human readable" } }` with matching HTTP status.

## Auth
| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /auth/register` | public | `{ name, email, password, role: ATTENDEE\|ORGANIZER }` (ADMIN → 422) | 201 `{ user }` + session cookie | 422 validation, 409 `EMAIL_EXISTS` |
| `POST /auth/login` | public | `{ email, password }` | 200 `{ user }` + cookie | 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_SUSPENDED` |
| `POST /auth/logout` | session | — | 204, clears cookie | — |
| `GET /auth/me` | session | — | 200 `{ user }` \| 401 `{ user: null }` pattern (200 with null or 401 — **finalize: 200 + `{user:null}`** to simplify guards) | — |

`User` response: `{ id, name, email, role, status, created_at }` — never `password_hash`.

## Public events
| Method & path | Query/body | Success | Errors |
|---|---|---|---|
| `GET /events` | `q?, category?, city?, date? (YYYY-MM-DD) \| preset=today\|tomorrow\|weekend\|week, page?, per_page?` → only APPROVED + upcoming, ordered by `starts_at` | 200 `{ data: EventItem[], meta: { total, page, per_page } }` | 422 bad filter |
| `GET /events/:id` | — (APPROVED visible publicly; PENDING/REJECTED → 404 for non-owners/non-admins) | 200 `{ data: EventItem }` | 404 `EVENT_NOT_FOUND` |

## Attendee bookings
| Method & path | Auth | Success | Errors |
|---|---|---|---|
| `POST /events/:id/bookings` | attendee/organizer session | 201 `{ data: Booking }` (CONFIRMED + `ticket_id`) | 401, 404 event, 410 `EVENT_NOT_APPROVED`, 409 `EVENT_SOLD_OUT` / `BOOKING_ALREADY_EXISTS`, 403 suspended |
| `GET /bookings/me` | session | 200 `{ data: Booking[] }` (own only, with event summary) | 401 |
| `GET /bookings/:id` | session (owner or admin; organizer only if own event) | 200 `{ data: Booking }` | 401, 403 `BOOKING_FORBIDDEN`, 404 |

## Organizer
| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /organizer/events` | organizer | — | 200 `{ data: EventItem[] }` (own) | 401/403 |
| `POST /organizer/events` | organizer | `{ title, description, category, starts_at, location, city, capacity, poster_url?, price_inr? }` | 201 PENDING event | 422 (incl. past date, bad capacity), 401/403 |
| `PATCH /organizer/events/:id` | organizer **owner** | partial same fields; editing REJECTED → status resets PENDING | 200 updated | 403 `NOT_EVENT_OWNER`, 409 `EVENT_NOT_EDITABLE` (if APPROVED with bookings — finalize: allow edit but stays APPROVED? **decision: APPROVED events editable except date/capacity shrink below booked → 409**) |
| `GET /organizer/events/:id/bookings` | organizer owner | — | 200 `{ data: Booking[] }` with attendee info | 401/403/404 |

## Admin
| Method & path | Auth | Request/Success |
|---|---|---|
| `GET /admin/events` | admin; `?status=PENDING` default | 200 pending list with organizer info |
| `PATCH /admin/events/:id/approval` | admin; `{ action: APPROVE }` or `{ action: REJECT, reason: string(≥10 chars) }` | 200 updated event; reject-without-reason → 422 |
| `GET /admin/users` | admin; `?q?` | 200 `{ data: User[] }` |
| `PATCH /admin/users/:id` | admin; `{ status: ACTIVE\|SUSPENDED }` | 200 updated user |
| `GET /admin/bookings` | admin | 200 `{ data: Booking[] }` (all, with event + attendee) |

## Validation rules (mirror in Zod + Flask)
- email: RFC-valid, ≤254, lowercase compare; password ≥8 chars; name 1–80.
- event title 3–120; description 10–5000; capacity int 1–100000; `starts_at` future; `poster_url` valid http(s) if present; `price_inr` int ≥0; rejection reason ≥10 chars.
- Rate-limit login (e.g. 10/min/IP) — backend concern, noted for completeness.
