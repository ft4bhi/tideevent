import { expect, test, type Page } from "@playwright/test";

const ATTENDEE = { email: "attendee@example.com", password: "attendee123" };
const SOLDOUT_BOOK_URL =
  "/events/b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2/book";

async function signOut(page: Page) {
  await page.goto("/");
  // Wait for the client session to resolve before branching: the auth area
  // renders nothing while loading, so snapshot checks would misfire.
  await page.waitForFunction(() => {
    const h = document.querySelector("header");
    if (!h) return false;
    const t = (h as HTMLElement).innerText || "";
    if (t.includes("Sign out") || t.includes("Log in")) return true;
    const btn = document.querySelector(
      'button[aria-label="Open menu"], button[aria-label="Close menu"]',
    );
    // offsetParent is null for display:none (desktop) — existence is not enough.
    return !!btn && (btn as HTMLElement).offsetParent !== null;
  });
  const loginLink = page.getByRole("link", { name: "Log in" }).first();
  const desktopBtn = page.locator("header").getByRole("button", { name: /^sign out$/i });
  if (await desktopBtn.isVisible()) {
    await desktopBtn.click();
    await expect(loginLink).toBeVisible();
    return;
  }
  // Mobile flow (hamburger menu present).
  const openMenuBtn = page.getByRole("button", { name: /open menu/i });
  if (await openMenuBtn.isVisible()) {
    await openMenuBtn.click();
    await expect(page.getByRole("button", { name: /close menu/i })).toBeVisible();
    const mobileSignOut = page.getByRole("button", { name: /sign out/i });
    if (await mobileSignOut.isVisible()) {
      await mobileSignOut.click();
      // Menu closes on sign-out; reopen and verify logged-out links.
      await expect(page.getByRole("button", { name: /close menu/i })).toHaveCount(0);
      await page.getByRole("button", { name: /open menu/i }).click();
    }
    await expect(loginLink).toBeVisible();
    return;
  }
  // Desktop and already logged out.
  await expect(loginLink).toBeVisible();
}

test("guest booking gate → login → confirm → ticket (E-02, E-03, E-05)", async ({ page }) => {
  await signOut(page);

  // Pick a bookable event the demo attendee hasn't booked yet
  await page.goto("/events");
  await page.getByRole("link", { name: /hacknight/i }).first().click();
  await expect(page.getByRole("heading", { name: "HackNight: Build & Demo" })).toBeVisible();

  // Guest clicks Book Now → asked to log in, with return path
  await page.getByRole("link", { name: "Book Now" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);

  // Log in → returned to booking page
  await page.getByLabel("Email").fill(ATTENDEE.email);
  await page.getByLabel("Password").fill(ATTENDEE.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirm booking" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Aarav Sharma")).toBeVisible();

  // Confirm → ticket with ID + demo badge
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
  await expect(page.getByText(/^TD-/).first()).toBeVisible();
  await expect(page.getByText(/no real seat was reserved/i)).toBeVisible();
});

test("sold-out event cannot be booked (E-04)", async ({ page }) => {
  await page.goto(SOLDOUT_BOOK_URL);
  await expect(page.getByText("Sold out")).toBeVisible();
  await expect(page.getByRole("button", { name: /confirm booking/i })).toHaveCount(0);
});

test("register → auto-login → empty bookings (E-01 auth)", async ({ page }) => {
  await signOut(page);
  const email = `new${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/my-bookings");
  await expect(page.getByText("No bookings yet")).toBeVisible();
});

test("duplicate email shows a readable error", async ({ page }) => {
  await signOut(page);
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Someone");
  await page.getByLabel("Email").fill(ATTENDEE.email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/already exists/i)).toBeVisible();
});
