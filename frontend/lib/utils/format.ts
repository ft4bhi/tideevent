export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

export function priceLabel(priceInr: number | undefined | null): string {
  if (priceInr === undefined || priceInr === null) return "Price unavailable";
  if (priceInr === 0) return "Free";
  return `₹${priceInr.toLocaleString("en-IN")}`;
}

export function seatsLeft(capacity: number, bookedCount: number): number {
  return Math.max(0, capacity - bookedCount);
}

export function isSoldOut(capacity: number, bookedCount: number): boolean {
  return seatsLeft(capacity, bookedCount) <= 0;
}
