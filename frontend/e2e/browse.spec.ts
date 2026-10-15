import { expect, test } from "@playwright/test";

test("guest can browse approved events and open details", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /discover events/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /monsoon jazz night/i }).first()).toBeVisible();

  await page.getByRole("link", { name: "Explore all" }).click();
  await expect(page).toHaveURL(/\/events/);
  await expect(page.getByRole("heading", { name: "Explore events" })).toBeVisible();

  // Filter by category: only comedy shows
  const categoryGroup = page.getByRole("group", { name: "Category" });
  await categoryGroup.getByRole("link", { name: "Comedy", exact: true }).click();
  await expect(page).toHaveURL(/category=COMEDY/);
  await expect(page.getByRole("link", { name: /laugh riot/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /monsoon jazz night/i })).toHaveCount(0);

  // Open details, verify booking action state
  await page.getByRole("link", { name: /laugh riot/i }).first().click();
  await expect(page.getByRole("heading", { name: "Stand-up: Laugh Riot" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sold out" })).toBeVisible();
});

test("no horizontal overflow on key pages (mobile)", async ({ page }) => {
  for (const url of ["/", "/events"]) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
