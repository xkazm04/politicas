# A held PGlite store mimics corruption — find the live holder FIRST

**Fact.** On 2026-08-12 two independent builder agents diagnosed `./.pglite`
as corrupt: `PANIC: could not locate a valid checkpoint record`, „database
system was interrupted; last known up at 14:25", and the symptom
**reproduced on a byte copy** — which both read as proof it was data-level,
not a lock. The real cause was a live `next dev -p 3411` server (started
14:12 by a concurrent session) holding the single-connection store the whole
time. The app at :3411 was serving real pass-42 data throughout. A byte copy
of a HELD store is torn **by construction** (see
`robocopy-of-a-live-pglite-store-can-corrupt.md`) — so „reproduces on a
copy" does NOT rule out a holder; it is exactly what a holder produces.

**Why it matters.** The next step after „the store is corrupt" is a restore
from backup — a destructive action against a healthy store that merely has
an owner. The `mv .pglite` of the restore protocol failed with Permission
denied, which was the lock saying so; treating that as an obstacle to work
around instead of as evidence would have destroyed the holder's session.

**How to apply.** Before diagnosing store corruption or starting a restore:
1. `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` and look for
   ANY politicas process — dev servers (`next dev`), not just tsx probes.
2. If a dev server exists, probe it over HTTP (`curl localhost:<port>/...`)
   — real data rendering = healthy, held store. Leave both alone.
3. Only when no holder exists and the store still PANICs at rest is the
   2026-08-04 restore protocol in order (preserve corrupt dir → restore
   named backup → verify boot + pass provenance).
A rename/delete failing with Permission denied on the store dir IS the
holder check failing loudly — never work around it.
