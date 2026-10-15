import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { EventGrid } from "@/components/events/event-grid";
import { listEvents, type EventFilters as Filters } from "@/lib/api/endpoints/events";
import { toMessage } from "@/lib/api/errors";

/** Async server component — rendered inside <Suspense> on explore. */
export async function EventResults({ filters }: { filters: Filters }) {
  let events: Awaited<ReturnType<typeof listEvents>>["data"] = [];
  let total = 0;
  try {
    const res = await listEvents(filters);
    events = res.data;
    total = res.meta.total;
  } catch (err) {
    return (
      <Alert
        tone="error"
        title="Could not load events"
        action={
          <Link
            href="/events"
            className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
          >
            Retry
          </Link>
        }
      >
        {toMessage(err)}
      </Alert>
    );
  }

  return (
    <>
      <p className="text-[#687386]" aria-live="polite">
        {total} upcoming event{total === 1 ? "" : "s"}
      </p>
      <EventGrid events={events} />
    </>
  );
}
