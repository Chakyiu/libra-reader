import type { LookupAddress } from "node:dns";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { safeFetch, SafeFetchError, type Transport, decodeHtml } from "@/lib/safe-fetch";
import {
  assertUrlAllowed,
  BlockedDestinationError,
  createGuardedLookup,
  isPublicAddress,
  resolvePublicAddresses,
  type Resolver,
} from "@/lib/ssrf";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "127.10.0.5",
    "10.0.0.8",
    "172.16.4.2",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // carrier-grade NAT
    "0.0.0.0",
    "255.255.255.255",
    "224.0.0.1",
    "192.0.2.10", // documentation
    "198.18.0.1", // benchmarking
    "240.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "::ffff:10.1.2.3",
    "2001:db8::1", // documentation
    "2002:7f00:1::1", // 6to4 wrapping 127.0.0.1
    "64:ff9b::7f00:1", // NAT64 wrapping 127.0.0.1
    "fe80::1%en0", // zone id
    "not-an-ip",
  ])("rejects %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["93.184.216.34", "1.1.1.1", "8.8.8.8", "2606:4700:4700::1111", "::ffff:93.184.216.34", "[2a00:1450:4001:80b::200e]"])(
    "accepts %s",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );
});

describe("assertUrlAllowed", () => {
  it.each([
    "http://localhost:3000/",
    "http://LOCALHOST/",
    "http://app.localhost/",
    "http://printer.local/",
    "http://db.internal/",
    "http://127.0.0.1/",
    "http://2130706433/", // decimal 127.0.0.1
    "http://0x7f.0.0.1/", // hex
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://intranet/",
    "file:///etc/passwd",
    "gopher://example.com/",
    "https://user:pass@example.com/",
    "https://example.com:22/",
  ])("blocks %s", (url) => {
    expect(() => assertUrlAllowed(url)).toThrow(BlockedDestinationError);
  });

  it.each(["https://example.com/a", "http://example.com:8080/x", "https://93.184.216.34/", "https://example.com./trailing-dot"])(
    "allows %s",
    (url) => {
      expect(assertUrlAllowed(url)).toBeInstanceOf(URL);
    },
  );
});

const fakeResolver =
  (table: Record<string, string[]>): Resolver =>
  async (hostname) => {
    const addresses = table[hostname];
    if (!addresses) throw Object.assign(new Error("not found"), { code: "ENOTFOUND" });
    return addresses.map((address): LookupAddress => ({ address, family: address.includes(":") ? 6 : 4 }));
  };

describe("resolvePublicAddresses", () => {
  const resolver = fakeResolver({
    "public.test": ["93.184.216.34"],
    "rebind.test": ["93.184.216.34", "127.0.0.1"],
    "metadata.test": ["169.254.169.254"],
    "v6.test": ["2606:4700:4700::1111"],
  });

  it("returns public answers", async () => {
    await expect(resolvePublicAddresses("public.test", resolver)).resolves.toEqual([{ address: "93.184.216.34", family: 4 }]);
    await expect(resolvePublicAddresses("v6.test", resolver)).resolves.toHaveLength(1);
  });

  it("refuses when any answer is private", async () => {
    await expect(resolvePublicAddresses("rebind.test", resolver)).rejects.toBeInstanceOf(BlockedDestinationError);
    await expect(resolvePublicAddresses("metadata.test", resolver)).rejects.toBeInstanceOf(BlockedDestinationError);
  });

  it("checks IP literals without resolving", async () => {
    await expect(resolvePublicAddresses("[::1]", resolver)).rejects.toBeInstanceOf(BlockedDestinationError);
    await expect(resolvePublicAddresses("1.1.1.1", resolver)).resolves.toEqual([{ address: "1.1.1.1", family: 4 }]);
  });
});

describe("createGuardedLookup", () => {
  const lookup = createGuardedLookup(fakeResolver({ "public.test": ["93.184.216.34", "2606:4700:4700::1111"], "evil.test": ["10.0.0.5"] }));

  it("hands sockets only validated addresses", async () => {
    const single = await new Promise<{ address: string; family: number }>((resolve, reject) =>
      lookup("public.test", { family: 4 }, (error, address, family) => (error ? reject(error) : resolve({ address: address as string, family: family ?? 0 }))),
    );
    expect(single).toEqual({ address: "93.184.216.34", family: 4 });

    const all = await new Promise<LookupAddress[]>((resolve, reject) =>
      lookup("public.test", { all: true }, (error, addresses) => (error ? reject(error) : resolve(addresses as LookupAddress[]))),
    );
    expect(all).toHaveLength(2);
  });

  it("fails the connection for private answers", async () => {
    const error = await new Promise<Error | null>((resolve) => lookup("evil.test", {}, (err) => resolve(err)));
    expect(error).toBeInstanceOf(BlockedDestinationError);
  });
});

function response(status: number, headers: Record<string, string>, body: string | Buffer = ""): Awaited<ReturnType<Transport>> {
  return { status, headers, body: Readable.from([typeof body === "string" ? Buffer.from(body) : body]) };
}

function scriptedTransport(routes: Record<string, () => Awaited<ReturnType<Transport>>>) {
  const visited: string[] = [];
  const transport: Transport = async (url) => {
    visited.push(url.toString());
    const route = routes[url.toString()];
    if (!route) throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    return route();
  };
  return { transport, visited };
}

describe("safeFetch", () => {
  it("returns HTML from a public page", async () => {
    const { transport } = scriptedTransport({
      "https://example.com/a": () => response(200, { "content-type": "text/html; charset=utf-8" }, "<p>hello</p>"),
    });
    const result = await safeFetch("https://example.com/a", { transport });
    expect(result.body.toString()).toBe("<p>hello</p>");
    expect(result.url).toBe("https://example.com/a");
  });

  it("follows a validated redirect", async () => {
    const { transport, visited } = scriptedTransport({
      "http://example.com/old": () => response(301, { location: "https://example.com/new" }),
      "https://example.com/new": () => response(200, { "content-type": "text/html" }, "ok"),
    });
    const result = await safeFetch("http://example.com/old", { transport });
    expect(result.url).toBe("https://example.com/new");
    expect(visited).toEqual(["http://example.com/old", "https://example.com/new"]);
  });

  it.each(["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data/", "http://localhost:8080/", "file:///etc/passwd", "http://[::1]/"])(
    "refuses a redirect to %s without connecting",
    async (location) => {
      const { transport, visited } = scriptedTransport({
        "https://example.com/r": () => response(302, { location }),
      });
      await expect(safeFetch("https://example.com/r", { transport })).rejects.toMatchObject({ code: "BLOCKED" });
      expect(visited).toEqual(["https://example.com/r"]);
    },
  );

  it("stops after too many redirects", async () => {
    const { transport } = scriptedTransport({
      "https://example.com/loop": () => response(302, { location: "/loop" }),
    });
    await expect(safeFetch("https://example.com/loop", { transport, maxRedirects: 3 })).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("refuses blocked starting URLs before any request", async () => {
    const { transport, visited } = scriptedTransport({});
    await expect(safeFetch("http://192.168.0.1/", { transport })).rejects.toBeInstanceOf(SafeFetchError);
    expect(visited).toEqual([]);
  });

  it("enforces the size limit on declared and streamed bodies", async () => {
    const big = "x".repeat(2048);
    const declared = scriptedTransport({
      "https://example.com/big": () => response(200, { "content-type": "text/html", "content-length": "999999" }, big),
    });
    await expect(safeFetch("https://example.com/big", { transport: declared.transport, maxBytes: 1024 })).rejects.toMatchObject({ code: "TOO_LARGE" });

    const streamed = scriptedTransport({
      "https://example.com/big": () => response(200, { "content-type": "text/html" }, big),
    });
    await expect(safeFetch("https://example.com/big", { transport: streamed.transport, maxBytes: 1024 })).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("counts decompressed bytes, so a gzip bomb is cut off", async () => {
    const bomb = gzipSync(Buffer.alloc(5 * 1024 * 1024, 0x61));
    const { transport } = scriptedTransport({
      "https://example.com/bomb": () => response(200, { "content-type": "text/html", "content-encoding": "gzip" }, bomb),
    });
    await expect(safeFetch("https://example.com/bomb", { transport, maxBytes: 64 * 1024 })).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("decompresses gzip within the limit", async () => {
    const { transport } = scriptedTransport({
      "https://example.com/gz": () => response(200, { "content-type": "text/html", "content-encoding": "gzip" }, gzipSync("<p>zipped</p>")),
    });
    await expect(safeFetch("https://example.com/gz", { transport }).then((r) => r.body.toString())).resolves.toBe("<p>zipped</p>");
  });

  it("rejects non-HTML responses and error statuses", async () => {
    const pdf = scriptedTransport({ "https://example.com/f.pdf": () => response(200, { "content-type": "application/pdf" }, "%PDF") });
    await expect(safeFetch("https://example.com/f.pdf", { transport: pdf.transport })).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });

    const missing = scriptedTransport({ "https://example.com/gone": () => response(404, { "content-type": "text/html" }) });
    await expect(safeFetch("https://example.com/gone", { transport: missing.transport })).rejects.toMatchObject({ code: "HTTP_STATUS", status: 404 });
  });

  it("times out slow servers", async () => {
    const transport: Transport = (_url, signal) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { code: "ABORT_ERR" }))));
    await expect(safeFetch("https://example.com/slow", { transport, timeoutMs: 50 })).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("decodeHtml", () => {
  it("honours the declared charset", () => {
    const latin1 = Buffer.from([0x63, 0x61, 0x66, 0xe9]); // "café" in ISO-8859-1
    expect(decodeHtml(latin1, "text/html; charset=iso-8859-1")).toBe("café");
    expect(decodeHtml(Buffer.from('<meta charset="windows-1252"><p>\x93hi\x94</p>', "latin1"), "text/html")).toContain("“hi”");
    expect(decodeHtml(Buffer.from("plain ✓"), "text/html")).toBe("plain ✓");
  });
});
