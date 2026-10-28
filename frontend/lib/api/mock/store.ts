import { ApiError } from "@/lib/api/errors";
import { mockPasswords, seedBookings, seedEvents, seedUsers } from "@/lib/api/mock/seed";
import type { Booking, EventItem, Paged, User } from "@/types/domain";

export interface EventFilters {
  q?: string;
  category?: string;
  city?: string;
  date?: string; // YYYY-MM-DD
  preset?: "today" | "tomorrow" | "weekend" | "week";
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function delay(ms = 250): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sameDayIST(a: Date, b: Date): boolean {
  const f = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return f(a) === f(b);
}

function matchesPreset(startsAt: string, preset: NonNullable<EventFilters["preset"]>): boolean {
  const now = new Date();
  const d = new Date(startsAt);
  if (preset === "today") return sameDayIST(d, now);
  if (preset === "tomorrow") {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    return sameDayIST(d, t);
  }
  if (preset === "week") {
    const diff = d.getTime() - now.getTime();
    return diff >= 0 && diff <= 7 * 24 * 3600 * 1000;
  }
  // weekend: upcoming Sat/Sun (IST)
  const istDay = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).formatToParts(d).find(() => true),
  );
  void istDay;
  const dayNum = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) + "T00:00:00Z",
  ).getUTCDay();
  const isWeekend = dayNum === 0 || dayNum === 6;
  const diff = d.getTime() - now.getTime();
  return isWeekend && diff >= 0 && diff <= 7 * 24 * 3600 * 1000;
}

class MockStore {
  users = clone(seedUsers);
  events = clone(seedEvents);
  bookings = clone(seedBookings);
  /** No implicit session: the app starts signed out unless a test or the user acts. */
  currentUserId: string | null = null;
  ticketSeq = 100;

  reset() {
    this.users = clone(seedUsers);
    this.events = clone(seedEvents);
    this.bookings = clone(seedBookings);
    this.currentUserId = null;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(MOCK_SESSION_KEY);
        window.sessionStorage.removeItem(MOCK_DB_KEY);
      } catch {
        /* storage unavailable — memory state still reset */
      }
    }
  }
}

export const mockStore = new MockStore();

/**
 * Demo-only session persistence. The mock store lives in JS memory, so a full
 * page reload would otherwise resurrect the seeded attendee. Tab-scoped
 * sessionStorage keeps login/logout across reloads in mock mode. This is NOT
 * the production auth strategy (see specs/06-api-contract.md: HttpOnly cookie).
 */
const MOCK_SESSION_KEY = "tideevent.mock.session";
const MOCK_DB_KEY = "tideevent.mock.db";
const MOCK_DB_VERSION = 1;

/** Persist the mock DB (accounts, bookings, events) so demo data survives reloads.
 * Credentials are deliberately excluded: plaintext passwords are never written
 * to browser storage. Passwords live only in memory for the current tab. */
function saveDb() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      MOCK_DB_KEY,
      JSON.stringify({
        version: MOCK_DB_VERSION,
        users: mockStore.users,
        events: mockStore.events,
        bookings: mockStore.bookings,
        ticketSeq: mockStore.ticketSeq,
      }),
    );
  } catch {
    /* storage full/unavailable — demo continues in memory */
  }
}

function loadDb() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(MOCK_DB_KEY);
    if (!raw) return;
    const db = JSON.parse(raw) as {
      version?: number;
      users?: User[];
      events?: EventItem[];
      bookings?: Booking[];
      ticketSeq?: number;
    };
    if (db.version !== MOCK_DB_VERSION) return;
    if (Array.isArray(db.users)) mockStore.users = db.users;
    if (Array.isArray(db.events)) mockStore.events = db.events;
    if (Array.isArray(db.bookings)) mockStore.bookings = db.bookings;
    if (typeof db.ticketSeq === "number") mockStore.ticketSeq = db.ticketSeq;
  } catch {
    /* corrupt snapshot — fall back to seeds */
  }
}

loadDb();

function persistSession(userId: string | null) {
  mockStore.currentUserId = userId;
  if (typeof window === "undefined") return;
  try {
    if (userId) window.sessionStorage.setItem(MOCK_SESSION_KEY, userId);
    else window.sessionStorage.setItem(MOCK_SESSION_KEY, "");
  } catch {
    /* ignore */
  }
}

export function mockSessionUser(): User | null {
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(MOCK_SESSION_KEY);
      if (stored !== null) {
        const found = stored
          ? (mockStore.users.find((u) => u.id === stored) ?? null)
          : null;
        mockStore.currentUserId = found?.id ?? null;
        return clone(found) as User | null;
      }
    } catch {
      /* fall through to memory */
    }
  }
  return mockStore.currentUserId
    ? (clone(mockStore.users.find((u) => u.id === mockStore.currentUserId) ?? null) as User | null)
    : null;
}

export async function mockListEvents(filters: EventFilters = {}): Promise<Paged<EventItem>> {
  await delay();
  let list = mockStore.events.filter(
    (e) => e.status === "ACTIVE" && new Date(e.starts_at).getTime() >= Date.now() - 24 * 3600 * 1000,
  );
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter((e) => `${e.title} ${e.description}`.toLowerCase().includes(q));
  }
  if (filters.category) list = list.filter((e) => e.category === filters.category);
  if (filters.city) list = list.filter((e) => e.city === filters.city);
  if (filters.date) {
    list = list.filter(
      (e) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(
          new Date(e.starts_at),
        ) === filters.date,
    );
  }
  if (filters.preset) list = list.filter((e) => matchesPreset(e.starts_at, filters.preset!));
  list.sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  return { data: clone(list), meta: { total: list.length, page: 1, per_page: 50 } };
}

export async function mockGetEvent(id: string): Promise<EventItem> {
  await delay(150);
  const e = mockStore.events.find((x) => x.id === id);
  if (!e) throw new ApiError("EVENT_NOT_FOUND", "Event not found.", 404);
  const me = mockSessionUser();
  const canSee =
    e.status === "ACTIVE" || me?.role === "ADMIN" || (me && e.organizer_id === me.id);
  if (!canSee) throw new ApiError("EVENT_NOT_FOUND", "This event is not public.", 404);
  return clone(e);
}

export async function mockRegister(input: { name: string; email: string; password: string; role: "ATTENDEE" | "ORGANIZER" }): Promise<User> {
  await delay();
  const exists = mockStore.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase());
  if (exists) throw new ApiError("EMAIL_EXISTS", "An account with this email already exists.", 409);
  const user: User = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email.toLowerCase(),
    role: input.role,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
  };
  mockStore.users.push(user);
  mockPasswords[user.email] = input.password;
  persistSession(user.id);
  saveDb();
  return clone(user);
}

export async function mockLogin(email: string, password: string): Promise<User> {
  await delay();
  const user = mockStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || mockPasswords[user.email] !== password)
    throw new ApiError("INVALID_CREDENTIALS", "Incorrect email or password.", 401);
  if (user.status === "SUSPENDED")
    throw new ApiError("ACCOUNT_SUSPENDED", "This account has been suspended.", 403);
  persistSession(user.id);
  return clone(user);
}

export async function mockLogout(): Promise<void> {
  await delay(100);
  persistSession(null);
}

function eventSummary(e: EventItem) {
  return { id: e.id, title: e.title, starts_at: e.starts_at, location: e.location, poster_url: e.poster_url };
}

export async function mockBook(eventId: string): Promise<Booking> {
  await delay(400);
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in to book.", 401);
  const e = mockStore.events.find((x) => x.id === eventId);
  if (!e || e.status !== "ACTIVE")
    throw new ApiError("EVENT_UNAVAILABLE", "This event is not available for booking.", 403);
  if (e.booked_count >= e.capacity)
    throw new ApiError("EVENT_SOLD_OUT", "This event is sold out.", 409);
  if (mockStore.bookings.some((b) => b.user_id === me.id && b.event_id === eventId && b.status === "CONFIRMED"))
    throw new ApiError("BOOKING_ALREADY_EXISTS", "You already have a booking for this event.", 409);
  e.booked_count += 1;
  const booking: Booking = {
    id: crypto.randomUUID(),
    user_id: me.id,
    event_id: e.id,
    ticket_id: `TD-${(++mockStore.ticketSeq).toString(36).toUpperCase().padStart(6, "0")}`,
    status: "CONFIRMED",
    booked_at: new Date().toISOString(),
    event: eventSummary(e),
    attendee_name: me.name,
    attendee_email: me.email,
  };
  mockStore.bookings.push(booking);
  saveDb();
  return clone(booking);
}

export async function mockMyBookings(): Promise<Booking[]> {
  await delay();
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in.", 401);
  return clone(mockStore.bookings.filter((b) => b.user_id === me.id)).reverse();
}

export async function mockGetBooking(id: string): Promise<Booking> {
  await delay(150);
  const me = mockSessionUser();
  const b = mockStore.bookings.find((x) => x.id === id || x.ticket_id === id);
  if (!b) throw new ApiError("BOOKING_NOT_FOUND", "Booking not found.", 404);
  const e = mockStore.events.find((x) => x.id === b.event_id);
  const allowed =
    me && (b.user_id === me.id || me.role === "ADMIN" || (e && e.organizer_id === me.id));
  if (!allowed) throw new ApiError("BOOKING_FORBIDDEN", "You cannot view this booking.", 403);
  return clone({ ...b, event: e ? eventSummary(e) : b.event });
}

export async function mockOrganizerEvents(): Promise<EventItem[]> {
  await delay();
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in.", 401);
  if (me.role !== "ORGANIZER" && me.role !== "ADMIN")
    throw new ApiError("FORBIDDEN", "Organizer access required.", 403);
  return clone(mockStore.events.filter((e) => e.organizer_id === me.id));
}

export async function mockCreateEvent(input: Omit<EventItem, "id" | "booked_count" | "organizer_id" | "organizer_name" | "status" | "created_at">): Promise<EventItem> {
  await delay(300);
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in.", 401);
  if (me.role !== "ORGANIZER" && me.role !== "ADMIN")
    throw new ApiError("FORBIDDEN", "Organizer access required.", 403);
  const e: EventItem = {
    ...input,
    id: crypto.randomUUID(),
    booked_count: 0,
    organizer_id: me.id,
    organizer_name: me.name,
    status: "ACTIVE",
    created_at: new Date().toISOString(),
  };
  mockStore.events.push(e);
  saveDb();
  return clone(e);
}

export async function mockUpdateEvent(
  id: string,
  patch: Partial<Pick<EventItem, "title" | "description" | "category" | "starts_at" | "location" | "city" | "capacity" | "poster_url" | "price_inr">>,
): Promise<EventItem> {
  await delay(300);
  const me = mockSessionUser();
  const e = mockStore.events.find((x) => x.id === id);
  if (!e) throw new ApiError("EVENT_NOT_FOUND", "Event not found.", 404);
  if (!me || (me.role !== "ADMIN" && e.organizer_id !== me.id))
    throw new ApiError("NOT_EVENT_OWNER", "You can only edit your own events.", 403);
  if (patch.capacity !== undefined && patch.capacity < e.booked_count)
    throw new ApiError("EVENT_NOT_EDITABLE", `Capacity cannot be below ${e.booked_count} already booked.`, 409);
  Object.assign(e, patch);
  saveDb();
  return clone(e);
}

export async function mockEventBookings(eventId: string): Promise<Booking[]> {
  await delay();
  const me = mockSessionUser();
  const e = mockStore.events.find((x) => x.id === eventId);
  if (!e) throw new ApiError("EVENT_NOT_FOUND", "Event not found.", 404);
  if (!me || (me.role !== "ADMIN" && e.organizer_id !== me.id))
    throw new ApiError("NOT_EVENT_OWNER", "You can only view bookings for your own events.", 403);
  return clone(mockStore.bookings.filter((b) => b.event_id === eventId));
}

export async function mockAdminEvents(status = "ACTIVE"): Promise<EventItem[]> {
  await delay();
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in.", 401);
  if (me.role !== "ADMIN") throw new ApiError("FORBIDDEN", "Admin access required.", 403);
  return clone(mockStore.events.filter((e) => e.status === status));
}

export async function mockApproveEvent(id: string, action: "ACTIVATE" | "CANCEL", reason?: string): Promise<EventItem> {
  await delay(300);
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in.", 401);
  if (me.role !== "ADMIN") throw new ApiError("FORBIDDEN", "Admin access required.", 403);
  const e = mockStore.events.find((x) => x.id === id);
  if (!e) throw new ApiError("EVENT_NOT_FOUND", "Event not found.", 404);
  if (action === "CANCEL") {
    if (!reason || reason.trim().length < 10)
      throw new ApiError("VALIDATION_ERROR", "Give a cancellation reason of at least 10 characters.", 422);
    e.status = "CANCELLED";
    e.rejection_reason = reason.trim();
  } else {
    e.status = "ACTIVE";
    delete e.rejection_reason;
  }
  saveDb();
  return clone(e);
}

export async function mockAdminUsers(q?: string): Promise<User[]> {
  await delay();
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in.", 401);
  if (me.role !== "ADMIN") throw new ApiError("FORBIDDEN", "Admin access required.", 403);
  let list = mockStore.users;
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(s));
  }
  return clone(list);
}

export async function mockAdminSetUserStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<User> {
  await delay(200);
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in.", 401);
  if (me.role !== "ADMIN") throw new ApiError("FORBIDDEN", "Admin access required.", 403);
  const u = mockStore.users.find((x) => x.id === id);
  if (!u) throw new ApiError("USER_NOT_FOUND", "User not found.", 404);
  u.status = status;
  saveDb();
  return clone(u);
}

export async function mockAdminBookings(): Promise<Booking[]> {
  await delay();
  const me = mockSessionUser();
  if (!me) throw new ApiError("UNAUTHENTICATED", "Please log in.", 401);
  if (me.role !== "ADMIN") throw new ApiError("FORBIDDEN", "Admin access required.", 403);
  return clone(mockStore.bookings).reverse();
}
