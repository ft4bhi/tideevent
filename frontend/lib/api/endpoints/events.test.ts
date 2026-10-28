import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventFilters } from "@/lib/api/endpoints/events";

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

const PAGED = {
  data: [
    {
      id: "e1",
      title: "Show",
      category: "MUSIC" as const,
      starts_at: "2026-12-01T19:00:00Z",
      location: "Hall",
      city: "Mumbai",
      poster_url: "",
      booking_mode: "GENERAL_ADMISSION" as const,
      status: "ACTIVE" as const,
      organizer_name: "Org",
      starting_price_inr: 500,
      remaining: 50,
      sold_out: false,
      capacity: 100,
      description: "desc",
      sections: [],
      ticket_types: [],
      created_at: "2026-10-20T00:00:00Z",
      updated_at: "2026-10-20T00:00:00Z",
    },
  ],
  meta: { total: 1, page: 1, per_page: 20 },
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
});

describe("listEvents envelope", () => {
  it("returns paged envelope with data and meta intact", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGED));
    vi.stubGlobal("fetch", fetchMock);

    const { listEvents } = await import("@/lib/api/endpoints/events");
    const res = await listEvents();
    expect(res.meta.total).toBe(1);
    // Backend returns starting_price_inr; frontend normalizes to price_inr.
    expect(res.data[0].price_inr).toBe(500);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/events");
  });

  it("maps starting_price_inr to price_inr for paid events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGED));
    vi.stubGlobal("fetch", fetchMock);

    const { listEvents } = await import("@/lib/api/endpoints/events");
    const res = await listEvents();
    expect(res.data[0].price_inr).toBe(500);
  });

  it("maps starting_price_inr of 0 to price_inr of 0 (free event)", async () => {
    const free = {
      ...PAGED.data[0],
      starting_price_inr: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [free], meta: PAGED.meta }));
    vi.stubGlobal("fetch", fetchMock);

    const { listEvents } = await import("@/lib/api/endpoints/events");
    const res = await listEvents();
    expect(res.data[0].price_inr).toBe(0);
  });

  it("leaves price_inr undefined when starting_price_inr is missing", async () => {
    const noPrice = { ...PAGED.data[0] };
    delete (noPrice as Record<string, unknown>).starting_price_inr;
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: [noPrice], meta: PAGED.meta }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listEvents } = await import("@/lib/api/endpoints/events");
    const res = await listEvents();
    expect(res.data[0].price_inr).toBeUndefined();
  });

  it("appends query params when filters are provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGED));
    vi.stubGlobal("fetch", fetchMock);

    const { listEvents } = await import("@/lib/api/endpoints/events");
    const filters: EventFilters = { q: "jazz", category: "MUSIC", city: "Mumbai", date: "2026-12-01", preset: "weekend" };
    await listEvents(filters);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/events?q=jazz");
    expect(url).toContain("category=MUSIC");
    expect(url).toContain("city=Mumbai");
    expect(url).toContain("date=2026-12-01");
    expect(url).toContain("preset=weekend");
  });
});
