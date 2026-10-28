import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EventCard } from "@/components/events/event-card";
import type { EventItem } from "@/types/domain";

const BASE_EVENT: EventItem = {
  id: "e1",
  title: "Jazz Night",
  description: "A lovely evening of jazz.",
  category: "MUSIC",
  starts_at: "2026-12-01T19:00:00Z",
  location: "NCPA",
  city: "Mumbai",
  capacity: 100,
  booked_count: 0,
  organizer_id: "o1",
  organizer_name: "Organizer",
  poster_url: "",
  status: "ACTIVE",
  created_at: "2026-10-20T00:00:00Z",
};

function renderCard(event: EventItem) {
  render(<EventCard event={event} />);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  cleanup();
});

describe("EventCard price rendering", () => {
  it("renders paid event price with INR grouping", () => {
    renderCard({ ...BASE_EVENT, price_inr: 10000 });
    expect(screen.getByText("₹10,000")).toBeInTheDocument();
    expect(screen.getByText("· onwards")).toBeInTheDocument();
  });

  it("renders free event as Free entry", () => {
    renderCard({ ...BASE_EVENT, price_inr: 0 });
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("· Free entry")).toBeInTheDocument();
  });

  it("renders missing price as Price unavailable without crashing", () => {
    const { price_inr: _, ...eventWithoutPrice } = BASE_EVENT;
    renderCard(eventWithoutPrice as EventItem);
    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
    expect(screen.getByText("· Price unavailable")).toBeInTheDocument();
  });

  it("renders backend-shaped event with starting_price_inr instead of price_inr", () => {
    const backendShaped = {
      ...BASE_EVENT,
      starting_price_inr: 750,
    } as unknown as EventItem;
    renderCard(backendShaped);
    // price_inr is undefined when not mapped; should not crash.
    expect(screen.getByText("Price unavailable")).toBeInTheDocument();
  });
});
