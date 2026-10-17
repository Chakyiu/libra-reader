import { expect, test } from "@playwright/test";
import { selectArticleText } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("reads on a phone: bottom navigation, reading sheet, annotations, no sideways scroll", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Primary" }).filter({ has: page.getByRole("button", { name: "Add content" }) });
  await expect(tabs).toBeVisible();

  await tabs.getByRole("link", { name: "Library" }).click();
  await expect(page).toHaveURL(/\/library/);
  await page.getByRole("link", { name: "The City That Forgot How to Walk", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The City That Forgot How to Walk" })).toBeVisible();

  // The tab bar steps aside while reading.
  await expect(page.getByRole("button", { name: "Add content" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Reading settings" }).click();
  const sheet = page.getByRole("dialog", { name: "Reading" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("radio", { name: "Grotesk" }).click();
  await expect(page.locator("article.article")).toHaveAttribute("data-font", "SANS");
  await sheet.getByRole("radio", { name: "Newsreader" }).click();
  await expect(page.locator("article.article")).toHaveAttribute("data-font", "SERIF");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "Annotations" }).click();
  const annotations = page.getByRole("dialog", { name: "Annotations" });
  await expect(annotations).toContainText("A street that cannot be crossed on foot");
  await annotations.getByRole("button", { name: /A street that cannot be crossed on foot/ }).click();
  await expect(annotations).toBeHidden();

  await selectArticleText(page, "Comfort does not have a funding stream.");
  await expect(page.getByRole("toolbar", { name: "Selection actions" })).toBeVisible();
});

test("adds content from the phone's centre button as a bottom sheet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add content" }).click();
  const dialog = page.getByRole("dialog", { name: "Add content" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box && box.y + box.height).toBeGreaterThan(830);
  await expect(dialog.getByRole("tab", { name: /URL/ })).toBeVisible();
});
