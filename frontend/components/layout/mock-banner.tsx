import Link from "next/link";
import { isMockMode } from "@/lib/api/client";

/** Development-only indicator. Hidden in production and whenever the real API is active. */
export function MockBanner() {
  if (!isMockMode()) return null;
  return (
    <p className="bg-[#202B3C] px-4 py-2 text-center text-xs font-medium text-white">
      Development mock data — not the live API.{" "}
      <Link href="/events" className="underline underline-offset-2">
        Browse mock events
      </Link>
    </p>
  );
}
