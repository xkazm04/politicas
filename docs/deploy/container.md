# Deploying politicas as a container (chosen route)

> **STATUS: this is the chosen deploy route** — route (a) from
> [`vercel.md`](./vercel.md): a long-lived `next start`-equivalent process in a
> container, with the PGlite store on a **persistent volume** and `PGLITE_PATH`
> pointed at its mount. Primary target: **Fly.io** ([`fly.toml`](../../fly.toml)
> at the repo root); Railway equivalent in [§9](#9-railway-equivalent-notes).
>
> The operator owns the provider account, domain, and secret **values**. This
> doc names every step and every variable NAME; it never contains a value.

## 0. The non-negotiables (why the config looks like this)

1. **Single instance, forever (until route (b)).** PGlite is single-connection
   per data directory (`lib/db/config.ts`): a second process against the same
   store corrupts or blocks. `fly.toml` therefore pins one machine, and
   deploys use `strategy = "immediate"` — a few seconds of downtime per deploy
   instead of a rolling replacement (which would momentarily run two machines
   fighting over the volume). Never `fly scale count 2`.
2. **The image contains no data.** `.dockerignore` excludes `.pglite*`; the
   1.6 GB store lives only on the volume at `/data/pglite` (`PGLITE_PATH`).
   An image rebuild never touches data; a volume snapshot never touches code.
3. **The store must stay warm.** `auto_stop_machines = "off"` +
   `min_machines_running = 1`. A cold start re-opens a 1.6 GB store.
4. **`NEXT_PUBLIC_*` are build-time.** They go in as Docker **build args**
   (`fly.toml [build.args]`), not runtime secrets. Changing the DSN or app-env
   requires a rebuild+redeploy — same contract as Vercel.

## 1. Prerequisites

- `flyctl` installed and authenticated (`fly auth login`) — operator-side.
- Docker locally if you want to build/rehearse locally (optional; Fly builds
  remotely by default via `fly deploy`).
- A local `.pglite` store that passes the cardinality floors
  (`lib/db/readiness.ts`: person ≥150, company ≥140, bill ≥100, law ≥70,
  contract ≥1500). As of 2026-08-05 the real store has 207 persons.

## 2. Create the app + volume (one-time)

```sh
fly launch --no-deploy --copy-config --name <app-name>   # reads fly.toml, creates the app
fly volumes create pglite_data --region fra --size 5     # 5 GB: 1.6 GB store + growth + tar headroom
```

If the app name differs from `app = "politicas"` in `fly.toml`, update the
file (or pass `-a <app-name>` to every command below).

## 3. Set secrets (names only — values are the operator's)

```sh
fly secrets set ADMIN_TOKEN=<value>        # /admin console gate — unset ⇒ console CLOSED (fails closed)
fly secrets set REVIEWER_TOKEN=<value> REVIEWER_NAME=<value>
    # BOTH required together (see .env.example): token without name ⇒ server
    # refuses every review decision ("misconfigured"). Use a DIFFERENT value
    # than ADMIN_TOKEN. Unset ⇒ /penize/kontrola stays read-only.
```

Not secrets (build args, set in `fly.toml [build.args]` or per-deploy):

```sh
fly deploy --build-arg NEXT_PUBLIC_SENTRY_DSN=<dsn> --build-arg NEXT_PUBLIC_APP_ENV=production
```

All of these are **optional for the app to run** — everything fails closed or
no-ops silently (`.env.example` is the authoritative reference). Never set
`KG_READINESS_OFF` in a deployment.

## 4. First deploy (empty store — expected)

```sh
fly deploy
```

The machine boots with an **empty volume**. PGlite creates an empty-but-healthy
store at `/data/pglite`, `storeReady()` fails the floors (loudly, in logs), and
every public surface renders its **labelled** degraded state — `/zebricek`
shows „Živá data z grafu nedostupná." instead of the leaderboard. That is the
designed behavior, not an error. Now seed.

## 5. Seed the volume with the local store

**Never seed from the live `./.pglite` while anything (dev server, `da:*`
script) has it open — copy first** (single-connection rule; a live dir copied
under use can be torn). From the repo root:

```sh
# 1. Make a quiesced copy (or reuse a known-good backup like .pglite-backup-YYYYMMDD-*)
cp -r .pglite .pglite-seed

# 2. Pack it — one tarball moves ~100× faster over sftp than thousands of files.
#    --transform makes it extract as ./pglite (matching PGLITE_PATH=/data/pglite).
tar -czf pglite-seed.tar.gz --transform 's,^\.pglite-seed,pglite,' .pglite-seed

# 3. Upload to the volume (machine must be running — it is, after §4)
fly ssh sftp shell
sftp> put pglite-seed.tar.gz /data/pglite-seed.tar.gz
sftp> exit

# 4. Swap it in atomically-enough: extract to a temp name, then rename.
fly ssh console -C "sh -c 'cd /data && rm -rf pglite.next && mkdir pglite.next && tar -xzf pglite-seed.tar.gz -C pglite.next --strip-components=1 && rm -rf pglite.old && { [ -d pglite ] && mv pglite pglite.old || true; } && mv pglite.next pglite && rm pglite-seed.tar.gz'"

# 5. Restart so the (single-connection) process re-opens the seeded store
fly machine restart

# 6. Clean up locally
rm -rf .pglite-seed pglite-seed.tar.gz
```

(If BSD tar locally: replace `--transform`/`--strip-components` with
`cd .pglite-seed && tar -czf ../pglite-seed.tar.gz .` and extract into
`pglite.next` directly.)

Re-seeding after a fresh ingest = repeat this section. The app keeps serving
the old store until the `fly machine restart`.

## 6. Deploy updates (code only)

```sh
fly deploy          # rebuild + replace the machine; volume (data) untouched
```

Seconds of downtime per deploy (single machine, `strategy = "immediate"`).

## 7. Verify — the smoke criterion

```sh
curl -sf -o /dev/null -w '%{http_code}\n' https://<app>.fly.dev/          # 200
curl -s https://<app>.fly.dev/zebricek | grep -c 'Živá data z grafu nedostupná'   # MUST be 0
```

Then open `https://<app>.fly.dev/zebricek` in a browser: it must render the
**full leaderboard of 207 real MPs** (ranked contribution index), **not** the
dashed "Živá data z grafu nedostupná." notice. If the notice shows:

- `fly logs` — look for `[readiness]`/`storeReady` floor failures
  (`graph below cardinality floor: …`) or `reportLoaderFailure` lines.
- `fly ssh console -C "ls /data/pglite"` — is the seed actually there, at
  exactly that path?
- Wrong path (e.g. extracted as `/data/pglite/.pglite-seed/…`) is the classic
  failure — PGlite silently creates a fresh empty store at the configured
  path and the floors fail. Fix the layout, restart.

Also verify fail-closed gates: `/admin` must say the console is closed until
`ADMIN_TOKEN` is set.

## 8. Rollback

```sh
fly releases                       # list releases + image refs
fly deploy --image <previous-image-ref>   # redeploy a prior image as-is
```

Code rollback never touches the volume. There is no automatic data rollback —
if a bad **seed** must be rolled back, re-run §5 with the previous local
backup (`.pglite-backup-YYYYMMDD-*`), or restore a Fly volume snapshot
(`fly volumes snapshots list <vol-id>` → create a new volume from a snapshot,
then attach). Take a snapshot before any risky re-seed.

## 9. Railway equivalent (notes)

Same Dockerfile, same constraints; Railway differences:

- **Volume**: attach a Railway Volume to the service, mount path `/data`.
  Set service variable `PGLITE_PATH=/data/pglite`.
- **Single instance**: Replicas = 1 (never more), and **disable App Sleeping**
  (Settings → Sleep) — same warm-store rationale as `auto_stop_machines = "off"`.
- **Build args**: Railway exposes service variables at build time, so set
  `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_APP_ENV` as plain service variables;
  the Dockerfile `ARG`s pick them up only if wired as build args — simpler on
  Railway is to rely on its variable injection during `docker build`
  (Railway passes service variables as build args automatically).
- **Secrets**: `ADMIN_TOKEN`, `REVIEWER_TOKEN`, `REVIEWER_NAME` as sealed
  service variables.
- **Seeding**: no sftp; use `railway ssh` (or a one-off service) and pull the
  tarball from a private URL, or `railway run` with volume attached. The
  tar-swap in §5 step 4 applies unchanged.
- **Health check**: path `/zebricek` (same caveat: 200 ≠ real data).
- **Port**: Railway injects `PORT`; the image honors it (`ENV PORT=3000` is
  only a default).

## 10. Known limits (accepted, by design — until route (b))

- **One machine** = no horizontal scaling, no zero-downtime deploys, one
  region. The escape hatch is route (b) in `vercel.md` (hosted Postgres for
  serving); this route deliberately keeps the entire `da:*` loop unchanged.
- **Writes on the volume**: the only write path is `/penize/kontrola`
  (review decisions) + admin state — all inside the same single PGlite store,
  so re-seeding **overwrites production review_audit rows** written since the
  seed. Before re-seeding, either export those decisions or accept the loss
  consciously. (Today the review console is operator-only; coordinate.)
- **Local rehearsal** (what was proven on 2026-08-05, Docker 29.3.1,
  linux/arm64): image builds from this Dockerfile; container serves `/` and
  `/zebricek` with real data from a volume-mounted store copy. See the
  rehearsal notes in the PR/commit that introduced this file.
