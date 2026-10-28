import { apiFetch, isMockMode } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { mockBook, mockGetBooking, mockMyBookings } from "@/lib/api/mock/store";
import type { Booking } from "@/types/domain";

export type BookingCreateInput = {
  seats?: string[];
  items?: { ticket_type_id: string; quantity: number }[];
};

export async function bookEvent(
  eventId: string,
  body?: BookingCreateInput,
): Promise<Booking> {
  if (isMockMode()) return mockBook(eventId);
  return apiFetch<Booking>(`/events/${eventId}/bookings`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function myBookings(): Promise<Booking[]> {
  if (isMockMode()) return mockMyBookings();
  const paged = await apiFetch<{ data: Booking[]; meta: unknown }>("/bookings/me");
  if (!Array.isArray(paged.data)) {
    throw new ApiError("REQUEST_FAILED", "Malformed my-bookings response.", 0);
  }
  return paged.data;
}

export async function getBooking(id: string): Promise<Booking> {
  if (isMockMode()) return mockGetBooking(id);
  return apiFetch<Booking>(`/bookings/${id}`);
}
