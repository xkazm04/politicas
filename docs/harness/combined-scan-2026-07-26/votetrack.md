# VoteTrack — Combined Bug-Hunt + UI-Perfectionist Scan
> Total: 5

## 1. Excused-vote segment is invisible in the chamber-split bar
- **Lens**: UI
- **Severity**: High
- **Category**: color-contrast / silent-visual-failure
- **File**: features/votetrack/components/ChamberDetail.tsx:105-109
- **Scenario**: Open any roll call detail and look at a party row's per-party split bar (the "Rozpad po stranách" strip). For a party with excused ("omluven") members, that portion of the bar renders but is completely indistinguishable from empty track.
- **Root cause**: The bar's track container is `bg-hairline` (line 105), and the "omluven" segment is styled with the exact same class, `bg-hairline` (line 108). `--color-hairline` (#d7d3c8, `app/globals.css:24`) is being reused both as the neutral "unfilled track" chrome color and as the semantic color for the excused vote-status, so the segment paints itself over an identical background — 0% effective contrast. The 4-way legend above (`SPLIT_META`, line 24, `cls: "bg-hairline"`) has the same collision.
- **Impact**: For a civic-transparency product whose entire premise is showing exactly how each MP/party behaved, "excused" attendance — a datapoint directly tied to the Docházka (attendance) pillar — is silently unrenderable. A viewer sees a shorter colored bar and cannot tell whether the remainder is "excused" or simply an artifact of scaling; a party that excuses many members from an inconvenient vote looks better than one that shows up and abstains, since only the latter's `zdrzel` (ochre) segment is visible.
- **Fix sketch**: Introduce a dedicated `--color-excused` token distinct from the structural `hairline` grid/chrome color (e.g. a muted mid-gray with real contrast against both `bg-hairline` tracks and `bg-paper`), and use it consistently for `omluven` across `ChamberDetail.tsx` (bar + legend) and `VoteHemicycle.tsx`'s `fill-hairline` (line 22), which has the same low-contrast problem against `bg-paper`.

## 2. Hemicycle seat coloring silently misaligns if WEDGE_ORDER drifts from PARTIES
- **Lens**: Bug
- **Severity**: High
- **Category**: data-integrity / silent-failure
- **File**: features/votetrack/VoteHemicycle.tsx:17, 58-67
- **Scenario**: A future roll call adds an 8th parliamentary club, or `PARTIES` in `lib/civic/data.ts` is reordered/extended without updating the separate, hand-maintained `WEDGE_ORDER` array in this file. The build compiles fine; nothing throws.
- **Root cause**: `votes` (the flat per-seat color array fed to the 200 fixed `SEATS` positions) is built by iterating `WEDGE_ORDER`, a literal list of 7 party codes maintained independently of `PARTIES`/`byParty`. `WEDGE_ORDER` and `PARTIES` currently happen to contain the same 7 codes, but nothing enforces that invariant. If a party in `byParty` is missing from `WEDGE_ORDER`, its votes are silently dropped from `votes`, shortening the array; every subsequent `SEATS[i]` then reads `votes[i]` from the wrong party's block, so the diagram renders a plausible-looking but factually wrong hemicycle for potentially every seat after the gap — with no error, no warning, no visual cue that anything is off.
- **Impact**: Silent misrepresentation of how the chamber voted, in the module's flagship visualization, with no signal to catch it besides manually eyeballing seat counts against known results.
- **Fix sketch**: Derive `WEDGE_ORDER` from `PARTIES` (e.g. `PARTIES.map(p => p.code)` in the desired seating order, or add an explicit `wedgeOrder` field to `PartyMeta`) so there is one source of truth, and add a dev-time assertion that `votes.length === SEATS.length` before render.

## 3. Party "line" and "discipline" report false 100% loyalty when no one voted
- **Lens**: Bug
- **Severity**: Medium
- **Category**: edge-case / misleading-metric
- **File**: features/votetrack/components/ChamberDetail.tsx:97-98, 111-116; features/votetrack/components/DisciplineBoard.tsx:16, 37, 87 (logic in lib/civic/votes.ts:11, 17-21)
- **Scenario**: A roll call where a party's members are entirely `omluven`/absent for that vote (`pro: 0, proti: 0`, i.e. present via `pro+proti+zdrzel` computed only from those three, none present) — not exercised by today's mock rows but a realistic future data point (small clubs are occasionally wiped out by illness/travel on a single vote).
- **Root cause**: `partyLine` (`pv.pro >= pv.proti ? "pro" : "proti"`) resolves the 0-vs-0 tie to `"pro"`, and `partyDiscipline` explicitly special-cases `present === 0` to return `1` (100%). Both `ChamberDetail`'s per-party row (▲ arrow + `f.int(disc)) %`) and `DisciplineBoard`'s ranking/matrix consume these functions directly and render the party as if it voted unanimously "for" with perfect discipline, when in fact it cast zero votes.
- **Impact**: A party that abstains-by-absence from an inconvenient vote is displayed identically to one that unanimously and enthusiastically voted for it — the opposite of what a transparency tool should surface, and it would also quietly inflate that party's `avg` discipline score in the leaderboard.
- **Fix sketch**: Have `partyLine`/`partyDiscipline` return a distinguishable "no data" state (e.g. `null`) when `present === 0`, and render an explicit "—" / neutral marker in both `ChamberDetail` and `DisciplineBoard` instead of a colored arrow and a fabricated percentage.

## 4. Theme filter silently truncates results at 80 with no disclosure
- **Lens**: UI
- **Severity**: Medium
- **Category**: missing-affordance / data-loss-in-UI
- **File**: features/votetrack/components/VoteThemeFilter.tsx:54
- **Scenario**: `getVoteThemes()` can materialize up to 100,000 tags (`getVoteThemes.ts:21,25`); once the Silver-layer classifier has tagged more than 80 votes overall, or more than 80 within a single theme, selecting "Vše" (all) or any populous theme chip shows only the first 80 (by recency) with zero indication that anything was cut off.
- **Root cause**: `shown.slice(0, 80)` is a hard client-side cap applied after filtering, but the chip label right above it (`{t("themeAll")} · {data.total}` / `{themeLabel(th.slug)} · {th.count}`) still shows the true, un-truncated count — so the UI asserts "312 hlasování" in the chip while listing 80 rows underneath, with no "showing 80 of 312" note, no pagination, and no "load more".
- **Impact**: As the classifier backlog grows (which is the explicit intended trajectory per the file's own comments), this section will increasingly look broken — the displayed count and the visible list will diverge — undermining the "every number cites its source" trust premise of the rest of the page.
- **Fix sketch**: Either paginate/virtualize the list, or make the cap honest: show a `t("themeTruncated", { shown, total })` note (mirroring the existing `SourceNote` pattern used elsewhere in this component) whenever `shown.length > 80`.

## 5. Sample-size footnote cites a hardcoded, unsourced total
- **Lens**: Bug
- **Severity**: Medium
- **Category**: data-integrity / success-theater
- **File**: features/votetrack/components/VoteLedger.tsx:86
- **Scenario**: The ledger's footer reads "vzorek N z 5214 …" (sample N of 5214 real votes) via `t("sampleFootnote", { sample: ROLL_CALLS.length, total: f.int(5214) })`.
- **Root cause**: `5214` is a bare numeric literal typed directly into this component — it is not read from `ROLL_CALLS`, not derived from any store query, and not shared with the one place in this same feature (`getVoteThemes.ts:25`, `store.listVoteEvents({ termCode: "PSP10" })`) that actually knows the real vote-event count for this term. It exists only here and duplicated in a doc-comment example in `lib/i18n/useFormat.ts:6`.
- **Impact**: The module's own header comment states "each number cites psp.cz" — but this specific number cites nothing; it was hand-typed at some point and will silently go stale as the real PSP10 term accumulates more roll calls, quietly turning an accuracy claim into a guess that nobody will remember to update.
- **Fix sketch**: Source the total from the real store the same way `getVoteThemes` does (a lightweight `store.countVoteEvents({ termCode: "PSP10" })`-style call passed down as a prop, with a static fallback only when the store is unavailable), or at minimum hoist `5214` to a named, dated constant with a comment stating where/when it was last verified against psp.cz.
