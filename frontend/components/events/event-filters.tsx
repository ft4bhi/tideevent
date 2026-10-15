"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CITIES,
  DATE_PRESETS,
  DATE_PRESET_LABELS,
} from "@/config/site";
import { cn } from "@/lib/utils/cn";

function setParam(
  current: URLSearchParams,
  key: string,
  value: string | null,
): string {
  const next = new URLSearchParams(current.toString());
  if (value) next.set(key, value);
  else next.delete(key);
  // Changing any filter clears the others' conflicts: date vs preset
  if (key === "date" && value) next.delete("preset");
  if (key === "preset" && value) next.delete("date");
  const qs = next.toString();
  return `/events${qs ? `?${qs}` : ""}`;
}

export function EventFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("q") ?? "");

  const activeCategory = params.get("category");
  const activeCity = params.get("city") ?? "";
  const activePreset = params.get("preset");
  const activeDate = params.get("date") ?? "";
  const hasFilters =
    params.get("q") || activeCategory || activeCity || activePreset || activeDate;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(setParam(params, "q", keyword.trim() || null));
  }

  return (
    <section aria-label="Search and filter events" className="flex flex-col gap-4">
      <form onSubmit={submitSearch} role="search" className="flex gap-2">
        <label htmlFor="event-search" className="sr-only">
          Search events by title or keyword
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#687386]"
            aria-hidden
          />
          <input
            id="event-search"
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search events…"
            className="min-h-[44px] w-full rounded-lg border border-[#E7E7E2] bg-white py-2 pl-10 pr-3 text-base text-[#202B3C] placeholder:text-[#687386] focus:border-[#B95F43] focus:outline-2 focus:outline-[#B95F43]"
          />
        </div>
        <button
          type="submit"
          className="min-h-[44px] rounded-lg bg-[#B95F43] px-5 text-base font-semibold text-white hover:bg-[#A9553B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B95F43]"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
        <FilterChip
          active={!activeCategory}
          href={setParam(params, "category", null)}
          label="All"
        />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            active={activeCategory === c}
            href={setParam(params, "category", activeCategory === c ? null : c)}
            label={CATEGORY_LABELS[c]}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm font-medium text-[#202B3C]">
          City
          <select
            aria-label="Filter by city"
            value={activeCity}
            onChange={(e) => router.push(setParam(params, "city", e.target.value || null))}
            className="min-h-[44px] rounded-lg border border-[#E7E7E2] bg-white px-3 text-base"
          >
            <option value="">All cities</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Date">
          {DATE_PRESETS.map((p) => (
            <FilterChip
              key={p}
              active={activePreset === p}
              href={setParam(params, "preset", activePreset === p ? null : p)}
              label={DATE_PRESET_LABELS[p]}
            />
          ))}
          <input
            type="date"
            aria-label="Filter by specific date"
            value={activeDate}
            onChange={(e) => router.push(setParam(params, "date", e.target.value || null))}
            className="min-h-[44px] rounded-lg border border-[#E7E7E2] bg-white px-3 text-base text-[#202B3C]"
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setKeyword("");
              router.push("/events");
            }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-[#B95F43] hover:underline sm:ml-auto"
          >
            Clear all
          </button>
        )}
      </div>
    </section>
  );
}

function FilterChip({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[#B95F43] bg-[#B95F43] text-white"
          : "border-[#E7E7E2] bg-white text-[#202B3C] hover:border-[#B95F43]",
      )}
    >
      {label}
    </Link>
  );
}
