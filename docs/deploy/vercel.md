# Deploying politicas to Vercel

> **STATUS: NOT DEPLOYABLE TO VERCEL AS-IS.** The data layer is incompatible
> with Vercel's runtime — see the blocker below. Everything after it (env vars,
> Node pinning, `vercel.json`) is *correct but conditional*: it describes how the
> build would be configured **once the data layer is resolved**, not a green
> light to connect the repo today.

This repo does **not** deploy itself. A human connects the repo in the Vercel
dashboard and owns the Production promote. Nothing here runs `vercel deploy`.

## 0. BLOCKER — the data layer cannot live on Vercel

**Hard prerequisite. Resolve this before any deploy, Preview included.**

### What the code actually does

- `lib/db/config.ts` exposes exactly one driver — `DbDriver = "pglite"` — and
  `dbDriver()` returns `"pglite"` by default. There is no hosted-Postgres path.
- `pglitePath()` returns `process.env.PGLITE_PATH || "./.pglite"` — a
  **directory on the local filesystem**, relative to the process cwd.
- `lib/db/pglite/internals.ts` `open()` does `new PGlite(pglitePath())` and then
  `pg.exec(CORE_DDL)`. If the directory does not exist, PGlite **creates it and
  the schema** — an *empty but perfectly healthy* store. There is no error.
- The `.pglite` directory is produced offline by the `da:*` ingest/analysis
  scripts (`npm run da:ingest`, `da:kg-*`, …). It is **not** a build artifact
  and is not in the repository.

### Why that breaks on Vercel

Vercel serverless functions get an ephemeral, read-only filesystem (only `/tmp`
is writable, and it is per-instance and discarded). So on every cold start:

1. `./.pglite` does not exist → PGlite creates an **empty** database with valid
   schema. No exception is thrown, so nothing looks wrong.
2. `storeReady()` (`lib/db/readiness.ts`) checks the `CARDINALITY_FLOORS`
   (person 150 / company 140 / bill 100 / law 70 / contract 1 500) and returns
   `false` — correctly, and it does report through `reportLoaderFailure()`.
3. Every loader in `features/**/get*Data.ts` therefore returns `null`.
4. Each page falls back to the sample data in `lib/civic/` — **and renders**.

**The result is a live site showing plausible, invented civic numbers about real
named politicians.** That is a direct violation of this project's brand rule
("every rendered number cites its source"), and it fails *silently* from the
visitor's side. The readiness guard and the loader-failure reporter do their job
— they make the degradation traceable in logs — but they do not stop the page
from shipping fiction to the public.

Secondary, independently disqualifying: **PGlite is single-connection per data
directory** (documented in `lib/db/config.ts` and `internals.ts`). Serverless
scales to N concurrent instances by design; even with a shared filesystem, N
writers/readers against one data dir is exactly the configuration those comments
warn corrupts or blocks.

### The two viable routes (pick one — this doc does not choose)

**(a) Containerize with a persistent volume.** Run the app as a long-lived
Node process (`next start`) in a container on a host that offers attached disks
— Fly.io, Railway, or equivalent — with `.pglite` on a persistent volume and
`PGLITE_PATH` pointed at its mount. Keeps the current data layer and the whole
`da:*` loop unchanged; the constraint that follows is that the serving tier must
stay **one instance** (single-connection), so horizontal scaling and zero-downtime
rolling deploys need designing before, not after. Vercel is off the table in this
route.

**(b) Move serving to hosted Postgres; keep PGlite as the analysis store.**
`lib/db/config.ts` already anticipates this in its own header: the `Store`
indirection exists so that "the move to a hosted Postgres is a new file, not a
rewrite of every call site". Add a second `DbDriver`, implement `Store` against a
managed Postgres, and have the offline `da:*` loops publish into it; PGlite then
stays what it is good at — the local, zero-infra analysis substrate. This is the
only route that makes Vercel (or any serverless host) viable, and it is the
larger piece of work: a new repository implementation plus a publish step, both
of which must clear the same `storeReady()` floors before a surface is allowed
to claim real data.

Whichever route is taken, the deploy is only safe once a served page either
shows real, sourced data or shows an explicit unavailable state — never the
`lib/civic/` sample presented as fact.

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
**optional for the app to run**: with none set, the public surfaces work
normally and Sentry is a completely silent no-op. The two token vars gate
capability, not startup — and they fail **closed**. Names and semantics mirror
[`.env.example`](../../.env.example): the NAME is constant per environment, the
VALUE belongs to the deployment target.

| Variable | Production | Preview | Local (`.env.local`) | Secret? | Purpose |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | set (prod DSN) | set (same or a preview DSN) | optional | No (public, in client bundle) | The single gate for **all** Sentry activity. Unset → no init anywhere, incl. the render-error boundaries. |
| `NEXT_PUBLIC_APP_ENV` | `production` | `preview` | `development` | No | Environment tag on every Sentry event. |
| `SENTRY_ORG` | optional | optional | — | No | Build-time source-map upload only. |
| `SENTRY_PROJECT` | optional | optional | — | No | Build-time source-map upload only. |
| `SENTRY_AUTH_TOKEN` | optional | optional | — | **Yes** — mark as a Vercel secret; never commit | Enables source-map upload. Absent → upload skipped silently, build still passes. |
| `ADMIN_TOKEN` | set before the first deploy | set | optional | **Yes** | Unlocks `/admin`. Unset → the console is CLOSED and says so; no admin data is loaded. |
| `REVIEWER_TOKEN` | optional | optional | optional | **Yes** | Unlocks the `/penize/kontrola` write path. Unset → console stays read-only ("not-configured"). |
| `REVIEWER_NAME` | optional | optional | optional | No (display only) | Reviewer stamped on every `review_audit` row. |

Notes:
- `NEXT_PUBLIC_*` are **build-time inlined**. After changing one, you must
  **redeploy** for it to take effect — editing the value alone does nothing to a
  build that already shipped.
- Source-map upload (the three `SENTRY_*` vars) is the only reason to set
  anything beyond the two `NEXT_PUBLIC_*` vars. All three must be present for
  upload; any missing → the build skips upload without failing.
- The DSN is **currently unset in every environment**, so nothing reports today.
  React render errors are caught by `app/global-error.tsx` / `app/error.tsx` and
  shown honestly, but no one is notified until a DSN exists per environment.
- `ADMIN_TOKEN` / `REVIEWER_TOKEN` are server-only (never `NEXT_PUBLIC_`),
  compared in constant time by the shared gate `lib/security/token.ts`. Use
  different values for the two — they guard different privileges.

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
