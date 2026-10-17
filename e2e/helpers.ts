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
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}
