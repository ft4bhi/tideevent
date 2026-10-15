"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/features/auth/session-context";
import type { Role } from "@/types/domain";

export function RequireAuth({
  children,
  next,
}: {
  children: React.ReactNode;
  next: string;
}) {
  const { user, loading } = useSession();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-6" aria-label="Checking sign-in status">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#E7E7E2]" />
        <div className="h-24 animate-pulse rounded-xl bg-[#E7E7E2]" />
      </div>
    );
  }

  if (!user) {
    const loginHref = `/login?next=${encodeURIComponent(next)}`;
    return (
      <div className="py-6">
        <Alert
          tone="info"
          title="Please log in"
          action={
            <div className="flex gap-2">
              <Button onClick={() => router.push(loginHref)} className="px-4 py-2 text-sm">
                Log in
              </Button>
              <Link
                href={`/register?next=${encodeURIComponent(next)}`}
                className="rounded-lg border border-[#E7E7E2] bg-white px-4 py-2 text-sm font-semibold text-[#202B3C]"
              >
                Create account
              </Link>
            </div>
          }
        >
          You need to be logged in to continue.
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}

/** Auth + role gate. Renders children only for signed-in users with an allowed role. */
export function RequireRole({
  roles,
  next,
  children,
}: {
  roles: Role[];
  next: string;
  children: React.ReactNode;
}) {
  return (
    <RequireAuth next={next}>
      <RoleCheck roles={roles}>{children}</RoleCheck>
    </RequireAuth>
  );
}

function RoleCheck({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useSession();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="py-6">
        <EmptyState
          icon={ShieldX}
          title="Not allowed"
          copy="Your account does not have access to this area."
          action={
            <Link
              href="/"
              className="rounded-lg bg-[#B95F43] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A9553B]"
            >
              Go home
            </Link>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
