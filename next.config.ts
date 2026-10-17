import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js hydration relies on inline scripts; no third-party script is ever allowed.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // epub.js turns book stylesheets and fonts into blob: URLs.
  "style-src 'self' 'unsafe-inline' blob:",
  // Saved articles may reference images on their original sites.
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data: blob:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  // epub.js renders chapters into same-origin iframes sandboxed without scripts.
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  serverExternalPackages: ["jsdom", "better-sqlite3", "@prisma/adapter-better-sqlite3"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Stored files set their own sandboxing CSP in app/api/files/[id]/route.ts.
        source: "/((?!api/files/).*)",
        headers: [...baseHeaders, { key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
      { source: "/api/files/:path*", headers: baseHeaders },
      {
        // Browsers re-check the worker on navigation. A long cache would keep an old one.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
