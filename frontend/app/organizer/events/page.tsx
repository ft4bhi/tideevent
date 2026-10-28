import Link from "next/link";
import { RequireRole } from "@/components/auth/require-auth";
import { OrganizerEventList } from "@/components/organizer/organizer-event-list";

export const metadata = { title: "My events" };

export default function OrganizerEventsPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">My events</h1>
          <p className="mt-1 text-[#687386]">New events are published immediately.</p>
        </div>
        <Link
          href="/organizer/events/new"
          className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
        >
          Create event
        </Link>
      </div>
      <RequireRole roles={["ORGANIZER", "ADMIN"]} next="/organizer/events">
        <OrganizerEventList />
      </RequireRole>
    </div>
  );
}
