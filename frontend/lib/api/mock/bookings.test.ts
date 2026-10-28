import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  mockBook,
  mockGetBooking,
  mockLogin,
  mockLogout,
  mockMyBookings,
  mockRegister,
  mockStore,
} from "@/lib/api/mock/store";

const JAZZ_ID = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
const SOLDOUT_ID = "b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2";
const CANCELLED_ID = "b8b8b8b8-b8b8-48b8-88b8-b8b8b8b8b8b8";

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (err) {
    return err instanceof ApiError ? err.code : "UNKNOWN";
  }
}

beforeEach(() => {
  mockStore.reset();
});

describe("mock booking flow (T-05)", () => {
  it("starts signed out — no implicit attendee session", async () => {
    expect(await codeOf(mockMyBookings())).toBe("UNAUTHENTICATED");
  });

  it("confirms a booking with a unique ticket ID once the attendee signs in", async () => {
    await mockLogin("attendee@example.com", "attendee123");
    // Shakespeare has no seed booking for the attendee
    const b = await mockBook("e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5");
    expect(b.status).toBe("CONFIRMED");
    expect(b.ticket_id).toMatch(/^TD-/);
    expect(b.attendee_name).toBe("Aarav Sharma");
  });

  it("rejects booking when logged out (401) and shows no ticket", async () => {
    await mockLogout();
    expect(await codeOf(mockBook(JAZZ_ID))).toBe("UNAUTHENTICATED");
    expect(await codeOf(mockMyBookings())).toBe("UNAUTHENTICATED");
  });

  it("rejects sold-out events (409) and unavailable events (403)", async () => {
    // attendee already has no booking on these; capacity rules fire first
    await mockLogout();
    await mockLogin("organizer@example.com", "organizer123");
    expect(await codeOf(mockBook(SOLDOUT_ID))).toBe("EVENT_SOLD_OUT");
    expect(await codeOf(mockBook(CANCELLED_ID))).toBe("EVENT_UNAVAILABLE");
  });

  it("rejects duplicate booking for the same event (409)", async () => {
    await mockLogout();
    await mockLogin("organizer@example.com", "organizer123");
    await mockBook(JAZZ_ID);
    expect(await codeOf(mockBook(JAZZ_ID))).toBe("BOOKING_ALREADY_EXISTS");
  });

  it("hides other users' bookings (403) without leaking data", async () => {
    // Attendee books Shakespeare; an unrelated organizer must not see it.
    // (The seed organizer owns all seed events, so use a fresh organizer.)
    await mockLogin("attendee@example.com", "attendee123");
    const mine = await mockBook("e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5");
    await mockRegister({
      name: "Other Org",
      email: "other-org@example.com",
      password: "password123",
      role: "ORGANIZER",
    });
    expect(await codeOf(mockGetBooking(mine.id))).toBe("BOOKING_FORBIDDEN");
  });
});

describe("mock auth (T-04)", () => {
  it("rejects wrong credentials (401)", async () => {
    await mockLogout();
    expect(await codeOf(mockLogin("attendee@example.com", "wrong"))).toBe("INVALID_CREDENTIALS");
  });

  it("rejects duplicate email on register (409) and auto-logs-in on success", async () => {
    await mockLogout();
    expect(
      await codeOf(
        mockRegister({ name: "X", email: "attendee@example.com", password: "password123", role: "ATTENDEE" }),
      ),
    ).toBe("EMAIL_EXISTS");
    const u = await mockRegister({
      name: "New User",
      email: "new@example.com",
      password: "password123",
      role: "ATTENDEE",
    });
    expect(u.email).toBe("new@example.com");
    const list = await mockMyBookings();
    expect(list).toHaveLength(0);
  });
});
