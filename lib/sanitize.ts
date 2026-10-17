import { render } from "dom-serializer";
import { isTag, isText, Text, type ChildNode, type ParentNode } from "domhandler";
import { Parser, parseDocument } from "htmlparser2";
import sanitizeHtml from "sanitize-html";

const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"];

const ALLOWED_TAGS = [
  ...HEADINGS,
  "p",
  "br",
  "hr",
  "div",
  "section",
  "span",
  "blockquote",
  "pre",
  "code",
  "kbd",
  "samp",
  "var",
  "em",
  "strong",
  "b",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "small",
  "sub",
  "sup",
  "abbr",
  "cite",
  "q",
  "time",
  "a",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "figure",
  "figcaption",
  "img",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "colgroup",
  "col",
  "details",
  "summary",
];

/** Elements whose contents are dropped along with the tag. */
const DROP_WITH_CONTENT = [
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "svg",
  "math",
  "canvas",
  "video",
  "audio",
  "source",
  "track",
  "form",
  "input",
  "button",
  "select",
  "option",
  "textarea",
  "nav",
  "head",
  "title",
  "meta",
  "link",
  "base",
];

const NUMERIC = /^\d{1,5}$/;

function keepNumeric(attribs: Record<string, string>, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = attribs[name];
    if (value && NUMERIC.test(value)) out[name] = value;
  }
  return out;
}

/**
 * Sanitizes untrusted article HTML. Everything executable or stateful is
 * removed; links open in a new tab without referrer; images load lazily
 * without referrer; incoming ids are discarded and headings get generated
 * `sec-N` ids so saved pages can't clobber DOM globals.
 */
export function sanitizeArticleHtml(dirty: string): string {
  let headingIndex = 0;
  const headingTransform: sanitizeHtml.Transformer = (tagName) => {
    headingIndex += 1;
    return { tagName, attribs: { id: `sec-${headingIndex}` } };
  };

  const clean = sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "referrerpolicy"],
      abbr: ["title"],
      time: ["datetime"],
      q: ["cite"],
      blockquote: ["cite"],
      ol: ["start", "reversed"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      col: ["span"],
      colgroup: ["span"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: DROP_WITH_CONTENT,
    transformTags: {
      h1: headingTransform,
      h2: headingTransform,
      h3: headingTransform,
      h4: headingTransform,
      h5: headingTransform,
      h6: headingTransform,
      article: "div",
      main: "div",
      header: "div",
      footer: "div",
      aside: "div",
      center: "div",
      font: "span",
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...(attribs.href ? { href: attribs.href } : {}),
          ...(attribs.title ? { title: attribs.title } : {}),
          rel: "noopener noreferrer nofollow ugc",
          target: "_blank",
        },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...(attribs.src ? { src: attribs.src } : {}),
          alt: attribs.alt ?? "",
          ...(attribs.title ? { title: attribs.title } : {}),
          ...keepNumeric(attribs, ["width", "height"]),
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        },
      }),
      ol: (tagName, attribs) => ({ tagName, attribs: keepNumeric(attribs, ["start"]) }),
      th: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...keepNumeric(attribs, ["colspan", "rowspan"]),
          ...(attribs.scope && /^(row|col|rowgroup|colgroup)$/.test(attribs.scope) ? { scope: attribs.scope } : {}),
        },
      }),
      td: (tagName, attribs) => ({ tagName, attribs: keepNumeric(attribs, ["colspan", "rowspan"]) }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  }).trim();
  return normalizeBlockWhitespace(clean);
}

const LAYOUT_BLOCKS = new Set([
  ...HEADINGS,
  "p",
  "div",
  "section",
  "blockquote",
  "pre",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "figure",
  "figcaption",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "colgroup",
  "col",
  "hr",
  "details",
  "summary",
]);

const isBlock = (node: ChildNode | undefined) => Boolean(node && isTag(node) && LAYOUT_BLOCKS.has(node.name));

function normalizeChildren(parent: ParentNode, inPre: boolean): void {
  const kept: ChildNode[] = [];
  parent.children.forEach((child, index, siblings) => {
    if (isText(child) && !inPre) {
      const collapsed = child.data.replace(/\s+/g, " ");
      const previous = kept[kept.length - 1];
      const next = siblings[index + 1];
      if (!collapsed.trim() && (!previous || !next || isBlock(previous) || isBlock(next))) return;
      child.data = collapsed;
    } else if (isTag(child)) {
      normalizeChildren(child, inPre || child.name === "pre");
    }
    kept.push(child);
  });

  const result: ChildNode[] = [];
  kept.forEach((child, index) => {
    if (index > 0 && !inPre && (isBlock(child) || isBlock(kept[index - 1]))) result.push(new Text("\n"));
    result.push(child);
  });
  result.forEach((child, index) => {
    child.parent = parent;
    child.prev = result[index - 1] ?? null;
    child.next = result[index + 1] ?? null;
  });
  parent.children = result;
}

/**
 * Makes text offsets predictable: whitespace inside text collapses to single
 * spaces (except in <pre>), formatting whitespace beside blocks is dropped,
 * and exactly one newline separates sibling blocks. A highlight's stored quote
 * then contains newlines only where it actually crossed a block boundary.
 */
export function normalizeBlockWhitespace(html: string): string {
  const document = parseDocument(html);
  normalizeChildren(document, false);
  return render(document, { encodeEntities: "utf8", emptyAttrs: true });
}

const BLOCK_TAGS = new Set([
  ...HEADINGS,
  "p",
  "div",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "aside",
  "blockquote",
  "pre",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "figure",
  "figcaption",
  "table",
  "caption",
  "tr",
  "br",
  "hr",
  "details",
  "summary",
]);

const SKIP_TEXT = new Set(["script", "style", "noscript", "template", "head", "title"]);

export interface Heading {
  id: string;
  text: string;
  level: number;
}

/** Contents entries for sanitized HTML: h1–h3 that carry a generated id. */
export function headingsFromHtml(html: string): Heading[] {
  const headings: Heading[] = [];
  let current: Heading | null = null;
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const level = /^h([1-3])$/.exec(name)?.[1];
        if (level && attrs.id) current = { id: attrs.id, text: "", level: Number(level) };
      },
      ontext(text) {
        if (current) current.text += text;
      },
      onclosetag(name) {
        if (current && name === `h${current.level}`) {
          const text = current.text.replace(/\s+/g, " ").trim();
          if (text) headings.push({ ...current, text });
          current = null;
        }
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return headings;
}

/** Plain text with one line per block, for search, excerpts, and word counts. */
export function htmlToPlainText(html: string): string {
  let out = "";
  let skipping = 0;
  const parser = new Parser(
    {
      onopentag(name) {
        if (SKIP_TEXT.has(name)) skipping += 1;
        if (BLOCK_TAGS.has(name)) out += "\n";
      },
      ontext(text) {
        if (!skipping) out += text;
      },
      onclosetag(name) {
        if (SKIP_TEXT.has(name)) skipping = Math.max(0, skipping - 1);
        if (BLOCK_TAGS.has(name)) out += "\n";
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return out
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
