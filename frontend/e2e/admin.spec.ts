import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, signOut } from "./helpers";

test("admin overview + reject flow with validation (E-11 reject, E-15)", async ({ page }) => {
  await signOut(page);
  await loginAs(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("Pending approvals", { exact: true })).toBeVisible();
  await expect(page.getByText("Users", { exact: true })).toBeVisible();

  await page.goto("/admin/events");
  await expect(page.getByRole("heading", { name: "Review events" })).toBeVisible();
  await expect(page.getByText("Indie Film Screening")).toBeVisible();

  // Reject requires a real reason.
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Rejection reason").fill("short");
  await page.getByRole("button", { name: "Reject event" }).click();
  await expect(page.getByText(/at least 10 characters/i)).toBeVisible();

  await page.getByLabel("Rejection reason").fill("Please add venue permits and resubmit.");
  await page.getByRole("button", { name: "Reject event" }).click();
  await expect(page.getByText(/rejected with feedback/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByText("Queue is clear")).toBeVisible();
});

test("admin approves pending event (E-11 approve)", async ({ page }) => {
  await signOut(page);
  await loginAs(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);

  await page.goto("/admin/events");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/approved — it is now public/i)).toBeVisible();
  await expect(page.getByText("Queue is clear")).toBeVisible();
});

test("admin suspends user and login is blocked (E-17)", async ({ page }) => {
  await signOut(page);
  await loginAs(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);

  await page.goto("/admin/users");
  await page.getByLabel("Search users by name or email").fill("attendee@example.com");
  await expect(page.getByText("Aarav Sharma")).toBeVisible();
  await page.getByRole("button", { name: "Suspend" }).click();
  await expect(page.getByRole("button", { name: "Reinstate" })).toBeVisible();

  await signOut(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(ACCOUNTS.attendee.email);
  await page.getByLabel("Password").fill(ACCOUNTS.attendee.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/suspended/i)).toBeVisible();
});

test("admin bookings table + role gates", async ({ page }) => {
  await signOut(page);
  await loginAs(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);

  await page.goto("/admin/bookings");
  await expect(page.getByRole("heading", { name: "All bookings" })).toBeVisible();
  await expect(page.getByText(/^TD-/).first()).toBeVisible();

  // Attendee is locked out of admin areas.
  await signOut(page);
  await loginAs(page, ACCOUNTS.attendee.email, ACCOUNTS.attendee.password);
  await page.goto("/admin");
  await expect(page.getByText("Not allowed")).toBeVisible();
  await page.goto("/admin/events");
  await expect(page.getByText("Not allowed")).toBeVisible();
});
