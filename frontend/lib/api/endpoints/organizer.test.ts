import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventFormInput } from "@/lib/validation/event";

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

const FORM_INPUT: EventFormInput = {
  title: "Summer Music Night",
  description: "A lovely evening of music and friends.",
  category: "MUSIC",
  starts_at: "2026-11-01T21:30",
  location: "City Amphitheatre",
  city: "Mumbai",
  capacity: 100,
  poster_url: "",
  price_inr: 500,
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

describe("createEvent live payload", () => {
  it("sends the Django GA contract instead of the flat form shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "e1" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const { createEvent } = await import("@/lib/api/endpoints/organizer");
    await createEvent(FORM_INPUT);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/organizer/events");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-CSRFToken")).toBe("test-token");

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      title: FORM_INPUT.title,
      description: FORM_INPUT.description,
      category: "MUSIC",
      starts_at: new Date(FORM_INPUT.starts_at).toISOString(),
      location: FORM_INPUT.location,
      city: "Mumbai",
      capacity: 100,
      poster_url: "",
      booking_mode: "GENERAL_ADMISSION",
      ticket_types: [{ name: "General", price_inr: 500, quantity_total: 100 }],
    });
    expect(body).not.toHaveProperty("price_inr");
  });

  it("creates a free event as a zero-price GA ticket type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "e2" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const { createEvent } = await import("@/lib/api/endpoints/organizer");
    await createEvent({ ...FORM_INPUT, price_inr: 0, capacity: 250 });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.capacity).toBe(250);
    expect(body.ticket_types).toEqual([
      { name: "General", price_inr: 0, quantity_total: 250 },
    ]);
  });
});

describe("updateEvent live payload", () => {
  it("normalizes starts_at to a UTC instant", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);

    const { updateEvent } = await import("@/lib/api/endpoints/organizer");
    await updateEvent("e1", { starts_at: FORM_INPUT.starts_at });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/organizer/events/e1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      starts_at: new Date(FORM_INPUT.starts_at).toISOString(),
    });
  });

  it("leaves patches without starts_at untouched", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);

    const { updateEvent } = await import("@/lib/api/endpoints/organizer");
    await updateEvent("e1", { title: "Renamed" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ title: "Renamed" });
  });
});

describe("organizerEvents live payload", () => {
  it("unwraps the { data, meta } paginated envelope into an array", async () => {
    const paged = {
      data: [
        { id: "e1", title: "Show", status: "ACTIVE" as const },
        { id: "e2", title: "Gig", status: "SUSPENDED" as const },
      ],
      meta: { total: 2, page: 1, per_page: 20 },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(paged));
    vi.stubGlobal("fetch", fetchMock);

    const { organizerEvents } = await import("@/lib/api/endpoints/organizer");
    const events = await organizerEvents();

    expect(Array.isArray(events)).toBe(true);
    expect(events).toEqual(paged.data);
    expect(events.length).toBe(2);
  });

  it("returns an empty array when the organizer has no events", async () => {
    const paged = { data: [], meta: { total: 0, page: 1, per_page: 20 } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(paged));
    vi.stubGlobal("fetch", fetchMock);

    const { organizerEvents } = await import("@/lib/api/endpoints/organizer");
    const events = await organizerEvents();
    expect(events).toEqual([]);
  });

  it("rejects a malformed response instead of returning a non-array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ not: "an array" }));
    vi.stubGlobal("fetch", fetchMock);

    const { organizerEvents } = await import("@/lib/api/endpoints/organizer");
    await expect(organizerEvents()).rejects.toMatchObject({
      code: "REQUEST_FAILED",
      status: 0,
    });
  });
});
