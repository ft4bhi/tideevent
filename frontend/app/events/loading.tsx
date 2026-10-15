import { EventGridSkeleton } from "@/components/events/event-grid";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Explore events</h1>
      </div>
      <EventGridSkeleton />
    </div>
  );
}
