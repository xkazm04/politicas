import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl (App Router, no i18n routing): reads the active locale from the
// NEXT_LOCALE cookie in ./lib/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // The parent kiro folder has its own lockfile; pin the root so Turbopack
  // doesn't infer the wrong workspace. This stays correct for a standalone
  // Vercel deploy too — __dirname is the repo root there — so it needs no
  // change (see docs/deploy/vercel.md). Only revisit if politicas is ever
  // deployed as a subdirectory of a larger monorepo on Vercel.
  turbopack: {
    root: __dirname,
  },
};

// withSentryConfig wraps the Next config to enable Sentry's build-time
// integration (source-map upload). It is a no-op for event delivery on its own
// — runtime capture is gated on the DSN in the sentry.*.config.ts /
// instrumentation-client.ts files. Source-map upload only happens when
// SENTRY_AUTH_TOKEN (+ org/project) are present; otherwise it is skipped
// silently. `silent` keeps local builds quiet and lets CI surface logs.
// (No `disableLogger`: it is deprecated and unsupported under Turbopack, which
// this app builds with — leaving it in only produces build-time warn-spam.)
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
