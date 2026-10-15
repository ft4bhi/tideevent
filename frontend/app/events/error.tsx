"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-6">
      <Alert
        tone="error"
        title="Something went wrong"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-lg border border-[#E7E7E2] px-4 py-2 text-sm font-semibold text-[#202B3C]"
            >
              Go home
            </Link>
          </div>
        }
      >
        {error.message || "Could not load events."}
      </Alert>
    </div>
  );
}
