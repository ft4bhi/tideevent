import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/organizer/event-form";
import { ApiError } from "@/lib/api/errors";
import type { EventFormInput } from "@/lib/validation/event";
import type { EventItem } from "@/types/domain";

type Submit = (values: EventFormInput) => Promise<EventItem>;

afterEach(cleanup);

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Summer Music Night" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "A lovely evening of music and friends." },
  });
  fireEvent.change(screen.getByLabelText("Starts at"), {
    target: { value: "2026-12-01T19:00" },
  });
  fireEvent.change(screen.getByLabelText("Venue"), {
    target: { value: "City Amphitheatre" },
  });
}

function submitForm(onSubmit: Submit) {
  render(<EventForm submitLabel="Submit" onSubmit={onSubmit} />);
  fillRequiredFields();
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
}

describe("EventForm server validation errors", () => {
  it("renders mapped field errors inline and unmapped ones in the alert", async () => {
    const onSubmit = vi.fn<Submit>().mockRejectedValue(
      new ApiError("VALIDATION_ERROR", "Some fields are invalid.", 422, {
        capacity: "General-admission events require capacity.",
        ticket_types: "At least one ticket type is required.",
      }),
    );
    submitForm(onSubmit);

    expect(
      await screen.findByText("General-admission events require capacity."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Some fields are invalid. At least one ticket type is required.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Could not save the event")).toBeInTheDocument();
  });

  it("falls back to the plain message when no fields are returned", async () => {
    const onSubmit = vi
      .fn<Submit>()
      .mockRejectedValue(
        new ApiError("EVENT_NOT_FOUND", "Event not found.", 404),
      );
    submitForm(onSubmit);

    expect(await screen.findByText("Event not found.")).toBeInTheDocument();
    expect(
      screen.queryByText("Some fields are invalid."),
    ).not.toBeInTheDocument();
  });
});
