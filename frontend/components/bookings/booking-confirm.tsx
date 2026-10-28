"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-context";
import { bookEvent, type BookingCreateInput } from "@/lib/api/endpoints/bookings";
import { isApiError, toMessage } from "@/lib/api/errors";
import { formatDateTime, priceLabel } from "@/lib/utils/format";
import type { EventItem } from "@/types/domain";

function isGAMode(event: EventItem): boolean {
  return event.booking_mode === "GENERAL_ADMISSION";
}

export function BookingConfirm({ event }: { event: EventItem }) {
  const router = useRouter();
  const { user } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const [pending, setPending] = useState(false);

  const isGA = isGAMode(event);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());

  const ticketTypes = event.ticket_types ?? [];
  const sellableSeats = event.sections
    ?.flatMap((section) =>
      section.rows.flatMap((row) =>
        row.seats.filter((seat) => seat.is_sellable)
      )
    )
    .sort((a, b) => a.number - b.number) ?? [];

  const hasSelection = isGA
    ? selectedTicketTypeId !== null
    : selectedSeatIds.size > 0;

  const body: BookingCreateInput = isGA
    ? selectedTicketTypeId
      ? { items: [{ ticket_type_id: selectedTicketTypeId, quantity }] }
      : {}
    : { seats: Array.from(selectedSeatIds) };

  async function onConfirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    setFieldErrors(null);

    if (!hasSelection) {
      setError(isGA ? "Please select a ticket type." : "Please select at least one seat.");
      setPending(false);
      return;
    }

    try {
      const booking = await bookEvent(event.id, body);
      router.push(`/tickets/${booking.ticket_token}`);
      router.refresh();
    } catch (err) {
      setPending(false);
      if (isApiError(err)) {
        if (err.fields) {
          setFieldErrors(err.fields);
        }
        setError(toMessage(err));
      } else {
        setError(toMessage(err));
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-6">
      <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Confirm booking</h1>

      <Card className="flex flex-col gap-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#687386]">Event</p>
        <h2 className="text-xl font-bold text-[#202B3C]">{event.title}</h2>
        <p className="flex items-center gap-1.5 text-sm text-[#687386]">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          {formatDateTime(event.starts_at)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-[#687386]">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {event.location}
        </p>
        <p className="text-sm font-semibold text-[#202B3C]">{priceLabel(event.price_inr)}</p>
      </Card>

      <Card className="flex flex-col gap-1 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#687386]">Attendee</p>
        <p className="font-medium text-[#202B3C]">{user?.name}</p>
        <p className="text-sm text-[#687386]">{user?.email}</p>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#687386]">
          {isGA ? "Ticket" : "Seats"}
        </p>
        {isGA ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[#202B3C] mb-1">
                  Ticket type
                </label>
                <select
                  value={selectedTicketTypeId ?? ""}
                  onChange={(e) => {
                    setSelectedTicketTypeId(e.target.value || null);
                    setQuantity(1);
                  }}
                  className="Input w-full rounded-lg border border-[#E7E7E2] bg-white px-3 py-2 text-base text-[#202B3C] focus:border-[#B95F43] focus:outline-2 focus:outline-[#B95F43]"
                >
                  <option value="">Select a ticket type</option>
                  {ticketTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name} — {priceLabel(tt.price_inr)} ({tt.remaining} remaining)
                    </option>
                  ))}
                </select>
                {fieldErrors?.items && (
                  <p className="text-xs text-red-700 mt-1">{fieldErrors.items}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#202B3C] mb-1">
                  Quantity
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value || 1))))}
                  disabled={!selectedTicketTypeId}
                />
                {selectedTicketTypeId && ticketTypes.some((tt) => tt.id === selectedTicketTypeId) && (
                  <p className="text-xs text-[#687386] mt-1">
                    Max {Math.min(10, ticketTypes.find((tt) => tt.id === selectedTicketTypeId)!.remaining)} per line
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
              {sellableSeats.map((seat) => (
                <label key={seat.id} className="flex items-center gap-1.5 cursor-pointer rounded border border-[#E7E7E2] p-2 hover:bg-[#F8F8F5]">
                  <input
                    type="checkbox"
                    checked={selectedSeatIds.has(seat.id)}
                    onChange={() => {
                      const next = new Set(selectedSeatIds);
                      if (next.has(seat.id)) next.delete(seat.id);
                      else next.add(seat.id);
                      setSelectedSeatIds(next);
                    }}
                    className="rounded border-[#B95F43] text-[#B95F43] focus:ring-[#B95F43]"
                  />
                  <span className="text-sm text-[#202B3C]">{seat.number}</span>
                  {!seat.is_accessible && <span className="text-xs text-[#687386]">· standard</span>}
                </label>
              ))}
              {sellableSeats.length === 0 && (
                <p className="text-sm text-[#687386] col-span-4">No sellable seats available.</p>
              )}
            </div>
            {fieldErrors?.seats && (
              <p className="text-xs text-red-700 mt-1">{fieldErrors.seats}</p>
            )}
          </>
        )}
      </Card>

      {error && (
        <Alert tone="error" title="Booking failed — no ticket was created">
          {error}
        </Alert>
      )}

      <Button
        onClick={onConfirm}
        disabled={pending || !hasSelection}
        className="w-full"
      >
        {pending ? "Confirming…" : "Confirm booking"}
      </Button>
      <p className="text-xs text-[#687386]">No payment needed — confirming reserves your seat.</p>
    </div>
  );
}
