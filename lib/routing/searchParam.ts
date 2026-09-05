/**
 * The FIRST value of a Next search param (`string | string[] | undefined`), or null. A shape
 * guard over `searchParams`, not a codec - the codec of the value (the lens vector, say) is
 * the caller's. ONE definition (scan-sweep 2026-09-07): /referendum and /zebricek each
 * spelled it under a comment naming the other.
 */
export function firstParam(v: string | string[] | undefined): string | null {
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;
}
