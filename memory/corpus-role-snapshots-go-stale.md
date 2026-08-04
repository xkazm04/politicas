---
name: corpus-role-snapshots-go-stale
description: "A registry role recorded in a targets/payload file is a point-in-time snapshot — settle any dispute about rank/tense of a role at ARES VR, never by treating the corpus as the ceiling of the fact."
metadata: 
  node_type: memory
  type: project
  originSessionId: 582a7906-7a52-40f3-98cd-38b9bc1eefed
  modified: 2026-08-04T16:11:33.717Z
---

In the law loop's batch-012 audit cycle (2026-08-04), an independent auditor flagged "Vlček je
předseda představenstva SOMPO" as a fabrication because the corpus's only role record
(batch-003-targets.json) said *místopředseda*. Fetching ARES VR settled it the other way: he has
been předseda since 2024-12-03 — the corpus snapshot predated the change. The same day, the
inverse failure: batch-011 published two multi-billion CZK ties in the present tense while the
registry showed the roles ended in 2001 and 2012.

**Why:** payload/targets files freeze registry state at ingest time and carry no as-of date. Both
over-claiming (stale role asserted as current) and over-correcting (current role rejected because
the snapshot is old) are live failure modes, and both hit reader-facing prose about named MPs.

**How to apply:** any claim about the RANK or TENSE of a company role must be resolved against
`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/{ico}` at write time,
cited as `kind:"web"` with the vznik/zánik dates; a `graph_fact` citation may only carry what the
node's props actually hold (tie + CZK aggregate + review state). Related: [[money-stored-review-rank-is-a-stale-cache]],
[[or-shareholder-entry-semantics]].
