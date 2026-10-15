# 05 — Data Model

Authoritative store will be PostgreSQL via Flask/SQLAlchemy. Frontend mirrors with TypeScript types in `types/domain.ts`. Backend-only fields are never sent to the client.

## 1. User
| Field | Type | Notes |
|---|---|---|
| `id` | UUID string | PK |
| `name` | string (1–80) | required |
| `email` | string, unique, lowercase | validated |
| `password_hash` | string | **backend only**, never in API responses |
| `role` | `ATTENDEE \| ORGANIZER \| ADMIN` | guest = unauthenticated, not a role |
| `status` | `ACTIVE \| SUSPENDED` | for admin moderation (default ACTIVE) |
| `created_at` | ISO-8601 | server-generated |

## 2. Event
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `title` | string (3–120) | required |
| `description` | string (10–5000) | required |
| `category` | enum: `MUSIC \| COMEDY \| THEATRE \| WORKSHOP \| SPORTS \| FOOD \| TECH \| ART` | required; justified display/filter need |
| `starts_at` | ISO-8601 | must be future on create |
| `location` | string (venue + city) | required; city part used for filter |
| `city` | string | denormalized filter aid (from fixed city list) |
| `capacity` | positive int (≥1, ≤100000) | required |
| `booked_count` | int ≥ 0 | **derived/cached**, not authority |
| `organizer_id` | UUID | FK → User |
| `organizer_name` | string | denormalized for public display |
| `poster_url` | string (URL, optional) | remote image; upload-ready later |
| `price_inr` | int ≥ 0 (optional, default 0) | display only; 0 = Free; no payments |
| `status` | `PENDING \| APPROVED \| REJECTED` | default PENDING |
| `rejection_reason` | string (optional) | required when REJECTED |
| `created_at` | ISO-8601 | server-generated |

Display helpers: `availability = capacity - booked_count`; `isSoldOut = availability <= 0`; `priceLabel = price_inr === 0 ? 'Free' : '₹' + price_inr`.

## 3. Booking
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `event_id` | UUID | FK → Event |
| `ticket_id` | unique string e.g. `TD-7F3K2A` | server-generated, human-readable |
| `status` | `CONFIRMED \| CANCELLED` | MVP creates CONFIRMED; cancel optional-later |
| `booked_at` | ISO-8601 | server-generated |
| (joined views) | `event: EventSummary`, `attendee_name/email` | for ticket + tables |

## 4. Relationships
- User(organizer) 1—N Event (`organizer_id`).
- User(attendee) 1—N Booking (`user_id`).
- Event 1—N Booking (`event_id`).
- Constraint (backend): one active (CONFIRMED) booking per (`user_id`, `event_id`); second attempt → 409 `BOOKING_ALREADY_EXISTS`.
- Constraint (backend): booking allowed only if event `APPROVED` and `booked_count < capacity`, checked transactionally (row lock / serializable).

## 5. TypeScript (target `types/domain.ts`)
```ts
export type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
export type EventStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED';
export type EventCategory = 'MUSIC'|'COMEDY'|'THEATRE'|'WORKSHOP'|'SPORTS'|'FOOD'|'TECH'|'ART';
export interface User { id: string; name: string; email: string; role: Role; status: 'ACTIVE'|'SUSPENDED'; created_at: string; }
export interface EventItem { id: string; title: string; description: string; category: EventCategory; starts_at: string; location: string; city: string; capacity: number; booked_count: number; organizer_id: string; organizer_name: string; poster_url?: string; price_inr: number; status: EventStatus; rejection_reason?: string; created_at: string; }
export interface Booking { id: string; user_id: string; event_id: string; ticket_id: string; status: BookingStatus; booked_at: string; event?: Pick<EventItem,'id'|'title'|'starts_at'|'location'|'poster_url'>; attendee_name?: string; attendee_email?: string; }
```

## 6. Seed data (mock + future Flask seed)
Minimum: 3 users (1 attendee, 1 organizer, 1 admin), 8 events (6 approved across ≥4 categories/≥3 cities incl. 1 sold-out + 1 free; 1 pending; 1 rejected with reason), 3 bookings for attendee. Passwords only in backend seed, never in frontend fixtures.
