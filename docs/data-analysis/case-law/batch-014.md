# Case ③ Law loop — batch 014 (2026-08-04 → 05)

Solo run. Army: 3 Sonnet verdict groups, 2 Sonnet collision readers, 1 Sonnet dependency-triage
agent, 1 fresh Opus adversarial auditor (max effort, three rounds). **New doctrine in force and
vindicated: the closure check GATED the write** — batch-014's blocking defects (including a
defamation-class one) were caught and fixed while NOTHING was live.

**The pass in one line:** the dependency census became a validated signal with 18 companion
edges (a new finding class for /zakony), 10 more verdicts landed (5 mediums — state-power and
fiscal findings), the collision rubric was unified across the corpus — and the day ended with
the live store being restored from an old backup by a concurrent session and every lost pass
replayed deterministically from committed payloads within minutes.

## P1 — the bill-dependency census (new deterministic pass, validated)

Phase-1 detector: a Sbírka citation whose number slot is a literal ellipsis („zákona č. …/2026
Sb.") — the drafter's placeholder for a companion act not yet promulgated. 67 hits across 26
bills. The first triage read was audited and its core rule REBUILT (audit B4): a placeholder in
the TARGET LAW's prior-amendment enumeration can never denote the citing bill itself, so that
shape is per se a companion reference. Final classification: **26 self-reference / 18
companion-dependency / 23 honestly unclear**. Companion map (tisk → depends on): 53→16 (the
anchor), 144→64 (verbatim title), 153→69 (three footnotes), 206→ST 777 (explicit), **207→14**
and **216→207** (annex headers — the audit's proof cases), **210→143** (an explicit „zohledňuje
ST 64 … a ST 143" marker found on re-derivation), 64→zákon o účetnictví and 58→an unnamed
87/2023 novela (companions outside the corpus), 250→62 (weak, disclosed as such).
Payloads: `batch-014-dependency-census.json` + `batch-014-dependency-triage.json`.
**Manifestation debt, disclosed:** the dependency map does not render anywhere yet — a
/zakony surface for enactment-order hazards is the natural build item.

## P2 — 10 verdicts on the churn-5/6 head (5 medium / 5 low, pass 48)

Coverage **59 → 69/141** (72 pending). Mediums:
- **tisk 141** (medium/4): the rival RUD bill raises the municipal share 10,23 → 10,97 % and
  excludes Prague from THREE of eight criteria (55 % of model weight, § 3 odst. 13); the DZ's
  own decomposition puts the real state-revenue cut at **≈ 7,35 mld Kč** (the first draft said
  ~11,3 mld and "two criteria" — both corrected by the audit cycle before anything shipped).
- **tisk 187** (medium/3): a PERMANENT security-forces carve-out (incl. GIBS) from certified
  e-records systems, inside what is otherwise the third deadline postponement since the original
  2024/2025 date.
- **tisk 217** (medium/3): NKÚ audit power over ČT/ČRo's entire holdings, tied to a companion
  constitutional amendment — and the batch's defamation-class catch: the graph listed a FIFTH
  sponsor (pspId 6743) whom the bill's signature page does not carry; three companies' ties were
  drafted against him and removed before persist; the live bill node's sponsors prop is
  corrected (pass 48, `fix-217-sponsors-014.ts`, expectation-guarded).
- **tisk 89** (medium/3): closes one leak in the pension reserve account while opening an
  uncapped sociální-infrastruktura one; its § 3 písm. s) collision with tisk 64 re-confirmed.
- **tisk 25** (medium/4): the e-Legislativa bill PERMANENTLY exempts the state budget bill from
  the system it makes mandatory for everything else (§ 22a), with an easier grandfather trigger
  for government bills (§ 26).
Also: the case's first senate bill (257, honest data-scope note — the graph carries no senator
ties); 234's § 17d near-verbatim duplication vs tisk 56 re-derived („téměř doslovně", not
byte-identical — the hedge survived audit).

## P3 — collision wave and the unified rubric

16 pairs (backlog 28 → **12**): **2 confirmed / 13 coordination-risk / 1 incidental** after the
audit cycle. Confirmed: 64×162 (99/1963 § 141 insertion-vs-append) and 7×260 (37/2021 § 16 —
tisk 260 inserts five písmena and re-letters h)–u), silently retargeting tisk 7's „písm. n)";
the renumbering habit's third carrier after 64 and 65). The 108/2006 § 21 candidates honestly
do NOT close a triangle — tisk 125 rewrites odst. 1 while the confirmed 85×88 edge sits in
odst. 2 písm. e): a „V", not a triangle. **The classification rubric is now ONE sentence applied
corpus-wide** (audit M5): same-§ genuine instructions on both sides ⇒ at least
coordination-risk; incidental only for citation/anchor/own-article artifacts. Six gA pairs and
two batch-013 pairs were reclassified under it (disclosed in each reasoning); 64×74 stays the
model incidental (a pure insertion-anchor artifact). /zakony/kolize renders **125 pairs / 61
confirmed / czechPending 0**.

## The audit cycle — three rounds, and the gate that finally sat in front of the write

Round 1: **NOT READY** (4 blocking + 8 major) — the 141 arithmetic was impossible and its
Prague claim undercounted; 217 carried the non-sponsor; the triage's self-reference rule was
structurally wrong; M8 found the jargon rule absent at render time. Round 2 (closure):
**REOPENED narrowly** — two defects introduced by the fixes themselves (a reclassified pair
whose prose still said „incidental"; the evidence field bypassing the render gate), plus a
Cyrillic homoglyph and an English word. Round 3: **CLOSED**, with the auditor regression-probing
the render-gate fix against every real shape the evidence field takes. Only then did pass 48
run. `lawJargonIssues()` now runs identically at persist (validateLawVerdict) and render
(getLawData withholds and counts), composing the shared public-copy list minus its
sample-scoped rule (documented false positive on „v této skupině pojištěnců").

## The store-restore incident (2026-08-05 00:09)

A concurrent session restored `./.pglite` from the pass-42 backup overnight (most likely a
rescue after store contention — see [[robocopy-of-a-live-pglite-store-can-corrupt]]), silently
wiping law passes 43–47. Detected by this batch's manifestation probe (59 forensic blocks → 27),
diagnosed from store timestamps + pass provenance, and **replayed deterministically in minutes**
from the committed payloads: pass 45 (4 verdicts), pass 46 (5 nodes + 5 edges), pass 47 (28
verdicts). The replay validated the persist gate en route — it REJECTED one stale-text entry
from an outdated combined file until the payload was regenerated from current files. A fresh
backup (`.pglite-backup-20260805-pass48`) now protects the current state, so the next rescue
does not time-travel. **The residue:** the restored copies of the original 27 verdicts carry
pre-sweep prose in some evidence fields — the render gate withholds those 16 strings (disclosed
per block), and sweeping the old 27's graph props is an open item. Non-law passes written after
the backup was taken (money/effort work from 2026-08-04 afternoon) may be similarly lost —
flagged for those cases' owners, not repaired here.

## Not done — disclosed

- 12 collision pairs remain unread.
- The dependency map has no product surface yet (build item).
- The old 27 verdicts' graph props need the jargon sweep the newer batches got.
- 72 bills pending verdicts; §-level sector attribution still deferred.

## Metrics

| | |
|---|---|
| units | 67 census hits triaged + 10 verdicts + 16 pairs + 1 sponsor correction + 1 store recovery |
| verdicts total | 59 → **69** (5 medium / 5 low new; mediums 13 of 69) |
| dependency edges | **18** companion-dependency (new finding class), 23 honest unclears |
| collisions rendered | 108 → **125** pairs (61 confirmed); backlog 12 |
| audit rounds | 3 (NOT READY 4B/8M → REOPENED 2M → CLOSED); the write was gated and it mattered |
| graph writes | pass 48 (10 verdicts + 1 sponsor-prop correction) + replayed 45/46/47 |
| data-quality | 1 false sponsor found and corrected; 1 store restore detected and recovered |

## Files

New: `scripts/case-loops/law/{prepare-batch-014,dependency-census-014,fix-217-sponsors-014}.ts`,
`payloads/{batch-014-targets,batch-014-collision-queue,batch-014-dependency-census,batch-014-dependency-triage,batch-014-verdicts-combined,batch-014-replay-pass45}.json`,
`payloads/verdicts-014/` (10), `payloads/collision-close-reads-batch014-g{A,B}.json`,
`batch-014-audit.md`, this note.
Modified: `lib/analysis/law-verdict.ts` (lawJargonIssues exported, public-copy composed),
`features/lawwatch/getLawData.ts` (render-time jargon withhold incl. evidence),
`features/lawwatch/getCollisionData.ts` (batch-014 wired), `verdicts-011/verdict-64.json`
(pipeline word), `collision-close-reads-batch013-gB.json` (rubric + N1),
`ledger.json`, `graph-log.md` (pass 48 + the restore/replay).
