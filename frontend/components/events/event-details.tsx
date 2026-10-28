import { CalendarDays, MapPin, Ticket, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BookingPanel } from "@/components/events/booking-panel";
import { PosterImage } from "@/components/events/poster-image";
import { CATEGORY_LABELS } from "@/config/site";
import { formatDateTime, isSoldOut, priceLabel, seatsLeft } from "@/lib/utils/format";
import type { EventItem } from "@/types/domain";

export function EventDetails({ event }: { event: EventItem }) {
  const soldOut = isSoldOut(event.capacity, event.booked_count);
  const left = seatsLeft(event.capacity, event.booked_count);
  const unavailable = event.status !== "ACTIVE";
  const bookable = !unavailable && !soldOut;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#E7E7E2]">
          <PosterImage src={event.poster_url} alt={`${event.title} poster`} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge>{CATEGORY_LABELS[event.category]}</Badge>
          <Badge tone={event.price_inr === 0 ? "FREE" : "DEFAULT"}>
            {priceLabel(event.price_inr)}
          </Badge>
          {soldOut && !unavailable && <Badge tone="SOLDOUT">Sold out</Badge>}
          {unavailable && (
            <Badge
              tone={event.status === "SUSPENDED" ? "SUSPENDED" : "CANCELLED"}
            >
              {event.status}
            </Badge>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#202B3C]">
          {event.title}
        </h1>
        <dl className="mt-4 flex flex-col gap-2 text-[#202B3C]">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#687386]" aria-hidden />
            <dt className="sr-only">Date and time</dt>
            <dd>{formatDateTime(event.starts_at)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#687386]" aria-hidden />
            <dt className="sr-only">Venue</dt>
            <dd>{event.location}</dd>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-[#687386]" aria-hidden />
            <dt className="sr-only">Organizer</dt>
            <dd className="text-sm text-[#687386]">Organized by {event.organizer_name}</dd>
          </div>
        </dl>
        <h2 className="mt-6 text-lg font-semibold text-[#202B3C]">About this event</h2>
        <p className="mt-2 whitespace-pre-line text-[#202B3C]">{event.description}</p>
      </div>

      <aside aria-label="Booking">
        <Card className="flex flex-col gap-4 p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-[#202B3C]">{priceLabel(event.price_inr)}</p>
            {!unavailable && (
              <p className="flex items-center gap-1.5 text-sm text-[#687386]">
                <Ticket className="h-4 w-4" aria-hidden />
                {soldOut ? "Sold out" : `${left} of ${event.capacity} seats left`}
              </p>
            )}
          </div>
          {!soldOut && !unavailable && (
            <div
              className="h-2 overflow-hidden rounded-full bg-[#F8F8F5]"
              role="progressbar"
              aria-valuenow={event.capacity - left}
              aria-valuemin={0}
              aria-valuemax={event.capacity}
              aria-label="Seats booked"
            >
              <div
                className="h-full rounded-full bg-[#B95F43]"
                style={{ width: `${((event.capacity - left) / event.capacity) * 100}%` }}
              />
            </div>
          )}
          {unavailable ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              This event is {event.status.toLowerCase()} and cannot be booked yet.
            </p>
          ) : (
            <BookingPanel
              eventId={event.id}
              capacity={event.capacity}
              bookedCount={event.booked_count}
              bookable={bookable}
            />
          )}
          <p className="text-xs text-[#687386]">No payment needed — booking reserves your seat.</p>
        </Card>
      </aside>
    </div>
  );
}
