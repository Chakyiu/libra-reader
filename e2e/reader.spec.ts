import { expect, test } from "@playwright/test";
import { openFromLibrary, selectArticleText } from "./helpers";

test("highlights a passage, attaches a note, and keeps both after reload", async ({ page }) => {
  const quote = "It is a completed experiment.";
  await openFromLibrary(page, "On Not Finishing Books", "/library?status=inbox");

  await selectArticleText(page, quote);
  const toolbar = page.getByRole("toolbar", { name: "Selection actions" });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Add note" }).click();

  const dialog = page.getByRole("dialog", { name: "Add a note" });
  await expect(dialog).toContainText(quote);
  await dialog.getByLabel("Your note").fill("Permission to stop, and to say why.");
  await dialog.getByRole("radio", { name: "Sage" }).click();
  await dialog.getByRole("button", { name: "Save note" }).click();

  await expect(page.getByText("Note saved", { exact: true })).toBeVisible();
  const mark = page.locator("mark.hl", { hasText: quote });
  await expect(mark).toHaveAttribute("data-note", "true");
  await expect(mark).toHaveAttribute("data-color", "SAGE");

  await page.reload();
  await expect(page.locator("mark.hl", { hasText: quote })).toHaveAttribute("data-color", "SAGE");
  const panel = page.getByRole("complementary", { name: "Annotations" });
  await expect(panel).toContainText(quote);
  await expect(panel).toContainText("Permission to stop, and to say why.");

  await page.goto("/highlights");
  await expect(page.getByText("Permission to stop, and to say why.")).toBeVisible();
  await page.getByRole("link", { name: /Go to passage in On Not Finishing Books/ }).click();
  await expect(page).toHaveURL(/\/read\/.+\?hl=/);
  await expect(page.locator("mark.hl", { hasText: quote })).toBeVisible();
});

test("highlights across paragraphs and edits the colour from the text", async ({ page }) => {
  await openFromLibrary(page, "Stocks, Flows, and the Art of Waiting");

  const range = await page.evaluate(() => {
    const paragraphs = document.querySelectorAll(".article-body p");
    const firstText = (el: Element) => document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    const start = firstText(paragraphs[1]!);
    const end = firstText(paragraphs[2]!);
    const r = document.createRange();
    r.setStart(start, (start.textContent ?? "").indexOf("It sounds trivial"));
    r.setEnd(end, 10);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(r);
    return r.toString();
  });
  expect(range).toContain("It sounds trivial");

  await page.getByRole("toolbar", { name: "Selection actions" }).getByRole("button", { name: "Highlight in Blue" }).click();
  await expect(page.getByText("Highlighted", { exact: true })).toBeVisible();
  const pieces = page.locator('mark.hl[data-color="BLUE"]');
  expect(await pieces.count()).toBeGreaterThanOrEqual(2);

  await pieces.first().click();
  const popover = page.getByRole("dialog", { name: "Highlight" });
  await popover.getByRole("radio", { name: "Blush" }).click();
  await expect(page.locator('mark.hl[data-color="BLUSH"]').first()).toBeVisible();

  await page.reload();
  await expect.poll(() => page.locator('mark.hl[data-color="BLUSH"]').count()).toBeGreaterThanOrEqual(2);
});

test("remembers the reading position", async ({ page }) => {
  await openFromLibrary(page, "The City That Forgot How to Walk");
  await page.getByRole("heading", { name: "Rebuilding the short trip" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1800);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(400);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 200);
});

test("search finds documents, article text, and highlights with working links", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("searchbox", { name: "Search everything" }).fill("wall");
  await expect(page).toHaveURL(/q=wall/);

  await expect(page.getByRole("heading", { name: /^In document text · \d+/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Highlights · \d+/ })).toBeVisible();
  await expect(page.locator("mark.search-hit").first()).toBeVisible();

  const highlightGroup = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Highlights · / }) });
  await highlightGroup.getByRole("link", { name: /A street that cannot be crossed on foot/ }).click();
  await expect(page).toHaveURL(/\/read\/.+\?hl=/);
  await expect(page.getByRole("heading", { level: 1, name: "The City That Forgot How to Walk" })).toBeVisible();

  await page.goto("/search?q=zzzzqqq");
  await expect(page.getByText("No results for “zzzzqqq”")).toBeVisible();
});

test("opens the sample PDF and EPUB in their readers", async ({ page }) => {
  await openFromLibrary(page, "A Grammar of Shadows");
  await expect(page.getByText("of 3")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByLabel("Page", { exact: true })).toHaveValue("2");
  await expect(page.getByRole("img", { name: /Page 2 of 3/ })).toBeVisible();

  await openFromLibrary(page, "The Long Now of Software Maintenance");
  await expect(page.getByRole("navigation", { name: "Chapters" })).toContainText("Judged by what fails to happen");
  await expect(page.locator(".epub-container iframe, [aria-label$='book text'] iframe").first()).toBeAttached();
});
