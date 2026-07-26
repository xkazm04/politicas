import * as Sentry from "@sentry/nextjs";

/**
 * Failure reporter for the server-loader boundary (`features/**\/get*Data.ts`).
 *
 * The loader convention converts every failure into `null` (page falls back to
 * mock/empty state) — a convention whose failure mode is invisibility: a dead
 * store is indistinguishable from an empty graph. Call this in the catch before
 * returning null/[] so every degradation leaves a log line and a Sentry event.
 * `captureException` is a no-op when the DSN is unset, so always safe to call.
 * See docs/architect/decisions/2026-07-26-silent-degradation-observability.md.
 */
export function reportLoaderFailure(loader: string, err: unknown): void {
  console.error(`[loader:${loader}] failed — surface degrades to fallback`, err);
  Sentry.captureException(err, { tags: { loader } });
}
