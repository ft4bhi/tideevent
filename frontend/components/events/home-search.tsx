"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { CITIES, DATE_PRESETS, DATE_PRESET_LABELS } from "@/config/site";

export function HomeSearch() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [city, setCity] = useState("");
  const [preset, setPreset] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (city) params.set("city", city);
    if (preset) params.set("preset", preset);
    const qs = params.toString();
    router.push(`/events${qs ? `?${qs}` : ""}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="Find events"
      className="flex w-full flex-col gap-2 rounded-xl border border-[#E7E7E2] bg-white p-3 sm:flex-row"
    >
      <label htmlFor="home-search" className="sr-only">
        Search events by title or keyword
      </label>
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#687386]"
          aria-hidden
        />
        <input
          id="home-search"
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search concerts, workshops, comedy…"
          className="min-h-[44px] w-full rounded-lg bg-transparent py-2 pl-10 pr-3 text-base text-[#202B3C] placeholder:text-[#687386] focus:outline-2 focus:outline-[#B95F43]"
        />
      </div>
      <label className="sr-only" htmlFor="home-city">
        City
      </label>
      <select
        id="home-city"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="min-h-[44px] rounded-lg border border-[#E7E7E2] bg-white px-3 text-base text-[#202B3C] sm:w-40"
      >
        <option value="">All cities</option>
        {CITIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="home-date">
        Date
      </label>
      <select
        id="home-date"
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        className="min-h-[44px] rounded-lg border border-[#E7E7E2] bg-white px-3 text-base text-[#202B3C] sm:w-40"
      >
        <option value="">Any date</option>
        {DATE_PRESETS.map((p) => (
          <option key={p} value={p}>
            {DATE_PRESET_LABELS[p]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="min-h-[44px] rounded-lg bg-[#B95F43] px-6 text-base font-semibold text-white hover:bg-[#A9553B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B95F43]"
      >
        Search
      </button>
    </form>
  );
}
