"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarX } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { organizerEvents } from "@/lib/api/endpoints/organizer";
import { toMessage } from "@/lib/api/errors";
import type { EventItem } from "@/types/domain";

export function OrganizerOverview() {
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
      <Alert tone="error" title="Could not load your overview">
        {error}
      </Alert>
    );
  }

  if (events === null) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Loading overview">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[#E7E7E2]" />
        ))}
      </div>
    );
  }

  const total = events.length;
  const active = events.filter((e) => e.status === "ACTIVE").length;
  const suspended = events.filter((e) => e.status === "SUSPENDED").length;
  const cancelled = events.filter((e) => e.status === "CANCELLED").length;
  // booked_count isn't part of the live event-list serializer; guard so a
  // missing field never produces NaN.
  const bookings = events.reduce((sum, e) => sum + (e.booked_count ?? 0), 0);

  const stats = [
    { label: "Total events", value: total },
    { label: "Active", value: active },
    { label: "Suspended", value: suspended },
    { label: "Cancelled", value: cancelled },
    { label: "Total bookings", value: bookings },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-3xl font-bold text-[#202B3C]">{s.value}</p>
            <p className="mt-1 text-sm text-[#687386]">{s.label}</p>
          </Card>
        ))}
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="No events yet"
          copy="Create your first event."
          action={
            <Link
              href="/organizer/events/new"
              className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
            >
              Create event
            </Link>
          }
        />
      ) : (
        <Link
          href="/organizer/events"
          className="self-start rounded-lg border border-[#E7E7E2] bg-white px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5]"
        >
          Manage events
        </Link>
      )}
    </div>
  );
}
