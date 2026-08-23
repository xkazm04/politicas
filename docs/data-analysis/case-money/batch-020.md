# Money batch 020 — setting the table for the human gate

Case ① FollowTheMoney · 2026-08-23 · **pass 66**.

> STATE's item 0 is a human-gate session — yours, not the loop's. This batch made sure it
> starts on the right screen, and put document-source evidence behind the two companies
> that are 16,2 of the 16,8 mld. CZK still unverified.

## 1. The „rozpor" lane

The 18 role × register contradictions (batch 019) were flagged on cards scattered across the
review tiers. `/penize/kontrola` now has a sixth sticky-filter lane, **„rozpor role ×
rejstřík"**, driven by the same `roleRegisterContradiction()` the badge uses — one import,
not a second copy — so the first sitting opens on exactly those 18 ties. Reviewer setup is
already documented in `.env.example` (`REVIEWER_TOKEN` + `REVIEWER_NAME`, both required).

## 2. Document sources for the two that matter

The OR cannot name a multi-shareholder a.s.'s owners (batch 018). The companies themselves
do:

- **Pražská energetika, a.s.** — „Struktura akcionářů k 31. 12. 2025", published on the
  company's „Pro akcionáře" page as a chart: **Pražská energetika Holding a.s. 58,05 %,
  EnBW Central and Eastern Europe Holding GmbH 41,40 %, ostatní osoby 0,55 %.** Read from
  the image itself; cited with the URL of the chart and the access date. The Holding's own
  ownership (hl. m. Praha / EnBW) is NOT established by this — the note says so.
- **ČSOB Pojišťovna, a. s.** — the „Kdo jsme" page names its *hlavní akcionář*, **KBC
  Verzekeringen NV (skupina KBC)**, with no percentage. Quoted verbatim, cited.

Both land as **`ownership_disclosed`** on the company node (pass 66) with `_citations` and
`_provenance` — a layer ON TOP of the register verdict, which stays `ownership-not-published`
because that is what the register says. Doctrine held: **no `owns_stake` edge** was minted
from a web page; a company's self-disclosure is cited enrichment, not a graph fact. The
console card prints „doloženo firmou k 2025-12-31: … — zdroj" in place of „k doložení mimo
rejstřík". `ownershipDisclosed` travels over the wire as public.

Both companies are `manager` ties (Marek Ženíšek, Karel Haas); both disclosures name private
owners, so the money stays attributable — the disclosure confirms the conservative reading
rather than changing it. The remaining 7 unpublished attributable companies (VaK Vsetín,
VaK Vyškov, RERA, SOMPO, Horní Labe, PEVAK, Nárožní dům) hold 0,56 mld. together.

## 3. Gate

`npm run check` green (see ledger); `props-check` clean after registering
`ownership_disclosed*`; headline unchanged.

## 4. Lesson

A document source read by a machine is still a document source: the chart was an image,
the claim is what the image shows, and the citation points at the image. What the loop
must NOT do is turn that into an edge — the register axis and the disclosure axis stay two
things the reader can see apart.
