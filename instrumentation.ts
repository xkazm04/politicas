// Next.js server instrumentation entry point (App Router).
//
// `register()` runs once per server instance; it dynamically imports the
// runtime-appropriate Sentry config, each of which is itself env-gated (a
// no-op when NEXT_PUBLIC_SENTRY_DSN is unset). `onRequestError` forwards
// server-side render/route errors to Sentry — a no-op when Sentry is not
// initialized, so it is always safe to export.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
