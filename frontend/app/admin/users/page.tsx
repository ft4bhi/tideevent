import { RequireRole } from "@/components/auth/require-auth";
import { UsersTable } from "@/components/admin/users-table";

export const metadata = { title: "Manage users" };

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Manage users</h1>
        <p className="mt-1 text-[#687386]">Search accounts and moderate access.</p>
      </div>
      <RequireRole roles={["ADMIN"]} next="/admin/users">
        <UsersTable />
      </RequireRole>
    </div>
  );
}
