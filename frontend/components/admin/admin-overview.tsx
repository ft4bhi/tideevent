"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { adminBookings, adminEvents, adminUsers } from "@/lib/api/endpoints/admin";
import { listEvents } from "@/lib/api/endpoints/events";
import { toMessage } from "@/lib/api/errors";

export function AdminOverview() {
  const [stats, setStats] = useState<{ label: string; value: number }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adminUsers(),
      adminEvents("ACTIVE"),
      adminBookings(),
      listEvents(),
    ]).then(
      ([users, pending, bookings, pub]) => {
        if (cancelled) return;
        setStats([
          { label: "Users", value: users.length },
          { label: "Active events", value: pending.length },
          { label: "Bookings", value: bookings.length },
          { label: "Public events", value: pub.meta.total },
        ]);
      },
      (err: unknown) => {
        if (!cancelled) setError(toMessage(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Alert tone="error" title="Could not load the overview">
        {error}
      </Alert>
    );
  }

  if (stats === null) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Loading overview">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[#E7E7E2]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="p-4">
          <p className="text-3xl font-bold text-[#202B3C]">{s.value}</p>
          <p className="mt-1 text-sm text-[#687386]">{s.label}</p>
        </Card>
      ))}
    </div>
  );
}
