import { z } from "zod";
import { CATEGORIES, CITIES } from "@/config/site";

export const eventFormSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be 120 characters or less"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must be 5000 characters or less"),
  category: z.enum(CATEGORIES, { message: "Choose a category" }),
  starts_at: z
    .string()
    .min(1, "Start date and time is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date")
    .refine(
      (v) => new Date(v).getTime() > Date.now(),
      "Start must be in the future",
    ),
  location: z.string().min(1, "Venue is required"),
  city: z.enum(CITIES, { message: "Choose a city" }),
  capacity: z.coerce
    .number()
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(100000, "Capacity must be 100000 or less"),
  poster_url: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^https?:\/\/.+/.test(v),
      "Poster must be a valid http(s) URL or left empty",
    )
    .optional()
    .default(""),
  price_inr: z.coerce
    .number()
    .int("Price must be a whole number")
    .min(0, "Price cannot be negative")
    .default(0),
});

export type EventFormInput = z.infer<typeof eventFormSchema>;
/** Raw form values before coercion (what RHF actually handles). */
export type EventFormRawInput = z.input<typeof eventFormSchema>;

export const rejectSchema = z.object({
  reason: z.string().min(10, "Give a reason of at least 10 characters"),
});

export type RejectInput = z.infer<typeof rejectSchema>;
