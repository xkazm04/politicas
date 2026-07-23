# Deploying politicas to Vercel

Quick-card for shipping this app to Vercel. **Production** is the deploy target;
**Preview** deployments (one per PR / push) are where changes get tested.

> This repo does **not** deploy itself. A human connects the repo in the Vercel
> dashboard and owns the Production promote. Nothing here runs `vercel deploy`.

## 1. Connect the repo (one-time)

1. Vercel dashboard → **Add New… → Project** → import the `politicas` Git repo.
2. **Framework Preset**: Vercel auto-detects **Next.js** from `package.json`
   (`next@16.2.11`). Leave Build Command, Output, and Install Command on their
   auto values — this app is **zero-config** (see [§ vercel.json](#no-verceljson)).
3. **Root Directory**: the repo root (`.`). Only change this if politicas is
   nested inside a larger monorepo on Vercel — see the turbopack note below.
4. Add the environment variables (next section) **before** the first deploy —
   `NEXT_PUBLIC_*` vars are inlined at build time, so they must exist when the
   build runs, not after.
5. Deploy. Every push to a branch/PR yields a **Preview**; promoting (or pushing
   to the production branch) yields **Production**.

## 2. Environment variables — by name, by environment

Set these in **Project → Settings → Environment Variables**. Every variable is
**optional**: with none set, the app runs normally and Sentry is a completely
silent no-op. Names and semantics mirror [`.env.example`](../../.env.example).

| Variable | Production | Preview | Local (`.env.local`) | Secret? | Purpose |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | set (prod DSN) | set (same or a preview DSN) | optional | No (public, in client bundle) | The single gate for **all** Sentry activity. Unset → no init anywhere. |
| `NEXT_PUBLIC_APP_ENV` | `production` | `preview` | `development` | No | Environment tag on every Sentry event. |
| `SENTRY_ORG` | optional | optional | — | No | Build-time source-map upload only. |
| `SENTRY_PROJECT` | optional | optional | — | No | Build-time source-map upload only. |
| `SENTRY_AUTH_TOKEN` | optional | optional | — | **Yes** — mark as a Vercel secret; never commit | Enables source-map upload. Absent → upload skipped silently, build still passes. |

Notes:
- `NEXT_PUBLIC_*` are **build-time inlined**. After changing one, you must
  **redeploy** for it to take effect — editing the value alone does nothing to a
  build that already shipped.
- Source-map upload (the three `SENTRY_*` vars) is the only reason to set
  anything beyond the two `NEXT_PUBLIC_*` vars. All three must be present for
  upload; any missing → the build skips upload without failing.

## 3. What can go wrong (top 3)

### a) `NEXT_PUBLIC_*` unset at build time
Because these are compiled into the bundle, a DSN added to the dashboard *after*
a deploy will not activate Sentry until the next build. Symptom: you expect
Sentry events but see none — and there is **no error or warning**, because the
app treats an unset DSN as a deliberate no-op. Fix: set the vars for the target
environment and **redeploy**.

### b) Node version drift
CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) builds on
**Node 22**. `package.json` declares no `engines` field, so Vercel uses its
own default Node version, which can drift from CI over time. Pin
**Project → Settings → Node.js Version → 22.x** so the Vercel build matches CI
and local. (Alternatively add an `engines.node` field to `package.json`.)

### c) `turbopack.root` in `next.config.ts` — reviewed, left unchanged
`next.config.ts` pins `turbopack: { root: __dirname }`. This was added because
the parent `kiro` monorepo had its own lockfile and Turbopack would otherwise
infer the wrong workspace root.

**For a standalone Vercel deploy this needs no change** and was intentionally
left as-is: `__dirname` resolves to the repo root, which is exactly the workspace
root Vercel builds from, so the pin is correct (and silences Next's multi-lockfile
root-inference warning if one ever reappears). The only situation that would
require revisiting it: deploying politicas as a **subdirectory** of a larger
monorepo on Vercel with the **Root Directory** set to that subfolder — in that
case confirm `__dirname` still points at the project directory (it does, since
Vercel builds from the Root Directory). We did not silently alter build behavior.

## <a name="no-verceljson"></a>No `vercel.json` — and why

This repo intentionally ships **no `vercel.json`**. Next.js on Vercel is
zero-config: the framework preset supplies the build command, output handling,
routing, and function defaults. This app has no custom rewrites, redirects,
headers, cron jobs, or region pinning that would require overriding those
defaults. Adding a `vercel.json` would only introduce config that can drift from
the framework's own conventions. Add one only if a concrete need appears (e.g. a
custom header policy, a cron, or a pinned function region).
