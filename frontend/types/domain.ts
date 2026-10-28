export type Role = "ATTENDEE" | "ORGANIZER" | "ADMIN";
export type EventStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED";
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
  price_inr?: number;
  status: EventStatus;
  rejection_reason?: string;
  created_at: string;
  ticket_types?: TicketType[];
  sections?: EventSection[];
}

export interface Booking {
  id: string;
  ticket_token?: string;
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

export interface TicketType {
  id: string;
  name: string;
  price_inr: number;
  quantity_total: number;
  remaining: number;
}

export interface EventSeat {
  id: string;
  number: number;
  is_accessible: boolean;
  is_sellable: boolean;
}

export interface EventRow {
  id: string;
  label: string;
  seats: EventSeat[];
}

export interface EventSection {
  id: string;
  name: string;
  price_inr: number;
  rows: EventRow[];
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; page: number; per_page: number };
}

export type SessionUser = User | null;
