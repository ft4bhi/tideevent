import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventDetails } from "@/components/events/event-details";
import { Alert } from "@/components/ui/alert";
import { getEvent } from "@/lib/api/endpoints/events";
import { isApiError, toMessage } from "@/lib/api/errors";

interface Props {
  params: Promise<{ id: string }>;
}

const getEventCached = cache(getEvent);

export async function generateMetadata({ params }: Props) {
  try {
    const event = await getEventCached((await params).id);
    return { title: event.title };
  } catch {
    return { title: "Event" };
  }
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  let event: Awaited<ReturnType<typeof getEvent>> | null = null;
  let error: string | null = null;
  try {
    event = await getEventCached(id);
  } catch (err) {
    if (isApiError(err) && err.status === 404) notFound();
    error = toMessage(err);
  }

  if (!event) {
    return (
      <div className="py-6">
        <Alert tone="error" title="Could not load this event">
          {error ?? "Unknown error."}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      <nav aria-label="Breadcrumb">
        <Link href="/events" className="text-sm font-medium text-[#687386] hover:text-[#202B3C]">
          ← Back to events
        </Link>
      </nav>
      <EventDetails event={event} />
    </div>
  );
}
