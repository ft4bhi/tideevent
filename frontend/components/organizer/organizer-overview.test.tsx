import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OrganizerOverview } from "@/components/organizer/organizer-overview";

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

const EVENTS = [
  { id: "e1", title: "Active Show A", status: "ACTIVE" as const, booked_count: 2 },
  { id: "e2", title: "Active Show B", status: "ACTIVE" as const, booked_count: 3 },
  { id: "e3", title: "Suspended Gig", status: "SUSPENDED" as const, booked_count: 0 },
  { id: "e4", title: "Cancelled Fest", status: "CANCELLED" as const, booked_count: 0 },
];

const PAGED = {
  data: EVENTS,
  meta: { total: EVENTS.length, page: 1, per_page: 20 },
};

function stubFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "false");
  document.cookie = "csrftoken=test-token; path=/";
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  clearCsrfCookie();
});

function cardValue(label: string): string {
  const el = screen.getByText(label);
  return el.parentElement?.textContent ?? "";
}

describe("OrganizerOverview with live API", () => {
  it("renders counts aligned to ACTIVE / SUSPENDED / CANCELLED", async () => {
    stubFetch(jsonResponse(PAGED));
    render(<OrganizerOverview />);

    await screen.findByText("Total events");
    expect(cardValue("Total events")).toContain("4");
    expect(cardValue("Active")).toContain("2");
    expect(cardValue("Suspended")).toContain("1");
    expect(cardValue("Cancelled")).toContain("1");
    expect(cardValue("Total bookings")).toContain("5");
    expect(screen.getByRole("link", { name: "Manage events" })).toBeInTheDocument();
  });

  it("shows the empty state when the organizer has no events", async () => {
    stubFetch(jsonResponse({ data: [], meta: { total: 0, page: 1, per_page: 20 } }));
    render(<OrganizerOverview />);

    await screen.findByText("No events yet");
    expect(screen.getByRole("link", { name: "Create event" })).toBeInTheDocument();
    expect(screen.queryByText("Total events")).not.toBeInTheDocument();
  });

  it("shows a loading state while the request is in flight", async () => {
    let resolveFetch!: (value: Response) => void;
    stubFetch(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<OrganizerOverview />);

    expect(screen.queryByText("Total events")).not.toBeInTheDocument();

    resolveFetch(jsonResponse(PAGED));
    await screen.findByText("Total events");
    expect(cardValue("Total events")).toContain("4");
  });

  it("reports a malformed response clearly instead of crashing", async () => {
    stubFetch(jsonResponse({ not: "an array" }));
    render(<OrganizerOverview />);

    await screen.findByText("Could not load your overview");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Malformed organizer events response.")).toBeInTheDocument();
  });
});
