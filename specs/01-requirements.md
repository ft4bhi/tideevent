# 01 — Requirements (Django backend revision, 2026-10-16)

Supersedes the Flask/approval-queue revision. Frontend exists and keeps working on
mock data; the Django backend (§4 of master brief) is the new source of authority.
Stale rules (PENDING/APPROVED/REJECTED, public organizer registration, capacity-counter
booking) are struck through in §7 and must not be reintroduced.

## 1. Functional requirements

### FR-1 Public discovery (Guest) — unchanged behavior, new lifecycle
- FR-1.1 `/` home: as before (search, city, date presets, featured ≤6, categories, CTA).
- FR-1.2 `/events`: list **ACTIVE, upcoming events only**; card shows poster, title,
  date/time, venue, starting price (derived minimum) or "Free".
- FR-1.3 `/events/[id]`: as before + booking-mode section (seat map for
  RESERVED_SEATING, ticket-type selector for GENERAL_ADMISSION); Book action enabled
  only when ACTIVE and inventory remains. SUSPENDED/CANCELLED direct URLs → not-found
  for non-owners (owners see status banner, admins see all).
- FR-1.4 Guest booking gate → `/login?next=…` (unchanged).

### FR-2 Auth — attendee-only public registration
- FR-2.1 `/login`: email + password (unchanged UI).
- FR-2.2 `/register`: name + email + password creates **ATTENDEE only**. No role
  selector. Requests for ORGANIZER/ADMIN roles are rejected (422).
- FR-2.3 Session: Django session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in prod)
  + CSRF token for mutating requests; `GET /auth/me` drives nav/guards; logout clears.
- FR-2.4 Errors: invalid credentials (401/400), suspended account (403), validation,
  network failure — all readable, none leaking internals.

### FR-3 Organizer invitations (new)
- FR-3.1 Admin enters an email in `/admin/users` (or invites panel); system creates a
  PENDING invitation (hashed token, 7-day expiry) and emails a single-use link.
- FR-3.2 Recipient opens `/invite/accept?token=…`, sees invitation state
  (valid/expired/used), sets name + password → becomes ORGANIZER. Never creates ADMIN.
- FR-3.3 Existing ATTENDEE invited: no silent promotion. Default policy A — recipient
  logs in as the invited email, then accepts to upgrade ATTENDEE→ORGANIZER (audited).
  Anonymous acceptance for a registered email → 409 with "log in first" guidance.
- FR-3.4 Invitations are single-use and atomic; email failures keep the invitation
  usable and report `email_sent: false` with resend/replace actions. No reusable
  passwords ever emailed.
- FR-3.5 Initial admin via `createsuperuser` only. No public admin registration.

### FR-4 Events — immediate ACTIVE publishing
- FR-4.1 Organizer creates an event with a valid booking configuration → published as
  **ACTIVE immediately**. No approval queue, no PENDING/REJECTED.
- FR-4.2 Create/edit: metadata (title, description, category, starts_at, location,
  city, poster) + booking mode + inventory (layout/sections for RESERVED_SEATING;
  capacity + ticket types for GENERAL_ADMISSION).
- FR-4.3 Ownership: organizers mutate only their own events (backend 403 otherwise).
  Mode immutable once confirmed bookings exist; inventory structure locked after first
  confirmed booking (metadata stays editable).
- FR-4.4 Organizer views bookings for own events (attendee, seats or ticket lines,
  status, timestamps).
- FR-4.5 Statuses: ACTIVE (bookable), SUSPENDED (no new bookings, reason recorded,
  reversible by admin), CANCELLED (no new bookings, terminal). Existing bookings and
  ticket records are preserved in all cases — never deleted.

### FR-5 Booking
- FR-5.1 RESERVED_SEATING: attendee selects individual seats (available/selected/
  booked/accessible states), sees section pricing + live summary, confirms →
  server-validated ticket with seat assignments.
- FR-5.2 GENERAL_ADMISSION: attendee picks ticket type + quantity (1–10 per request),
  sees remaining availability; free tickets consume capacity identically.
- FR-5.3 Confirm → 201 with unique references; failures (sold out, seat taken,
  suspended/cancelled, invalid payload, 401) show readable errors, **no ticket**.
- FR-5.4 `/bookings/[id]`, `/my-bookings`: as before + seat/ticket-line details.
- FR-5.5 Cancellation: attendee cancels own CONFIRMED booking before event start →
  CANCELLED, inventory released (seats freed / capacity returned). No refunds exist.
- FR-5.6 Duplicates: GA repeat purchases allowed (new booking per request); RS seat
  double-book prevented by constraint (409 `SEAT_UNAVAILABLE`). No global
  one-active-booking-per-event rule.

### FR-6 Admin (replaces approval queue)
- FR-6.1 `/admin` overview: users, events by status, bookings, **pending invitations**.
- FR-6.2 `/admin/events`: all events with status filter; suspend (reason required),
  reactivate, cancel; processing/success/error states.
- FR-6.3 `/admin/users`: search, suspend/reinstate accounts, create + resend
  organizer invitations, invitation status list. No public escalation path.
- FR-6.4 `/admin/bookings`: all bookings with ticket/seat info.

## 2. Roles & permissions (backend-enforced; frontend guards are UX only)
| Capability | Guest | Attendee | Organizer | Admin |
|---|---|---|---|---|
| Browse ACTIVE events | ✓ | ✓ | ✓ | ✓ |
| Book (both modes) | — | ✓ | ✓* | — |
| Own bookings + cancel own | — | ✓ | ✓* | — |
| Create/edit own events (+inventory) | — | — | ✓ | — |
| Own event bookings | — | — | ✓ | — |
| Suspend/reactivate/cancel events, manage users, invite organizers | — | — | — | ✓ |
\* Organizers may book as attendees. Django `is_staff`/`is_superuser` map to business
ADMIN per `05-data-model.md` (superuser ⇒ ADMIN enforced; `is_staff` synced for ADMINs).

## 3. Booking integrity (backend, PostgreSQL)
- BI-1. `transaction.atomic` + `select_for_update` on Event (+ TicketType/EventSeat
  rows) for every booking/cancel/accept mutation.
- BI-2. Constraints: partial-unique active seat (`BookingSeat.is_active`), quantity/
  price/capacity checks, one PENDING invitation per email, token-hash unique.
- BI-3. Bookings for SUSPENDED/CANCELLED events rejected; past-start bookings rejected.
- BI-4. Unique booking + ticket references (collision-retry server-side).
- BI-5. No seat-hold/expiry system in MVP (documented limitation: last-seat races
  resolve to 409 for the loser).
- BI-6. Failed operations roll back cleanly; inventory derived from CONFIRMED rows only.

## 4. Data, API, email
- DR-1..DR-4 (frontend boundary, mock switching, UUIDs, error envelope) unchanged,
  except base URL example `http://localhost:8000/api/v1` and error codes per `06`.
- DR-5. Email: console backend locally, real SMTP in deployment; invitation emails
  contain exactly one single-use link; delivery status reported honestly.
- DR-6. Timezone-aware datetimes (UTC storage, IST display); server-side validation
  mirrors Zod rules; pagination (page/per_page, default 20) on all listings.

## 5. Non-functional requirements
- NFR-1..NFR-4 unchanged (responsive, a11y, Server Components, gates).
- NFR-5. Security: Django sessions + CSRF; no long-lived credentials in localStorage;
  invitation tokens hashed (SHA-256) at rest; rate-limit login + invitation endpoints.
- NFR-6. DB: Neon pooled connection for app traffic, direct connection for
  migrations; `CONN_MAX_AGE=0` with the pooler; no client-side pooling on top.
- NFR-7. Backend gates: `pytest` green, `ruff`/`black` (or flake8) clean, `migrate`
  succeeds from zero, createsuperuser bootstrap documented.

## 6. Assumptions / decisions (see `11-django-backend-plan.md` for D1–D8)
- A7'. Admin user actions = search + suspend/reinstate + invitations. No UI role
  escalation; `createsuperuser` is the only ADMIN path.
- A8. Categories/cities unchanged. A10. Date presets unchanged.
- A12. Invitation expiry 7 days; token `secrets.token_urlsafe(32)`, SHA-256 stored.
- A13. GA max 10 tickets per request; cancellation allowed until event start.
- A14. RS capacity derived from sellable seats (not stored); GA capacity stored.
- A15. Venue templates (auditorium, stadium, cinema, conference, custom) generate
  *editable starting layouts*, not fixed venue types.

## 7. Struck-through legacy rules (do not implement)
- ~~PENDING/APPROVED/REJECTED lifecycle, approval queue, resubmit flow.~~
- ~~Public organizer/admin registration or role selector.~~
- ~~Capacity-counter booking (`booked_count`), one-active-booking-per-event.~~
- ~~Flask/SQLAlchemy backend, Flask error codes (`EVENT_NOT_APPROVED`, etc.).~~

## 8. Out of scope (binding, extended)
Payments, refunds, public organizer registration, emailed passwords, approval queues,
CAD-like venue editor, seat holds/expiry, QR/entry scanning, microservices, and all
previous exclusions. Real email *delivery* configuration is required (SMTP settings),
but no marketing/transactional mail beyond invitations.
