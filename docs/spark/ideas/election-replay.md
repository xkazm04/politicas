---
slug: election-replay
type: spark/idea
status: shipped
contexts: [volby (new), kg-analysis, civicscore-leaderboard, mp-profile, lawwatch, money-cases-review, shell-navigation, shared-primitives]
groups: [Voting & Legislation, Financial Transparency, MP Profiles & Rankings, Landing & Navigation, Shared UI Primitives]
sparked: 2026-08-27
designed: 2026-08-27
shipped: 2026-08-27
commit: 87d1964
waves_used: 3
questions_asked: 12
---
## Spark
> "Lets adopt /spark … we will then use it to design and implement flagship page/use case for this app. We gathered through time large amount of tenders, lawmaking data, contracts. One direction can be to replicate communal elections, election to chamber of deputies, and rate parties/members by attaching to them positive/negative findings regarding their activity. We can track backwards choices we now know as controversial, help reconsider checking these subjects before voting again"

## Targeting
Context map: `context-map.json` (48 contexts, 10 groups) — the only partition; no disagreeing source.

**Prior decision this spark sits on:** tender loop R1–R4 (2026-08-24, `docs/data-analysis/case-tender/STATE.md`): new module „Radar zakázek" approved; gap = SYNTHESIS (signals → findings/nálezy); UX north star lookup-first („Kde volíte?" → local radar + findings); use case „whom to distrust at regional/state elections"; NO new data campaigns. The spark widens this from tenders to tenders + laws + contracts + the backward look, and adds parties/MPs as rated subjects.

**Primary (code lands):**
- NEW feature module (`features/volby/` or similar — name settles in wave 1) — the flagship route. No existing context; nearest is `money-budget-routes`/`voting-legislation-routes` as route-shape peers.
- `kg-analysis` — composing findings (nálezy) from persisted signals across money/law/tender.
- `civicscore-leaderboard` + `mp-profile` — where per-MP/party ratings already render; the finding attachment must reconcile with the CivicScore, not compete with it.

**Touched:** `lawwatch` (forensic verdicts, collision feed), `money-cases-review` (gated ties, střety), `shell-navigation` (navModel, sitemap), `shared-primitives` (catalog), tender scripts (`scripts/case-loops/tender`, compose-findings not yet written).

**Excluded (near misses):** `budget-mirror` (132 towns are a geography asset but budgets ≠ accountability findings — may be reused as a town index only); `graph-explorer`; `ingest-external-sources` (R4 forbids new campaigns; `volby.ts` has no importer/table — its use is a wave-1 fork, not a default); `civic-chronicle` (a feed consumer of findings later, not a home).
## Scout digest
(3 Explore scouts, 2026-08-27; full transcripts in the session task outputs — the load-bearing facts only)

**Subjects the data can hold accountable today**
- MPs: 207 PSP10, CivicScore per MP (`features/civicscore/getLeaderboardData.ts:200 LeaderboardEntry`); club (`store.clubByMandate`, `lib/db/store.ts:78`) is kept SEPARATE from elected party list (`MandateRow.partyListPspId`, `lib/db/types.ts:58`) on 207/207 rows — the product has never surfaced the party list. Per-term spine exists: `features/profile/careerSpine.ts:70 CareerTerm{termCode, partyList, region, …}`; PSP9 only as `contribution_psp9`.
- Parties/clubs: `party` nodes carry only `seats, cohesion, fiscal_divergence`; club aggregates exist for votes (`features/votetrack/record/types.ts:86 ClubAggregate`, derive.ts:277) and Kompas already scores clubs (`kompas/score.ts:71`). **No party-level finding aggregate exists anywhere.**
- Authorities (obce, kraje, state bodies): `company:ico:<8>` nodes with `electoral_arena` (komunalni|krajske|statni|nejasne), `tender_authority_category`, `tender_winner_circle` (pass 74, 5 240/5 641 mapped). **No municipality name/kraj/NUTS on authority nodes** — only IČO. Municipal/regional councils have NO political composition anywhere (grep `starosta|zastupitel|council` → budget contracts only).

**Finding-like objects that exist**
- Law: 141/141 bills carry a forensic posudek (`bill.forensic_severity/confidence/…`, pending_review; reader `features/lawwatch/getLawData.ts:578`), Case-① `flagged_conflict + sponsor_money_companies + sponsor_contract_czk`, dated later outcome `fate_sb/fate_published_on`, e-Sbírka existence. 44 non-incidental collision pairs from disk JSON (`getCollisionData.ts`), radar ledger `deriveRadar.ts` (closest analogue to a "finding"). MP attachment only via `sponsors/rapporteur/spoke_on/proposes_amendment` edges.
- Money: 211 `linked_to` ties, ALL `pending_review`, gate never exercised → `/penize/strety` empty by construction (`deriveCollisions.ts:10-33` rule 1). Kauzy = hand-curated disk JSON (`getLeadDossiers.ts`).
- Tenders: 61 421 CPV-45 lots, **4 392 flagged** (single_bid 1 490 · tight_spread 1 059 · short_deadline 1 557 · JŘBU 397 · repeat_winner 111 · supplier_lock 2), `wins.decided_on` ~74 % filled. **Zero rendered consumers** of flags/arena/circle; `compose-findings.ts` (rules N1–N4, batch-012 §3) does not exist; no `finding` node kind (kinds frozen at `lib/analysis/kg-verdict.ts:24`); no tender repository — reads go through `listKgNodes({kind:"tender"})` at `KG_READ_CAP` + in-memory filter (what every tender script does).
- Votes: per-MP positional ballots + `vote_tag` themes (Kompas). `contested_*` props (1 057/2 013 votes contested) computed but deliberately stripped from every loader (`lib/testing/loaders.test.ts:1129`). **No repeal/court/"vindicated" entity exists** — "a choice now known as controversial" must be a NEW composed object; dated later outcomes available: bill fate, e-Sbírka, forensic verdict date, collision `generatedAt`, contract register findings.

**Geography & elections**
- 6 254 obcí as a static TS registry (`features/budget/data/registryData.generated.ts`, `Municipality{ic,name,county,krajIndex,krajName,population}`); obec↔authority join only by IČO equality (misses every příspěvková organizace; the 1 575 `nejasne` need an ownership hop).
- Three kraj vocabularies with no crosswalk: psp.cz organ names (`regionLabel`, `krajSlug`), MONITOR NUTS3 (`KRAJE`), ČSÚ VOLKRAJ 1–14 (`VOLKRAJ_NAME`).
- No term registry: PSP terms are `term_code` strings without dates; komunální 2022-10 / krajské 2024-10 exist only as prose in batch-012 — yet the finding doctrine's second factor is the term window.
- `volby.ts` parses the PS2025 registry (4 475 candidates, 26 lists, 199 elected; 205/207 MPs match) but has no importer, no table, no cached zip; `/atlas` declares landing "none". `mandate.partyListPspId` already gives party-per-MP without it.

**Surfaces & primitives to reuse**
- Route skeleton: `app/hlasovani/page.tsx` → `get*Data.ts` (`server-only`, `getStore`+`storeReady`, `reportLoaderFailure`) → client feature; RSC sections + `DataUnavailable` per `app/poslanec/[id]/page.tsx`; `navModel.ts` NAV entry + `PAGE_SECTIONS`; `navModel.test.ts` fails an undeclared public route; sitemap automatic.
- Existing voter-season surfaces: `/kraj` + `/kraj/[kraj]` (printable slate, `features/civicscore/kraj.ts`), `/kompas` (club alignment), reader lens (`lens.ts`), Souboj duel.
- Catalog: SourceNote(provenance), SectionHeading/Rule, StatTile, FlagList, RankDelta, AnimatedScore, DataUnavailable, LiveDataNotice, PosterFrame; NO shared combobox (TownPicker, KrajPickerPage, NodeSearch are three copies; four fold implementations) — a picker is the moment to extract one.
- Claims: `claim:<dataset>:<metric>[:<subject>]`, `h.` edge refs → `/zdroj/<ref>`; `/overeni` re-derives.
- Strings: next-intl, 27 namespaces, per-feature `messages.test.ts` parity + language-gate; docs: `docs/feature-doc-map.json` entry + `docs/routes/<route>.md` + CLAUDE.md row + `context-map.json` context (block D informational only).
- Landing hero = CivicScore over 207 MPs; says nothing about parties or an election.

**Traps carried forward:** 207 mandates cover 200 seats (dedupe on current holder); club ≠ party list — never re-merge; small LIMIT slower than cap; `kgNeighbours` default 500 drops the cheapest edges of the busiest entity; every route is dynamic.
## Design decisions
**Wave 1 (shape), 2026-08-27**
- Subject → **Ballot-keyed**: komunální/krajské → the authority (obec/kraj/its bodies) carries tender findings; sněmovní → the party list/club carries rolled-up MP findings. REJECTED: party-first roll-up (drops local arenas), MP-first extension of /poslanec (not a flagship).
- Sources v1 → **all four**: tender N1–N4 per authority; law posudky + sponsor-money conflicts per MP→party; contested-vote positions per MP→party (re-expose deliberately); money ties as labelled `nezhodnoceno` counts only (never scoring).
- Backward look → **dated-outcome timeline** from held facts (decision date → later dated fact: bill fate/e-Sbírka, forensic verdict date, collision detection, flag computation). REJECTED: hand-curated kauzy (editorial), defer.
- Representation → **composed at read time by a memoised loader**; rules are the gated artefact. REJECTED: `finding` node kind (kind-freeze + pass discipline before UI), props on subject nodes (findings lose identity).
- Director decisions (convention/doctrine, not asked): no PS2025 registry import (R4; `mandate.partyListPspId` suffices); hand-authored 14-row kraj crosswalk (psp organ name ↔ NUTS3 ↔ VOLKRAJ ↔ kraj IČO); a term-registry constant (komunální 2022-10, krajské 2024-10, PSP10 from 2025-10) — both required by the finding doctrine's term-window factor and absent.
**Wave 2 (functional/UX), 2026-08-27**
- Rating → **severity ledger, no composite**: counts per finding kind × severity + share vs arena/chamber baseline; ranking by disclosed counts. REJECTED: composite index (3/4 sources pending_review), findings-only.
- Party key (sněmovní) → **elected party list** (`partyListPspId`), club shown as „dnes sedí v"; divergence visible. REJECTED: club only.
- Route → **`/volby`** (lookup + national context) + `/volby/obec/[ico]`, `/volby/kraj/[slug]`, `/volby/snemovna/[list]` permalinks; new NAV module; „Radar zakázek" = the tender section inside. REJECTED: single page with query state; two modules.
- Obec join → **IČO equality (obec + kraj via crosswalk), gaps disclosed** („nepropojeno" + count for příspěvkovky/city companies). REJECTED: ownership hop now (b013 data pass, R4).
- Director decisions: shared `Combobox` primitive extracted into the catalog (TownPicker/KrajPicker/NodeSearch are three copies); tender read memoised cross-request like `moneyLoader`; contested-vote positions are a RECORD (positions on the most contested votes), not a valenced finding — direction has no derivable valence; no RSS/JSON feeds in v1.

**Wave 3 (residue), 2026-08-27**
- Positives -> derived from the same rules (P1 cisty radar; became-law-clean; effort badges). REJECTED: negatives only.
- Snemovni unit -> national party list page, lookup kraj's MPs pinned. REJECTED: kraj x list pages.
- Landing -> new section with the lookup entry; hero untouched. REJECTED: hero rewrite; nothing.
- Board on /volby -> arena census tiles + dated timeline of latest findings. REJECTED for v1: party-list ledger board, top-authorities species board (reachable from subject pages).

## Design brief

### Summary
`/volby` („Volby: zrcadlo") is the flagship voter surface: the reader says where they vote (obec picker over 6 254 obcí, or a kraj, or the chamber) and gets the accountable subjects of each ballot — the obec/kraj as zadavatel for komunální/krajské, the elected party lists for sněmovní — each with a **severity ledger of findings (nálezy)** composed at read time from persisted, cited signals (tender flags/circles/arenas; law posudky + sponsor-money conflicts; effort badges; money ties as unrated counts), plus a **dated-outcome timeline** (decision → later dated fact we hold). No composite score, no editorial verdict, no new data campaign: every figure cites its rule and its rows; gaps render as „nepropojeno"/„nezhodnoceno" with counts.

### Wire-level contract (all packages build against this — `lib/analysis/volby/types.ts`, WP1)
```ts
export type Arena = "komunalni" | "krajske" | "statni" | "nejasne";      // = company.electoral_arena
export type Ballot = "komunalni" | "krajske" | "snemovni";
export type FindingKind =
  | "tender_konvejer" | "tender_dvorni_dodavatel" | "tender_rotace" | "tender_kratke_lhuty"   // N1–N4
  | "tender_cisty_radar"                                                                       // P1 positive
  | "law_posudek" | "law_sponsor_conflict" | "law_became_law_clean"                            // MP→list
  | "effort_workhorse" | "effort_rapporteur"                                                   // P2/P3 positive
  | "money_ties_unrated";                                                                      // count only
export type Valence = "negative" | "positive" | "unrated";
export type Severity = "low" | "medium" | "high";
export interface Finding {
  id: string;                    // `${kind}:${subjectId}[:${objectId}]` — stable; React key + anchor
  kind: FindingKind; valence: Valence; severity: Severity;
  subjectId: string;             // "company:ico:<8>" | "list:<partyListPspId>" | "person:<pspId>"
  objectId: string | null;       // e.g. "bill:<tisk>" | winner "company:ico:<8>"
  decidedOn: string | null;      // ISO date of the choice (wins.decided_on / bill sponsorship / vote)
  laterOn: string | null;        // ISO date of the later dated fact (fate_published_on, forensic_provenance date, flags_provenance date)
  laterKind: "fate_sb" | "forensic_verdict" | "collision_detected" | "flags_computed" | null;
  reviewState: "verified" | "pending_review" | "deterministic";   // deterministic = rule over register facts
  figures: Record<string, number>;   // rule inputs, e.g. { share: 0.33, baseline: 0.037, multiple: 8.9 }
  ruleRef: string;               // "volby:N1" … "volby:P3" — /metodika anchor
  evidence: { label: string; ref: string }[];   // ref = h.<edge> | u.<node> | claim:… (features/shared/provenance/claimRef)
}
export interface SeverityLedger {
  counts: Record<Valence, Record<Severity, number>>; total: number;
  baseline: { label: string; share: number; source: string } | null;   // arena baseline (live census) or chamber median
}
export interface TermWindow { ballot: Ballot; from: string; to: string | null; label: string; source: string }
export const TERM_WINDOWS: readonly TermWindow[];   // komunalni 2022-10-01→, krajske 2024-10-12→, snemovni 2025-10-04→ (PSP10)
export interface KrajRow { slug: string; pspLabel: string; nuts: string; volkraj: number; krajIco: string; name: string }
export const KRAJ_CROSSWALK: readonly KrajRow[];    // 14 rows; slug = krajSlug(regionLabel(pspOrganName)) per features/civicscore/kraj.ts
export interface SubjectCard { subjectId: string; ballot: Ballot; label: string; href: string; ledger: SeverityLedger; findings: Finding[]; timeline: Finding[] /* laterOn != null, sorted desc */ }
export interface ListSummary { slug: string; label: string; seats: number; ledger: SeverityLedger; clubsToday: Record<string, number> }
export interface Provenance { pass: number | null; computedAt: string; sources: string[]; counts: Record<string, number> }
export interface ObecData   { obec: { ico: string; name: string; county: string; krajSlug: string; population: number }; komunalni: SubjectCard | null; unlinked: { nejasneNational: number; note: "nepropojeno" }; krajCard: SubjectCard | null; lists: ListSummary[]; provenance: Provenance }
export interface KrajData   { kraj: KrajRow; krajske: SubjectCard | null; lists: ListSummary[]; mps: { pspId: number; name: string; listSlug: string; club: string | null }[]; provenance: Provenance }
export interface RecordRow  { votePspId: number; title: string; votedOn: string; contestedness: number; line: "yes" | "no" | "split"; yes: number; no: number }
export interface ListData   { list: ListSummary; card: SubjectCard; members: { pspId: number; name: string; region: string | null; club: string | null; findings: Finding[] }[]; contested: RecordRow[]; pinnedKraj: string | null; provenance: Provenance }
export interface VolbyHomeData { census: { arena: Arena; authorities: number; lots: number; flaggedShare: number; czkFloor: number }[]; latest: Finding[] /* 20 */; lists: ListSummary[]; provenance: Provenance }
```
List slug = `listSlug(organLabel)` (same fold as `krajSlug`: `ano-2011`, `spolu`); label = organ label of `partyListPspId` verbatim. Routes: `/volby`, `/volby/obec/[ico]` (8-digit; `getMunicipality()` null → 404), `/volby/kraj/[slug]`, `/volby/snemovna/[slug]`; `?kraj=<slug>` on a list page pins that kraj's MPs. Nav key `volby`, brandName „Volby", children `/kraj`, `/kompas`. Messages namespace `volby`, plus `meta.volby*`, `nav.volby`.

### Rules (deterministic; the Director hand-reads top candidates per rule before merge)
- N1 `tender_konvejer`: arena ∈ {komunalni, krajske}; authority flagged-lot share ≥ 3× arena baseline (baseline from the live census, cited); ≥ 1 winner with dependence ≥ 0,9 (wins at this authority / all its wins). Severity: ≥ 3× medium, ≥ 6× high.
- N2 `tender_dvorni_dodavatel`: `tender_winner_circle.circle3_share` ≥ 0,6 ∧ `switch_rate` ≤ 0,2 ∧ `dated_wins` ≥ 10. N3 `tender_rotace`: circle3_share ≥ 0,6 ∧ switch_rate ≥ 0,6. Medium; high when circle3_share ≥ 0,8.
- N4 `tender_kratke_lhuty`: authority `short_deadline` share ≥ 3× arena short_deadline baseline, ≥ 10 lots. Medium.
- P1 `tender_cisty_radar` (positive): ≥ 20 lots in the term window and flagged share ≤ 0,5× arena baseline. Low.
- Term window: `wins.decided_on` (fallback `tender.ended_on`) inside `TERM_WINDOWS[ballot]`; undated lots counted in `figures.undated`, never guessed.
- MP→list: `law_posudek` (bill the MP `sponsors` with `forensic_severity`; severity = forensic_severity; pending_review; laterOn = forensic provenance date); `law_sponsor_conflict` (`flagged_conflict === true`; figures `sponsor_contract_czk`, `sponsor_money_companies`; medium, high if czk ≥ 100 mil.); `law_became_law_clean` (positive: sponsored bill with `fate_sb` ∧ !flagged_conflict; low; laterOn = `fate_published_on`); `effort_workhorse` / `effort_rapporteur` (positive; `LeaderboardEntry.effortWorkhorse` / `effortRapporteurLoad ≥ 3`; low; dated by `effortRecordedAt`); `money_ties_unrated` (count of `linked_to` edges; valence unrated; never in negative/positive counts).
- List ledger = sum over CURRENT mandate holders (207 rows / 200 seats — dedupe on current holder), keyed by `partyListPspId`; `clubsToday` from `clubByMandate("PSP10")`.
- Contested-vote RECORD (not a finding): top 12 contested non-voided PSP10 votes by `1 − |yes−no|/(yes+no)` over `vote_event`, × list line = majority of the list's ballots via `listVoteBallots({ voteIds })` (the indexed read) → `RecordRow[]`.

### Work packages
**WP1 — domain `lib/analysis/volby/`**: `types.ts` (above verbatim), `terms.ts` (`TERM_WINDOWS`), `kraje.ts` (`KRAJ_CROSSWALK`, `krajBySlug/ByPspLabel/ByNuts`), `rules.ts` (pure: `composeAuthorityFindings`, `composeMpFindings`, `rollupLedger`, `outcomeTimeline`, `listSlug`; thresholds exported as named constants), `contested.ts` (`contestedness`, `listLine`). Colocated vitest. No DB imports. Acceptance: tests cover every rule threshold edge, term windowing incl. undated, current-holder dedupe, 14 crosswalk rows with unique slug/NUTS/VOLKRAJ/IČO, slug determinism; every finding carries `ruleRef` + ≥ 1 evidence ref; no display formatting in lib.
**WP2 — loaders `features/volby/`**: `tenderLayer.ts` (ONE memoised read at `KG_READ_CAP`: kind `tender` nodes, `procures` + `wins` edges, authority `company` nodes with `electoral_arena`/`tender_winner_circle`; folded to per-authority stats + live arena census; cross-request memo like `features/money/moneyLoader.ts`, never memoising null/empty; `warnIfTruncated`), `getVolbyHomeData.ts`, `getObecData.ts(ico)`, `getKrajData.ts(slug)`, `getListData.ts(slug, kraj?)` — `server-only`, `getStore()` + `storeReady()`, `reportLoaderFailure()`, language gate on analyst prose. Reuse `buildLeaderboard()` (effort fields, region, club), `listMandates({ termCode: "PSP10" })` for `partyListPspId` + organ labels, `getMunicipality()`, bill nodes read narrowly (props listed above + `sponsors` edges). Acceptance: a loader test per loader against the PGlite fixture (null on dark store; empty layer → named empty state, not null); obec with 0 lots → card with `ledger.total = 0`; `unlinked.nejasneNational` is the NATIONAL nejasne count (no false locality); cold fold time logged and recorded.
**WP3 — UI + routes**: `features/shared/components/Combobox.tsx` (@catalog; ARIA combobox extracted from `features/budget/TownPicker.tsx`; fold via `asciiFold` from `@/lib/ingest/normalize`; props only, no feature imports), `features/volby/VolbyPage.tsx` (lookup: obec Combobox + kraj Combobox + „celá sněmovna"; census StatTiles; latest findings in the FactRow voice), `ObecPage.tsx`, `KrajPage.tsx`, `ListPage.tsx` (RSC sections: ledger tiles → finding rows → timeline in the CareerSpine ribbon idiom → contested matrix (list) → members), `FindingRow.tsx` (kind label, severity chip, valence, `pending_review` label, evidence via ProvenanceCapsule/SourceNote), `app/volby/**` (metadata; `DataUnavailable` on busy store; `notFound()` on unknown ico/slug), `features/shell/navModel.ts` NAV entry + `PAGE_SECTIONS["/volby"]`, `messages/{cs,en}.json`, `features/volby/messages.test.ts` (parity + language gate + „no accusation" assertion), landing `features/landing/components/VolbySection.tsx` between `#k-zebricek` and `ReferendumTeaser` (lookup entry only). Acceptance: every figure cites (SourceNote); lint 0 errors and `require-source-citation` warn count not up; navModel/publicRoutes tests green; copy in the „otázky pro zastupitele / radu" voice; no person names on komunální/krajské cards.
**Director**: `docs/routes/volby.md`, CLAUDE.md route row, `docs/feature-doc-map.json` entry, `context-map.json` context `volby-election-mirror`, `/metodika` section for N1–N4/P1–P3 importing thresholds from `rules.ts`, memory entries, hand-read of rule candidates.

### Data & API
No schema change, migration, node kind, prop key or endpoint. Nothing persists. No feeds in v1.

### UX/UI spec
Konstrukt: `/01 Kde volíte?` → Combobox; `/02 Kdo se vám zodpovídá` → subject cards; `/03 Nálezy` → ledger + rows; `/04 Co víme dnes` → timeline; `/05 Sporná hlasování` (list pages). States: RSC streaming with Suspense fallback around the tender fold; busy store → `DataUnavailable`; unknown obec/list → 404; zero findings → „Bez nálezu v CPV 45 (2024-12 → 2026-07), n zakázek" — never blank. Tokens only; numbers via `lib/format.ts`.

### Strings
`volby.*` (cs source, en mirror), `meta.volby.*`, `nav.volby`; parity + language-gate test.

### Non-goals
Party-first / MP-first shapes; composite index; hand-curated kauzy; `finding` node kind or subject props; PS2025 registry import; ownership hop for `nejasne`; kraj × list pages; landing hero rewrite; feeds; „Radar zakázek" as a separate module.

### Risks
- Thresholds are the gated artefact: hand-read top candidates per rule against the b007 Havířov case; a rule firing on > 15 % of an arena is recalibrated, not shipped.
- Cold tender fold (61 k nodes + ~193 k edges): memoised; measured and recorded in docs/routes/volby.md.
- Obec IČO equality misses příspěvkovky/city companies — disclosed nationally, never localised.
- Coalition list labels (SPOLU) come from psp.cz organ labels verbatim.
## Build record
Go-gate 2026-08-27: operator chose "Build directly in local main/master" (no worktree) — taste signal.

**Work packages & SHAs**
- WP3a Combobox primitive + TownPicker → `d644d73` (bounced once on doc-sync trailers; rule now in overlay Repo law 11).
- WP1 domain rules, 41 tests → `6b9eb9c` (builder deviations accepted: L1–L3/U1 refs, rounded-multiple comparison, per-person dedupe with the seat signal pushed to WP2).
- WP2 loaders, 14 tests → `a1fe4c1` — measured cold fold 3 814 ms / warm ~140 ms; arena registry-correction (1 518 authorities); current-holder signal = open chamber membership (200); Director recalibrated three rules on the first live read (posudek floor `medium`, list `dedupeByObject`, contested turnout floor 100) — fire rates 0,2–1,1 % per arena, Havířov N1+N4 as b007 predicts.
- WP3 UI + routes + strings + nav + landing section → `87d1964`; full vitest 3 237 green; `require-source-citation` 0 → 0.
- Director: `/metodika` §05 (`MetodikaVolbySection.tsx`, flat `metodika.volbyRule_*` keys — the parity test walks flat strings), doc-map globs, CLAUDE.md/README/ROADMAP rows, `context-map.json` context `volby-election-mirror` (49 contexts), 2 memory entries.
- Gate: `npm run check` green on every leg except one doc-map header count (48 → 49), fixed; `npm run build` run before the final commit.
## Retro
- **Targeting accuracy:** the build touched every named primary/touched context and two more — `budget-mirror` (excluded as "geography only", but its obec registry became the join key AND the arena corrector) and `civicscore` for `/metodika` (named as Director work, not as a context). No named context went untouched.
- **Question efficiency:** 12 questions over 3 waves; none changed nothing. The go-gate's own options were wrong — the operator answered „Other: build directly in local main/master"; the worktree default is now second in the overlay's taste. Two Director "convention" decisions were later overturned by data, not by the operator: the volby import question was rightly not asked, but „club vs list" would have been unanswerable without the scout's mandate verdict.
- **Scout misses:** (1) `electoral_arena` is self-declared and wrong for 1 296 obce — the scout read the prop registry, not the prop VALUES against the registry; (2) every bill carries a posudek, so the "law posudek per sponsor" rule was a foreseeable flood; (3) `asciiFold` does not exist in `lib/ingest/normalize` (WP3 fell back to `foldCzech`) — an asserted symbol in a brief that no scout verified.
- **Execution friction:** three commit bounces on the doc-sync `commit-msg` rung (dead globs pre-registered; unknown coupled docs; header count) — all Director, all now in overlay Repo law 11; one lane registration owed by a builder that couldn't own the file; two parallel builders shared `messages/*.json` by design (WP3 owned them, the Director waited) and did not collide.
- **Skill edits proposed (method, not overlay):** (a) Phase-2 liveness rule should gain a fourth half — *a categorical prop "exists" only if its VALUES were sampled against an independent register*; (b) the brief's contract should list asserted helper symbols with a scout-verified `file:line`, or say "builder verifies". Both go to LESSONS.md; no bump (one session).
