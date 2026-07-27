---
name: or-shareholder-entry-semantics
description: In the Czech OR an a.s. shareholder is recorded ONLY when there is a single one — and shareholder entry dates are registration dates, never acquisition dates.
metadata:
  type: reference
---

Two reading rules for ARES VR / obchodní rejstřík shareholder records that are
easy to get wrong in opposite directions. Both were established by an Opus
verification pass in money batch 010 against ARES VR, or.justice.cz's úplný
výpis, and notarial deeds in the sbírka listin.

**1. An `AKCIONAR` entry means SOLE shareholder.** Per **§ 48 odst. 1 písm. k)
zák. č. 304/2013 Sb.**, a shareholder is entered in the register for an `a.s.`
*only where the company has a single shareholder*; a multi-shareholder a.s. has
no shareholder recorded at all. So reading such an entry as "was a shareholder"
**under**-claims — the register says sole shareholder, 100 % of shares and
votes. (§ 12 ZOK is *not* the registration duty — it governs who exercises
general-meeting powers in a single-member company.)

**2. Shareholder entry dates are registration dates, not legal-effect dates.**
Shareholder members carry an **empty `clenstvi: {}`**, unlike board members,
which carry real `vznikClenstvi`/`zanikClenstvi` and `vznikFunkce`/`zanikFunkce`.
So `datumZapisu`/`datumVymazu` establish only when the register was changed —
**the acquisition date is not established by the register** and must never be
stated as if it were. Group-level and member-level dates agreed in the case
examined, but check both.

Corollary that bit us: a stored role like `2000-07-01 → 2014-01-22` can silently
mix a registry date with a legal date. Record which kind each date is.

**Why:** these decide whether a public claim about a named person is accurate,
over-strong, or needlessly weak — the exact failure class the money loop's
verification trigger exists for.

**How to apply:** when annotating any `linked_to` tie from a VR record, state
the date semantics on the annotation itself, and prefer "zapsán jako jediný
akcionář od X do Y" over any phrasing implying acquisition. Related:
[[ico-node-id-canonical-form]], [[registr-smluv-token-free-access]].
