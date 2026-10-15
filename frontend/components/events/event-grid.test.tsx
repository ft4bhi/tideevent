import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventGrid } from "@/components/events/event-grid";

describe("EventGrid empty state", () => {
  it("shows empty state with reset action when no events", () => {
    render(<EventGrid events={[]} />);
    expect(screen.getByText("No events found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/events");
  });
});
