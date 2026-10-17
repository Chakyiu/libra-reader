// PDF.js runs its parser in a web worker and loads fonts, CMaps, colour
// profiles and image decoders on demand. Serving them as static files keeps
// them out of the bundler and pins them to the installed pdfjs-dist version.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

let pkgDir;
try {
  pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
} catch {
  console.warn("[copy-pdf-worker] pdfjs-dist is not installed yet; skipping.");
  process.exit(0);
}

const targetDir = path.join(process.cwd(), "public", "vendor", "pdfjs");
mkdirSync(targetDir, { recursive: true });

cpSync(path.join(pkgDir, "build", "pdf.worker.min.mjs"), path.join(targetDir, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  const from = path.join(pkgDir, dir);
  if (existsSync(from)) cpSync(from, path.join(targetDir, dir), { recursive: true });
}

console.log("[copy-pdf-worker] copied PDF.js worker and assets to public/vendor/pdfjs/");
