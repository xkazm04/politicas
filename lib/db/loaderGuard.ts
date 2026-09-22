import * as Sentry from "@sentry/nextjs";

import { appendLoaderFailure } from "./loaderFailureLog";

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
  // A THIRD sink, added 2026-09-04, because the first two answer nothing after
  // the fact: the console line is gone when the terminal scrolls and
  // `captureException` is a no-op with no DSN (docs/routes/app-shell.md). With
  // 121 call sites, "which surfaces fell back to mock in the last 24 h" was
  // unanswerable — /admin renders this roll-up and the sentinel reads it as a
  // check. The append never throws (see loaderFailureLog.ts): this is a catch
  // block, and a throw here would turn an honest fallback into a crash.
  appendLoaderFailure(loader, err);
}
