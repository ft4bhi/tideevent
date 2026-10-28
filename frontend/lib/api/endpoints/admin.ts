import { apiFetch, isMockMode } from "@/lib/api/client";
import {
  mockAdminBookings,
  mockAdminEvents,
  mockAdminSetUserStatus,
  mockAdminUsers,
  mockApproveEvent,
} from "@/lib/api/mock/store";
import type { Booking, EventItem, User } from "@/types/domain";

export async function adminEvents(status = "ACTIVE"): Promise<EventItem[]> {
  if (isMockMode()) return mockAdminEvents(status);
  return apiFetch<EventItem[]>(`/admin/events?status=${status}`);
}

export async function reviewEvent(
  id: string,
  action: "ACTIVATE" | "CANCEL",
  reason?: string,
): Promise<EventItem> {
  if (isMockMode()) return mockApproveEvent(id, action, reason);
  return apiFetch<EventItem>(`/admin/events/${id}/approval`, {
    method: "PATCH",
    body: JSON.stringify({ action, reason }),
  });
}

export async function adminUsers(q?: string): Promise<User[]> {
  if (isMockMode()) return mockAdminUsers(q);
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<User[]>(`/admin/users${qs}`);
}

export async function setUserStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<User> {
  if (isMockMode()) return mockAdminSetUserStatus(id, status);
  return apiFetch<User>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function adminBookings(): Promise<Booking[]> {
  if (isMockMode()) return mockAdminBookings();
  return apiFetch<Booking[]>("/admin/bookings");
}
