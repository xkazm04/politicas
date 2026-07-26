/**
 * Closed-union narrowing for kg `props` values at the loader boundary.
 *
 * `KgNodeRow.props` / `KgEdgeRow.props` are honestly `Record<string, unknown>`
 * (arbitrary ingested JSON); widening them with `as SomeUnion` admits any
 * out-of-vocabulary string straight into a render branch. Narrow by membership
 * check instead — same idiom the repository mappers use
 * (lib/db/pglite/mappers.ts). See
 * docs/architect/decisions/2026-07-26-props-union-narrowing.md.
 */
export function asUnion<T extends string>(value: unknown, members: readonly T[], fallback: T): T;
export function asUnion<T extends string>(value: unknown, members: readonly T[], fallback: T | null): T | null;
export function asUnion<T extends string>(value: unknown, members: readonly T[], fallback: T | null): T | null {
  return typeof value === "string" && (members as readonly string[]).includes(value) ? (value as T) : fallback;
}
