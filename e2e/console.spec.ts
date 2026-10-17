import { expect, test } from "@playwright/test";

const PAGES = ["/", "/library", "/library?view=grid", "/highlights", "/collections", "/search?q=street", "/settings"];

test("core pages render without console errors or hydration mismatches", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${page.url()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));

  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
  }

  await page.goto("/library");
  await page.getByRole("link", { name: "The City That Forgot How to Walk", exact: true }).click();
  await expect(page.locator("mark.hl").first()).toBeVisible();

  expect(errors).toEqual([]);
});
