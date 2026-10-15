"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function RejectDialog({
  eventTitle,
  pending,
  serverError,
  onCancel,
  onConfirm,
}: {
  eventTitle: string;
  pending: boolean;
  serverError: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  // Close on Escape (unless a rejection is in flight).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, onCancel]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setValidation("Give a reason of at least 10 characters so the organizer can fix it.");
      return;
    }
    setValidation(null);
    onConfirm(reason.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Reject ${eventTitle}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-[#E7E7E2] bg-white p-5"
        noValidate
      >
        <div>
          <h2 className="text-lg font-bold text-[#202B3C]">Reject event</h2>
          <p className="mt-1 text-sm text-[#687386]">
            {eventTitle} — the organizer will see your reason and can resubmit.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reject-reason" className="text-sm font-semibold text-[#202B3C]">
            Rejection reason
          </label>
          <textarea
            id="reject-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What must change before approval?"
            disabled={pending}
            autoFocus
            className="min-h-[44px] w-full rounded-lg border border-[#E7E7E2] bg-white px-3 py-2 text-base text-[#202B3C] placeholder:text-[#687386] focus:border-[#B95F43] focus:outline-2 focus:outline-[#B95F43]"
          />
          {validation && (
            <p role="alert" className="text-sm text-red-700">
              {validation}
            </p>
          )}
          {serverError && (
            <p role="alert" className="text-sm text-red-700">
              {serverError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? "Rejecting…" : "Reject event"}
          </Button>
        </div>
      </form>
    </div>
  );
}
