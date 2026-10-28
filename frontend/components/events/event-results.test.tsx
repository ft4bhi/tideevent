import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function clearCsrfCookie() {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

const BACKEND_EVENTS = {
  data: [
    {
      id: "e1",
      title: "Jazz Night",
      category: "MUSIC" as const,
      starts_at: "2026-12-01T19:00:00Z",
      location: "NCPA",
      city: "Mumbai",
      poster_url: "",
      booking_mode: "GENERAL_ADMISSION" as const,
      status: "ACTIVE" as const,
      organizer_name: "Organizer",
      starting_price_inr: 500,
      remaining: 50,
      sold_out: false,
    },
    {
      id: "e2",
      title: "Free Workshop",
      category: "WORKSHOP" as const,
      starts_at: "2026-12-02T11:00:00Z",
      location: "Community Hall",
      city: "Delhi",
      poster_url: "",
      booking_mode: "GENERAL_ADMISSION" as const,
      status: "ACTIVE" as const,
      organizer_name: "Organizer",
      starting_price_inr: 0,
      remaining: 100,
      sold_out: false,
    },
  ],
  meta: { total: 2, page: 1, per_page: 20 },
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "false");
  document.cookie = "csrftoken=test-token; path=/";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  clearCsrfCookie();
  cleanup();
});

describe("EventResults backend data mapping", () => {
  it("maps starting_price_inr to price_inr for paid and free events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(BACKEND_EVENTS)));

    const { listEvents } = await import("@/lib/api/endpoints/events");
    const res = await listEvents({});

    expect(res.data[0].price_inr).toBe(500);
    expect(res.data[1].price_inr).toBe(0);
    expect(res.meta.total).toBe(2);
  });

  it("handles empty results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: [], meta: { total: 0, page: 1, per_page: 20 } })),
    );

    const { listEvents } = await import("@/lib/api/endpoints/events");
    const res = await listEvents({});
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
  });
});
