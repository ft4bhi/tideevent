"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_LABELS, CITIES } from "@/config/site";
import { isApiError, toMessage } from "@/lib/api/errors";
import { eventFormSchema, type EventFormInput, type EventFormRawInput } from "@/lib/validation/event";
import type { EventItem } from "@/types/domain";
import { apiBaseUrl } from "@/lib/api/client";

const FORM_FIELDS = [
  "title",
  "description",
  "category",
  "starts_at",
  "location",
  "city",
  "capacity",
  "poster_file",
] as const;

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
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const initialPoster = initial?.poster_url?.startsWith("/media/")
    ? `${apiBaseUrl().replace(/\/api\/v1\/?$/, "")}${initial.poster_url}`
    : initial?.poster_url || null;
  const [posterPreview, setPosterPreview] = useState<string | null>(initialPoster);
  const [posterError, setPosterError] = useState<string | null>(null);
  const localPreview = useMemo(() => posterFile ? URL.createObjectURL(posterFile) : null, [posterFile]);
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
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
          poster_file: undefined,
          remove_poster: false,
          price_inr: initial.price_inr,
        }
      : { category: "MUSIC", city: "Mumbai", capacity: 100, price_inr: 0 },
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
      setSavedNote("Saved.");
    } catch (err) {
      const fields = isApiError(err) ? err.fields : undefined;
      const entries = fields ? Object.entries(fields) : [];
      if (entries.length === 0) {
        setServerError(toMessage(err));
        return;
      }
      const unmapped: string[] = [];
      for (const [key, message] of entries) {
        if (FORM_FIELDS.includes(key as (typeof FORM_FIELDS)[number])) {
          setError(key as keyof EventFormRawInput, { type: "server", message });
        } else {
          unmapped.push(message);
        }
      }
      setServerError(
        unmapped.length ? `${toMessage(err)} ${unmapped.join(" ")}` : null,
      );
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
        label="Poster image (optional)"
        htmlFor="event-poster"
        error={errors.poster_file?.message}
      >
        <div className="flex flex-col gap-3">
          {(localPreview || posterPreview) && <Image src={localPreview || posterPreview!} alt="Selected event poster preview" width={288} height={160} unoptimized className="h-40 w-full rounded-lg object-cover sm:w-72" />}
          <input id="event-poster" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-describedby="event-poster-help" className="block w-full text-sm text-[#202B3C] file:mr-3 file:rounded-lg file:border-0 file:bg-[#F8F8F5] file:px-4 file:py-2"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              setPosterError(null);
              if (!file) return;
              if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setPosterError("Choose a JPG, JPEG, or WebP image."); e.currentTarget.value = ""; return; }
              if (file.size > 5 * 1024 * 1024) { setPosterError("Image must be 5 MB or smaller."); e.currentTarget.value = ""; return; }
              setPosterFile(file);
              setPosterPreview(null);
              setValue("poster_file", file, { shouldValidate: true });
              setValue("remove_poster", false);
            }} />
          <p id="event-poster-help" className="text-sm text-[#687386]">Optional. JPG, JPEG, PNG, or WebP, up to 5 MB.</p>
          {(posterError || errors.poster_file?.message) && <p role="alert" className="text-sm text-red-700">{posterError || errors.poster_file?.message}</p>}
          {(posterFile || posterPreview) && <button type="button" className="self-start text-sm font-medium text-[#B95F43] underline"
            onClick={() => { setPosterFile(null); setPosterPreview(null); setValue("poster_file", undefined); setValue("remove_poster", Boolean(initial?.poster_url)); }}>Remove poster</button>}
        </div>
      </FormField>

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
