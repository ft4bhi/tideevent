"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-context";
import { seatsLeft } from "@/lib/utils/format";

export function BookingPanel({
  eventId,
  capacity,
  bookedCount,
  bookable,
}: {
  eventId: string;
  capacity: number;
  bookedCount: number;
  bookable: boolean;
}) {
  const { user, loading } = useSession();
  const left = seatsLeft(capacity, bookedCount);

  if (!bookable) {
    return (
      <div className="flex flex-col gap-2">
        <Button disabled>
          {left <= 0 ? "Sold out" : "Not available"}
        </Button>
        <p className="text-sm text-[#687386]">
          {left <= 0
            ? "All seats for this event are booked."
            : "This event is not open for booking yet."}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Button disabled>Checking…</Button>
      </div>
    );
  }

  const href = user ? `/events/${eventId}/book` : `/login?next=${encodeURIComponent(`/events/${eventId}/book`)}`;

  return (
    <div className="flex flex-col gap-2">
      <Link href={href}>
        <Button className="w-full">Book Now</Button>
      </Link>
      {!user && (
        <p className="text-sm text-[#687386]">You will be asked to log in first.</p>
      )}
    </div>
  );
}
