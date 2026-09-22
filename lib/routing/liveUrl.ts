import { headers } from "next/headers";

/**
 * The live URL of a page, from the REQUEST headers - for the footer of a printed sheet,
 * where an invented domain must never stand: in dev it is honestly localhost, in a
 * deployment the real host behind the proxy. ONE definition (scan-sweep 2026-09-07):
 * /kraj/[kraj] and /plakat/[view] each spelled it under the same comment.
 */
export function liveUrlFrom(host: string | null, forwardedProto: string | null, path: string): string {
  return host ? `${forwardedProto ?? "http"}://${host}${path}` : path;
}

/** `liveUrlFrom` over this request's `host` and `x-forwarded-proto`. */
export async function liveUrl(path: string): Promise<string> {
  const h = await headers();
  return liveUrlFrom(h.get("host"), h.get("x-forwarded-proto"), path);
}
