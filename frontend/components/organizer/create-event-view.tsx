"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EventForm } from "@/components/organizer/event-form";
import { createEvent } from "@/lib/api/endpoints/organizer";
import type { EventFormInput } from "@/lib/validation/event";

export function CreateEventView() {
  const router = useRouter();

  async function handle(values: EventFormInput) {
    return createEvent(values);
  }

  function handleSaved() {
    router.push("/organizer/events");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl p-5">
      <EventForm submitLabel="Submit for review" onSubmit={handle} onSaved={handleSaved} />
    </Card>
  );
}
