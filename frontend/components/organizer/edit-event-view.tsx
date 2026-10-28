"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldX } from "lucide-react";
import { EventForm } from "@/components/organizer/event-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/features/auth/session-context";
import { getEvent } from "@/lib/api/endpoints/events";
import { updateEvent } from "@/lib/api/endpoints/organizer";
import { isApiError, toMessage } from "@/lib/api/errors";
import type { EventFormInput } from "@/lib/validation/event";
import type { EventItem } from "@/types/domain";

export function EditEventView({ id }: { id: string }) {
  const { user } = useSession();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEvent(id).then(
      (e) => {
        if (!cancelled) setEvent(e);
      },
      (err: unknown) => {
        if (cancelled) return;
        if (isApiError(err) && err.status === 404) setError("Event not found.");
        else setError(toMessage(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <Alert tone="error" title="Could not load this event">
        {error}
      </Alert>
    );
  }

  if (event === null) {
    return (
      <div className="flex max-w-2xl flex-col gap-3" aria-label="Loading event">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[#E7E7E2]" />
        <div className="h-96 animate-pulse rounded-xl bg-[#E7E7E2]" />
      </div>
    );
  }

  const isOwner = !!user && (user.role === "ADMIN" || event.organizer_id === user.id);
  if (!isOwner) {
    return (
      <EmptyState
        icon={ShieldX}
        title="Not your event"
        copy="You can only edit events you organize."
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

  async function handle(values: EventFormInput) {
    const saved = await updateEvent(id, values);
    setEvent(saved);
    return saved;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge tone={event.status}>{event.status}</Badge>
        {event.status === "CANCELLED" && (
          <span className="text-sm text-[#687386]">editing creates a new draft</span>
        )}
      </div>
      {event.status === "CANCELLED" && event.rejection_reason && (
        <Alert tone="error" title="Cancellation reason">
          {event.rejection_reason}
        </Alert>
      )}
      <Card className="p-5">
        <EventForm initial={event} submitLabel="Save changes" onSubmit={handle} />
      </Card>
    </div>
  );
}
