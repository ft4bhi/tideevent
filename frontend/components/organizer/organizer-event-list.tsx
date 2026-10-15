"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarX, Pencil, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { organizerEvents } from "@/lib/api/endpoints/organizer";
import { toMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format";
import type { EventItem } from "@/types/domain";

export function OrganizerEventList() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    organizerEvents().then(
      (list) => {
        if (!cancelled) setEvents(list);
      },
      (err: unknown) => {
        if (!cancelled) setError(toMessage(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Alert tone="error" title="Could not load your events">
        {error}
      </Alert>
    );
  }

  if (events === null) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading events">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-[#E7E7E2]" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title="No events yet"
        copy="Create your first event and submit it for review."
        action={
          <Link
            href="/organizer/events/new"
            className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
          >
            Create event
          </Link>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.id}>
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-[#202B3C]">{e.title}</p>
                <Badge tone={e.status}>{e.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-[#687386]">
                {formatDateTime(e.starts_at)} · {e.location}
              </p>
              <p className="mt-1 text-sm text-[#687386]">
                Capacity {e.capacity} · Booked {e.booked_count}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/organizer/events/${e.id}/edit`}
                className="flex items-center gap-1.5 rounded-lg border border-[#E7E7E2] px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5]"
              >
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </Link>
              <Link
                href={`/organizer/events/${e.id}/bookings`}
                className="flex items-center gap-1.5 rounded-lg border border-[#E7E7E2] px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5]"
              >
                <Users className="h-4 w-4" aria-hidden /> Bookings
              </Link>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
