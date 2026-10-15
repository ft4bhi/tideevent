import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  mockCreateEvent,
  mockEventBookings,
  mockListEvents,
  mockLogin,
  mockLogout,
  mockOrganizerEvents,
  mockRegister,
  mockStore,
  mockUpdateEvent,
} from "@/lib/api/mock/store";

const JAZZ_ID = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
const REJECTED_ID = "b8b8b8b8-b8b8-48b8-88b8-b8b8b8b8b8b8";

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (err) {
    return err instanceof ApiError ? err.code : "UNKNOWN";
  }
}

const draft = {
  title: "New Workshop",
  description: "A sufficiently long description for validation.",
  category: "WORKSHOP",
  starts_at: new Date(Date.now() + 86400000).toISOString(),
  location: "Hall 2",
  city: "Pune",
  capacity: 50,
  poster_url: undefined,
  price_inr: 0,
} as const;

beforeEach(() => {
  mockStore.reset();
});

describe("mock organizer flow (T-06)", () => {
  it("attendees cannot create events (403)", async () => {
    expect(await codeOf(mockCreateEvent({ ...draft }))).toBe("FORBIDDEN");
  });

  it("organizer creates PENDING events hidden from public listing", async () => {
    await mockLogout();
    await mockLogin("organizer@example.com", "organizer123");
    const created = await mockCreateEvent({ ...draft });
    expect(created.status).toBe("PENDING");

    const mine = await mockOrganizerEvents();
    expect(mine.map((e) => e.id)).toContain(created.id);

    const pub = await mockListEvents({ q: "New Workshop" });
    expect(pub.data).toHaveLength(0);
  });

  it("another organizer cannot edit or view bookings (403)", async () => {
    await mockRegister({
      name: "Second Org",
      email: "org2@example.com",
      password: "password123",
      role: "ORGANIZER",
    });
    expect(await codeOf(mockUpdateEvent(JAZZ_ID, { title: "Hijacked" }))).toBe("NOT_EVENT_OWNER");
    expect(await codeOf(mockEventBookings(JAZZ_ID))).toBe("NOT_EVENT_OWNER");
  });

  it("editing a rejected event resubmits it as PENDING", async () => {
    await mockLogout();
    await mockLogin("organizer@example.com", "organizer123");
    const updated = await mockUpdateEvent(REJECTED_ID, { title: "Marathon Practice Run v2" });
    expect(updated.status).toBe("PENDING");
    expect(updated.rejection_reason).toBeUndefined();
  });

  it("capacity cannot shrink below already-booked seats (409)", async () => {
    await mockLogout();
    await mockLogin("organizer@example.com", "organizer123");
    // Jazz has 212 booked in seeds.
    expect(await codeOf(mockUpdateEvent(JAZZ_ID, { capacity: 100 }))).toBe("EVENT_NOT_EDITABLE");
  });
});
