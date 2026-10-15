import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, signOut } from "./helpers";

const JAZZ_ID = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
const PENDING_ID = "a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7";
const SEED_BOOKING_ID = "d0000000-0000-4000-8000-000000000001";
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

test("duplicate booking fails with error and no ticket (E-06)", async ({ page }) => {
  await signOut(page);
  await loginAs(page, ACCOUNTS.attendee.email, ACCOUNTS.attendee.password);

  // Seed attendee already holds a confirmed Jazz booking.
  await page.goto(`/events/${JAZZ_ID}/book`);
  await expect(page.getByRole("heading", { name: "Confirm booking" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText(/already have a booking/i)).toBeVisible();
  // Still on the booking page — no ticket created, no navigation.
  await expect(page).toHaveURL(new RegExp(`/events/${JAZZ_ID}/book`));
});

test("cross-user ticket URL is forbidden without data leak (E-07)", async ({ page }) => {
  await signOut(page);
  const email = `fresh${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Fresh User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await page.goto(`/bookings/${SEED_BOOKING_ID}`);
  await expect(page.getByText("Not your ticket")).toBeVisible();
  await expect(page.getByText(/^TD-/)).toHaveCount(0);
});

test("pending event is hidden from guests entirely (E-09 direct)", async ({ page }) => {
  await signOut(page);
  await page.goto(`/events/${PENDING_ID}`);
  // Non-owners get a plain not-found page: no details, no booking action.
  await expect(page.getByText("Event not found")).toBeVisible();
  await expect(page.getByRole("link", { name: "Book Now" })).toHaveCount(0);
});

test("errors are readable: auth, missing event, missing booking (E-14)", async ({ page }) => {
  await signOut(page);

  await page.goto("/login");
  await page.getByLabel("Email").fill(ACCOUNTS.attendee.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/incorrect email or password/i)).toBeVisible();

  await page.goto(`/events/${MISSING_ID}`);
  await expect(page.getByText("Event not found")).toBeVisible();

  await loginAs(page, ACCOUNTS.attendee.email, ACCOUNTS.attendee.password);
  await page.goto(`/bookings/${MISSING_ID}`);
  await expect(page.getByText("Booking not found")).toBeVisible();
});

test("no horizontal overflow at 360px across all MVP pages (E-13)", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  async function expectNoOverflow(url: string) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }

  await signOut(page);
  for (const url of [
    "/",
    "/events",
    `/events/${JAZZ_ID}`,
    "/login",
    "/register",
    `/events/${PENDING_ID}`,
    `/events/${MISSING_ID}`,
  ]) {
    await expectNoOverflow(url);
  }

  await loginAs(page, ACCOUNTS.attendee.email, ACCOUNTS.attendee.password);
  for (const url of [`/events/${JAZZ_ID}/book`, `/bookings/${SEED_BOOKING_ID}`, "/my-bookings"]) {
    await expectNoOverflow(url);
  }

  await loginAs(page, ACCOUNTS.organizer.email, ACCOUNTS.organizer.password);
  for (const url of [
    "/organizer",
    "/organizer/events",
    "/organizer/events/new",
    `/organizer/events/${JAZZ_ID}/edit`,
    `/organizer/events/${JAZZ_ID}/bookings`,
  ]) {
    await expectNoOverflow(url);
  }

  await loginAs(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  for (const url of ["/admin", "/admin/events", "/admin/users", "/admin/bookings"]) {
    await expectNoOverflow(url);
  }
});
