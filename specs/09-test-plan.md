# 09 — Test Plan

## 1. Quality gates (every milestone)
1. `npx tsc --noEmit` — must pass.
2. `npm run lint` — must pass.
3. `npm run build` — must pass.
4. `npx vitest run` — unit/component (added M1+).
5. `npx playwright test` (smoke → full) — journeys below.
6. Manual: 360px + 1280px, keyboard-only, no horizontal overflow.

## 2. Frontend tests (Vitest + Testing Library, mock provider)
- T-01 Filter logic: keyword/category/city/date-preset combinators; weekend calc; past events excluded.
- T-02 Availability: `left = capacity - booked`; sold-out flag; price label Free/₹.
- T-03 Form validation: login/register/event schemas accept/reject cases (bad email, short pw, past date, capacity 0, reject-reason <10 chars).
- T-04 Guards: `requireRole` matrix (guest/attendee/organizer/admin × routes) returns allow/login/403.
- T-05 Booking flow: confirm success → ticket; 409 sold-out → error, no ticket; double-submit disabled.
- T-06 Ownership: organizer A cannot edit/view organizer B event (403 in mock client).
- T-07 Approval: approve → APPROVED + publicly listed; reject w/o reason blocked; with reason → REJECTED + reason persisted; resubmit → PENDING.

## 3. E2E (Playwright, mock mode) — maps to the 14 required acceptance scenarios
| # | Scenario | Expect |
|---|---|---|
| E-01 | Guest browses approved events | cards render; pending hidden |
| E-02 | Guest clicks Book Now | → `/login?next=...`, post-login returns |
| E-03 | Attendee details → booking | ticket page with ticket ID |
| E-04 | Full event | disabled Sold out; POST → readable error |
| E-05 | Mock success ticket | shows demo-data badge |
| E-06 | Failed booking | error shown, no ticket |
| E-07 | Cross-user ticket URL | 403/404, no data leak |
| E-08 | Organizer create+edit own | PENDING created; listed |
| E-09 | Pending not public | direct URL → "under review" |
| E-10 | Cross-organizer manage | 403 |
| E-11 | Admin approve/reject | status transitions + queue updates |
| E-12 | Rejected → resubmit | PENDING again |
| E-13 | Mobile 360px | no horizontal overflow all pages |
| E-14 | API error | readable feedback + retry |

## 4. Backend-integration tests (later, Flask/Pytest — noted only)
Contract tests against live `/api/v1` (same cases, `USE_MOCK=false`): auth round-trip, capacity race (parallel booking → exactly ≤ capacity confirms), ownership enforcement, approval transitions. Playwright suite re-runnable with `PLAYWRIGHT_BASE_URL` + seeded Flask DB.

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

Vitest (37): format/availability, auth + event schemas, mock matrix — filters, booking 401/409/410/403, ownership, approval transitions, suspend-blocks-login. Known E2E limitation: approve→public visibility is asserted in Vitest only (public pages render server-side from a separate mock heap; see `specs/10-flask-handoff.md`).
