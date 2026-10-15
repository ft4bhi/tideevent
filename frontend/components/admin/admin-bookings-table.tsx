"use client";

import { useEffect, useState } from "react";
import { ReceiptText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { adminBookings } from "@/lib/api/endpoints/admin";
import { toMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format";
import type { Booking } from "@/types/domain";

export function AdminBookingsTable() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminBookings().then(
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
      <Alert tone="error" title="Could not load bookings">
        {error}
      </Alert>
    );
  }

  if (bookings === null) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading bookings">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[#E7E7E2]" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="No bookings yet"
        copy="Bookings across all events will appear here."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {bookings.map((b) => (
        <li key={b.id}>
          <Card className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#202B3C]">
                {b.event?.title ?? "Event"} · {b.attendee_name}
              </p>
              <p className="truncate text-sm text-[#687386]">
                {b.event ? `${formatDateTime(b.event.starts_at)} · ` : ""}
                {b.attendee_email}
              </p>
              <p className="mt-1 font-mono text-xs text-[#687386]">{b.ticket_id}</p>
            </div>
            <Badge
              tone={b.status === "CONFIRMED" ? "CONFIRMED" : "CANCELLED"}
              className="self-start sm:self-center"
            >
              {b.status}
            </Badge>
          </Card>
        </li>
      ))}
    </ul>
  );
}
