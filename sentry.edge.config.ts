// Sentry — edge runtime initialization.
//
// Loaded by `instrumentation.ts` via `register()` when NEXT_RUNTIME === "edge"
// (middleware and edge routes). ENV-GATED: a completely silent no-op when
// NEXT_PUBLIC_SENTRY_DSN is unset — `Sentry.init` is never called, so there is
// no network activity and no console noise. Set the DSN in the Vercel dashboard
// / a local `.env` (see .env.example); never commit a real DSN.
import * as Sentry from "@sentry/nextjs";
import { scrubFollowTelemetry } from "@/features/schranka/telemetryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV,
    tracesSampleRate: 1,
    debug: false,
    // The follow list of the Občanská schránka travels in the QUERY of
    // /schranka/novinky.json and the schránka feeds, and with tracing at 1.0
    // the SDK copies that URL into several trace attributes on its own. The
    // server and client configs strip it on both hooks since 2026-08-12; this
    // runtime was the one left without the scrub (scan-sweep 2026-09-07) — a
    // middleware or edge route added later would have shipped the fingerprint.
    // See features/schranka/telemetryScrub.ts.
    beforeSend: scrubFollowTelemetry,
    beforeSendTransaction: scrubFollowTelemetry,
  });
}
