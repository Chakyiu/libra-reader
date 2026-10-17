import JSZip from "jszip";

/* Small, valid sample files generated in code, for the dev seed and tests. */

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > width) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface PdfPageSpec {
  heading?: string;
  paragraphs: string[];
}

/** A minimal multi-page PDF using the standard Times fonts (ASCII text only). */
export function buildSamplePdf(meta: { title: string; author: string }, pages: PdfPageSpec[]): Buffer {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalog = add("");
  const pagesId = add("");
  const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>");
  const italic = add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>");

  const pageIds: number[] = [];
  pages.forEach((page, index) => {
    const ops: string[] = [];
    let y = 720;
    if (index === 0) {
      ops.push(`BT /F2 24 Tf 72 ${y} Td (${escapePdfText(meta.title)}) Tj ET`);
      y -= 26;
      ops.push(`BT /F3 12 Tf 72 ${y} Td (${escapePdfText(meta.author)}) Tj ET`);
      y -= 40;
    }
    if (page.heading) {
      ops.push(`BT /F2 15 Tf 72 ${y} Td (${escapePdfText(page.heading)}) Tj ET`);
      y -= 26;
    }
    for (const paragraph of page.paragraphs) {
      const lines = wrap(paragraph, 88);
      ops.push(`BT /F1 11.5 Tf 15.5 TL 72 ${y} Td`);
      lines.forEach((line, lineIndex) => ops.push(`${lineIndex === 0 ? "" : "T* "}(${escapePdfText(line)}) Tj`));
      ops.push("ET");
      y -= lines.length * 15.5 + 12;
    }
    ops.push(`BT /F3 9 Tf 300 40 Td (${index + 1}) Tj ET`);
    const stream = ops.join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R /F3 ${italic} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
  });

  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const info = add(`<< /Title (${escapePdfText(meta.title)}) /Author (${escapePdfText(meta.author)}) /Producer (Libra Reader sample) >>`);

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export interface EpubChapterSpec {
  title: string;
  paragraphs: string[];
}

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A small EPUB 3 (with an EPUB 2 NCX for older readers). */
export async function buildSampleEpub(meta: { title: string; author: string; publisher: string; id: string }, chapters: EpubChapterSpec[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );

  const manifest = chapters
    .map((_, i) => `<item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n    ");
  const spine = chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join("\n    ");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${xmlEscape(meta.id)}</dc:identifier>
    <dc:title>${xmlEscape(meta.title)}</dc:title>
    <dc:creator>${xmlEscape(meta.author)}</dc:creator>
    <dc:publisher>${xmlEscape(meta.publisher)}</dc:publisher>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${manifest}
  </manifest>
  <spine toc="ncx">
    ${spine}
  </spine>
</package>`,
  );

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol>
${chapters.map((c, i) => `<li><a href="ch${i + 1}.xhtml">${xmlEscape(c.title)}</a></li>`).join("\n")}
</ol></nav></body></html>`,
  );

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${xmlEscape(meta.id)}"/></head>
  <docTitle><text>${xmlEscape(meta.title)}</text></docTitle>
  <navMap>
${chapters
  .map(
    (c, i) =>
      `    <navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${xmlEscape(c.title)}</text></navLabel><content src="ch${i + 1}.xhtml"/></navPoint>`,
  )
  .join("\n")}
  </navMap>
</ncx>`,
  );

  zip.file("OEBPS/style.css", "body { margin: 0 4%; } h1 { font-size: 1.4em; margin: 1.2em 0 .8em; } p { text-indent: 1.2em; margin: 0 0 .4em; }");

  chapters.forEach((chapter, i) => {
    zip.file(
      `OEBPS/ch${i + 1}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xmlEscape(chapter.title)}</title><link rel="stylesheet" href="style.css"/></head>
<body><h1>${xmlEscape(chapter.title)}</h1>
${chapter.paragraphs.map((p) => `<p>${xmlEscape(p)}</p>`).join("\n")}
</body></html>`,
    );
  });

  return zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip", compression: "DEFLATE" });
}
