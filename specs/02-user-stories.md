# 02 — User Stories

Format: **As a [role], I want [goal] so that [benefit].** Acceptance pointers reference `03-acceptance-criteria.md`.

## Guest
- US-G1. As a guest, I want to search events by keyword on home and explore pages so that I can find something I like. → AC-01, AC-02
- US-G2. As a guest, I want to filter by category, location, and date so that I can narrow results. → AC-02
- US-G3. As a guest, I want to view event details (date, venue, price, availability) so that I can decide to attend. → AC-03
- US-G4. As a guest who clicks Book Now, I want to be asked to log in (and returned to booking after) so that I don't lose my place. → AC-04

## Attendee
- US-A1. As an attendee, I want to register with name/email/password so that I can book. → AC-05
- US-A2. As an attendee, I want to log in and stay logged in across pages so that booking is smooth. → AC-05
- US-A3. As an attendee, I want to confirm a booking without payment so that I get a ticket quickly. → AC-06
- US-A4. As an attendee, I want to see my ticket (ticket ID, status, event info) so that I have proof of booking. → AC-07
- US-A5. As an attendee, I want to list my bookings and open each ticket so that I can manage my plans. → AC-08
- US-A6. As an attendee, I want clear errors when an event is full so that I am not misled. → AC-09

## Organizer
- US-O1. As an organizer, I want an overview of my events (total/pending/approved/bookings) so that I know my status at a glance. → AC-10
- US-O2. As an organizer, I want to create an event (which starts PENDING) so that it can be reviewed. → AC-11
- US-O3. As an organizer, I want to edit only my own events and see rejection reasons so that I can fix and resubmit. → AC-12
- US-O4. As an organizer, I want to view bookings for my own events so that I know who is coming. → AC-13
- US-O5. As an organizer, I want pending events to stay hidden from public listing so that unapproved content isn't bookable. → AC-14

## Admin
- US-D1 (admin). As an admin, I want a compact overview (users/events/pending/bookings) so that I know what needs review. → AC-15
- US-D2. As an admin, I want to approve or reject pending events (reject requires a reason) so that quality is controlled. → AC-16
- US-D3. As an admin, I want to search users and suspend/reinstate them so that I can moderate. → AC-17
- US-D4. As an admin, I want to view all bookings so that I can audit activity. → AC-18

## Cross-cutting
- US-X1. As any user, I want loading/empty/error states (never blank screens) so that I always know what's happening. → AC-19
- US-X2. As a mobile user, I want the site usable at 360px without horizontal scroll so that I can book from my phone. → AC-20
