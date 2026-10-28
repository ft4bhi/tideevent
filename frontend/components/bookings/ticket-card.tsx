import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { QRCodeBadge } from "@/components/bookings/qr-code";
import { frontendBaseUrl, isMockMode } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils/format";
import type { Booking } from "@/types/domain";

export function TicketCard({ booking }: { booking: Booking }) {
  const cancelled = booking.status === "CANCELLED";
  const ticketUrl = booking.ticket_token
    ? `${frontendBaseUrl()}/tickets/${booking.ticket_token}`
    : "";
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-[#202B3C] px-5 py-3 text-white">
        <p className="font-mono text-lg font-bold tracking-wider">{booking.ticket_id}</p>
        <Badge tone={cancelled ? "CANCELLED" : "CONFIRMED"}>{booking.status}</Badge>
      </div>
      {isMockMode() && (
        <p className="bg-amber-50 px-5 py-2 text-center text-xs font-semibold text-amber-800">
          Development mock booking — no real seat was reserved.
        </p>
      )}
      <div className="flex flex-col gap-2 p-5">
        <h2 className="text-xl font-bold text-[#202B3C]">{booking.event?.title ?? "Event"}</h2>
        {booking.event && (
          <>
            <p className="flex items-center gap-1.5 text-sm text-[#687386]">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              {formatDateTime(booking.event.starts_at)}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-[#687386]">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {booking.event.location}
            </p>
          </>
        )}
        <hr className="my-1 border-dashed border-[#E7E7E2]" />
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#687386]">Attendee</dt>
            <dd className="font-medium text-[#202B3C]">{booking.attendee_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#687386]">Booked on</dt>
            <dd className="font-medium text-[#202B3C]">{formatDateTime(booking.booked_at)}</dd>
          </div>
        </dl>
        {ticketUrl && booking.status === "CONFIRMED" && (
          <div className="mt-4">
            <QRCodeBadge value={ticketUrl} />
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <Link
            href="/my-bookings"
            className="rounded-lg border border-[#E7E7E2] px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5]"
          >
            My bookings
          </Link>
          <Link
            href="/events"
            className="rounded-lg border border-[#E7E7E2] px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5]"
          >
            Explore events
          </Link>
        </div>
      </div>
    </Card>
  );
}
