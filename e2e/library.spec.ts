import { expect, test } from "@playwright/test";

test("saves a note from Add content and opens it", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: /^Add content/ }).click();

  const dialog = page.getByRole("dialog", { name: "Add content" });
  await dialog.getByRole("tab", { name: /note/i }).click();
  await dialog.getByLabel("Title", { exact: true }).fill("Field note from the test run");
  await dialog.getByLabel("Note", { exact: true }).fill("The first paragraph of a note.\n\nA second paragraph, kept separate.");
  await dialog.getByRole("button", { name: "Save note" }).click();

  await expect(page.getByText("Note saved to Inbox")).toBeVisible();
  await expect(page).toHaveURL(/status=inbox/);
  await page.getByRole("link", { name: "Field note from the test run", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Field note from the test run" })).toBeVisible();
  await expect(page.locator(".article-body p")).toHaveCount(2);
  await expect(page.getByText("A second paragraph, kept separate.")).toBeVisible();
});

test("validates an empty note instead of saving it", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: /^Add content/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add content" });
  await dialog.getByRole("tab", { name: /note/i }).click();
  await dialog.getByRole("button", { name: "Save note" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(/Write a title or a few words/);
});

test("creates a collection and adds a document to it", async ({ page }) => {
  await page.goto("/collections");
  await page.getByRole("button", { name: "New collection" }).click();

  const dialog = page.getByRole("dialog", { name: "New collection" });
  await dialog.getByLabel("Name").fill("Weekend Reading");
  await dialog.getByLabel("Description").fill("Long pieces for slow mornings.");
  await dialog.getByRole("radio", { name: "Blue" }).click();
  await dialog.getByRole("button", { name: "Create collection" }).click();

  await expect(page.getByText("Created Weekend Reading")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: /Weekend Reading/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Weekend Reading" })).toBeVisible();
  await expect(page.getByText("Nothing in Weekend Reading yet")).toBeVisible();

  await page.goto("/library");
  await page.getByRole("button", { name: "More actions for Stocks, Flows, and the Art of Waiting" }).click();
  await page.getByRole("menuitem", { name: "Collections…" }).click();
  const picker = page.getByRole("dialog", { name: "Collections" });
  await picker.getByRole("button", { name: /Weekend Reading/ }).click();
  await expect(page.getByText("Added 1 item to Weekend Reading")).toBeVisible();
  await expect(picker.getByRole("button", { name: /Weekend Reading/ })).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: "Done" }).click();

  await page.getByRole("complementary", { name: "Library navigation" }).getByRole("link", { name: /Weekend Reading/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Weekend Reading" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stocks, Flows, and the Art of Waiting", exact: true })).toBeVisible();
});

test("archives with undo, then restores from the archive", async ({ page }) => {
  const title = "The Quiet Death of the Ground Floor";
  await page.goto("/library");

  await page.getByRole("button", { name: `More actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByText(`“${title}” archived`)).toBeVisible();
  await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Put back")).toBeVisible();
  await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();

  await page.getByRole("button", { name: `More actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);

  await page.goto("/library?status=archived");
  await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `More actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Restore to library" }).click();
  await expect(page.getByText(`“${title}” restored`)).toBeVisible();
  await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);

  await page.goto("/library?status=inbox");
  await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
});

test("refuses to fetch private addresses and offers honest choices on failure", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: /^Add content/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add content" });

  await dialog.getByLabel("Article or page address").fill("http://localhost:3200/library");
  await dialog.getByRole("button", { name: "Fetch preview" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Libra won't fetch that address");
  await expect(dialog.getByRole("button", { name: "Save the link only" })).toHaveCount(0);

  await dialog.getByLabel("Article or page address").fill("javascript:alert(1)");
  await dialog.getByRole("button", { name: "Fetch preview" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Only http:// and https:// addresses can be saved.");
});
