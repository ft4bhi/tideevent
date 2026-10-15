import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

describe("loginSchema (T-03)", () => {
  it("accepts a valid login", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
  it("rejects bad email and empty password", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "" });
    expect(r.success).toBe(false);
  });
});

describe("registerSchema (T-03)", () => {
  it("accepts a valid registration", () => {
    const r = registerSchema.safeParse({
      name: "Aarav",
      email: "a@b.com",
      password: "password123",
      role: "ATTENDEE",
    });
    expect(r.success).toBe(true);
  });
  it("rejects short password, bad email, and ADMIN role", () => {
    expect(
      registerSchema.safeParse({ name: "A", email: "a@b.com", password: "short", role: "ATTENDEE" }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ name: "A", email: "bad", password: "password123", role: "ATTENDEE" }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ name: "A", email: "a@b.com", password: "password123", role: "ADMIN" }).success,
    ).toBe(false);
  });
});
