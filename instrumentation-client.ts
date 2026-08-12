// Sentry — client (browser) initialization.
//
// Next.js runs this file on the client before the app becomes interactive
// (see node_modules/next/dist/docs/.../instrumentation-client.md).
// ENV-GATED: a completely silent no-op when NEXT_PUBLIC_SENTRY_DSN is unset —
// `Sentry.init` is never called, so nothing loads, sends, or logs. Set the DSN
// in the Vercel dashboard / a local `.env` (see .env.example).
import * as Sentry from "@sentry/nextjs";
import { scrubFollowTelemetry } from "@/features/schranka/telemetryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV,
    tracesSampleRate: 1,
    debug: false,
    // The follow list leaves from the BROWSER: SchrankaBadge's useNews() fetch
    // of /schranka/novinky.json?e=<klíč>… runs on every page, and the browser
    // SDK's default integrations copy that full URL into fetch breadcrumbs
    // (`breadcrumbs[].data.url`) and `http.client` span attributes — the exact
    // shapes the scrub walks. Binding only the server hooks (as this file did
    // until 2026-08-12) left the fingerprint path open on the client.
    beforeSend: scrubFollowTelemetry,
    beforeSendTransaction: scrubFollowTelemetry,
  });
}

// Instruments App Router client-side navigations. When Sentry is not
// initialized (no DSN) this is a harmless no-op.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
