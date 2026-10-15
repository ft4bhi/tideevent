# 03 — Acceptance Criteria

Each AC lists **Given / When / Then** plus the spec test in `09-test-plan.md`.

- AC-01 Home discovery: Given the home page, when it loads, then search input, location select, date presets, ≤6 featured approved events, category links, and an Explore CTA are visible; featured cards link to `/events/[id]`.
- AC-02 Explore filters: Given `/events` with seeded approved events across categories/cities/dates, when filtering by keyword/category/location/date, then only matching approved upcoming events show; no-match shows empty state with reset; loading shows skeletons; API failure shows error with retry.
- AC-03 Event details: Given an approved event, when viewing `/events/[id]`, then poster, title, category, date/time, venue, description, organizer, availability, and price label render; Book Now enabled iff approved + seats left; full event shows disabled "Sold out".
- AC-04 Guest booking gate: Given a guest clicking Book Now, when unauthenticated, then redirect to `/login?next=/events/[id]/book`; after login, return to the booking page.
- AC-05 Auth: Given `/login` and `/register`, when submitting invalid input, then inline Zod errors show; wrong credentials show 401 message; duplicate email shows conflict message; success redirects (login → `next` or `/`; register → login or auto-login per §6 decision: auto-login).
- AC-06 Booking confirm: Given an authenticated user on `/events/[id]/book` for an available event, when confirming, then a confirmed ticket (`/bookings/[id]`) appears with unique ticket ID; double-click does not create duplicates (button disables while pending).
- AC-07 Ticket page: Given a confirmed booking, when viewing `/bookings/[id]`, then event details, attendee name, ticket ID, CONFIRMED badge, and nav actions render; no ticket renders on failed booking; mock mode shows "Demonstration data" badge.
- AC-08 My bookings: Given an attendee with bookings, when viewing `/my-bookings`, then each row shows title/date/venue/ticket ID/status + ticket link; zero bookings shows empty state; another user's booking URL returns 403/404, never their data.
- AC-09 Full event: Given an event with `booked >= capacity`, when attempting booking, then Book Now is disabled and direct POST yields a readable "sold out" error (409), no ticket.
- AC-10 Organizer overview: Given an organizer, when viewing `/organizer`, then total/pending/approved/booking totals for own events are correct.
- AC-11 Create event: Given valid new-event input, when submitting, then event is created with PENDING status and appears in organizer list (not public); invalid input shows inline errors.
- AC-12 Edit/resubmit: Given own REJECTED event with reason, when editing, then reason is displayed; saving sets status back to PENDING; editing another organizer's event is forbidden (403 + error page).
- AC-13 Organizer bookings: Given own event, when viewing bookings, then attendee rows render; another organizer's event bookings are forbidden.
- AC-14 Pending hidden: Given a PENDING event, when browsing as guest/attendee, then it never appears in `/`, `/events`, search, or booking; a direct details URL returns the not-found page for non-owners (no details, no Book action). Owners/admins see it with an "Under review" state instead.
- AC-15 Admin overview: Given an admin, when viewing `/admin`, then user/event/pending/booking counts render.
- AC-16 Approve/reject: Given a PENDING event in `/admin/events`, when approving, then status → APPROVED and event becomes public; when rejecting without reason, then blocked with validation; with reason, then status → REJECTED + reason stored.
- AC-17 Admin users: Given `/admin/users`, when searching, then table filters by name/email; suspend/reinstate toggles status with success/error feedback. Non-admins get 403.
- AC-18 Admin bookings: Given `/admin/bookings`, when viewing, then ticket/attendee/event/date/status rows render with empty state.
- AC-19 UI states: Every API page implements loading / loaded / empty / validation-error / 401 / 403 / 404 / 500-retry / success / disabled-sold-out as applicable. Skeletons, no blank screens.
- AC-20 Mobile: At 360×800, all MVP pages render without horizontal overflow; nav collapses (hamburger); tables become stacked cards; tap targets ≥44px for primary actions.
