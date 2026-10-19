"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_LABELS, CITIES } from "@/config/site";
import { toMessage } from "@/lib/api/errors";
import { eventFormSchema, type EventFormInput, type EventFormRawInput } from "@/lib/validation/event";
import type { EventItem } from "@/types/domain";

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventForm({
  initial,
  submitLabel,
  onSubmit,
  onSaved,
}: {
  initial?: EventItem;
  submitLabel: string;
  onSubmit: (values: EventFormInput) => Promise<EventItem>;
  onSaved?: (event: EventItem) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventFormRawInput>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: initial
      ? {
          title: initial.title,
          description: initial.description,
          category: initial.category,
          starts_at: toDateTimeLocal(initial.starts_at),
          location: initial.location,
          city: initial.city as EventFormInput["city"],
          capacity: initial.capacity,
          poster_url: initial.poster_url ?? "",
          price_inr: initial.price_inr,
        }
      : { category: "MUSIC", city: "Mumbai", capacity: 100, price_inr: 0, poster_url: "" },
  });

  async function handle(raw: EventFormRawInput) {
    setServerError(null);
    setSavedNote(null);
    // The resolver already validated; parse applies coercion for the API call.
    const values: EventFormInput = eventFormSchema.parse(raw);
    try {
      const saved = await onSubmit(values);
      if (onSaved) {
        onSaved(saved);
        return;
      }
      setSavedNote(
        saved.status === "PENDING"
          ? "Saved — your event is pending review."
          : "Saved.",
      );
    } catch (err) {
      setServerError(toMessage(err));
    }
  }

  const inputCls =
    "min-h-[44px] w-full rounded-lg border border-[#E7E7E2] bg-white px-3 text-base text-[#202B3C] focus:border-[#B95F43] focus:outline-2 focus:outline-[#B95F43]";

  return (
    <form onSubmit={handleSubmit(handle)} className="flex flex-col gap-4" noValidate>
      {serverError && (
        <Alert tone="error" title="Could not save the event">
          {serverError}
        </Alert>
      )}
      {savedNote && <Alert tone="success">{savedNote}</Alert>}

      <FormField label="Title" htmlFor="event-title" error={errors.title?.message}>
        <Input id="event-title" placeholder="Summer Music Night" {...register("title")} />
      </FormField>

      <FormField label="Description" htmlFor="event-description" error={errors.description?.message}>
        <textarea
          id="event-description"
          rows={4}
          placeholder="What should attendees expect?"
          {...register("description")}
          className={inputCls}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Category" htmlFor="event-category" error={errors.category?.message}>
          <select id="event-category" {...register("category")} className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="City" htmlFor="event-city" error={errors.city?.message}>
          <select id="event-city" {...register("city")} className={inputCls}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Starts at" htmlFor="event-starts" error={errors.starts_at?.message}>
          <Input id="event-starts" type="datetime-local" {...register("starts_at")} />
        </FormField>
        <FormField label="Venue" htmlFor="event-location" error={errors.location?.message}>
          <Input id="event-location" placeholder="City Amphitheatre" {...register("location")} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Capacity (seats)" htmlFor="event-capacity" error={errors.capacity?.message}>
          <Input id="event-capacity" type="number" min={1} {...register("capacity")} />
        </FormField>
        <FormField
          label="Price in ₹ (0 = free)"
          htmlFor="event-price"
          error={errors.price_inr?.message}
        >
          <Input id="event-price" type="number" min={0} {...register("price_inr")} />
        </FormField>
      </div>

      <FormField
        label="Poster image URL (optional)"
        htmlFor="event-poster"
        error={errors.poster_url?.message}
      >
        <Input id="event-poster" type="url" placeholder="https://…" {...register("poster_url")} />
      </FormField>

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
