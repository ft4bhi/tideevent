import { Suspense } from "react";
import { TicketSkeleton } from "@/components/bookings/ticket-skeleton";
import { TokenTicketView } from "@/components/bookings/token-ticket-view";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  return { title: "Your ticket" };
}

export default function TicketPage({ params }: Props) {
  return (
    <Suspense fallback={<TicketSkeleton />}>
      <TicketShell params={params} />
    </Suspense>
  );
}

async function TicketShell({ params }: Props) {
  const { token } = await params;
  return <TokenTicketView token={token} />;
}
