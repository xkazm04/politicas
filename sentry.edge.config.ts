// Sentry — edge runtime initialization.
//
// Loaded by `instrumentation.ts` via `register()` when NEXT_RUNTIME === "edge"
// (middleware and edge routes). ENV-GATED: a completely silent no-op when
// NEXT_PUBLIC_SENTRY_DSN is unset — `Sentry.init` is never called, so there is
// no network activity and no console noise. Set the DSN in the Vercel dashboard
// / a local `.env` (see .env.example); never commit a real DSN.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV,
    tracesSampleRate: 1,
    debug: false,
  });
}
