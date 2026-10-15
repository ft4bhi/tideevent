import { RequireRole } from "@/components/auth/require-auth";
import { AdminBookingsTable } from "@/components/admin/admin-bookings-table";

export const metadata = { title: "All bookings" };

export default function AdminBookingsPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">All bookings</h1>
        <p className="mt-1 text-[#687386]">Every ticket across all events.</p>
      </div>
      <RequireRole roles={["ADMIN"]} next="/admin/bookings">
        <AdminBookingsTable />
      </RequireRole>
    </div>
  );
}
