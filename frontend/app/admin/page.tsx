import Link from "next/link";
import { RequireRole } from "@/components/auth/require-auth";
import { AdminOverview } from "@/components/admin/admin-overview";

export const metadata = { title: "Admin overview" };

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Admin</h1>
        <p className="mt-1 text-[#687386]">Review queue, users, and bookings.</p>
      </div>
      <RequireRole roles={["ADMIN"]} next="/admin">
        <AdminOverview />
        <nav aria-label="Admin sections" className="flex flex-wrap gap-2">
          {[
            { href: "/admin/events", label: "Review events" },
            { href: "/admin/users", label: "Manage users" },
            { href: "/admin/bookings", label: "View bookings" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg border border-[#E7E7E2] bg-white px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </RequireRole>
    </div>
  );
}
