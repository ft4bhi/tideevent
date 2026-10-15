import { RequireAuth } from "@/components/auth/require-auth";
import { BookingsList } from "@/components/bookings/bookings-list";

export const metadata = { title: "My bookings" };

export default function MyBookingsPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">My bookings</h1>
        <p className="mt-1 text-[#687386]">Your tickets, all in one place.</p>
      </div>
      <RequireAuth next="/my-bookings">
        <BookingsList />
      </RequireAuth>
    </div>
  );
}
