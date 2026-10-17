import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Libra Reader",
    short_name: "Libra",
    description: "A local-first place to save, read, highlight, and organize articles, PDFs, EPUBs, and notes.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F9F8F6",
    theme_color: "#F9F8F6",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
