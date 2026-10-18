import { expect, test, type Page } from "@playwright/test";
import { openFromLibrary, selectBookText, selectPdfText } from "./helpers";

// epub.js paints highlight marks in the page, in an SVG overlay above the chapter
// iframe, so they are found without crossing into the frame.
const bookMarks = (page: Page) => page.locator("g.libra-hl");

const chapterIsOpen = (page: Page) => expect(page.locator("[aria-label$='book text'] iframe").first()).toBeVisible();

// Opens a chapter from the table of contents, so a test never depends on where the last one stopped.
async function openChapter(page: Page, label: RegExp) {
  await page.getByRole("navigation", { name: "Chapters" }).getByRole("button", { name: label }).click();
  await chapterIsOpen(page);
}

test("lists annotations in the PDF reader and paints the mark", async ({ page }) => {
  await openFromLibrary(page, "A Grammar of Shadows");

  const panel = page.getByRole("complementary", { name: "Annotations" });
  await expect(panel.getByRole("heading", { name: "Annotations" })).toBeVisible();
  await expect(panel).toContainText("Select any passage to highlight it.");

  const quote = "A facade is a sentence the building says";
  await selectPdfText(page, quote);
  const toolbar = page.getByRole("toolbar", { name: "Selection actions" });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Highlight in Yellow" }).click();

  await expect(page.getByText("Highlighted", { exact: true })).toBeVisible();
  await expect(panel).toContainText(quote);
  await expect(page.locator('mark.hl[data-color="YELLOW"]')).toHaveCount(1);

  await page.reload();
  await expect(panel).toContainText(quote);
  await expect(page.locator('mark.hl[data-color="YELLOW"]')).toHaveCount(1);
});

test("jumps from the PDF annotation list back to the page that holds the passage", async ({ page }) => {
  await openFromLibrary(page, "A Grammar of Shadows");

  // Flip mode renders only the page in view, so turn to the last one first.
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator('[data-pdf-page="3"]')).toBeVisible();

  const quote = "Every fin is a detail, every reveal a junction";
  await selectPdfText(page, quote);
  const toolbar = page.getByRole("toolbar", { name: "Selection actions" });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Add note" }).click();

  const dialog = page.getByRole("dialog", { name: "Add a note" });
  await dialog.getByLabel("Your note").fill("The address is not the question.");
  await dialog.getByRole("radio", { name: "Blue" }).click();
  await dialog.getByRole("button", { name: "Save note" }).click();

  const panel = page.getByRole("complementary", { name: "Annotations" });
  await expect(panel).toContainText("The address is not the question.");

  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.locator('[data-pdf-page="2"]')).toBeVisible();

  await panel.getByRole("button", { name: new RegExp(quote) }).click();
  await expect(page.locator('[data-pdf-page="3"]')).toBeVisible();
  await expect(page.locator('mark.hl[data-color="BLUE"]')).toHaveCount(1);

  // Leave the document on page one: the reading position is saved per document.
  await page.getByRole("button", { name: "Previous page" }).click();
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.locator('[data-pdf-page="1"]')).toBeVisible();
});

test("highlights a passage in the EPUB reader and keeps it in the list", async ({ page }) => {
  await openFromLibrary(page, "The Long Now of Software Maintenance");
  await chapterIsOpen(page);
  await openChapter(page, /Judged by what fails/);

  const panel = page.getByRole("complementary", { name: "Annotations" });
  await expect(panel.getByRole("heading", { name: "Annotations" })).toBeVisible();

  const quote = "the only design discipline that is judged";
  const before = await bookMarks(page).count();
  await selectBookText(page, quote);
  const toolbar = page.getByRole("toolbar", { name: "Selection actions" });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Highlight in Yellow" }).click();

  await expect(page.getByText("Highlighted", { exact: true })).toBeVisible();
  await expect(panel).toContainText(quote);
  await expect(bookMarks(page)).toHaveCount(before + 1);

  await page.reload();
  await expect(panel).toContainText(quote);
  await expect(bookMarks(page)).toHaveCount(before + 1);
});

test("reaches an EPUB passage from the Highlights page, several chapters away", async ({ page }) => {
  await openFromLibrary(page, "The Long Now of Software Maintenance");
  await chapterIsOpen(page);
  await openChapter(page, /Judged by what fails/);

  // Read on to the last chapter, mark it there, then put the book back at the start.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await selectBookText(page, "survives the people who made it");
  const toolbar = page.getByRole("toolbar", { name: "Selection actions" });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Highlight in Sage" }).click();
  await expect(page.locator("g.libra-hl[data-color='SAGE']")).toHaveCount(1);

  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByRole("button", { name: "Previous", exact: true }).click();

  await page.goto("/highlights");
  const card = page.locator("li").filter({ hasText: "survives the people who made it" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: /Go to passage in The Long Now of Software Maintenance/ }).click();
  await expect(page).toHaveURL(/\/read\/.+\?hl=/);

  // The reader reopens where the reader left off, then follows the mark.
  await expect(page.locator("g.libra-hl[data-color='SAGE']")).toHaveCount(1);
});

test("edits and deletes an EPUB highlight from the annotation list", async ({ page }) => {
  await openFromLibrary(page, "The Long Now of Software Maintenance");
  await chapterIsOpen(page);
  await openChapter(page, /Judged by what fails/);

  await selectBookText(page, "The better it is done, the less there is to show for it");
  const toolbar = page.getByRole("toolbar", { name: "Selection actions" });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Add note" }).click();

  const dialog = page.getByRole("dialog", { name: "Add a note" });
  await dialog.getByLabel("Your note").fill("Stay alive, on purpose.");
  await dialog.getByRole("radio", { name: "Blush" }).click();
  await dialog.getByRole("button", { name: "Save note" }).click();

  const panel = page.getByRole("complementary", { name: "Annotations" });
  await expect(panel).toContainText("Stay alive, on purpose.");
  await expect(page.locator("g.libra-hl[data-color='BLUSH']")).toHaveCount(1);

  const item = panel.getByRole("listitem").filter({ hasText: "The better it is done" });
  await item.getByRole("button", { name: "Edit note and colour" }).click();
  const edit = page.getByRole("dialog", { name: "Edit note" });
  await edit.getByRole("radio", { name: "Blue" }).click();
  await edit.getByRole("button", { name: "Save note" }).click();
  await expect(page.locator("g.libra-hl[data-color='BLUE']")).toHaveCount(1);
  await expect(page.locator("g.libra-hl[data-color='BLUSH']")).toHaveCount(0);

  await item.getByRole("button", { name: "Edit note and colour" }).click();
  await page.getByRole("dialog", { name: "Edit note" }).getByRole("button", { name: "Delete highlight" }).click();

  await expect(panel).not.toContainText("Stay alive, on purpose.");
  await expect(page.locator("g.libra-hl[data-color='BLUE']")).toHaveCount(0);
});
