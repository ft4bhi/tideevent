import { Suspense } from "react";
import { RequireRole } from "@/components/auth/require-auth";
import { EventBookingsView } from "@/components/organizer/event-bookings-view";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: "Event bookings" };
}

export default function EventBookingsPage({ params }: Props) {
  return (
    <Suspense>
      <BookingsShell params={params} />
    </Suspense>
  );
}

async function BookingsShell({ params }: Props) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Event bookings</h1>
        <p className="mt-1 text-[#687386]">Attendees for your event.</p>
      </div>
      <RequireRole roles={["ORGANIZER", "ADMIN"]} next={`/organizer/events/${id}/bookings`}>
        <EventBookingsView id={id} />
      </RequireRole>
    </div>
  );
}
