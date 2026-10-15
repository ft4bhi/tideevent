"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldX, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/features/auth/session-context";
import { getEvent } from "@/lib/api/endpoints/events";
import { eventBookings } from "@/lib/api/endpoints/organizer";
import { isApiError, toMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format";
import type { Booking, EventItem } from "@/types/domain";

export function EventBookingsView({ id }: { id: string }) {
  const { user } = useSession();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const e = await getEvent(id);
        if (cancelled) return;
        if (!user || (user.role !== "ADMIN" && e.organizer_id !== user.id)) {
          setForbidden(true);
          return;
        }
        setEvent(e);
        setBookings(await eventBookings(id));
      } catch (err) {
        if (cancelled) return;
        if (isApiError(err) && (err.status === 403 || err.code === "NOT_EVENT_OWNER")) {
          setForbidden(true);
        } else if (isApiError(err) && err.status === 404) {
          setError("Event not found.");
        } else {
          setError(toMessage(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (forbidden) {
    return (
      <EmptyState
        icon={ShieldX}
        title="Not your event"
        copy="You can only view bookings for events you organize."
        action={
          <Link
            href="/organizer/events"
            className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
          >
            My events
          </Link>
        }
      />
    );
  }

  if (error) {
    return (
      <Alert tone="error" title="Could not load bookings">
        {error}
      </Alert>
    );
  }

  if (event === null || bookings === null) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading bookings">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[#E7E7E2]" />
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-[#E7E7E2]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-[#202B3C]">{event.title}</h2>
        <p className="text-sm text-[#687386]">
          {formatDateTime(event.starts_at)} · {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </p>
      </div>
      {bookings.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No bookings yet"
          copy="When attendees book this event, they will appear here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {bookings.map((b) => (
            <li key={b.id}>
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#202B3C]">{b.attendee_name}</p>
                  <p className="truncate text-sm text-[#687386]">
                    {b.attendee_email} · booked {formatDateTime(b.booked_at)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[#687386]">{b.ticket_id}</p>
                </div>
                <Badge tone={b.status === "CONFIRMED" ? "CONFIRMED" : "CANCELLED"}>
                  {b.status}
                </Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
