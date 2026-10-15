import Link from "next/link";
import { EventGrid } from "@/components/events/event-grid";
import { Button } from "@/components/ui/button";
import { listEvents } from "@/lib/api/endpoints/events";
import { toMessage } from "@/lib/api/errors";

/** Async server component — rendered inside <Suspense> on home. */
export async function FeaturedEvents() {
  let featured: Awaited<ReturnType<typeof listEvents>>["data"] = [];
  try {
    featured = (await listEvents()).data.slice(0, 6);
  } catch (err) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Could not load featured events: {toMessage(err)}{" "}
        <Link href="/events" className="font-semibold underline">
          Try exploring all events
        </Link>
      </p>
    );
  }

  return (
    <>
      <EventGrid events={featured} />
      <Link href="/events" className="self-center">
        <Button>Explore events</Button>
      </Link>
    </>
  );
}
