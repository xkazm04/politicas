# Money/CivicScore UX remediation — 2026-07-27

Quality-only remediation pass against `docs/data-analysis/ux-audit-2026-07-27.md`. No new
data, no new analysis, no new features — existing real data made readable and correctly
ranked. Verified against a dedicated dev server (`localhost:3101`, isolated from other
concurrent agents' server on :3000) with real fetches against the live PGlite-backed store.
`npm run check` green (typecheck + lint + 406 tests) after every change in this batch.

Boundary respected: `features/money/`, `app/penize/`, `features/civicscore/`,
`features/profile/`, `app/zebricek/`, `app/poslanec/`, plus `messages/{cs,en}.json` (i18n
catalog, needed for two new translation keys — not itself excluded). Did not touch
`features/lawwatch/`, `features/dashboard/`, `features/landing/`, `features/votetrack/`,
`features/budget/`, `lib/civic/`, or `lib/analysis/` rules. No commits made.

---

## 1. `/penize` headline + default sort (audit #3)

**What it answered before / after.** Before: "how big is the biggest number this page can
show you" (answer: a number the page's own explainer disowns). After: "how many MPs have
the real FollowTheMoney tie" (answer: 19) — the ledger's default view leads with the
strongest-evidence row, not the biggest number.

**Changed:**
- `features/money/moneyTypes.ts` — added `MoneyStats.ownerOperatorMps`.
- `features/money/getMoneyData.ts` — computes it: count of MPs with ≥1 `owner-operator`-class
  tie.
- `features/money/FollowTheMoneyPage.tsx` — headline tile now shows this count
  ("poslanci s vlastní firmou u státu"); `contractCzkReachable` demoted to the last (4th)
  tile, an ordinary column, not the first thing a reader sees.
- `features/money/components/TiesLedger.tsx` — default `sortKey` changed from `"reach"` to
  a new `"evidence"` key sorting by `tie.reviewRank` (the batch-005 review order — already
  computed, tier ascending / money descending within tier — reused verbatim, no new ranking
  logic invented). The "class" column header is now clickable to toggle this sort explicitly.
- `messages/cs.json` / `messages/en.json` — added `money.real.stats.owner{Label,Sub,Source}`.

**Ranking before/after (verified live):**
- Before (audit): row 1 = Petr Hladík · KDU-ČSL · ARENA BRNO, a.s. · dozorčí/správní ·
  ukončeno 2022 · 6,1 mld. Kč (an ended, non-executive steward seat — the tie class the
  page's own explainer says never to read as personal enrichment).
- After: row 1 = **Radim Fiala · SPD · IF FACILITY a.s. · vlastník/jednatel · ukončeno 2014 ·
  186,6 mil. Kč** — a registry-confirmed owner-operator tie, the real FollowTheMoney class,
  ranked correctly ahead of any steward regardless of steward reach.

**Payload:** `/penize` 403 327 → 405 859 bytes (net flat; one stat swapped for another,
no volume added).

## 2. `/penize/[pspId]` case-file sort (audit #4)

**Changed:**
- `features/money/getMpDetail.ts:40` — tie sort changed from `contractCzk+subsidiesCzk`
  descending to `reviewRank` ascending (same evidence-order axis as #1).
- `features/money/getMoneyData.ts` (the `tiesByPerson` grouping loop) — same fix, so the
  comment already there ("strongest evidence first within a case file") stops lying about
  what the code actually did.

**Ranking before/after (verified live, `/penize/6786`, Róbert Teleky):**
- Before (audit): card 6 of 6 = Teleky Medicus s.r.o. (owner-operator, active, `úplný
  trojúhelník`) — smallest number, so last.
- After: **card 1 of 6 = Teleky Medicus s.r.o. · Jednatel · vlastník/jednatel · trvá** — the
  active family firm taking contracts + subsidies + donating to the MP's own party is now
  the first thing a reader sees, exactly where its evidential strength puts it. Hospital/
  waterworks steward seats (ended 2021–2022) now sort after it.

**Payload:** `/penize/6786` 137 018 → 139 393 bytes (flat).

## 3. Dossier truncation (audit #9)

**Changed:** `features/profile/components/ExpandableText.tsx`
- `COLLAPSE_AT` raised 240 → 360.
- Hard character slice replaced with `collapseBoundary()`: looks for the nearest sentence
  end (`. `, `! `, `? `) within 200 chars after the threshold; falls back to the nearest
  word boundary (never mid-word) if the sentence runs long.

**Truncation case (verified live, Radim Fiala, `Poznámky k datům`):**
- Before: cut at char 240, mid-word — *"...IF FACILITY a.s. (IČO 27720152, dříve IF KINGS
  SECURITY s.r.o. z Pro…"*.
- After: collapsed text is now 390 chars and reads through to the actual finding —
  *"...přímé ověření ve veřejném rejstříku ukazuje, že Radim Fiala **NEMÁ aktuální
  statutární ani vlastnickou roli** v žádné z firem: IF Holding a.s.…"*. The payoff clause
  (the verified-absence-of-role finding) is now inside the collapsed view instead of hidden
  behind "více" on every profile.

Scoped to the truncation mechanism only, per the task's instruction — did not reorder
`DossierSection`'s field order or touch the separate `publicRole` field (a different audit
item, out of this batch's assigned five).

## 4. `/zebricek` weight + bars (audit #8)

**What it answered before / after.** Before: six near-identical colored bars per row that
don't discriminate rank (top ~50 MPs share near-max Práce/Legislativa/Sál segments; actual
rank differences hid in a ~4px-wide Docházka sliver). After: one text stat per row — the
single component where that MP deviates furthest from the chamber median — states the thing
that actually explains the row.

**Changed:**
- `features/civicscore/components/LeaderboardTable.tsx` — removed `MiniBreakdown` (six
  `<span>` segments/row) and its now-orphaned color legend; added `componentMedians()` +
  `StandoutStat` (pure text, no SVG/DOM per-segment cost).
- `features/civicscore/getLeaderboardData.ts` — added `LeaderboardListEntry` (a `Pick` of
  exactly what the list + duel render: identity, score, six component points, workhorse/
  dossier flags) and `LeaderboardListData`. Added `getLeaderboardListData()` as a new,
  **list-only** entry point that trims every one of the 207 entries down to this shape
  before it reaches the client tree. `getLeaderboardData()` (full `LeaderboardEntry`,
  including `trend`, `effortPublicRole` prose, `effortLowScoreReason`, and seven raw
  counters) is **unchanged** — `features/dashboard/getDashboardData.ts` (out of this batch's
  boundary) still calls it and still gets the full shape it needs (`absenceRate`, etc.).
  `features/profile/getProfileData.ts` still calls `buildLeaderboard()` directly for the
  same reason — a profile page needs the one MP's full record.
- `app/zebricek/page.tsx` — switched from `getLeaderboardData()` to
  `getLeaderboardListData()`.
- `features/civicscore/CivicScorePage.tsx`, `HeadToHead.tsx` — retyped to
  `LeaderboardListEntry`/`LeaderboardListData`; verified (by reading every reference) that
  neither the list rows nor the duel view ever read `trend`/`effortPublicRole`/the seven raw
  counters — confirmed by `npm run typecheck` after the trim (would have failed loudly if a
  render path needed a dropped field; it didn't, until the dashboard's *separate* full-data
  consumer surfaced the one legitimate cross-feature dependency, which is why the full/list
  split exists instead of a blanket trim).

**Measured (verified live via curl):**
- Bytes: **1 045 363 → 750 981** (−28%, −294 KB) for a page whose rows previously carried
  ~5 KB/MP of data (trend deltas, dossier prose, raw vote counters) that nothing in the list
  or duel ever rendered.
- SVG/path count unchanged (645/1533) — those are lucide nav/status icons (arrow, dossier
  file icon, swords button), not the bars; removing them was not in scope and they are cheap
  per-icon. The actual fix for "bars too similar to discriminate" is qualitative: six
  same-width segments → one labelled deviation stat. Spot-checked rank #1 (Karel Haas,
  96,8): row now reads **"+10 Legislativní"** instead of six near-identical bar segments.
- `/dashboard` (out of boundary, sanity-checked only): 200 OK, unaffected — still calls the
  full-detail `getLeaderboardData()`.

**Deleted:** `MiniBreakdown` component, the per-row bar color legend, and the now-dead
`money.componentLegendNote` render path (translation keys left in the catalog rather than
deleted, to avoid an out-of-scope i18n-parity chase).

## 5. `/penize/kauzy` hardcoded dossier array (audit, Part 2 scale table)

**Changed:** `features/money/getLeadDossiers.ts` — replaced the hardcoded
`DOSSIER_FILES = ["batch-005-lead-juchelka.json", "batch-005-lead-okamura.json"]` array with
`readdir(PAYLOAD_DIR)` over every `*.json` in the payload directory, keeping only files that
pass the existing `isDossier()` shape validation (the directory holds many non-dossier batch
payloads — review-rank tables, corroboration dumps — so shape validation, not a filename
convention, is what selects dossiers).

**Verified live:** wrote a synthetic third dossier file
(`test-third-dossier.json`, cloned from `batch-005-lead-okamura.json` with a distinct
`leadId`/subject) directly into the payload directory with **no code change and no
redeploy** — it appeared on `/penize/kauzy` on the next request (confirmed via curl: the
subject name and `leadId` were present in the rendered HTML). Removed the test file
afterward; confirmed it disappeared from the page on the next request. `/penize/kauzy` no
longer breaks at n=3.

**Payload:** `/penize/kauzy` 133 693 → 136 556 bytes (flat; `readdir` + shape-validate over
13 files is negligible cost, well under the render-time budget).

---

## Check status

- `npm run typecheck` — clean (0 errors) after the full batch, including the
  full/list-entry split required to keep `features/dashboard` (out of boundary) working.
- `npm run lint` — 0 errors, 1 pre-existing warning unrelated to this batch
  (`features/graph/components/NodeSearch.tsx`, a `react-hooks/exhaustive-deps` ref-cleanup
  warning, not touched by this session).
- `npm run test` — 406/406 passing (39 files).
- No commits made; no live `.pglite` writes; no `lib/analysis/` rule changes;
  `custom/no-silent-null-catch` / `reportLoaderFailure()` discipline preserved in every
  edited loader (no new catch blocks added).

## What I did not touch (deliberately out of this batch's five defects)

- The sidebar's contradicting module numbers, the fabricated demo layer
  (`lib/civic/data.ts`), English-language dossier/collision prose, the raw `tie.flags` /
  reconciliation-note leak on `MpCaseFilePage`, and the inline verification caveat inside
  `publicRole` prose — all real defects in the audit, all outside the five assigned to this
  session, all inside other agents' concurrent boundaries (or explicitly deferred).

C:/Users/mkdol/dolla/politicas/docs/data-analysis/money-ux-remediation-2026-07-27.md
