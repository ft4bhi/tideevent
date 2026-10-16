# 08 — Implementation Plan

> Frontend M0–M6 below are a **completed historical record** (all gates green:
> tsc, eslint, build, vitest 37, playwright 38/38 on the approval-queue model).
> Backend + integration phases now live in `specs/11-django-backend-plan.md`,
> which supersedes the ordering below. Frontend retirement/integration work is
> tracked as phases B5–B6 there.

Order mattered: foundation → public → auth/booking → organizer → admin → hardening. Each milestone ends with gates; do not proceed green-gated.

## M0 — Foundation & specs (current)
- [x] Stage 1 inspection. [x] Specs 00–09 drafted. [x] M1 complete (see report below).
- Review decisions (user approved defaults): (a) root-level folders, no `src/`; (b) `GET /auth/me` → 200 + `{user:null}` when logged out; (c) register auto-logs in; (d) APPROVED events editable except capacity < booked → 409.

## M1 — App shell + design tokens + API boundary (no domain pages yet)
1. Install: `lucide-react zod react-hook-form @hookform/resolvers clsx tailwind-merge class-variance-authority`; dev: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom playwright @playwright/test`.
2. Theme `globals.css` tokens (§07), `Container/Navbar/Footer`, `Button/Badge/Card/Skeleton/EmptyState/Alert`, `cn()` util, `config/site.ts`, `.env.example`, `lib/api/{client,errors}` + `mock/` provider + `types/domain.ts`, `lib/validation/*`, `lib/utils/format.ts`.
3. **Gates:** `tsc --noEmit`, `eslint`, `next build` green.

## M2 — Public discovery (US-G1..G3 → AC-01..03)
- [x] M2 complete: home (hero search, city/date, categories, featured ≤6), explore (URL-param filters, skeletons/empty/error), details (bookable/sold-out/under-review states). Next 16 `cacheComponents` learnings: data-fetching server components must sit inside `<Suspense>`; Navbar (`usePathname`) wrapped in Suspense in layout. All gates green (tsc, eslint, build, vitest 10, playwright chromium+mobile).

## M3 — Auth + attendee booking (US-A1..A6, US-G4 → AC-04..09)
- [x] M3 complete: login/register (RHF+Zod, `next` return, auto-login), `RequireAuth` guard, book/ticket/my-bookings pages, ticket card with demo badge, sold-out/duplicate/unauth/cross-user handling. Mock session + full mock DB persist tab-scoped in sessionStorage (reload-proof demo). Navbar `usePathname` isolated in inner Suspense to avoid hydration remounts; id-stable session updates. All gates green (tsc, eslint, build, vitest 21, playwright 6 chromium + 6 mobile).

## M4 — Organizer (US-O1..O5 → AC-10..14)
- [x] M4 complete: organizer overview (totals/pending/approved/bookings), own-events list, create → PENDING (hidden from public), edit with rejection-reason display + resubmit → PENDING, per-event bookings, owner-only + role gates (`RequireRole`). Organizer pages are client-rendered behind guards (server cannot read mock session). RHF typed with `z.input` for coerce schemas. All gates green (tsc, eslint, build, vitest 31, playwright 20/20).

## M5 — Admin (US-D1..D4 → AC-15..18)
- [x] M5 complete: admin overview (users/pending/bookings/public counts), approval queue (approve → public, reject with ≥10-char reason dialog, processing/success/error states), users search + suspend/reinstate (self-protected), all-bookings table, attendee role gates. Approval → public visibility verified in Vitest (same-heap). All gates green (tsc, eslint, build, vitest 37, playwright 28/28).

## M6 — Hardening & handoff
- [x] M6 complete: E-06/E-07/E-13/E-14 closed in `e2e/acceptance.spec.ts` (incl. 360px sweep of all MVP pages); reject-dialog autofocus + Escape; alignment verified (no fetch outside `lib/api`, no hardcoded URLs, no localStorage); root + frontend READMEs and `10-django-handoff.md` written. Final gates green (tsc, eslint, build, vitest 37, playwright 38/38).

## Test mapping (summary; detail in 09)
M2: T-01..T-04 · M3: T-05..T-09 · M4: T-10..T-13 · M5: T-14..T-16 · M6: T-17 full matrix.
