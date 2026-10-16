# 00 — Project Overview: TideEvent (Online Event Booking & Management MVP)

## 1. What we are building
A simple event discovery + booking web app ("TideEvent") inspired by the **experience** of District.in
(search → filter → event details → book → ticket), built as a college industry-project MVP.

**Primary user journey:**
Home → Explore Events → Event Details → Login (if required) → Select seats / tickets → Ticket Confirmation → My Bookings

**Secondary journeys:**
- Organizer (invited): accept invitation → create event with booking mode + inventory (ACTIVE immediately) → manage → view bookings on own events.
- Admin: invite organizers → suspend/reactivate/cancel events → manage users and invitations → view bookings.

There is **no payment gateway**. Prices are stored and displayed; booking reserves inventory without collecting payment.

## 2. Repo state (updated 2026-10-16: Django direction)
- Root: `/tideevent/` contains `frontend/` (complete, all gates green) + `specs/` + READMEs. No `backend/` yet.
- `frontend/`: Next.js 16.4.1 App Router, React 19.3, Tailwind v4, strict TS, ESLint 9;
  full MVP on approval-queue model (PENDING/APPROVED/REJECTED) with typed `lib/api/`
  boundary + mock provider, Vitest (37) + Playwright (38, chromium + mobile) green.
- **Backend to build:** Python + Django 5.2 LTS + DRF + PostgreSQL (Neon) under
  `backend/`, per `specs/11-django-backend-plan.md`. Custom user model first.
- **Known frontend deltas (planned, not yet applied):** approval-queue UI must be
  retired (organizer resubmit flow, admin approve/reject); register becomes
  attendee-only; booking gains seat maps + ticket quantities; invitation +
  suspend/reactivate UIs added. See `11` phases B5–B6.

## 3. Goals
1. Clean, responsive event-discovery UI (warm white / navy / terracotta theme) with
   seat selection (BookMyShow-inspired interaction, original TideEvent branding).
2. Working system covering all routes in §8 of the master brief (public, attendee,
   organizer, admin) plus invitation acceptance and seat/ticket selection.
3. Django + DRF + PostgreSQL (Neon) backend enforcing auth, ownership, invitations,
   ACTIVE/SUSPENDED/CANCELLED lifecycle, and transaction-safe booking in both modes.
4. Frontend integrated incrementally via its typed service boundary + explicit mock
   mode; no silent mock fallback in production.
5. Spec-driven: every feature traces to `01-requirements.md` → `02-user-stories.md` → `03-acceptance-criteria.md` → tests in `09-test-plan.md`.

## 4. Non-goals (out of scope)
Payments/refunds, public organizer registration, emailed passwords, approval queues,
CAD-like venue editor, seat holds/expiry, QR/entry scanning, coupons, chat/social, ML
recommendations, multi-city inventory sync, dining/movies, microservices, WebSockets,
analytics. Invitation email *delivery configuration* (SMTP) is required. See `01-requirements.md §8`.

## 5. Assumptions (explicit)
- A1. Single-language (English), single-currency display (₹ INR), IST display, UTC storage.
- A2. Frontend runs on mock data (`NEXT_PUBLIC_USE_MOCK=true`) until Django is connected via `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:8000/api/v1`).
- A3. Auth = Django session cookie + CSRF; frontend never stores credentials/roles as a security boundary. Backend enforces everything (documented in `06-api-contract.md`).
- A4. Poster images: remote URL strings via `next/image` remote patterns; no uploader in MVP.
- A5. Package managers: npm (frontend, lockfile preserved); pip + venv with pinned `requirements.txt` (backend).
- A6. Design references only (District.in journey, BookMyShow seat interaction): never copy assets, logos, or copy; original TideEvent branding.
- A7. DB credentials live only in environment (Neon pooled URL for app, direct URL for migrations); `.env` never committed; exposed passwords must be rotated before deployment.

## 6. Success criteria (Definition of Done, condensed)
Feature is done when: acceptance criteria pass, all relevant UI states implemented,
`tsc --noEmit` + `eslint` + `next build` pass (frontend) and `pytest` + migrations-from-zero pass (backend), manual mobile/desktop check shows no horizontal overflow, shared design system used, no direct fetch-in-component (all via `lib/api/`), DB constraints back every inventory rule, and specs updated if design changed.

## 7. Document map
| File | Purpose |
|---|---|
| `01-requirements.md` | Functional + non-functional requirements (Django revision) |
| `02-user-stories.md` | Stories per role (invitations, seating) |
| `03-acceptance-criteria.md` | Testable criteria per feature |
| `04-architecture.md` | Frontend + Django backend architecture |
| `05-data-model.md` | Django models, constraints, TS delta |
| `06-api-contract.md` | DRF `/api/v1` contract |
| `07-ui-design-system.md` | Theme, components, seat-map + invitation UI |
| `08-implementation-plan.md` | Frontend record + backend phases |
| `09-test-plan.md` | Frontend gates + pytest/pytest-django coverage |
| `10-django-handoff.md` | Backend build order + parity notes |
| `11-django-backend-plan.md` | Phased backend plan awaiting approval |
