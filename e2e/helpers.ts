import { expect, type Page } from "@playwright/test";

/** Selects `text` inside the article body exactly as a reader would, firing selectionchange. */
export async function selectArticleText(page: Page, text: string) {
  const found = await page.evaluate((needle) => {
    const root = document.querySelector(".article-body");
    if (!root) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(needle) ?? -1;
      if (index === -1) continue;
      (node.parentElement as HTMLElement).scrollIntoView({ block: "center" });
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    }
    return false;
  }, text);
  expect(found, `"${text}" should be in the article`).toBe(true);
}

export async function openFromLibrary(page: Page, title: string, url = "/library") {
  await page.goto(url);
  await page.getByRole("link", { name: title, exact: true }).first().click();
  await expectReaderOpen(page, title);
}

/**
 * Every reader shows the open document in the reader toolbar's breadcrumb, which
 * is the one place a PDF, an EPUB and an article all name themselves.
 */
export async function expectReaderOpen(page: Page, title: string) {
  await expect(page.getByRole("toolbar", { name: "Reader" })).toContainText(title);
}

/** Selects `text` in the first rendered PDF text-layer page, firing selectionchange. */
export async function selectPdfText(page: Page, text: string) {
  const layer = page.locator(".pdf-page .textLayer").first();
  await layer.locator("span").first().waitFor({ state: "attached" });
  const found = await layer.evaluate((root, needle) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(needle) ?? -1;
      if (index === -1) continue;
      (node.parentElement as HTMLElement).scrollIntoView({ block: "center" });
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return true;
    }
    return false;
  }, text);
  expect(found, `"${text}" should be on the visible PDF page`).toBe(true);
}

/** Selects `text` inside the EPUB chapter iframe, the way epub.js reports a selection. */
export async function selectBookText(page: Page, text: string) {
  // Only the book's own frames count: the reader page embeds the extracted text in its
  // Next.js payload, so a document-wide search would select outside the chapter view.
  const frames = page.locator("[aria-label$='book text'] iframe");
  for (let attempt = 0; attempt < 16; attempt += 1) {
    for (let i = 0, n = await frames.count(); i < n; i += 1) {
      const found = await frames
        .nth(i)
        .contentFrame()
        .locator("body")
        .evaluate(selectInsideDocument, text)
        .catch(() => false);
      if (found) return;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`"${text}" was not found in any open chapter`);
}

function selectInsideDocument(body: HTMLElement, needle: string): boolean {
  const doc = body.ownerDocument;
  if (!doc || !(doc.body.textContent ?? "").includes(needle)) return false;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const index = node.textContent?.indexOf(needle) ?? -1;
    if (index === -1) continue;
    const range = doc.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + needle.length);
    const selection = doc.defaultView?.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  }
  return false;
}
