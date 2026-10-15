import { apiFetch, isMockMode } from "@/lib/api/client";
import { mockListEvents, mockGetEvent, type EventFilters } from "@/lib/api/mock/store";
import type { EventItem, Paged } from "@/types/domain";

export type { EventFilters };

export async function listEvents(filters: EventFilters = {}): Promise<Paged<EventItem>> {
  if (isMockMode()) return mockListEvents(filters);
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.date) params.set("date", filters.date);
  if (filters.preset) params.set("preset", filters.preset);
  const qs = params.toString();
  return apiFetch<Paged<EventItem>>(`/events${qs ? `?${qs}` : ""}`);
}

export async function getEvent(id: string): Promise<EventItem> {
  if (isMockMode()) return mockGetEvent(id);
  return apiFetch<EventItem>(`/events/${id}`);
}
