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

const PENDING_ID = "a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7";

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

describe("mock admin approvals (T-07)", () => {
  it("non-admins cannot review events (403)", async () => {
    await loginAs("ATTENDEE");
    expect(await codeOf(mockApproveEvent(PENDING_ID, "APPROVE"))).toBe("FORBIDDEN");
    expect(await codeOf(mockAdminEvents())).toBe("FORBIDDEN");
  });

  it("approve makes the event public and bookable", async () => {
    await loginAs("ADMIN");
    const queue = await mockAdminEvents("PENDING");
    expect(queue.map((e) => e.id)).toContain(PENDING_ID);

    const approved = await mockApproveEvent(PENDING_ID, "APPROVE");
    expect(approved.status).toBe("APPROVED");

    const queueAfter = await mockAdminEvents("PENDING");
    expect(queueAfter.map((e) => e.id)).not.toContain(PENDING_ID);

    const pub = await mockListEvents({ q: "Indie Film" });
    expect(pub.data.map((e) => e.id)).toContain(PENDING_ID);
  });

  it("reject requires a reason (422) and stores it", async () => {
    await loginAs("ADMIN");
    expect(await codeOf(mockApproveEvent(PENDING_ID, "REJECT", "short"))).toBe("VALIDATION_ERROR");
    expect(await codeOf(mockApproveEvent(PENDING_ID, "REJECT"))).toBe("VALIDATION_ERROR");
    const rejected = await mockApproveEvent(
      PENDING_ID,
      "REJECT",
      "Please add venue permits and resubmit.",
    );
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejection_reason).toMatch(/permits/);
    const pub = await mockListEvents({ q: "Indie Film" });
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
