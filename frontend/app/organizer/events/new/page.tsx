import { RequireRole } from "@/components/auth/require-auth";
import { CreateEventView } from "@/components/organizer/create-event-view";

export const metadata = { title: "Create event" };

export default function NewEventPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Create event</h1>
        <p className="mt-1 text-[#687386]">
          New events start as pending — an admin reviews them before they go public. No payment setup needed.
        </p>
      </div>
      <RequireRole roles={["ORGANIZER", "ADMIN"]} next="/organizer/events/new">
        <CreateEventView />
      </RequireRole>
    </div>
  );
}
