import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, signOut } from "./helpers";

const REJECTED_EDIT_URL =
  "/organizer/events/b8b8b8b8-b8b8-48b8-88b8-b8b8b8b8b8b8/edit";
const JAZZ_EDIT_URL =
  "/organizer/events/a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1/edit";
const JAZZ_BOOKINGS_URL =
  "/organizer/events/a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1/bookings";

test("organizer overview + create event, active stays visible (E-08, E-09)", async ({ page }) => {
  await signOut(page);
  await loginAs(page, ACCOUNTS.organizer.email, ACCOUNTS.organizer.password);

  await page.goto("/organizer");
  await expect(page.getByRole("heading", { name: "Organizer" })).toBeVisible();
  await expect(page.getByText("Total events")).toBeVisible();
  await expect(page.getByText("Active events")).toBeVisible();

  const title = `E2E Workshop ${Date.now()}`;
  await page.goto("/organizer/events/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("An end-to-end test workshop with enough detail.");
  await page.getByLabel("Starts at").fill("2026-12-15T19:00");
  await page.getByLabel("Venue").fill("Test Hall, Kothrud");
  await page.getByLabel("Capacity (seats)").fill("50");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL("/organizer/events");
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText("ACTIVE").first()).toBeVisible();

  // Active event is publicly bookable/searchable.
  await signOut(page);
  await page.goto(`/events?q=${encodeURIComponent(title)}`);
  await expect(page.getByText(title)).toBeVisible();
});

test("cancelled event shows reason and can be reactivated (E-12)", async ({ page }) => {
  await signOut(page);
  await loginAs(page, ACCOUNTS.organizer.email, ACCOUNTS.organizer.password);

  await page.goto(REJECTED_EDIT_URL);
  await expect(page.getByText("CANCELLED").first()).toBeVisible();
  await expect(page.getByText(/unlit highway/i)).toBeVisible();
  await page.getByLabel("Title").fill(`Marathon Practice Run v2 ${Date.now()}`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/saved/i).first()).toBeVisible();
});

test("organizer cannot manage another organizer's event (E-10)", async ({ page }) => {
  await signOut(page);
  const email = `org${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Second Org");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByLabel("I want to").selectOption("ORGANIZER");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await page.goto(JAZZ_EDIT_URL);
  await expect(page.getByText("Not your event")).toBeVisible();
  await page.goto(JAZZ_BOOKINGS_URL);
  await expect(page.getByText("Not your event")).toBeVisible();
});

test("attendee cannot open organizer area (role gate)", async ({ page }) => {
  await signOut(page);
  await loginAs(page, ACCOUNTS.attendee.email, ACCOUNTS.attendee.password);
  await page.goto("/organizer");
  await expect(page.getByText("Not allowed")).toBeVisible();
});
