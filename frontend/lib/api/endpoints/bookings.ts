import { apiFetch, isMockMode } from "@/lib/api/client";
import { mockBook, mockGetBooking, mockMyBookings } from "@/lib/api/mock/store";
import type { Booking } from "@/types/domain";

export async function bookEvent(eventId: string): Promise<Booking> {
  if (isMockMode()) return mockBook(eventId);
  return apiFetch<Booking>(`/events/${eventId}/bookings`, { method: "POST" });
}

export async function myBookings(): Promise<Booking[]> {
  if (isMockMode()) return mockMyBookings();
  return apiFetch<Booking[]>("/bookings/me");
}

export async function getBooking(id: string): Promise<Booking> {
  if (isMockMode()) return mockGetBooking(id);
  return apiFetch<Booking>(`/bookings/${id}`);
}
