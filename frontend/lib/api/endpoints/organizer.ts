import { apiFetch, isMockMode } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  mockCreateEvent,
  mockEventBookings,
  mockOrganizerEvents,
  mockUpdateEvent,
} from "@/lib/api/mock/store";
import type { Booking, EventItem, Paged } from "@/types/domain";
import type { EventFormInput } from "@/lib/validation/event";

const GA_TICKET_TYPE_NAME = "General";

function gaCreatePayload(input: EventFormInput) {
  return {
    title: input.title,
    description: input.description,
    category: input.category,
    starts_at: new Date(input.starts_at).toISOString(),
    location: input.location,
    city: input.city,
    capacity: input.capacity,
    poster_url: input.poster_url ?? "",
    booking_mode: "GENERAL_ADMISSION" as const,
    ticket_types: [
      {
        name: GA_TICKET_TYPE_NAME,
        price_inr: input.price_inr,
        quantity_total: input.capacity,
      },
    ],
  };
}

function withIsoStarts(patch: Partial<EventFormInput>): Partial<EventFormInput> {
  return patch.starts_at
    ? { ...patch, starts_at: new Date(patch.starts_at).toISOString() }
    : patch;
}

export async function organizerEvents(): Promise<EventItem[]> {
  if (isMockMode()) return mockOrganizerEvents();
  // Django paginates organizer lists as { data, meta } (specs/06). Unwrap so
  // consumers receive an array, matching the mock path.
  const paged = await apiFetch<Paged<EventItem>>("/organizer/events");
  if (!Array.isArray(paged.data)) {
    throw new ApiError(
      "REQUEST_FAILED",
      "Malformed organizer events response.",
      0,
    );
  }
  return paged.data;
}

export async function createEvent(input: EventFormInput): Promise<EventItem> {
  if (isMockMode()) {
    return mockCreateEvent({
      title: input.title,
      description: input.description,
      category: input.category,
      starts_at: new Date(input.starts_at).toISOString(),
      location: input.location,
      city: input.city,
      capacity: input.capacity,
      poster_url: input.poster_url || undefined,
      price_inr: input.price_inr,
    });
  }
  return apiFetch<EventItem>("/organizer/events", {
    method: "POST",
    body: JSON.stringify(gaCreatePayload(input)),
  });
}

export async function updateEvent(
  id: string,
  patch: Partial<EventFormInput>,
): Promise<EventItem> {
  if (isMockMode()) return mockUpdateEvent(id, patch);
  return apiFetch<EventItem>(`/organizer/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(withIsoStarts(patch)),
  });
}

export async function eventBookings(eventId: string): Promise<Booking[]> {
  if (isMockMode()) return mockEventBookings(eventId);
  return apiFetch<Booking[]>(`/organizer/events/${eventId}/bookings`);
}
