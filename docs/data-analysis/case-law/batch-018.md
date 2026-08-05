# Batch 018 — verdict wave 70/261/190/78/133/107/192/61/231/153 · evidence-coordinate migration (pass 52)

Date: 2026-08-05. Driver + 3 Sonnet verdict groups + 1 migration author + fresh Opus
auditor (two rounds, closure conditional on one pre-write edit, applied). Coverage after
this batch: **109/141 bills carry a gated verdict** (4 medium / 6 low this batch; the
corpus-first `high` was demoted to medium at audit — see below). Store writes: pass 52 =
10 verdicts + the 36-field evidence-coordinate migration over 21 bills
(`evidence-coordinates-018`). Backup: `.pglite-backup-20260805-pass52`. Probe EXPECT:
`withF: 109`, passes `…,51,52`. Post-migration store scan: **0 line/cache references
in any reader-facing forensic field** (`batch-018-evidence-scan-post.json`).

## Verdicts — 10 (4 medium / 6 low)

- **107 (medium) — the § 9e collision.** Tisk 107 and sibling tisk 106 (same seven
  sponsors, filed the same day, same proposed committee and rapporteur) each insert a
  NEW § 9e immediately after § 9d of zákona č. 159/1999 Sb. with mutually incompatible
  content — 106 a national-registry definitions section (via a Díl-2 heading, body
  22–24), 107 a municipal-ordinance power (čl. I bod 1). Neither DZ mentions the other.
  The sharpest forensic detail held under independent re-derivation: 107's zvláštní část
  is headed „K § 9o" — the first free number AFTER 106's §§ 9e–9n — betraying a draft
  that assumed 106's numbering, with the collision left unresolved in the final text.
  The verdict also corrects the published verdict-106's range (9e–9m → 9e–9n, measured).
  Filed as `high`, demoted to `medium` at audit against the loop's own ladder (batch-017's
  five-pair collision is medium; this is one § claimed twice, remediable by one amendment,
  with no beneficiary).
- **70 (medium).** A 7 879 000 000 Kč transfer out of VZP ČR to six named employee
  insurers, textually pinned to March 2026 — a month that ended more than eight weeks
  before the law took effect (27. 5. 2026), with no transitional rule. The audit's
  hardest finding of the batch: the first cut declared „no tie to VZP" while
  spolupředkladatel Jiří Mašek chairs the garanční Výbor pro zdravotnictví AND sits on
  VZP's dozorčí rada (od 28. 1. 2026, the project's own effort record) — the M9b
  asymmetric-disclosure class recurring. The shipped verdict scopes the money clearance
  precisely and states the institutional-role concurrence in full.
- **231 (medium).** ČT/ČRo financing switched to a mandatory state-budget contribution
  (~7,81 mld. Kč/rok, inflation-valorized). Its DZ names the government's twin
  commitment — fee abolition PLUS NKÚ oversight — in one breath, yet the bill never
  references the 47/217 NKÚ pair and trails their 1. 7. 2026 date by six months. The
  „zákonná garance" of the amount is novelizable by simple majority — the structural
  limit the DZ does not discuss.
- **261 (medium).** Concurrent-majority (dual-track) voting in national-park councils
  plus a two-year window to force re-approval of already-settled park documents — under
  a rule the DZ itself admits the old documents never had to satisfy, while calling
  re-approval „naprosto hladké a bezproblémové".
- **Lows**: 78 (Babiš flag day — the fast-track's own premise defeated by the Senate
  return; no collision with tisk 238, determined from the cache), 133 (fuel-excise cut;
  the government's nesouhlas mooted the 2022-precedent fast-track argument), 190
  (ballot reversion + QR codes; the tisk-12-bod-15 annex overlap documented precisely),
  192 (web archiving criteria delegated to the National Library's own collection
  policy — the DZ says so openly), 153 (the DZ's own RIA admits competitive advantages),
  61 (ESLP Spišák implementation, tightly scoped).

## The audit cycle

Round 1: **5 BLOCKING / 20 MAJOR / 20 MINOR** — a fabricated quotation at the heart of
the high verdict (the „identical formula" claim; the collision itself survived
re-derivation), a fabricated cross-reference inverting the published 47↔217 record, the
falsified VZP clearance (B3 above), an absence claim refuted by a grep of the section it
named (192), and a migration row whose new coordinate pointed at the wrong article OF THE
WRONG ACT (tisk 83: Čl. II/silniční doprava vs the true ČÁST PÁTÁ / Čl. V / 13/1997 Sb.)
— sweep-introduced, while the legacy line reference had resolved correctly. All
remediated driver-side; round 2 closed conditional on one procedural-verb fix (applied).

**M19 — guards that check truth, not shape.** The migration applier was rebuilt at
closure: digit MULTISET accounting (a Set passed permutations and duplicate deletions),
a digit-ADDITION ban outside psp.cz-URL/coordinate/quoted-heading context (amount
inflation and §-renumbering now throw), depth-tracked quotation spans (nested guillemets
protected), and — the check whose absence let B5 through — **coordinate truth**: every
introduced Čl./ČÁST token must exist in the NFC cached print, and a new „Čl. X bod N …
§ M" must find bod N and § M inside Čl. X's own span. Getting the guards green surfaced
four legitimate Czech citation shapes (law-ref digits, print numbers, list syntax,
quoted numbered headings) now encoded in the context rules.

## Artifacts

- `payloads/verdicts-018/…` + `batch-018-verdicts-combined.json` (10 verdicts).
- `payloads/batch-018-evidence-{scan,sweep,scan-post}.json` — 36 rewrites over 21 bills;
  the scan's „řádk" stem was widened mid-batch (singular „řádek"/locative „řádcích"
  missed 2 rows, recovered with driver-verified coordinates); the post-scan proves the
  class empty on the live store. The tisk-112 PDF-filename citation (cs + `_en` mirror)
  joined the payload; the `_en` field is exempted from the Czech gate by field-name rule.
- `scripts/case-loops/law/evidence-coordinate-{scan,apply}-018.ts` — the scanner and the
  guarded applier (the M19 guard set).
- `batch-018-targets.json`, `prepare-batch-018.ts`, `batch-018-audit.md` (the two-round
  record), ledger `batch018Verdicts`.

## Carried forward

- **M20**: 141/141 bill summaries cite a local cache path in `summary_source`, rendered
  at BillDetail — outside this batch's declared scan scope (non-forensic field); first
  item of the next evidence batch.
- 32 bills still without a verdict.
- Tisk 171's „cca 39 000 řádků" relative-length sentence (the documented tisk-64
  exception class) stays — it measures the transcript and says so.
- The published verdict-106 carries the 9e–9m range that verdict-107's measurement
  corrects (9e–9n) — a one-field correction candidate for a future pass over
  verdicts-016 on-store.
- The sector-attribution surface on /zakony (build phase) — unchanged from batch-017.
