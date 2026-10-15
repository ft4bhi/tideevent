import { Suspense } from "react";
import { EventFilters } from "@/components/events/event-filters";
import { EventResults } from "@/components/events/event-results";
import { EventGridSkeleton } from "@/components/events/event-grid";
import type { EventFilters as Filters } from "@/lib/api/endpoints/events";

export const metadata = { title: "Explore events" };

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    city?: string;
    date?: string;
    preset?: string;
  }>;
}

const PRESETS = ["today", "tomorrow", "weekend", "week"] as const;

export default async function ExplorePage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters: Filters = {
    q: sp.q || undefined,
    category: sp.category || undefined,
    city: sp.city || undefined,
    date: sp.date || undefined,
    preset: (PRESETS as readonly string[]).includes(sp.preset ?? "")
      ? (sp.preset as Filters["preset"])
      : undefined,
  };
  const suspenseKey = JSON.stringify(filters);

  return (
    <div className="flex flex-col gap-6 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Explore events</h1>
      </div>

      <Suspense>
        <EventFilters />
      </Suspense>

      <Suspense key={suspenseKey} fallback={<EventGridSkeleton />}>
        <EventResults filters={filters} />
      </Suspense>
    </div>
  );
}
