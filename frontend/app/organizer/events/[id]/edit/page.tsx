import { Suspense } from "react";
import { RequireRole } from "@/components/auth/require-auth";
import { EditEventView } from "@/components/organizer/edit-event-view";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: "Edit event" };
}

export default function EditPage({ params }: Props) {
  return (
    <Suspense>
      <EditShell params={params} />
    </Suspense>
  );
}

async function EditShell({ params }: Props) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Edit event</h1>
        <p className="mt-1 text-[#687386]">Changes to a rejected event resubmit it for review.</p>
      </div>
      <RequireRole roles={["ORGANIZER", "ADMIN"]} next={`/organizer/events/${id}/edit`}>
        <EditEventView id={id} />
      </RequireRole>
    </div>
  );
}
