"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TicketX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { myBookings } from "@/lib/api/endpoints/bookings";
import { toMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format";
import type { Booking } from "@/types/domain";

export function BookingsList() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    myBookings().then(
      (list) => {
        if (!cancelled) setBookings(list);
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
      <Alert tone="error" title="Could not load your bookings">
        {error}
      </Alert>
    );
  }

  if (bookings === null) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading bookings">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[#E7E7E2]" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={TicketX}
        title="No bookings yet"
        copy="When you book an event, your tickets will appear here."
        action={
          <Link
            href="/events"
            className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
          >
            Explore events
          </Link>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {bookings.map((b) => (
        <li key={b.id}>
          <Link
            href={`/bookings/${b.id}`}
            className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B95F43]"
          >
            <Card className="flex items-center justify-between gap-3 p-4 hover:border-[#B95F43]">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#202B3C]">{b.event?.title}</p>
                <p className="truncate text-sm text-[#687386]">
                  {b.event ? formatDateTime(b.event.starts_at) : ""} · {b.event?.location}
                </p>
                <p className="mt-1 font-mono text-xs text-[#687386]">{b.ticket_id}</p>
              </div>
              <Badge tone={b.status === "CONFIRMED" ? "CONFIRMED" : "CANCELLED"}>{b.status}</Badge>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
