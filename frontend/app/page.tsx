import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { EventGridSkeleton } from "@/components/events/event-grid";
import { FeaturedEvents } from "@/components/events/featured-events";
import { HomeSearch } from "@/components/events/home-search";
import { CATEGORIES, CATEGORY_LABELS } from "@/config/site";
import { SITE } from "@/config/site";

export default function Home() {
  return (
    <div className="flex flex-col gap-12 py-8">
      <section aria-label="Find events" className="flex flex-col gap-5">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-[#202B3C]">
          {SITE.tagline}
        </h1>
        <HomeSearch />
      </section>

      <section aria-label="Browse by category" className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-[#202B3C]">Browse by category</h2>
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link
                href={`/events?category=${c}`}
                className="block rounded-full border border-[#E7E7E2] bg-white px-4 py-2 text-sm font-medium text-[#202B3C] hover:border-[#B95F43]"
              >
                {CATEGORY_LABELS[c]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Featured events" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#202B3C]">Featured events</h2>
          <Link
            href="/events"
            className="flex items-center gap-1 text-sm font-semibold text-[#B95F43] hover:underline"
          >
            Explore all <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <Suspense fallback={<EventGridSkeleton />}>
          <FeaturedEvents />
        </Suspense>
      </section>
    </div>
  );
}
