import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PosterImage } from "@/components/events/poster-image";
import { CATEGORY_LABELS } from "@/config/site";
import { formatDateTime, isSoldOut, priceLabel } from "@/lib/utils/format";
import type { EventItem } from "@/types/domain";

export function EventCard({ event }: { event: EventItem }) {
  const soldOut = isSoldOut(event.capacity, event.booked_count);
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B95F43]"
      aria-label={`${event.title}${soldOut ? " (sold out)" : ""}`}
    >
      <Card className="overflow-hidden transition-colors hover:border-[#B95F43]">
        <div className="relative aspect-[4/3] w-full">
          <PosterImage src={event.poster_url} alt={`${event.title} poster`} />
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge>{CATEGORY_LABELS[event.category]}</Badge>
            {soldOut && <Badge tone="SOLDOUT">Sold out</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 p-4">
          <h3 className="line-clamp-2 font-semibold text-[#202B3C]">{event.title}</h3>
          <p className="flex items-center gap-1.5 text-sm text-[#687386]">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            {formatDateTime(event.starts_at)}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-[#687386]">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{event.location}</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-[#202B3C]">
            {priceLabel(event.price_inr)}
            <span className="ml-2 font-normal text-[#687386]">
              {soldOut ? "· Sold out" : event.price_inr === 0 ? "· Free entry" : event.price_inr === undefined ? "· Price unavailable" : "· onwards"}
            </span>
          </p>
        </div>
      </Card>
    </Link>
  );
}
