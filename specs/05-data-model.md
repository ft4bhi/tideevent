# 05 — Data Model (Django revision, 2026-10-16)

Authoritative store: PostgreSQL (Neon) via Django ORM + migrations. Custom user model
from the first migration. Table names use app-label prefixes (`accounts_`, `events_`,
`bookings_`). All ids are UUID PKs (`default=uuid4`, non-editable). Times are
timezone-aware (`USE_TZ=True`, UTC storage).

## 1. accounts.User (custom, email login)
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | unique, normalized lowercase | `USERNAME_FIELD`; RFC-valid, ≤254 |
| `name` | varchar(80) | required |
| `password` | Django hash | never serialized |
| `role` | `ATTENDEE` / `ORGANIZER` / `ADMIN`, default ATTENDEE | business role |
| `status` | `ACTIVE` / `SUSPENDED`, default ACTIVE | login blocked when SUSPENDED |
| `is_staff` / `is_superuser` | bool | Django privileges; see mapping |
| `created_at` / `updated_at` | datetimes | auto |

**Role mapping (D1, recommended):** `is_superuser=True` requires `role=ADMIN`
(enforced in `clean()`/save); `is_staff` auto-syncs True when `role==ADMIN` or
`is_superuser` (gives business admins Django-admin access without a second source
of truth). `is_staff` alone grants no business permissions — DRF permission classes
check `role` + `status`. `createsuperuser` prompts email + name and creates ADMIN.

## 2. accounts.OrganizerInvitation
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | lowercase | intended recipient |
| `token_hash` | char(64), unique | SHA-256 of `secrets.token_urlsafe(32)`; raw token never stored |
| `created_by` | FK User (admin, PROTECT) | inviter audit |
| `status` | `PENDING` / `ACCEPTED` / `EXPIRED` / `REVOKED` | `EXPIRED` computed from `expires_at`, stored on use |
| `expires_at` | datetime | default created + 7 days |
| `accepted_at` / `accepted_by` | nullable / FK User | acceptance audit |
| `created_at` | datetime | |
| Constraints | partial-unique: one PENDING per `email` | replacement = revoke + recreate |

Policy A (recommended) for existing accounts: anonymous acceptance where the email
already belongs to a user → 409 `INVITATION_LOGIN_REQUIRED`; logged-in-as-email
acceptance upgrades ATTENDEE→ORGANIZER (keeps history, sets `accepted_by`).
ORGANIZER/ADMIN recipients accepting → idempotent success (role already sufficient).
Never creates ADMIN.

## 3. events.Event
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `organizer` | FK User PROTECT | owner; admin reassignment is out of MVP |
| `title` (3–120), `description` (10–5000) | text | validated server-side |
| `category` | enum (8 existing) | unchanged |
| `starts_at` | tz-aware | must be future on create |
| `location`, `city` | text | unchanged semantics |
| `poster_url` | URL, optional | |
| `booking_mode` | `RESERVED_SEATING` / `GENERAL_ADMISSION` | immutable once confirmed bookings exist (serializer + check in `clean`) |
| `capacity` | positive int, nullable | **GA only** (required then); RS capacity is derived (count of sellable seats) |
| `status` | `ACTIVE` / `SUSPENDED` / `CANCELLED`, default ACTIVE | |
| `status_reason` | text | required when SUSPENDED or CANCELLED (admin accountability) |
| `created_at` / `updated_at` | datetimes | |

Derived (properties, never stored): GA `remaining = capacity − confirmed qty`;
RS `capacity/seats counts`; `starting_price_inr` = min section/ticket-type price;
`sold_out` flag. Bookings preserved on suspend/cancel (no cascade deletes).

## 4. Seating (RESERVED_SEATING; all CASCADE from event)
- **events.VenueLayoutTemplate**: `id`, `name` (Auditorium, Stadium/Arena, Cinema,
  Conference, Custom), `description`, `layout_json` (JSON: sections → rows →
  seat counts + prices + accessible flags), `is_active`. Read-only at runtime;
  organizers instantiate editable copies.
- **events.EventSection**: `id`, `event` FK CASCADE, `name`, `price_inr` ≥ 0,
  `sort_order`. Unique (`event`, `name`).
- **events.EventRow**: `id`, `section` FK CASCADE, `label` (`A`, `B`, …),
  `sort_order`. Unique (`section`, `label`).
- **events.EventSeat**: `id`, `row` FK CASCADE, `number` (`1`…`30`), `is_accessible`
  default False, `is_sellable` default True. Unique (`row`, `number`). Indexes on
  (`row`, `number`). "Booked" is derived: exists active `BookingSeat`.
- Lock rule: after the first CONFIRMED booking, sections/rows/seats are immutable
  (add/remove/rename blocked; metadata + prices stay editable — prices are display
  only since no payments).

## 5. Admission (GENERAL_ADMISSION)
- **events.TicketType**: `id`, `event` FK CASCADE, `name`, `price_inr` ≥ 0 (0 = free,
  consumes capacity identically), `quantity_total` > 0, `sort_order`.
  Unique (`event`, `name`). Remaining derived from confirmed `BookingItem` sums.
- Lock rule: after first CONFIRMED booking, types/quantities immutable (metadata
  editable). Free and paid lines share all validation and inventory paths.

## 6. bookings.Booking
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user` | FK User PROTECT | attendee (organizers booking as attendees included) |
| `event` | FK Event PROTECT | history preserved |
| `reference` | unique, e.g. `TD-XXXXXX` | human ticket ref; collision-retry on generate |
| `status` | `CONFIRMED` / `CANCELLED`, default CONFIRMED | |
| `booked_at` | datetime | server-set |
| `cancelled_at` | nullable | set on cancel |
- **bookings.BookingSeat** (RS): `id`, `booking` FK CASCADE, `seat` FK PROTECT,
  `is_active` default True (False = released by cancellation; rows kept for audit).
  **Partial unique**: (`seat`) WHERE `is_active` — one active assignment per seat.
- **bookings.BookingItem** (GA): `id`, `booking` FK CASCADE, `ticket_type` FK
  PROTECT, `quantity` 1–10 per line. Availability = `quantity_total − Σ confirmed qty`.
- Cancellation: attendee-owned CONFIRMED booking before `starts_at` → CANCELLED +
  `cancelled_at`; seats `is_active=False`; GA capacity returns automatically
  (derived). No refunds (no payments). Cancel of others' bookings → 404 (no
  existence oracle); cancel of non-cancellable (already cancelled, past start)
  → 409 `BOOKING_NOT_CANCELLABLE`.
- Booking guards: SUSPENDED/CANCELLED or already-started events reject with 403
  `EVENT_UNAVAILABLE` (no inventory is touched); GA repeat purchases allowed
  (new booking per request, ≤10/request); RS duplicates collapse to
  `SEAT_UNAVAILABLE`.
- References: `TD-` + 6 hex chars; generate-then-check with whole-transaction
  retry (≤3) on unique collision; seat-race IntegrityErrors re-validate to 409.

## 7. Relationships & integrity summary
- User 1—N Event (`organizer`, PROTECT); User 1—N Booking (PROTECT); Event 1—N
  Booking (PROTECT); Event 1—N Section 1—N Row 1—N Seat (CASCADE down);
  Event 1—N TicketType (CASCADE); Booking 1—N BookingSeat/BookingItem.
- Every write path that consumes inventory runs in `transaction.atomic` with
  `select_for_update()` on Event (+ TicketType / EventSeat rows); pre-check, insert,
  re-verify, commit; IntegrityError → clean 409 rollback.
- No seat-hold table in MVP (documented limitation, `11-django-backend-plan.md` R5).

## 8. Frontend TypeScript delta (planned, not now)
`EventStatus: 'ACTIVE'|'SUSPENDED'|'CANCELLED'`; `EventItem` gains `booking_mode`,
loses `booked_count`/`rejection_reason`/`price_inr` (→ `starting_price_inr`,
`remaining`, `sold_out`, `sections?`, `ticket_types?`); `Booking` gains
`reference` (keep `ticket_id` as alias during transition), `seats?: string[]`,
`items?: {ticket_type, quantity}[]`, `cancelled_at?`; new `OrganizerInvitation`
type; register input drops `role`. Mock provider extended to modes + invitations.
