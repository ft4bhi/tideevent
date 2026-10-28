import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const BOOKING = {
  id: "b1",
  user_id: "u1",
  event_id: "e1",
  ticket_id: "TD-ABC123",
  status: "CONFIRMED" as const,
  booked_at: "2026-11-01T19:00:00Z",
  event: { id: "e1", title: "Jazz Night", starts_at: "2026-11-15T19:00:00Z", location: "Hall", poster_url: "" },
  attendee_name: "User One",
  attendee_email: "user@example.com",
};

const PAGED = { data: [BOOKING], meta: { total: 1, page: 1, per_page: 20 } };

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

describe("myBookings live payload", () => {
  it("unwraps the { data, meta } paginated envelope into an array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGED));
    vi.stubGlobal("fetch", fetchMock);

    const { myBookings } = await import("@/lib/api/endpoints/bookings");
    const bookings = await myBookings();

    expect(Array.isArray(bookings)).toBe(true);
    expect(bookings).toEqual([BOOKING]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/bookings/me");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-CSRFToken")).toBe("test-token");
  });

  it("returns an empty array when there are no bookings", async () => {
    const paged = { data: [], meta: { total: 0, page: 1, per_page: 20 } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(paged));
    vi.stubGlobal("fetch", fetchMock);

    const { myBookings } = await import("@/lib/api/endpoints/bookings");
    const bookings = await myBookings();
    expect(bookings).toEqual([]);
  });

  it("rejects a malformed response where data is not an array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ not: "an array" }));
    vi.stubGlobal("fetch", fetchMock);

    const { myBookings } = await import("@/lib/api/endpoints/bookings");
    await expect(myBookings()).rejects.toMatchObject({
      code: "REQUEST_FAILED",
      status: 0,
    });
  });

  it("propagates non-OK responses as ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { code: "UNAUTHENTICATED", message: "Please log in." } }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const { myBookings } = await import("@/lib/api/endpoints/bookings");
    await expect(myBookings()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
  });
});

describe("bookEvent live payload", () => {
  const TICKET_TYPE_ID = "11111111-1111-4111-8111-111111111111";

  it("sends { items } for GA events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(BOOKING, 201));
    vi.stubGlobal("fetch", fetchMock);

    const { bookEvent } = await import("@/lib/api/endpoints/bookings");
    await bookEvent("e1", {
      items: [{ ticket_type_id: TICKET_TYPE_ID, quantity: 2 }],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/events/e1/bookings");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-CSRFToken")).toBe("test-token");
    expect(JSON.parse(String(init.body))).toEqual({
      items: [{ ticket_type_id: TICKET_TYPE_ID, quantity: 2 }],
    });
  });

  it("sends { seats } for reserved seating events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(BOOKING, 201));
    vi.stubGlobal("fetch", fetchMock);

    const { bookEvent } = await import("@/lib/api/endpoints/bookings");
    await bookEvent("e1", {
      seats: ["s1", "s2"],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/events/e1/bookings");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ seats: ["s1", "s2"] });
  });

  it("propagates 422 field validation errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: "VALIDATION_ERROR", message: "Some fields are invalid.", fields: { items: ["This field is required."] } } },
        422
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { bookEvent } = await import("@/lib/api/endpoints/bookings");
    await expect(bookEvent("e1", { items: [] })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 422,
      fields: { items: "This field is required." },
    });
  });
});
