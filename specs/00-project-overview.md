# 00 — Project Overview: TideEvent (Online Event Booking & Management MVP)

## 1. What we are building
A simple event discovery + booking web app ("TideEvent") inspired by the **experience** of District.in
(search → filter → event details → book → ticket), built as a college industry-project MVP.

**Primary user journey:**
Home → Explore Events → Event Details → Login (if required) → Confirm Booking → Ticket Confirmation → My Bookings

**Secondary journeys:**
- Organizer: create event (PENDING) → wait for review → edit/resubmit if rejected → view bookings on own events.
- Admin: review PENDING queue → approve/reject (with reason) → view users and bookings.

There is **no payment gateway**. Free and paid events are display-only price labels; booking only reserves a seat.

## 2. Repo state (Stage 1 finding, 2026-10-15)
- Root: `/tideevent/` contains only `frontend/` (untracked) + `.git/`.
- `frontend/`: fresh `create-next-app` scaffold — Next.js 16.4.1 (App Router, `cacheComponents: true`), React 19.3, Tailwind CSS v4 (via `@tailwindcss/turbopack`), TypeScript strict, ESLint 9 + `eslint-config-next`.
- Default template files only (`app/page.tsx`, `app/layout.tsx` with Geist fonts, `app/globals.css`). No domain code, no tests, no backend, no `.env` files.
- **Missing vs. required stack:** shadcn/ui, React Hook Form, Zod, lucide-react, Playwright/Vitest, `src/` structure, API layer, mock data service, `.env.example`. These will be added incrementally per `08-implementation-plan.md`.

## 3. Goals
1. Clean, responsive, District-inspired discovery UI (warm white / navy / terracotta theme).
2. Working MVP covering all routes in §6 of the master brief (public, attendee, organizer, admin).
3. Frontend structured so a future Python Flask + PostgreSQL backend (`/api/v1`) can plug in without rewriting pages — via a typed service boundary + explicit mock mode.
4. Spec-driven: every feature traces to `01-requirements.md` → `02-user-stories.md` → `03-acceptance-criteria.md` → tests in `09-test-plan.md`.

## 4. Non-goals (out of scope)
Payments/refunds, seat maps, QR scanning, ticket tiers, coupons, chat/social, ML recommendations, multi-city inventory sync, dining/movies, microservices, WebSockets, analytics, real email delivery. See `01-requirements.md §7`.

## 5. Assumptions (explicit)
- A1. Single-language (English), single-currency display (₹ INR, display only), single timezone display (IST) for MVP.
- A2. Flask backend does not exist yet; frontend ships with an explicit, clearly-labeled mock data provider (`NEXT_PUBLIC_USE_MOCK=true`) that is disabled by setting the real `NEXT_PUBLIC_API_BASE_URL`.
- A3. Auth for MVP demo = mock session in memory + `httpOnly`-cookie-ready API shape; frontend never stores passwords/roles as a security boundary. Real enforcement happens in Flask later (documented in `06-api-contract.md`).
- A4. Poster images: MVP uses remote URL strings (Unsplash/picsum placeholders) via `next/image` remote patterns; upload UI is a URL field prepared for future storage integration, not a real uploader.
- A5. Package manager: npm (existing `package-lock.json` preserved).
- A6. Design reference only: do not copy District.in assets, logos, or copy; build original TideEvent branding.

## 6. Success criteria (Definition of Done, condensed)
Feature is done when: acceptance criteria pass, all relevant UI states implemented, `tsc --noEmit` + `eslint` + `next build` pass, manual mobile/desktop check shows no horizontal overflow, shared design tokens used, no direct fetch-in-component (all via `lib/api/`), and specs updated if design changed.

## 7. Document map
| File | Purpose |
|---|---|
| `01-requirements.md` | Functional + non-functional requirements |
| `02-user-stories.md` | Stories per role |
| `03-acceptance-criteria.md` | Testable criteria per feature |
| `04-architecture.md` | Frontend architecture + backend-readiness |
| `05-data-model.md` | Entities + TypeScript types |
| `06-api-contract.md` | Proposed Flask `/api/v1` contract |
| `07-ui-design-system.md` | Theme, components, states |
| `08-implementation-plan.md` | Ordered build steps |
| `09-test-plan.md` | Checks + acceptance scenarios |
