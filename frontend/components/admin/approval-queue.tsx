"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RejectDialog } from "@/components/admin/reject-dialog";
import { adminEvents, reviewEvent } from "@/lib/api/endpoints/admin";
import { toMessage } from "@/lib/api/errors";
import { formatDateTime, priceLabel } from "@/lib/utils/format";
import type { EventItem } from "@/types/domain";

export function ApprovalQueue() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<EventItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminEvents("PENDING").then(
      (list) => {
        if (!cancelled) setEvents(list);
      },
      (err: unknown) => {
        if (!cancelled) setError(toMessage(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function approve(e: EventItem) {
    setProcessingId(e.id);
    setActionError(null);
    setNotice(null);
    try {
      await reviewEvent(e.id, "APPROVE");
      setEvents((prev) => (prev ?? []).filter((x) => x.id !== e.id));
      setNotice(`“${e.title}” approved — it is now public and bookable.`);
    } catch (err) {
      setActionError(toMessage(err));
    } finally {
      setProcessingId(null);
    }
  }

  async function reject(reason: string) {
    if (!rejectTarget) return;
    const target = rejectTarget;
    setProcessingId(target.id);
    setActionError(null);
    setNotice(null);
    try {
      await reviewEvent(target.id, "REJECT", reason);
      setEvents((prev) => (prev ?? []).filter((x) => x.id !== target.id));
      setRejectTarget(null);
      setNotice(`“${target.title}” rejected with feedback for the organizer.`);
    } catch (err) {
      setActionError(toMessage(err));
    } finally {
      setProcessingId(null);
    }
  }

  if (error) {
    return (
      <Alert tone="error" title="Could not load the review queue">
        {error}
      </Alert>
    );
  }

  if (events === null) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading review queue">
        {[0, 1].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-[#E7E7E2]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="error" title="Review action failed">{actionError}</Alert>}

      {events.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Queue is clear"
          copy="No events are waiting for review right now."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {events.map((e) => (
            <li key={e.id}>
              <Card className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[#202B3C]">{e.title}</h2>
                  <Badge tone="PENDING">PENDING</Badge>
                </div>
                <p className="text-sm text-[#202B3C]">{e.description}</p>
                <dl className="flex flex-col gap-1 text-sm text-[#687386]">
                  <div className="flex gap-2">
                    <dt className="font-semibold">When:</dt>
                    <dd>{formatDateTime(e.starts_at)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold">Venue:</dt>
                    <dd>{e.location} ({e.city})</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold">Capacity:</dt>
                    <dd>{e.capacity}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold">Price:</dt>
                    <dd>{priceLabel(e.price_inr)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold">Organizer:</dt>
                    <dd>{e.organizer_name}</dd>
                  </div>
                </dl>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve(e)}
                    disabled={processingId === e.id}
                  >
                    {processingId === e.id ? "Approving…" : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setActionError(null);
                      setRejectTarget(e);
                    }}
                    disabled={processingId === e.id}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {rejectTarget && (
        <RejectDialog
          eventTitle={rejectTarget.title}
          pending={processingId === rejectTarget.id}
          serverError={actionError}
          onCancel={() => {
            if (processingId !== rejectTarget.id) {
              setRejectTarget(null);
              setActionError(null);
            }
          }}
          onConfirm={reject}
        />
      )}
    </div>
  );
}
