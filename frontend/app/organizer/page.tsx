import Link from "next/link";
import { RequireRole } from "@/components/auth/require-auth";
import { OrganizerOverview } from "@/components/organizer/organizer-overview";

export const metadata = { title: "Organizer overview" };

export default function OrganizerPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Organizer</h1>
          <p className="mt-1 text-[#687386]">Your events at a glance.</p>
        </div>
        <Link
          href="/organizer/events/new"
          className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
        >
          Create event
        </Link>
      </div>
      <RequireRole roles={["ORGANIZER", "ADMIN"]} next="/organizer">
        <OrganizerOverview />
      </RequireRole>
    </div>
  );
}
