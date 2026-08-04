// Sentry — server (Node.js runtime) initialization.
//
// Loaded by `instrumentation.ts` via `register()` when NEXT_RUNTIME === "nodejs".
// ENV-GATED: a completely silent no-op when NEXT_PUBLIC_SENTRY_DSN is unset —
// `Sentry.init` is never called, so there is no network activity and no console
// noise. Set the DSN in the Vercel dashboard / a local `.env` (see .env.example);
// never commit a real DSN.
import * as Sentry from "@sentry/nextjs";
import { scrubFollowTelemetry } from "@/features/schranka/telemetryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV,
    // Performance tracing — tune down for high-traffic production if needed.
    tracesSampleRate: 1,
    // Keep the SDK's own logs quiet unless explicitly debugging.
    debug: false,
    // The Občanská schránka has no accounts: a reader's follow list travels in
    // the QUERY of /schranka/novinky.json and the schránka feeds, because the
    // reader owning a shareable address IS the design. With tracing at 1.0
    // that list would land in every transaction (measured: the SDK copies it
    // into several trace attributes on its own) — and a 20-MP follow list is a
    // fingerprint, not an anonymous request. Both hooks strip the keys and
    // keep only their count; see features/schranka/telemetryScrub.ts.
    beforeSend: scrubFollowTelemetry,
    beforeSendTransaction: scrubFollowTelemetry,
  });
}
