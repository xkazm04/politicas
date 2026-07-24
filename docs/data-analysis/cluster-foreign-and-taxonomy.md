# Cluster: theme-taxonomy extension — foreign affairs (F23)

Pass 9, 2026-07-23. F23 asked whether the 4 committee domains F12 left themeless
(defence / foreign / education / security) warrant new themes. Answer, grounded in the
actual votes: **one does, three do not.** Gated verdict `.kg-analysis/verdicts/F23.json`,
promoted pass 9. See [[graph-schema]], [[cluster-committees-and-money]], [[patterns]] P21–P22.

## What the data showed (the honest check)

Themes are *vote-derived*, so the test is: are there real floor votes on these domains?
Scanned all 179 distinct subjects (including the 132 long-tail ones F2 never themed):

| domain (committee) | legislative votes found | verdict |
|---|---|---|
| **foreign affairs** (ZAV) | **13** (8 treaty/Ukraine subjects) | **theme added** |
| defence (VO) | folded in (Ukraine measures, 2) | covered by the foreign-affairs theme |
| security (VB) | folded in (police-cooperation treaties, 2) | covered by the foreign-affairs theme |
| **education** (VVVMS) | **0** | **no theme — structural gap, not a defect** |

## Added — `theme:foreign-affairs-treaties` (13 votes, 8 subjects)

International-treaty ratifications, all long-tail: ČR–SR health-rescue (3), ČR–Kenya (2),
ČR–SRN border (2), ČR–Tanzania (1), ČR–SR & ČR–Mongolia police cooperation (1+1), ČR–Malta (1),
plus the Ukraine armed-conflict measures (2). **8 `about` edges** (vote → theme) + **3 `owns`
edges** (ZAV primary, VO for the Ukraine bill, VB for the police treaties) — resolving three of
the four committee gaps with real votes. (It has no contestedness props yet — F18 recomputes
those when it re-scores bloc×theme over the extended coverage.)

## Declined — education (and the discipline it demonstrates)

Across all 179 subjects there is **no education-legislation subject** (the one "education"
match was a sports-agency board election — an appointment). Adding a `theme:education` would
create an **empty, ungrounded node**. The loop declines: **themes are grounded in real votes,
never invented to complete a table.** The VVVMS gap is a true fact about this term's agenda
(education did not reach the floor), which is itself the honest finding.

## Note

F23 themed the *foreign-affairs* subset of the long tail. The rest of the 132 long-tail
subjects (F13) map to *existing* themes (social-health, fiscal, justice, environment,
procedure) — no further new taxonomy is needed, only coverage extension.
