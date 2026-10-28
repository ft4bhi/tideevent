import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  mockAdminBookings,
  mockAdminEvents,
  mockAdminSetUserStatus,
  mockAdminUsers,
  mockApproveEvent,
  mockLogin,
  mockLogout,
  mockStore,
} from "@/lib/api/mock/store";
import { mockListEvents } from "@/lib/api/mock/store";

const JAZZ_ID = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
const CANCELLED_ID = "b8b8b8b8-b8b8-48b8-88b8-b8b8b8b8b8b8";

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (err) {
    return err instanceof ApiError ? err.code : "UNKNOWN";
  }
}

async function loginAs(role: "ATTENDEE" | "ORGANIZER" | "ADMIN") {
  await mockLogout();
  const email =
    role === "ADMIN" ? "admin@example.com" : role === "ORGANIZER" ? "organizer@example.com" : "attendee@example.com";
  const password =
    role === "ADMIN" ? "admin12345" : role === "ORGANIZER" ? "organizer123" : "attendee123";
  await mockLogin(email, password);
}

beforeEach(() => {
  mockStore.reset();
});

describe("mock admin moderation (T-07)", () => {
  it("non-admins cannot moderate events (403)", async () => {
    await loginAs("ATTENDEE");
    expect(await codeOf(mockApproveEvent(JAZZ_ID, "ACTIVATE"))).toBe("FORBIDDEN");
    expect(await codeOf(mockAdminEvents())).toBe("FORBIDDEN");
  });

  it("activate makes a suspended event public and bookable", async () => {
    await loginAs("ADMIN");
    // Manually set an event to SUSPENDED for this test (CANCELLED is terminal).
    const eventToSuspend = mockStore.events.find((e) => e.id === JAZZ_ID);
    if (eventToSuspend) eventToSuspend.status = "SUSPENDED";

    const queue = await mockAdminEvents("SUSPENDED");
    expect(queue.map((e) => e.id)).toContain(JAZZ_ID);

    const activated = await mockApproveEvent(JAZZ_ID, "ACTIVATE");
    expect(activated.status).toBe("ACTIVE");

    const queueAfter = await mockAdminEvents("SUSPENDED");
    expect(queueAfter.map((e) => e.id)).not.toContain(JAZZ_ID);

    const pub = await mockListEvents({ q: "Monsoon Jazz" });
    expect(pub.data.map((e) => e.id)).toContain(JAZZ_ID);
  });

  it("cancel requires a reason (422) and stores it", async () => {
    await loginAs("ADMIN");
    expect(await codeOf(mockApproveEvent(JAZZ_ID, "CANCEL", "short"))).toBe("VALIDATION_ERROR");
    expect(await codeOf(mockApproveEvent(JAZZ_ID, "CANCEL"))).toBe("VALIDATION_ERROR");
    const cancelled = await mockApproveEvent(
      JAZZ_ID,
      "CANCEL",
      "Route crosses an unlit highway stretch. Please choose a closed-loop park route.",
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.rejection_reason).toMatch(/highway/);
    const pub = await mockListEvents({ q: "Monsoon Jazz" });
    expect(pub.data).toHaveLength(0);
  });
});

describe("mock admin users & bookings", () => {
  it("searches users and suspends login", async () => {
    await loginAs("ADMIN");
    const found = await mockAdminUsers("aarav");
    expect(found.map((u) => u.email)).toContain("attendee@example.com");

    const attendee = found.find((u) => u.email === "attendee@example.com")!;
    await mockAdminSetUserStatus(attendee.id, "SUSPENDED");
    await mockLogout();
    expect(await codeOf(mockLogin("attendee@example.com", "attendee123"))).toBe(
      "ACCOUNT_SUSPENDED",
    );
  });

  it("non-admins cannot list users or all bookings", async () => {
    await loginAs("ORGANIZER");
    expect(await codeOf(mockAdminUsers())).toBe("FORBIDDEN");
    expect(await codeOf(mockAdminBookings())).toBe("FORBIDDEN");
  });

  it("admin sees all bookings with tickets", async () => {
    await loginAs("ADMIN");
    const all = await mockAdminBookings();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((b) => /^TD-/.test(b.ticket_id))).toBe(true);
  });
});
