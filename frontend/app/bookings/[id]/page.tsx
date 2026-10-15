import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { TicketSkeleton } from "@/components/bookings/ticket-skeleton";
import { TicketView } from "@/components/bookings/ticket-view";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: "Your ticket" };
}

export default function BookingPage({ params }: Props) {
  return (
    <Suspense fallback={<TicketSkeleton />}>
      <BookingShell params={params} />
    </Suspense>
  );
}

async function BookingShell({ params }: Props) {
  const { id } = await params;
  return (
    <RequireAuth next={`/bookings/${id}`}>
      <TicketView id={id} />
    </RequireAuth>
  );
}
