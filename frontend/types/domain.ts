export type Role = "ATTENDEE" | "ORGANIZER" | "ADMIN";
export type EventStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BookingStatus = "CONFIRMED" | "CANCELLED";
export type EventCategory =
  | "MUSIC"
  | "COMEDY"
  | "THEATRE"
  | "WORKSHOP"
  | "SPORTS"
  | "FOOD"
  | "TECH"
  | "ART";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  created_at: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  starts_at: string;
  location: string;
  city: string;
  capacity: number;
  booked_count: number;
  organizer_id: string;
  organizer_name: string;
  poster_url?: string;
  price_inr: number;
  status: EventStatus;
  rejection_reason?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  event_id: string;
  ticket_id: string;
  status: BookingStatus;
  booked_at: string;
  event?: Pick<
    EventItem,
    "id" | "title" | "starts_at" | "location" | "poster_url"
  >;
  attendee_name?: string;
  attendee_email?: string;
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; page: number; per_page: number };
}

export type SessionUser = User | null;
