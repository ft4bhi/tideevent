"use client";

import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/features/auth/session-context";
import { adminUsers, setUserStatus } from "@/lib/api/endpoints/admin";
import { toMessage } from "@/lib/api/errors";
import type { User } from "@/types/domain";

export function UsersTable() {
  const { user: me } = useSession();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      adminUsers(query.trim() || undefined).then(
        (list) => {
          if (!cancelled) {
            setUsers(list);
            setError(null);
          }
        },
        (err: unknown) => {
          if (!cancelled) setError(toMessage(err));
        },
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  async function toggleStatus(u: User) {
    const next = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setProcessingId(u.id);
    setActionError(null);
    try {
      const updated = await setUserStatus(u.id, next);
      setUsers((prev) => (prev ?? []).map((x) => (x.id === u.id ? updated : x)));
    } catch (err) {
      setActionError(toMessage(err));
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form role="search" aria-label="Search users" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="user-search" className="sr-only">
          Search users by name or email
        </label>
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#687386]"
            aria-hidden
          />
          <input
            id="user-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="min-h-[44px] w-full rounded-lg border border-[#E7E7E2] bg-white py-2 pl-10 pr-3 text-base text-[#202B3C] placeholder:text-[#687386] focus:border-[#B95F43] focus:outline-2 focus:outline-[#B95F43]"
          />
        </div>
      </form>

      {actionError && <Alert tone="error" title="User action failed">{actionError}</Alert>}

      {error ? (
        <Alert tone="error" title="Could not load users">
          {error}
        </Alert>
      ) : users === null ? (
        <div className="flex flex-col gap-3" aria-label="Loading users">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#E7E7E2]" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          copy={query ? `Nothing matches “${query}”.` : "No users yet."}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {users.map((u) => {
            const isSelf = me?.id === u.id;
            return (
              <li key={u.id}>
                <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-[#202B3C]">{u.name}</p>
                      <Badge>{u.role}</Badge>
                      <Badge tone={u.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED"}>
                        {u.status}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-[#687386]">{u.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStatus(u)}
                    disabled={processingId === u.id || isSelf}
                    title={isSelf ? "You cannot suspend your own account" : undefined}
                    className="shrink-0 rounded-lg border border-[#E7E7E2] px-4 py-2 text-sm font-semibold text-[#202B3C] hover:bg-[#F8F8F5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingId === u.id
                      ? "Working…"
                      : u.status === "ACTIVE"
                        ? "Suspend"
                        : "Reinstate"}
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
