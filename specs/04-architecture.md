# 04 — Architecture

## 1. Guiding decisions (simplest viable)
- Next.js App Router stays the **frontend only**. No Next.js API routes as permanent backend, no Node DB. A `lib/api/` service boundary isolates all data access so Django DRF replaces the mock without touching page workflows.
- Server Components by default for listing/details; Client Components only for interactivity (forms, filters, seat map, booking confirm, admin actions).
- Auth state via a lightweight session context fed by `GET /auth/me`; Django session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in prod) + CSRF token header on mutations — no localStorage tokens. Mock mode simulates the same shape in sessionStorage (demo-only).
- Forms: React Hook Form + Zod. Validation schemas live in `lib/validation/` and mirror DRF serializer rules.

## 2. Directory structure
### Frontend (exists — root-level folders, no `src/`)
`app/` routes (as listed in §8 of master brief + planned `/invite/accept`,
seat-map and invitation components), `components/{ui,layout,events,bookings,organizer,admin,auth}/`,
`features/auth/`, `lib/api/{client,errors,endpoints/*,mock/}`, `lib/validation/`,
`lib/utils/`, `types/`, `config/`, `e2e/`. Route groups share layouts/guards without
affecting URLs. Data-fetching server components sit inside `<Suspense>` (required by
`cacheComponents`); `usePathname` is isolated in inner Suspense boundaries to avoid
hydration remounts.

### Backend (to build — `backend/`)
```
backend/
  manage.py  config/ (settings split dev/prod, urls, wsgi/asgi)
  apps/accounts/ (User, OrganizerInvitation, auth + invitation APIs)
  apps/events/   (Event, VenueLayoutTemplate, Section/Row/Seat, TicketType, APIs)
  apps/bookings/ (Booking, BookingSeat, BookingItem, booking/cancel APIs)
  tests/ (pytest-django: per-app test_*.py + concurrency tests)
  requirements.txt  .env.example  README.md  pytest.ini
```
One Django project, three apps — no services, no microservices. DRF viewsets where
they fit, explicit APIViews for booking/invitation transactions; custom exception
handler producing `{ error: { code, message, fields? } }`.

## 3. Data-access boundary
```
Page/Component → features/*/hooks → lib/api/endpoints/* → client.ts → (HTTP Django DRF | mock provider)
```
- `client.ts`: base URL from `NEXT_PUBLIC_API_BASE_URL`, JSON parse, CSRF header (`X-CSRFToken` from `csrftoken` cookie on mutations), status → typed `ApiError { code, message, status, fields? }`.
- Endpoint modules expose typed functions, e.g. `listEvents(params): Promise<Paged<EventItem>>` — never raw `fetch` in components. New Django endpoints (invitations, layout config, seat/GA booking, cancel, suspend) get endpoint functions first, mock implementations second.
- `mock/` implements the same function signatures over seeded in-memory data + simulated latency/errors; selected by `NEXT_PUBLIC_USE_MOCK !== 'false'`. Explicit banner in mock mode. **No silent fallback**: HTTP errors propagate to error states. Mock session + DB persist tab-scoped in `sessionStorage` (demo-only, survives reloads); production auth uses Django session cookies per `06-api-contract.md`. Mock must be extended (booking modes, seats, invitations, ACTIVE/SUSPENDED/CANCELLED) before it can stand in for the new contract.
- Guards: client `RequireAuth`/`RequireRole` for UX; Django permissions authoritative (IsAuthenticated + role/status + ownership checks on every object route).

## 4. Rendering & state
- `page.tsx` (Server) fetches via service → passes to client islands (`EventFilters`, `BookingConfirm`, `SeatMap`, `ApprovalActions`→`EventStatusActions`).
- URL search params are the filter source of truth on `/events` (shareable links).
- No global store library; React state + context suffice. Seat selection state lives in
  the booking client component (selected ≠ confirmed until the server responds).
- Organizer/admin pages render client-side behind role guards (server cannot read the
  mock session; Django cookies will allow server reads later — optional optimization).

## 5. Config & env
- Frontend: `NEXT_PUBLIC_API_BASE_URL` (required when mock off, e.g.
  `http://localhost:8000/api/v1`), `NEXT_PUBLIC_USE_MOCK` (`true` default in dev).
- Backend: `DATABASE_URL` (Neon **pooled**), `DIRECT_URL` (Neon **direct**, migrations),
  `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `ALLOWED_HOSTS`, `FRONTEND_URL` (CORS + invite
  links), `EMAIL_*` (SMTP in prod; console backend in dev). `.env` never committed.

## 6. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Next 16 `cacheComponents` caching stale lists | Data-fetching components inside `<Suspense>`; `usePathname` isolated in inner boundaries; `cache: 'no-store'` on user-scoped fetches |
| Auth cookie vs mock divergence | Identical `Session` type + `me()` shape; contract tests re-run live in `11` phase B7 |
| PgBouncer transaction mode vs Django | `CONN_MAX_AGE=0` on pooled URL; direct URL for `migrate`; no client-side pooling |
| Seat double-booking races | Partial-unique active-seat constraint + `select_for_update`; concurrency pytest included |
| Approval-queue leftovers in frontend | Phased retirement in `11` B5–B6; grep gates for `PENDING|APPROVED|REJECTED|approval` |
| Invitation email pretending | `email_sent` reported honestly; console backend in dev; resend endpoint |
