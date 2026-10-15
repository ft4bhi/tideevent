import { apiFetch, isMockMode } from "@/lib/api/client";
import {
  mockCreateEvent,
  mockEventBookings,
  mockOrganizerEvents,
  mockUpdateEvent,
} from "@/lib/api/mock/store";
import type { Booking, EventItem } from "@/types/domain";
import type { EventFormInput } from "@/lib/validation/event";

export async function organizerEvents(): Promise<EventItem[]> {
  if (isMockMode()) return mockOrganizerEvents();
  return apiFetch<EventItem[]>("/organizer/events");
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
    body: JSON.stringify(input),
  });
}

export async function updateEvent(
  id: string,
  patch: Partial<EventFormInput>,
): Promise<EventItem> {
  if (isMockMode()) return mockUpdateEvent(id, patch);
  return apiFetch<EventItem>(`/organizer/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function eventBookings(eventId: string): Promise<Booking[]> {
  if (isMockMode()) return mockEventBookings(eventId);
  return apiFetch<Booking[]>(`/organizer/events/${eventId}/bookings`);
}
