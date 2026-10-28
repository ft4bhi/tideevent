import { apiFetch, isMockMode } from "@/lib/api/client";
import { mockListEvents, mockGetEvent, type EventFilters } from "@/lib/api/mock/store";
import type { EventItem, EventSection, Paged, TicketType } from "@/types/domain";

export type { EventFilters };

/** The Django list/detail serializers expose `starting_price_inr`, not
 * `price_inr`. This DTO matches the raw API response shape for list/detail
 * endpoints. Fields absent from the list serializer are filled with safe
 * defaults so the returned `EventItem` is always complete. */
interface EventApiDTO {
  id: string;
  title: string;
  category: string;
  starts_at: string;
  location: string;
  city: string;
  poster_url: string;
  booking_mode: string;
  status: string;
  organizer_name: string;
  starting_price_inr: number;
  remaining: number;
  sold_out: boolean;
  // Detail-only fields (may be absent on list responses):
  description?: string;
  capacity?: number;
  created_at?: string;
  ticket_types?: unknown[];
  sections?: unknown[];
}

/** Normalize the raw API DTO into the frontend canonical EventItem. */
function mapEventFromApi(raw: EventApiDTO): EventItem {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? "",
    category: raw.category as EventItem["category"],
    starts_at: raw.starts_at,
    location: raw.location,
    city: raw.city,
    poster_url: raw.poster_url,
    booking_mode: raw.booking_mode as EventItem["booking_mode"],
    status: raw.status as EventItem["status"],
    organizer_name: raw.organizer_name,
    price_inr: typeof raw.starting_price_inr === "number" ? raw.starting_price_inr : undefined,
    capacity: raw.capacity ?? 0,
    booked_count: 0,
    organizer_id: "",
    rejection_reason: undefined,
    created_at: raw.created_at ?? "",
    ticket_types: raw.ticket_types
      ? (raw.ticket_types as TicketType[])
      : undefined,
    sections: raw.sections ? (raw.sections as EventSection[]) : undefined,
  };
}

export async function listEvents(filters: EventFilters = {}): Promise<Paged<EventItem>> {
  if (isMockMode()) return mockListEvents(filters);
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.date) params.set("date", filters.date);
  if (filters.preset) params.set("preset", filters.preset);
  const qs = params.toString();
  const paged = await apiFetch<Paged<EventItem>>(`/events${qs ? `?${qs}` : ""}`);
  return {
    data: paged.data.map(mapEventFromApi),
    meta: paged.meta,
  };
}

export async function getEvent(id: string): Promise<EventItem> {
  if (isMockMode()) return mockGetEvent(id);
  return mapEventFromApi(await apiFetch<EventItem>(`/events/${id}`));
}
