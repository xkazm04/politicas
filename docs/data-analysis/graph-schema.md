# Graph schema — the evolving node/edge-type catalogue

The living catalogue of what the derived graph (`kg_node` / `kg_edge`, see
`lib/db/types.ts`) is allowed to contain. Starts from design §3 and **grows as new
relationship kinds are discovered** — when a pass introduces an edge type, add it
here with its provenance method and how it's grounded. The machine-enforced
version is the enum set in `lib/analysis/kg-verdict.ts` (`KG_NODE_KINDS`,
`KG_EDGE_RELS`); keep the two in sync.

Every node/edge carries `provenance = {pass, method, ref, computedAt}`. Two methods:
- **`deterministic`** — computed in SQL/code from raw rows (`lib/analysis/kg.ts` via
  `npm run da:kg-compute`). Recomputable and exact; the LLM never authors these.
- **`verdict`** — proposed by a gated Sonnet subagent, persisted only after passing
  the schema + entity-id membership gate (`da:validate-kg-verdict`, then
  `da:kg-promote`). Cites the verdict it came from.

## Node kinds

| kind | id scheme | populated | props | how derived |
|---|---|---|---|---|
| `person` | `psp:person:<pspId>` | ✅ pass 1 (207) | `rebellion_rate`, `committee_count` | raw entity + deterministic props |
| `party` | `psp:organ:<pspId>` (a Klub organ) | ✅ pass 1 (8) | `cohesion`, `cohesion_votes`, `seats` | raw entity + deterministic cohesion |
| `organ` | `psp:organ:<pspId>` (a výbor/komise) | ✅ pass 1 (33) | `member_count`, `organ_type` | raw entity |
| `bloc` | `bloc:<slug>` | ✅ pass 2 (2) | `overall_win_rate`, `control_timeline` | verdict + deterministic enrichment |
| `theme` | `theme:<slug>` | ✅ pass 3 (13) | `opposed_fraction`, `classification`, `bloc_support` | verdict + deterministic enrichment |
| `company` | `company:ico:<ico>` | ⏳ **built, data-blocked (F6)** | ico, name | `kg-money.ts` (ARES); awaits data |
| `contract` | `contract:<id>` | ⏳ **built, data-blocked (F6)** | amount, signedOn, supplierIco | `kg-money.ts` (Registr smluv); awaits data |

## Edge relations

| rel | shape | populated | weight | how derived |
|---|---|---|---|---|
| `co_votes_with` | person ↔ person (undirected, `src<dst`) | ✅ pass 1 (20 496) | agreement rate over shared positional votes | deterministic; `minShared=50` |
| `rebels_against` | person → party | ✅ pass 1 (203) | rebellion rate vs club majority line | deterministic; `minEligible=50`, voided excluded |
| `influential_in` | person → organ | ✅ pass 1 (605) | committee role rank (chair 1 / vice 0.6 / member 0.3) | deterministic (degree + role) |
| `belongs_to` | party → bloc | ✅ pass 2 (8) | mean intra-bloc agreement | verdict |
| `about` | vote → theme | ✅ pass 3 (47) | roll-call count on the subject | verdict |
| `owns` | organ (committee) → theme | ✅ pass 8 (27) | — | verdict (committee remit → theme) |
| `linked_to` | person → company | ⏳ **built, data-blocked (F6)** | — | join (`lib/analysis/kg-money.ts`) + **human gate** (verified/pending-review) |
| `supplies` | company → contract | ⏳ **built, data-blocked (F6)** | contract amount | join (`kg-money.ts`) over Registr smluv IČO |

## Bases & caveats (shared with the deterministic layer)

- **Positional basis** = `{yes, no}` (`POSITIONAL_CHOICES`). abstain / not-voting /
  merged K bucket / absence are non-participation — never agreement or rebellion.
- **Voided (zmatečné) votes** (16 in PSP10) are excluded from every discipline metric.
- **Blocs are *named* by the LLM but *defined* by the computation** — the co-voting
  matrix is ground truth; the gate rejects a bloc member who isn't a real person id.
