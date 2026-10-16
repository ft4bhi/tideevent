# 02 — User Stories

Format: **As a [role], I want [goal] so that [benefit].** Acceptance pointers reference `03-acceptance-criteria.md`.

## Guest
- US-G1. As a guest, I want to search events by keyword on home and explore pages so that I can find something I like. → AC-01, AC-02
- US-G2. As a guest, I want to filter by category, location, and date so that I can narrow results. → AC-02
- US-G3. As a guest, I want to view event details (date, venue, price, availability) so that I can decide to attend. → AC-03
- US-G4. As a guest who clicks Book Now, I want to be asked to log in (and returned to booking after) so that I don't lose my place. → AC-04

## Attendee
- US-A1. As an attendee, I want to register with name/email/password (attendee account) so that I can book. → AC-05
- US-A2. As an attendee, I want to log in and stay logged in across pages so that booking is smooth. → AC-05
- US-A3. As an attendee, I want to pick seats on a seat map (reserved events) or ticket types + quantities (general admission) and confirm without payment so that I get a ticket quickly. → AC-06
- US-A4. As an attendee, I want to see my ticket (reference, seats/lines, status, event info) so that I have proof of booking. → AC-07
- US-A5. As an attendee, I want to list my bookings, open each ticket, and cancel per the rules so that I can manage my plans. → AC-08
- US-A6. As an attendee, I want clear errors when an event is full or seats just got taken so that I am not misled. → AC-09

## Organizer (invited)
- US-O0. As a prospective organizer, I want to accept an email invitation and set my own password so that I get organizer access securely. → AC-21
- US-O1. As an organizer, I want an overview of my events (total/active/suspended/bookings) so that I know my status at a glance. → AC-10
- US-O2. As an organizer, I want to create an event with a booking mode and inventory so that it publishes as ACTIVE immediately. → AC-11
- US-O3. As an organizer, I want to edit only my own events (inventory locked after bookings) so that existing tickets are never invalidated. → AC-12
- US-O4. As an organizer, I want to view bookings (with seats/lines) for my own events so that I know who is coming. → AC-13
- US-O5. As an organizer, I want my suspended events clearly marked and unbookable so that attendees are never misled. → AC-14

## Admin
- US-D1 (admin). As an admin, I want a compact overview (users/events/bookings/pending invitations) so that I know what needs attention. → AC-15
- US-D2. As an admin, I want to invite organizers by email and see/resend/revoke invitations so that organizer onboarding is controlled. → AC-22
- US-D3. As an admin, I want to search users and suspend/reinstate them so that I can moderate. → AC-17
- US-D4. As an admin, I want to view all bookings so that I can audit activity. → AC-18
- US-D5. As an admin, I want to suspend (with reason), reactivate, or cancel events so that unavailable events stop selling while history is preserved. → AC-16

## Cross-cutting
- US-X1. As any user, I want loading/empty/error states (never blank screens) so that I always know what's happening. → AC-19
- US-X2. As a mobile user, I want the site usable at 360px without horizontal scroll so that I can book from my phone. → AC-20
