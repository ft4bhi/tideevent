import { afterEach, beforeEach, cleanup, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingsList } from "@/components/bookings/bookings-list";

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

const BOOKINGS = [
  {
    id: "b1",
    user_id: "u1",
    event_id: "e1",
    ticket_id: "TD-ABC123",
    status: "CONFIRMED" as const,
    booked_at: "2026-11-01T19:00:00Z",
    event: { id: "e1", title: "Jazz Night", starts_at: "2026-11-15T19:00:00Z", location: "Hall", poster_url: "" },
    attendee_name: "User One",
    attendee_email: "user@example.com",
  },
  {
    id: "b2",
    user_id: "u1",
    event_id: "e2",
    ticket_id: "TD-XYZ789",
    status: "CANCELLED" as const,
    booked_at: "2026-11-02T10:00:00Z",
    event: { id: "e2", title: "Rock Fest", starts_at: "2026-11-20T20:00:00Z", location: "Arena", poster_url: "" },
    attendee_name: "User One",
    attendee_email: "user@example.com",
  },
];

function stubFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

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

describe("BookingsList with live API", () => {
  it("renders multiple bookings", async () => {
    const paged = { data: BOOKINGS, meta: { total: BOOKINGS.length, page: 1, per_page: 20 } };
    stubFetch(jsonResponse(paged));
    render(<BookingsList />);

    await screen.findByText("Jazz Night");
    await screen.findByText("Rock Fest");
    expect(screen.getByText("TD-ABC123")).toBeInTheDocument();
    expect(screen.getByText("TD-XYZ789")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
  });

  it("renders empty state when there are no bookings", async () => {
    const paged = { data: [], meta: { total: 0, page: 1, per_page: 20 } };
    stubFetch(jsonResponse(paged));
    render(<BookingsList />);

    await screen.findByText("No bookings yet");
    expect(screen.getByRole("link", { name: "Explore events" })).toBeInTheDocument();
  });

  it("shows loading state while fetching", async () => {
    let resolveFetch!: (value: Response) => void;
    stubFetch(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<BookingsList />);

    expect(screen.queryByText("Jazz Night")).not.toBeInTheDocument();
    expect(screen.queryByText("No bookings yet")).not.toBeInTheDocument();

    const paged = { data: BOOKINGS.slice(0, 1), meta: { total: 1, page: 1, per_page: 20 } };
    resolveFetch(jsonResponse(paged));
    await screen.findByText("Jazz Night");
  });

  it("shows error state for malformed response", async () => {
    stubFetch(jsonResponse({ not: "an array" }));
    render(<BookingsList />);

    await screen.findByText("Could not load your bookings");
    expect(screen.getByText("Malformed my-bookings response.")).toBeInTheDocument();
  });
});
