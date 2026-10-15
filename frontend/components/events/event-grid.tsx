import { CalendarX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EventCard } from "@/components/events/event-card";
import type { EventItem } from "@/types/domain";

export function EventGrid({ events }: { events: EventItem[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title="No events found"
        copy="Try a different keyword, category, city, or date."
        action={
          <Link
            href="/events"
            className="rounded-lg border border-[#E7E7E2] px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5]"
          >
            Clear filters
          </Link>
        }
      />
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <li key={e.id}>
          <EventCard event={e} />
        </li>
      ))}
    </ul>
  );
}

export function EventGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading events">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-[#E7E7E2] bg-white">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
