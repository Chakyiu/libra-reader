import dns, { type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";

export class BlockedDestinationError extends Error {
  readonly code = "BLOCKED_DESTINATION";
  constructor(message: string) {
    super(message);
    this.name = "BlockedDestinationError";
  }
}

export const PRIVATE_DESTINATION_MESSAGE =
  "That address points to a private or local network. Libra only fetches public websites.";

export const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".home.arpa",
  ".corp",
  ".private",
];

const GLOBAL_UNICAST_V6 = ipaddr.IPv6.parseCIDR("2000::/3");

/** Ranges inside 2000::/3 that are not ordinary public unicast. */
const BLOCKED_V6 = [
  "2001::/32", // Teredo: tunnels to an embedded IPv4 address
  "2001:2::/48", // benchmarking
  "2001:10::/28", // ORCHID
  "2001:20::/28", // ORCHIDv2
  "2001:db8::/32", // documentation
  "2002::/16", // 6to4: embeds an IPv4 address
  "3fff::/20", // documentation
].map((cidr) => ipaddr.IPv6.parseCIDR(cidr));

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/**
 * True only for globally routable unicast addresses. Loopback, private,
 * link-local (including cloud metadata at 169.254.169.254), CGNAT,
 * multicast, reserved, documentation and IPv4-mapped private addresses
 * are all rejected.
 */
export function isPublicAddress(ip: string): boolean {
  const bare = stripBrackets(ip.trim());
  if (!bare || bare.includes("%")) return false;
  if (!ipaddr.isValid(bare)) return false;

  let addr = ipaddr.parse(bare);
  if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
    addr = (addr as ipaddr.IPv6).toIPv4Address();
  }

  if (addr.kind() === "ipv4") return addr.range() === "unicast";

  const v6 = addr as ipaddr.IPv6;
  if (v6.range() !== "unicast") return false;
  if (!v6.match(GLOBAL_UNICAST_V6)) return false;
  return !BLOCKED_V6.some((range) => v6.match(range));
}

/**
 * Static checks that need no network: scheme, credentials, port, and
 * hostnames that are local by construction. DNS answers are checked by
 * resolvePublicAddresses at connect time, for the first hop and every redirect.
 */
export function assertUrlAllowed(input: string | URL): URL {
  let url: URL;
  try {
    url = new URL(input.toString());
  } catch {
    throw new BlockedDestinationError("That isn't a valid web address.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedDestinationError("Only http:// and https:// addresses can be fetched.");
  }
  if (url.username || url.password) {
    throw new BlockedDestinationError("Addresses with a username or password can't be fetched.");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new BlockedDestinationError(`Port ${url.port} isn't allowed. Libra only fetches standard web ports.`);
  }

  const host = stripBrackets(url.hostname.toLowerCase()).replace(/\.$/, "");
  if (!host) throw new BlockedDestinationError("That address has no host name.");

  if (ipaddr.isValid(host)) {
    if (!isPublicAddress(host)) throw new BlockedDestinationError(PRIVATE_DESTINATION_MESSAGE);
    return url;
  }
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new BlockedDestinationError(PRIVATE_DESTINATION_MESSAGE);
  }
  if (!host.includes(".")) {
    throw new BlockedDestinationError(
      "Single-word host names can point at machines on your own network, so Libra won't fetch them.",
    );
  }
  return url;
}

export type Resolver = (hostname: string) => Promise<LookupAddress[]>;

export const systemResolver: Resolver = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

/** Resolves a host and refuses if any answer is non-public (no partial trust). */
export async function resolvePublicAddresses(
  hostname: string,
  resolver: Resolver = systemResolver,
): Promise<LookupAddress[]> {
  const bare = stripBrackets(hostname);
  if (ipaddr.isValid(bare)) {
    if (!isPublicAddress(bare)) throw new BlockedDestinationError(PRIVATE_DESTINATION_MESSAGE);
    return [{ address: bare, family: bare.includes(":") ? 6 : 4 }];
  }
  const records = await resolver(bare);
  if (records.length === 0) {
    throw Object.assign(new Error(`No address found for ${bare}`), { code: "ENOTFOUND" });
  }
  if (records.some((record) => !isPublicAddress(record.address))) {
    throw new BlockedDestinationError(PRIVATE_DESTINATION_MESSAGE);
  }
  return records;
}

/**
 * A `lookup` for http.request / net.connect that validates every resolved
 * address and hands the socket only validated ones, so the address checked is
 * the address connected to (no DNS-rebinding window between check and use).
 */
export function createGuardedLookup(resolver: Resolver = systemResolver): LookupFunction {
  return (hostname, options, callback) => {
    resolvePublicAddresses(hostname, resolver).then(
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
