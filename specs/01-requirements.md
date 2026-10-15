# 01 — Requirements

## 1. Functional requirements

### FR-1 Public discovery (Guest)
- FR-1.1 `/` home: brand + nav, search input, location select (optional), quick date filters (Today / Tomorrow / This weekend / This week), featured events (≤6 approved), category links, CTA to `/events`.
- FR-1.2 `/events`: search by title/keyword; filters: category, location, date (single day or preset); list **approved, upcoming events only**; card shows poster, title, date/time, venue, starting price (or "Free").
- FR-1.3 `/events/[id]`: poster, title, category, starts_at, venue, description, organizer name, capacity availability (`X of Y left` / Sold out), price label; **Book Now** enabled only when event is approved AND seats remain; otherwise disabled with reason.
- FR-1.4 Guest clicking Book Now → redirected to `/login?next=/events/[id]/book`.

### FR-2 Auth (Attendee / Organizer / Admin share login)
- FR-2.1 `/login`: email + password, Zod validation, loading/error states.
- FR-2.2 `/register`: name + email + password (+ role selector: Attendee | Organizer; Admin is seeded, not self-registered), duplicate-email + invalid-input errors surfaced from API/mock.
- FR-2.3 Session: `GET /auth/me` drives nav state and route guards; logout clears session.
- FR-2.4 Auth errors distinguish: invalid credentials (401), validation (422), network (fetch fail).

### FR-3 Booking (Attendee)
- FR-3.1 `/events/[id]/book` (auth required): compact event summary + attendee info (name/email, read-only) + Confirm Booking button. No payment form.
- FR-3.2 On confirm: `POST /events/:id/bookings` → success shows ticket; failure (sold out 409 / gone 410 / 401) shows readable error and **no ticket**.
- FR-3.3 `/bookings/[id]`: confirmation with event details, attendee name, unique ticket ID, status badge, actions (View my bookings / Explore events). Ticket shown only after confirmed response. In mock mode, page shows "Demonstration data" badge.
- FR-3.4 `/my-bookings` (auth): list of own bookings — event title, date, venue, ticket ID, status; link to ticket; empty state.

### FR-4 Organizer
- FR-4.1 `/organizer` overview: total events, pending count, approved count, total bookings across own events.
- FR-4.2 `/organizer/events`: table of own events — title, date, capacity, booked, status badge, actions (Edit, View bookings). Create Event button → `/organizer/events/new`.
- FR-4.3 `/organizer/events/new`: fields — title, description, category, starts_at (datetime-local), venue/location, capacity (positive int), poster URL (optional), price paise/INR display (optional, display-only). Submit → status PENDING.
- FR-4.4 `/organizer/events/[id]/edit`: owner-only; shows status + rejection reason if REJECTED; allows edit + resubmit (status → PENDING).
- FR-4.5 `/organizer/events/[id]/bookings`: attendee records for own event only (name, ticket ID, status, booked_at).

### FR-5 Admin
- FR-5.1 `/admin` overview: counts — users, events, pending approvals, bookings (compact cards, no analytics widgets).
- FR-5.2 `/admin/events`: pending queue — event details + organizer; Approve / Reject actions; Reject requires reason; processing/success/error states.
- FR-5.3 `/admin/users`: searchable table — name, email, role; admin actions per spec (suspend/reinstate or role display for MVP — see assumption A7).
- FR-5.4 `/admin/bookings`: table — ticket ID, attendee, event, date, status.

## 2. Roles & permissions (frontend enforcement = UX only)
| Capability | Guest | Attendee | Organizer | Admin |
|---|---|---|---|---|
| Browse approved events | ✓ | ✓ | ✓ | ✓ |
| Book available seats | — | ✓ | ✓* | — |
| View own bookings | — | ✓ | ✓* | — |
| Create/edit own events | — | — | ✓ | — |
| View own event bookings | — | — | ✓ | — |
| Approve/reject events | — | — | — | ✓ |
| View/manage users & all bookings | — | — | — | ✓ |

\* Organizers may also book as attendees (simplest model). Backend enforces real ownership/roles; frontend guards are usability only.

## 3. Booking rules (authoritative = backend; frontend mirrors for UX)
- BR-1. Only APPROVED events are bookable.
- BR-2. `booked_count < capacity` required; backend checks transactionally.
- BR-3. One booking per user per event is **allowed multiple times?** Decision: MVP allows one active booking per user per event (second attempt → 409 with readable message). Documented to prevent accidental double-click; idempotency key optional later.
- BR-4. Ticket ID: unique, human-readable (e.g. `TD-XXXXXX`), generated server-side.
- BR-5. `booked_count` displayed is derived/cached; never the capacity authority.

## 4. Data & API readiness
- DR-1. All data access goes through `lib/api/*` typed functions; no `fetch` in components.
- DR-2. Base URL from `NEXT_PUBLIC_API_BASE_URL`; example `http://localhost:5000/api/v1`.
- DR-3. Mock provider implements the same TypeScript interface as the HTTP client; selected by `NEXT_PUBLIC_USE_MOCK=true`. No silent fallback: HTTP failure surfaces as error state.
- DR-4. UUIDs for ids; ISO-8601 timestamps; machine-readable error codes + human messages.

## 5. Non-functional requirements
- NFR-1. Responsive: 360px mobile → desktop, no horizontal overflow.
- NFR-2. Accessibility: semantic HTML, labels, keyboard nav, visible focus, aria for dialogs/status, contrast on terracotta meets AA for large text + button (white on `#B95F43` ≈ 4.0:1 — use 600-weight 16px+ or darken to `#A9553B` for small text; see `07-ui-design-system.md`).
- NFR-3. Performance: Server Components for listing/details; skeletons, no blank screens; images via `next/image`.
- NFR-4. Quality gates: `tsc --noEmit`, `eslint`, `next build` green; Playwright smoke journeys (see `09-test-plan.md`).
- NFR-5. Security posture: no passwords/tokens/roles in localStorage as trust source; backend owns enforcement; document auth strategy in `06-api-contract.md`.

## 6. Assumptions / decisions
- A7. Admin user actions MVP = search + suspend/reinstate (status toggle). No role escalation from UI (seed admins only).
- A8. Categories (fixed enum for MVP): Music, Comedy, Theatre, Workshop, Sports, Food, Tech, Art. Location list: seeded city list (e.g. Mumbai, Pune, Delhi, Bengaluru, Hyderabad, Chennai) — free-text venue + city field, filter by city.
- A9. Price: optional `price_inr` (0 = Free). Display only; no tiers.
- A10. Date filters: presets Today / Tomorrow / This weekend (Sat–Sun) / This week; plus native date input on `/events`.
- A11. Register role selector limited to Attendee/Organizer (simplest); backend may reject `ADMIN` with 422.

## 7. Out of scope (binding)
Payments, refunds, seat maps, QR scanning, ticket tiers, coupons, chat/social, ML recommendations, multi-city inventory sync, dining/movies, microservices, WebSockets, analytics dashboards, real email.
