export interface Shortcut {
  keys: string[];
  label: string;
  /** Keys pressed one after another rather than together. */
  sequence?: boolean;
}

export const GLOBAL_SHORTCUTS: Shortcut[] = [
  { keys: ["/"], label: "Jump to search" },
  { keys: ["A"], label: "Add content" },
  { keys: ["G", "L"], label: "Go to the library", sequence: true },
  { keys: ["G", "H"], label: "Go to highlights", sequence: true },
  { keys: ["G", "C"], label: "Go to collections", sequence: true },
  { keys: ["G", "S"], label: "Go to settings", sequence: true },
  { keys: ["T"], label: "Switch between light and dark" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["Esc"], label: "Close whatever is open" },
];

export const READER_SHORTCUTS: Shortcut[] = [
  { keys: ["H"], label: "Highlight the selected text" },
  { keys: ["N"], label: "Highlight the selection and add a note" },
  { keys: ["F"], label: "Favorite or unfavorite" },
  { keys: ["E"], label: "Archive or restore" },
  { keys: ["]"], label: "Show or hide the annotations panel" },
  { keys: ["←", "→"], label: "Previous or next page in PDFs and EPUBs" },
];

/** True while a modal, sheet or popover is open (ignores ones still animating closed). */
export function isOverlayOpen(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null;
}

/** True when a keystroke belongs to a text field rather than to the app. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}
