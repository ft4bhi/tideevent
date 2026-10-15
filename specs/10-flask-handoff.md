# 10 — Flask Handoff Notes

Who: backend team picking up the Python Flask + PostgreSQL implementation.
Source of truth for the contract: `06-api-contract.md`. This note covers order,
parity requirements, and known mock divergences.

## 1. Implement in this order
1. Auth (`register/login/logout/me`) with HttpOnly session cookie + seed users
   (attendee / organizer / admin — same emails as `lib/api/mock/seed.ts`).
2. Public events (`GET /events` with q/category/city/date/preset, `GET /events/:id`
   with owner/admin visibility for PENDING).
3. Bookings (`POST /events/:id/bookings` transactional capacity check + ticket ID;
   `GET /bookings/me`, `GET /bookings/:id` with ownership rules).
4. Organizer routes (ownership enforcement, REJECTED→PENDING on edit,
   capacity floor vs `booked_count`).
5. Admin routes (approval transitions, user suspend, listings).
6. Mirror `lib/validation/*.ts` rules server-side (lengths, future dates, ≥10-char
   rejection reasons, ADMIN rejected on register).

## 2. Parity requirements (frontend assumes these)
- Envelope `{ data }` or raw DTO; errors `{ error: { code, message } }` with the
  SNAKE codes in `06-api-contract.md` (`EVENT_SOLD_OUT`, `BOOKING_ALREADY_EXISTS`,
  `ACCOUNT_SUSPENDED`, …) — UI messages key off them.
- UUID ids, ISO-8601 UTC timestamps, `price_inr` int (0 = Free, display only).
- One active booking per user×event (409). Capacity checked transactionally.
- `GET /auth/me` → `200 + { user: null }` when logged out (not 401).
- CORS: allow the Next dev origin with credentials (cookies).

## 3. Connecting the frontend
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_USE_MOCK=false
```
Then run the contract suite: `npx vitest run` covers logic, but re-run
`npx playwright test` against Flask-seeded data (same seed emails/events) —
E2E doubles as integration tests. The approve→public journey (Vitest-only today)
must be re-verified live.

## 4. Known mock divergences (do NOT copy these into Flask)
- Session + whole DB persist in browser `sessionStorage` (demo convenience).
  Production uses HttpOnly cookies; nothing auth-related lives in storage.
- Server components and browser currently read *separate* mock heaps (e.g. a
  booking made client-side doesn't change server-rendered seat counts until the
  backend exists). This disappears with a real API.
- `booked_count` is a cached display field; Flask must enforce capacity in a
  transaction, never trust the frontend count.
- Passwords in `seed.ts` are fake demo strings; Flask stores only hashes.
