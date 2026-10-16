# 03 — Acceptance Criteria

Each AC lists **Given / When / Then** plus the spec test in `09-test-plan.md`.

- AC-01 Home discovery: Given the home page, when it loads, then search input, location select, date presets, ≤6 featured active events, category links, and an Explore CTA are visible; featured cards link to `/events/[id]`.
- AC-02 Explore filters: Given `/events` with seeded active events across categories/cities/dates, when filtering by keyword/category/location/date, then only matching active upcoming events show; no-match shows empty state with reset; loading shows skeletons; API failure shows error with retry.
- AC-03 Event details: Given an active event, when viewing `/events/[id]`, then poster, title, category, date/time, venue, description, organizer, availability, and price display render plus the mode UI (seat map or ticket-type selector); Book action enabled iff ACTIVE + inventory remains; sold-out shows disabled state; suspended/cancelled shows unavailable state for non-owners.
- AC-04 Guest booking gate: Given a guest clicking the book action, when unauthenticated, then redirect to `/login?next=/events/[id]/book`; after login, return to the booking page.
- AC-05 Auth: Given `/login` and `/register`, when submitting invalid input, then inline Zod errors show; wrong credentials show readable error; duplicate email shows conflict; register never offers organizer/admin roles; login → `next` or `/`, register auto-logs in.
- AC-06 Booking confirm: Given an authenticated user booking an available event (seats selected or ticket lines chosen), when confirming, then a CONFIRMED booking (`/bookings/[id]`) appears with unique reference + seat/line assignments; double-click does not duplicate; seat-taken races show 409 without a ticket.
- AC-07 Ticket page: Given a confirmed booking, when viewing `/bookings/[id]`, then event details, attendee name, reference, seats/lines, status badge, and nav actions render; no ticket renders on failed booking; cancel action appears while cancellable.
- AC-08 My bookings: Given an attendee with bookings, when viewing `/my-bookings`, then each row shows title/date/venue/reference/status + ticket link; zero bookings shows empty state; another user's booking URL returns 403/404, never their data.
- AC-09 Sold out: Given an event with no remaining inventory, when attempting booking, then the book action is disabled and direct POST yields a readable sold-out error (409), no ticket.
- AC-10 Organizer overview: Given an organizer, when viewing `/organizer`, then total/active/suspended/booking totals for own events are correct.
- AC-11 Create event: Given valid input with a valid mode + inventory, when submitting, then the event is created ACTIVE and appears publicly; invalid input shows inline errors; mode/inventory invalid → 422 with field messages.
- AC-12 Edit locks: Given own event with confirmed bookings, when editing structure (mode, seats, quantities), then blocked with a readable error; metadata edits succeed; editing another organizer's event is forbidden (403).
- AC-13 Organizer bookings: Given own event, when viewing bookings, then attendee rows with seats/lines render; another organizer's event bookings are forbidden.
- AC-14 Unavailable hidden: Given a SUSPENDED/CANCELLED event, when browsing as guest/attendee, then it never appears as bookable and direct details URLs return not-found for non-owners (owners see a status banner, admins see all).
- AC-15 Admin overview: Given an admin, when viewing `/admin`, then user/event/invitation/booking counts render.
- AC-16 Suspend/reactivate/cancel: Given an ACTIVE event, when an admin suspends with a reason, then new bookings are blocked with the reason recorded and existing bookings preserved; reactivate restores booking; cancel is terminal.
- AC-17 Admin users: Given `/admin/users`, when searching, then table filters by name/email; suspend/reinstate toggles status (self-suspend blocked). Non-admins get 403.
- AC-18 Admin bookings: Given `/admin/bookings`, when viewing, then reference/attendee/event/date/status (+ seats/lines) rows render with empty state.
- AC-19 UI states: unchanged (loading/empty/validation/401/403/404/500-retry/success/disabled).
- AC-20 Mobile: unchanged (360px, no overflow, ≥44px targets) + seat map usable by touch, no hover-only affordances.
- AC-21 Invitation accept: Given a valid invitation link, when the recipient sets a password, then they become ORGANIZER (or matching ATTENDEE upgrades on login); expired/used/forged tokens show explicit states; the link works exactly once.
- AC-22 Invitation manage: Given an admin, when inviting/resending/revoking, then status lists update, emails report honest delivery status, and no password material is ever emailed.
