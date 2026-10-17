import { expect, test } from "@playwright/test";
import { buildSampleEpub, buildSamplePdf } from "../lib/samples";

test("uploads a PDF and an EPUB, rejects a disguised file, and opens the upload", async ({ page }) => {
  const pdf = buildSamplePdf({ title: "Uploaded Field Guide", author: "Test Author" }, [
    { paragraphs: ["The first uploaded page."] },
    { heading: "Second", paragraphs: ["The second uploaded page."] },
  ]);
  const epub = await buildSampleEpub({ title: "Uploaded Book", author: "Test Author", publisher: "Test Press", id: "urn:e2e" }, [
    { title: "Opening", paragraphs: ["An uploaded chapter with enough words to count."] },
  ]);

  await page.goto("/library");
  await page.getByRole("button", { name: /^Add content/ }).click();
  const dialog = page.getByRole("dialog", { name: "Add content" });
  await dialog.getByRole("tab", { name: /file/i }).click();

  await dialog.locator('input[type="file"]').setInputFiles({ name: "not-really.pdf", mimeType: "application/pdf", buffer: Buffer.from("<script>alert(1)</script>") });
  await dialog.getByRole("button", { name: "Add to library" }).click();
  await expect(dialog.getByRole("alert")).toContainText("contents must match its extension");

  await dialog.locator('input[type="file"]').setInputFiles({ name: "field-guide.pdf", mimeType: "application/pdf", buffer: pdf });
  await dialog.getByRole("button", { name: "Add to library" }).click();
  await expect(page.getByText("Added “field-guide.pdf” to Inbox")).toBeVisible();
  await page.getByRole("link", { name: "Field guide", exact: true }).click();
  await expect(page.getByText("of 2")).toBeVisible();
  // First open reads the PDF's own metadata and replaces the filename-derived title.
  await expect(page.getByRole("heading", { level: 1, name: "Uploaded Field Guide" })).toBeVisible();

  await page.goto("/library");
  await page.getByRole("button", { name: /^Add content/ }).click();
  await dialog.getByRole("tab", { name: /file/i }).click();
  await dialog.locator('input[type="file"]').setInputFiles({ name: "book.epub", mimeType: "application/epub+zip", buffer: epub });
  await dialog.getByRole("button", { name: "Add to library" }).click();
  await expect(page.getByText("Added “book.epub” to Inbox")).toBeVisible();
  await expect(page.getByRole("link", { name: "Uploaded Book", exact: true })).toBeVisible();
});

test("bulk-tags a selection and deletes a document only after confirmation", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select What Compilers Know About Us" }).click();
  await page.getByRole("checkbox", { name: "Select Notes on legibility" }).click();

  const bulk = page.getByRole("region", { name: "Bulk actions" });
  await expect(bulk).toContainText("2 selected");
  await bulk.getByRole("button", { name: "Add tag" }).click();
  const tagDialog = page.getByRole("dialog", { name: "Add a tag" });
  await tagDialog.getByLabel("Tags").fill("reread");
  await tagDialog.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText("Tagged 2 items with #reread")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Library navigation" }).getByRole("link", { name: /reread/ })).toBeVisible();

  await page.getByRole("button", { name: "More actions for What Compilers Know About Us" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("This can't be undone");
  await confirm.getByRole("button", { name: "Keep" }).click();
  await expect(page.getByRole("link", { name: "What Compilers Know About Us", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "More actions for What Compilers Know About Us" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("Deleted", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "What Compilers Know About Us", exact: true })).toHaveCount(0);
});

test("keyboard shortcuts navigate and open help", async ({ page }) => {
  await page.goto("/library");
  await page.locator("body").click({ position: { x: 600, y: 10 } });
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("/");
  await expect(page).toHaveURL(/\/search/);
  const heading = page.getByRole("heading", { level: 1, name: "Search" });
  await expect(heading).toBeVisible();
  await heading.click();
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(page).toHaveURL(/\/highlights/);
  await page.keyboard.press("a");
  await expect(page.getByRole("dialog", { name: "Add content" })).toBeVisible();
});

test("exports everything as JSON and serves files defensively", async ({ request, page }) => {
  const exported = await request.get("/api/export");
  expect(exported.ok()).toBe(true);
  expect(exported.headers()["content-disposition"]).toMatch(/attachment; filename="libra-export-\d{4}-\d{2}-\d{2}\.json"/);
  const data = (await exported.json()) as Record<string, unknown[] | unknown>;
  expect(data).toMatchObject({ format: "libra-reader-export", version: 1 });
  for (const key of ["documents", "highlights", "collections", "tags"]) expect(Array.isArray(data[key])).toBe(true);
  expect((data.documents as unknown[]).length).toBeGreaterThan(5);
  expect(data.preferences).toMatchObject({ theme: expect.any(String), fontSize: expect.any(Number) });

  await page.goto("/library?type=pdf");
  const href = await page.getByRole("link", { name: "A Grammar of Shadows", exact: true }).getAttribute("href");
  const id = href?.split("/").pop();
  const file = await request.get(`/api/files/${id}`);
  expect(file.ok()).toBe(true);
  expect(file.headers()["content-type"]).toBe("application/pdf");
  expect(file.headers()["x-content-type-options"]).toBe("nosniff");
  expect(file.headers()["content-security-policy"]).toContain("sandbox");

  expect((await request.get("/api/files/..%2F..%2Fetc%2Fpasswd")).status()).toBe(404);
  const crossSite = await request.post(`/api/documents/${id}/position`, {
    headers: { "sec-fetch-site": "cross-site", "content-type": "text/plain" },
    data: JSON.stringify({ progress: 1 }),
  });
  expect(crossSite.status()).toBe(403);
});
