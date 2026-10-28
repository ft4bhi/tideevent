"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TicketX } from "lucide-react";
import { TicketCard } from "@/components/bookings/ticket-card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { getBookingByToken } from "@/lib/api/endpoints/bookings";
import { isApiError, toMessage } from "@/lib/api/errors";
import type { Booking } from "@/types/domain";

export function TokenTicketView({ token }: { token: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [status, setStatus] = useState<"loading" | "forbidden" | "missing" | "error" | "ready">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    getBookingByToken(token).then(
      (b) => {
        if (!cancelled) {
          setBooking(b);
          setStatus("ready");
        }
      },
      (err: unknown) => {
        if (cancelled) return;
        if (isApiError(err) && err.status === 404) {
          setStatus("missing");
        } else {
          setStatus("error");
          setMessage(toMessage(err));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 py-6" aria-label="Loading ticket">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[#E7E7E2]" />
        <div className="h-64 animate-pulse rounded-xl bg-[#E7E7E2]" />
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="py-6">
        <EmptyState
          icon={TicketX}
          title="Ticket not found"
          copy="This ticket does not exist or has been cancelled."
          action={
            <Link
              href="/events"
              className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
            >
              Explore events
            </Link>
          }
        />
      </div>
    );
  }

  if (status === "error" || !booking) {
    return (
      <div className="py-6">
        <Alert tone="error" title="Could not load this ticket">
          {message}
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-6">
      <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Your ticket</h1>
      <TicketCard booking={booking} />
    </div>
  );
}
