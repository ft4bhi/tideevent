import { describe, expect, it } from "vitest";
import { eventFormSchema } from "@/lib/validation/event";

const valid = {
  title: "E2E Jazz Night",
  description: "A proper description longer than ten characters.",
  category: "MUSIC",
  starts_at: "2026-12-15T19:00",
  location: "NCPA Lawns",
  city: "Mumbai",
  capacity: 100,
  poster_url: "",
  price_inr: 0,
} as const;

describe("eventFormSchema (T-03)", () => {
  it("accepts a valid event", () => {
    expect(eventFormSchema.safeParse({ ...valid }).success).toBe(true);
  });
  it("rejects past dates", () => {
    expect(
      eventFormSchema.safeParse({ ...valid, starts_at: "2020-01-01T10:00" }).success,
    ).toBe(false);
  });
  it("rejects zero capacity and short titles", () => {
    expect(eventFormSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...valid, title: "AB" }).success).toBe(false);
  });
  it("rejects invalid poster URLs but allows empty", () => {
    expect(eventFormSchema.safeParse({ ...valid, poster_url: "not-a-url" }).success).toBe(false);
    expect(
      eventFormSchema.safeParse({ ...valid, poster_url: "https://example.com/p.png" }).success,
    ).toBe(true);
  });
  it("rejects unknown category/city", () => {
    expect(eventFormSchema.safeParse({ ...valid, category: "NOPE" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...valid, city: "Atlantis" }).success).toBe(false);
  });
});
