"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSession } from "@/features/auth/session-context";
import { bookEvent } from "@/lib/api/endpoints/bookings";
import { toMessage } from "@/lib/api/errors";
import { formatDateTime, priceLabel } from "@/lib/utils/format";
import type { EventItem } from "@/types/domain";

/** Rendered inside <RequireAuth> — user is guaranteed present after loading. */
export function BookingConfirm({ event }: { event: EventItem }) {
  const router = useRouter();
  const { user } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const booking = await bookEvent(event.id);
      router.push(`/bookings/${booking.id}`);
      router.refresh();
    } catch (err) {
      setError(toMessage(err));
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-6">
      <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Confirm booking</h1>

      <Card className="flex flex-col gap-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#687386]">Event</p>
        <h2 className="text-xl font-bold text-[#202B3C]">{event.title}</h2>
        <p className="flex items-center gap-1.5 text-sm text-[#687386]">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          {formatDateTime(event.starts_at)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-[#687386]">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {event.location}
        </p>
        <p className="text-sm font-semibold text-[#202B3C]">{priceLabel(event.price_inr)}</p>
      </Card>

      <Card className="flex flex-col gap-1 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#687386]">Attendee</p>
        <p className="font-medium text-[#202B3C]">{user?.name}</p>
        <p className="text-sm text-[#687386]">{user?.email}</p>
      </Card>

      {error && (
        <Alert tone="error" title="Booking failed — no ticket was created">
          {error}
        </Alert>
      )}

      <Button onClick={onConfirm} disabled={pending} className="w-full">
        {pending ? "Confirming…" : "Confirm booking"}
      </Button>
      <p className="text-xs text-[#687386]">No payment needed — confirming reserves your seat.</p>
    </div>
  );
}
