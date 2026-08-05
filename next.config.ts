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
  // PGlite must NOT be bundled by the server compiler. Bundled, its WASM/FS
  // loader hands Node a `URL` where a path string is expected and the store
  // fails to open with
  //   TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type
  //   string or an instance of Buffer or URL. Received an instance of URL
  // …which every server loader catches, so the whole app degrades SILENTLY to
  // its labelled mock — the real cause of "the surfaces render no data" (found
  // 2026-07-25 in the manifestation pass; CLI scripts were unaffected because
  // they never go through the bundler).
  serverExternalPackages: ["@electric-sql/pglite"],
  // Security headers. Framing policy uses CSP frame-ancestors (not
  // X-Frame-Options, which cannot express a per-route allow-all): everything
  // is deny-by-default, but /embed/* stays embeddable by third parties — that
  // is the widget's entire purpose (app/embed/zebricek/route.ts sets its own
  // matching `frame-ancestors *` on the response as well). Rule order matters:
  // the /embed rule comes second so its CSP key overrides the catch-all.
  //
  // Follow-up (deliberately NOT in this pass): a full Content-Security-Policy
  // with script-src. Next's inline bootstrap scripts require a nonce/hash
  // pipeline (middleware-generated nonce threaded through the root layout) —
  // that is a project, not a checkbox. Tracked for post-launch.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'",
          },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
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
