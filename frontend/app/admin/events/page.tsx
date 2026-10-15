import { RequireRole } from "@/components/auth/require-auth";
import { ApprovalQueue } from "@/components/admin/approval-queue";

export const metadata = { title: "Review events" };

export default function AdminEventsPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#202B3C]">Review events</h1>
        <p className="mt-1 text-[#687386]">
          Approve quality submissions. Rejections need a reason so organizers can fix and resubmit.
        </p>
      </div>
      <RequireRole roles={["ADMIN"]} next="/admin/events">
        <ApprovalQueue />
      </RequireRole>
    </div>
  );
}
