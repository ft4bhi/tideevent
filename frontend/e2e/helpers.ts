import { expect, type Page } from "@playwright/test";

export const ACCOUNTS = {
  attendee: { email: "attendee@example.com", password: "attendee123", name: "Aarav Sharma" },
  organizer: { email: "organizer@example.com", password: "organizer123", name: "Meera Nair" },
  admin: { email: "admin@example.com", password: "admin12345", name: "Admin" },
} as const;

export async function signOut(page: Page) {
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

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  // Successful login navigates away from the login form.
  await expect(page.getByRole("heading", { name: "Log in", exact: true })).toHaveCount(0);
}
