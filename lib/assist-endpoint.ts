import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";
import { ALLOWED_PORTS, BlockedDestinationError, isPublicAddress, systemResolver, type Resolver } from "@/lib/ssrf";

/**
 * Where a model host is allowed to live. Article fetching stays public-only
 * in lib/ssrf.ts. This check is only for the endpoint the user configured:
 * public hosts keep the standard ports, and loopback or private addresses
 * are allowed on any port so a local model (Ollama, LM Studio) can answer.
 * Link-local addresses, including cloud metadata, stay blocked.
 */
export type AssistHostClass = "public" | "local";

const BLOCKED_ADDRESS_MESSAGE =
  "That address is link-local or otherwise blocked. Cloud metadata addresses stay blocked, including 169.254.169.254.";

const PUBLIC_PORT_MESSAGE =
  "Public model hosts only use standard web ports (80, 443, 8080, 8443). A local model can use any port.";

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/** Public unicast, a machine on this network, or neither. */
export function assistAddressClass(ip: string): AssistHostClass | "blocked" {
  if (isPublicAddress(ip)) return "public";
  const bare = stripBrackets(ip.trim());
  if (!bare || bare.includes("%") || !ipaddr.isValid(bare)) return "blocked";

  let addr = ipaddr.parse(bare);
  if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
    addr = (addr as ipaddr.IPv6).toIPv4Address();
  }
  const range = addr.range();
  if (range === "loopback" || range === "private" || range === "uniqueLocal") return "local";
  return "blocked";
}

function assertPort(url: URL, hostClass: AssistHostClass): void {
  if (hostClass === "public") {
    if (!ALLOWED_PORTS.has(url.port)) throw new BlockedDestinationError(PUBLIC_PORT_MESSAGE);
    return;
  }
  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new BlockedDestinationError("That port isn't valid.");
  }
}

/**
 * Static checks. Hostnames other than localhost are marked "resolve" so a
 * save can succeed while offline; the request path resolves them.
 */
export function inspectAssistUrl(input: string): { url: URL; hostClass: AssistHostClass | "resolve" } {
  if (input.length > 300) throw new BlockedDestinationError("That address is too long.");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BlockedDestinationError("That isn't a valid address.");
  }
  url.hash = "";
  url.search = "";
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedDestinationError("The model host has to be an http:// or https:// address.");
  }
  if (url.username || url.password) {
    throw new BlockedDestinationError("Don't put a username or password in the address. Use the API key field.");
  }
  const host = stripBrackets(url.hostname.toLowerCase()).replace(/\.$/, "");
  if (!host) throw new BlockedDestinationError("That address has no host name.");
  if (host.includes("%")) throw new BlockedDestinationError(BLOCKED_ADDRESS_MESSAGE);

  if (ipaddr.isValid(host)) {
    const hostClass = assistAddressClass(host);
    if (hostClass === "blocked") throw new BlockedDestinationError(BLOCKED_ADDRESS_MESSAGE);
    assertPort(url, hostClass);
    return { url, hostClass };
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    assertPort(url, "local");
    return { url, hostClass: "local" };
  }
  return { url, hostClass: "resolve" };
}

/** Drops any query or hash and a trailing slash, so the stored value is just the API root. */
export function normalizeAssistBaseUrl(url: URL): string {
  const next = new URL(url.origin);
  next.pathname = url.pathname.replace(/\/+$/, "");
  return next.toString().replace(/\/$/, "");
}

export function chatCompletionsUrl(base: URL): URL {
  const next = new URL(base.toString());
  const path = next.pathname.replace(/\/+$/, "");
  next.pathname = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`;
  next.hash = "";
  next.search = "";
  return next;
}

/** Resolves a hostname and decides whether this request may use it. */
export async function prepareAssistEndpoint(
  input: string,
  resolver: Resolver = systemResolver,
): Promise<{ url: URL; hostClass: AssistHostClass }> {
  const inspected = inspectAssistUrl(input);
  if (inspected.hostClass !== "resolve") return { url: inspected.url, hostClass: inspected.hostClass };

  let records: LookupAddress[];
  try {
    records = await resolver(inspected.url.hostname);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      throw Object.assign(new Error("Libra couldn't resolve the model host."), { code });
    }
    throw error;
  }
  if (records.length === 0) throw Object.assign(new Error("Libra couldn't resolve the model host."), { code: "ENOTFOUND" });

  const classes = records.map((record) => assistAddressClass(record.address));
  if (classes.some((item) => item === "blocked")) {
    throw new BlockedDestinationError("That host resolves to an address Libra won't contact.");
  }
  if (classes.every((item) => item === "local")) {
    assertPort(inspected.url, "local");
    return { url: inspected.url, hostClass: "local" };
  }
  if (classes.every((item) => item === "public")) {
    assertPort(inspected.url, "public");
    return { url: inspected.url, hostClass: "public" };
  }
  throw new BlockedDestinationError("That host name resolves to both public and private addresses, so Libra won't use it.");
}

async function resolveAssistAddresses(
  hostname: string,
  expected: AssistHostClass,
  resolver: Resolver,
): Promise<LookupAddress[]> {
  const bare = stripBrackets(hostname.toLowerCase());
  const records = ipaddr.isValid(bare)
    ? [{ address: bare, family: bare.includes(":") ? 6 : 4 } satisfies LookupAddress]
    : await resolver(bare);
  if (records.length === 0) throw Object.assign(new Error(`No address found for ${bare}`), { code: "ENOTFOUND" });
  if (records.some((record) => assistAddressClass(record.address) !== expected)) {
    throw new BlockedDestinationError(
      expected === "public"
        ? "That host no longer points at a public address, so Libra stopped."
        : "That host no longer points at a local address, so Libra stopped.",
    );
  }
  return records;
}

/**
 * Validates DNS again inside the socket lookup, so a name can't switch from
 * the address class checked above to a different one before the connection.
 */
export function createAssistLookup(expected: AssistHostClass, resolver: Resolver = systemResolver): LookupFunction {
  return (hostname, options, callback) => {
    resolveAssistAddresses(hostname, expected, resolver).then(
      (records) => {
        const family = options.family === 4 || options.family === 6 ? options.family : undefined;
        const preferred = family ? records.filter((record) => record.family === family) : records;
        const usable = preferred.length ? preferred : records;
        const first = usable[0];
        if (!first) {
          callback(Object.assign(new Error(`No address found for ${hostname}`), { code: "ENOTFOUND" }), "", 0);
          return;
        }
        if (options.all) callback(null, usable);
        else callback(null, first.address, first.family);
      },
      (error: NodeJS.ErrnoException) => callback(error, "", 0),
    );
  };
}
