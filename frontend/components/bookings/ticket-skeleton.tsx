export function TicketSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 py-6" aria-label="Loading ticket">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-[#E7E7E2]" />
      <div className="h-64 animate-pulse rounded-xl bg-[#E7E7E2]" />
    </div>
  );
}
