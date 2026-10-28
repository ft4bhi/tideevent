import Link from "next/link";
import { CalendarX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="py-10">
      <EmptyState
        icon={CalendarX}
        title="Event not found"
        copy="This event may have been removed or is no longer available."
        action={
          <Link
            href="/events"
            className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
          >
            Browse events
          </Link>
        }
      />
    </div>
  );
}
