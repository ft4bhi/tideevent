import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { BookingConfirm } from "@/components/bookings/booking-confirm";
import { Alert } from "@/components/ui/alert";
import { getEvent } from "@/lib/api/endpoints/events";
import { isApiError, toMessage } from "@/lib/api/errors";
import { isSoldOut } from "@/lib/utils/format";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  try {
    const event = await getEvent((await params).id);
    return { title: `Book · ${event.title}` };
  } catch {
    return { title: "Book event" };
  }
}

export default function BookPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3 py-6" aria-label="Loading booking">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-[#E7E7E2]" />
          <div className="h-48 animate-pulse rounded-xl bg-[#E7E7E2]" />
        </div>
      }
    >
      <BookShell params={params} />
    </Suspense>
  );
}

async function BookShell({ params }: Props) {
  const { id } = await params;
  let event: Awaited<ReturnType<typeof getEvent>> | null = null;
  let error: string | null = null;
  try {
    event = await getEvent(id);
  } catch (err) {
    if (isApiError(err) && err.status === 404) notFound();
    error = toMessage(err);
  }

  const bookPath = `/events/${id}/book`;

  if (!event) {
    return (
      <div className="py-6">
        <Alert tone="error" title="Could not load this event">
          {error ?? "Unknown error."}
        </Alert>
      </div>
    );
  }

  if (event.status !== "APPROVED") {
    return (
      <div className="py-6">
        <Alert tone="info" title="Not available for booking">
          This event is under review and cannot be booked yet.{" "}
          <Link href="/events" className="font-semibold underline">
            Browse events
          </Link>
        </Alert>
      </div>
    );
  }

  if (isSoldOut(event.capacity, event.booked_count)) {
    return (
      <div className="py-6">
        <Alert tone="info" title="Sold out">
          All seats for this event are booked.{" "}
          <Link href="/events" className="font-semibold underline">
            Find another event
          </Link>
        </Alert>
      </div>
    );
  }

  return (
    <RequireAuth next={bookPath}>
      <BookingConfirm event={event} />
    </RequireAuth>
  );
}
