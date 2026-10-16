# 09 — Test Plan

## 1. Quality gates (every milestone)
1. `npx tsc --noEmit` — must pass.
2. `npm run lint` — must pass.
3. `npm run build` — must pass.
4. `npx vitest run` — unit/component (added M1+).
5. `npx playwright test` (smoke → full) — journeys below.
6. Manual: 360px + 1280px, keyboard-only, no horizontal overflow.

## 2. Frontend tests (Vitest + Testing Library, mock provider) — legacy matrix kept green until retirement
- T-01 Filter logic (kept): keyword/category/city/date-preset combinators; past events excluded.
- T-02 Availability (updated in B5): per-mode remaining derivation; sold-out flag; price display Free/₹.
- T-03 Form validation (extended in B5): login/register/invitation/event/layout schemas.
- T-04 Guards: role matrix incl. invitation-accept and suspended-event visibility.
- T-05 Booking flow (extended in B6): seat select/deselect, GA quantities, 409 paths, no ticket on failure.
- T-06 Ownership: cross-organizer 403s (kept, re-verified live).
- T-07 Lifecycle (replaces approval): ACTIVE publish on create; suspend blocks bookings; reactivate restores; cancel terminal; rejected-without-reason tests retired.
- T-08 Invitations: token validation states, single-use, existing-email policy (B2).

## 3. E2E (Playwright) — legacy 14-scenario suite stays green on mocks; extended in B6
E-01..E-07, E-13, E-14 unchanged in meaning (status wording ACTIVE, not "approved").
Retired: E-08 (PENDING create), E-09 (pending hidden), E-11 (approve/reject),
E-12 (resubmit). Added: E-15 suspend/reactivate/cancel visibility; E-16 seat select →
book → ticket with seats; E-17 GA quantity booking + sold-out; E-18 invitation
accept (new + existing-attendee login flow); E-19 cancel releases inventory;
E-20 organizer cannot touch another's event/inventory.

## 4. Backend tests (pytest + pytest-django — the new source of truth)
Per-app `test_*.py` + `tests/test_concurrency.py`. Must cover (brief §15):
registration attendee-only; public organizer/admin creation blocked; auth +
permission enforcement (incl. suspended login block); organizer ownership;
invitation hashing/expiry/email-binding/single-use/existing-account policy;
createsuperuser ADMIN bootstrap; ACTIVE-on-create; suspend/reactivate/cancel
semantics + booking blocks; GA capacity + concurrency on last tickets
(ThreadPoolExecutor parallel POSTs → exactly capacity confirms);
seat double-book prevention; availability validation; cancel + inventory release;
unique references; invalid layouts/quantities; rollback on failure; CSRF + CORS
behavior; migration-from-zero green. Gates: `pytest -q` green, coverage of
`bookings/` + `accounts/` invitation paths ≥90%.

## 5. Manual checklist (M6)
Nav/roles render correctly; skeletons→content; empty states; dialogs trap focus; ticket prints legibly; `NEXT_PUBLIC_USE_MOCK=false` without backend shows honest error (never silent mock).

## 6. Final coverage map (M6 — all green, chromium + mobile/Pixel 7)
| Scenario | Spec file |
|---|---|
| E-01 guest browse | `e2e/browse.spec.ts` |
| E-02 gate → login | `e2e/booking.spec.ts` |
| E-03 details → booking | `e2e/booking.spec.ts` |
| E-04 full event | `e2e/booking.spec.ts` (+ browse sold-out badge) |
| E-05 demo ticket | `e2e/booking.spec.ts` |
| E-06 failed booking, no ticket | `e2e/acceptance.spec.ts` (duplicate attempt stays on page) |
| E-07 cross-user ticket | `e2e/acceptance.spec.ts` |
| E-08 organizer create+edit | `e2e/organizer.spec.ts` |
| E-09 pending hidden (search + direct URL 404) | `e2e/organizer.spec.ts` + `e2e/acceptance.spec.ts` |
| E-10 cross-organizer 403 | `e2e/organizer.spec.ts` |
| E-11 approve/reject | `e2e/admin.spec.ts` (+ Vitest approve→public) |
| E-12 rejected → resubmit | `e2e/organizer.spec.ts` |
| E-13 360px no overflow, all MVP pages | `e2e/acceptance.spec.ts` (+ browse spot-check) |
| E-14 readable errors | `e2e/acceptance.spec.ts` (auth, missing event/booking) |

Vitest (37): format/availability, auth + event schemas, mock matrix — filters, booking 401/409/410/403, ownership, approval transitions, suspend-blocks-login. Known E2E limitation: approve→public visibility is asserted in Vitest only (public pages render server-side from a separate mock heap; see `specs/10-django-handoff.md`).
