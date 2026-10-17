import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { detectUploadKind, readEpub } from "@/lib/files";
import { buildSampleEpub, buildSamplePdf } from "@/lib/samples";

describe("detectUploadKind", () => {
  const pdf = buildSamplePdf({ title: "T", author: "A" }, [{ paragraphs: ["Hello world"] }]);

  it("accepts real PDFs and EPUBs", async () => {
    expect(detectUploadKind(pdf, "paper.pdf")).toBe("PDF");
    const epub = await buildSampleEpub({ title: "B", author: "A", publisher: "P", id: "x" }, [{ title: "One", paragraphs: ["Text"] }]);
    expect(detectUploadKind(epub, "book.epub")).toBe("EPUB");
  });

  it("rejects mismatched names and contents", () => {
    expect(detectUploadKind(pdf, "paper.epub")).toBeNull();
    expect(detectUploadKind(Buffer.from("<html><script>alert(1)</script>"), "fake.pdf")).toBeNull();
    expect(detectUploadKind(pdf, "paper.exe")).toBeNull();
  });
});

describe("readEpub", () => {
  it("reads metadata and spine text", async () => {
    const epub = await buildSampleEpub({ title: "The Long Now", author: "R. Ngata", publisher: "Fieldnote", id: "urn:x" }, [
      { title: "One", paragraphs: ["Maintenance is judged by what fails to happen."] },
      { title: "Two", paragraphs: ["Interest on old decisions."] },
    ]);
    const details = await readEpub(epub);
    expect(details).toMatchObject({ title: "The Long Now", author: "R. Ngata", publisher: "Fieldnote", drm: false });
    expect(details?.text).toContain("Maintenance is judged");
    expect(details?.text).toContain("Interest on old decisions");
  });

  it("rejects archives that aren't EPUBs", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "hello");
    expect(await readEpub(await zip.generateAsync({ type: "nodebuffer" }))).toBeNull();
    expect(await readEpub(Buffer.from("not a zip"))).toBeNull();
  });

  it("flags DRM-protected books", async () => {
    const zip = await JSZip.loadAsync(
      await buildSampleEpub({ title: "Locked", author: "A", publisher: "P", id: "y" }, [{ title: "One", paragraphs: ["x"] }]),
    );
    zip.file("META-INF/rights.xml", "<rights/>");
    const details = await readEpub(await zip.generateAsync({ type: "nodebuffer" }));
    expect(details?.drm).toBe(true);
  });
});
