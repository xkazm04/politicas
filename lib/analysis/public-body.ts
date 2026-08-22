/**
 * Is a company's money its OWN public mandate, or could it reach a politician?
 *
 * This is the money case's attribution rule in code. A `steward` tie — an MP sitting on
 * the board of a public body — must never have that body's contract volume attributed to
 * them (the VaK Kroměříž ~602M rule). Money batch 009 got this wrong in the other
 * direction: its public-body test keyed on the entity's NAME, so it caught every
 * "Ministerstvo …" / "… kraj" / "Město …" and missed **Zdravotnický holding
 * Královéhradeckého kraje a.s.** — a kraj-owned company under an ordinary private legal
 * form, which was also the single largest CZK figure that batch produced.
 *
 * The fix is ownership-based, in two layers:
 *   1. the entity's OWN legal form (`pravniForma`) — a ministry, kraj or obec is a public
 *      body outright; and
 *   2. failing that, its CURRENT shareholders/members from the ARES VR record — a company
 *      whose shareholder is a kraj is publicly owned however private its own form looks.
 *
 * **Unknown legal-form codes never fall through to "private".** An unrecognised code
 * yields `unknown`, because the expensive error here is calling a public body private and
 * hanging its budget on an MP. `unknownCodes` is returned so callers can log and extend
 * the table rather than silently mis-classify.
 */

/** A legal form that makes an entity a public body in its own right. */
export interface LegalFormInfo {
  label: string;
  /** How this entry was established — every code here was checked against a real subject. */
  verifiedVia: string;
}

/**
 * Public-law legal forms. Deliberately an ALLOWLIST of codes that were each verified
 * against a named real subject via the ARES basic endpoint on 2026-07-27 (money batch
 * 010), or read from ARES's own `PravniForma` číselník. ARES's číselník endpoint returns
 * only a fragment of the full table, so this is not machine-complete by construction —
 * hence the loud `unknown` path rather than a closed-world assumption.
 */
export const PUBLIC_LEGAL_FORMS: Record<string, LegalFormInfo> = {
  "301": { label: "Státní podnik", verifiedVia: "číselník 2026-08-22; 42196451 Lesy České republiky, s.p.; 70890005 Povodí Labe, státní podnik — RECLASSIFIED batch 016" },
  "325": { label: "Organizační složka státu", verifiedVia: "00006947 Ministerstvo financí; 75112779 Ústav pro studium totalitních režimů" },
  "331": { label: "Příspěvková organizace", verifiedVia: "ARES PravniForma číselník (label corrected 2026-08-22)" },
  "332": { label: "Státní příspěvková organizace", verifiedVia: "ARES PravniForma číselník" },
  "333": { label: "Státní příspěvková organizace ostatní", verifiedVia: "ARES PravniForma číselník — EXPIRED 2016-12-31, kept for historical records" },
  "352": { label: "Státní organizace Správa železnic", verifiedVia: "ARES PravniForma číselník (label corrected 2026-08-22 — was 'Státní fond', which is 382)" },
  "361": { label: "Veřejnoprávní instituce (ČT,ČRo,ČTK)", verifiedVia: "00027383 ČESKÁ TELEVIZE" },
  "362": { label: "Česká tisková kancelář", verifiedVia: "ARES PravniForma číselník" },
  "382": { label: "Státní fond ze zákona nezapisující se do obchodního rejstříku", verifiedVia: "ARES PravniForma číselník" },
  "391": { label: "Zdravotní pojišťovna", verifiedVia: "ARES PravniForma číselník (391/392 were SWAPPED before 2026-08-22; both public, so no verdict changed)" },
  "392": { label: "Všeobecná zdravotní pojišťovna", verifiedVia: "41197518 VŠEOBECNÁ ZDRAVOTNÍ POJIŠŤOVNA ČR" },
  "525": { label: "Vnitřní organizační jednotka organizační složky státu", verifiedVia: "ARES PravniForma číselník" },
  "601": { label: "Vysoká škola (veřejná, státní)", verifiedVia: "00216208 Univerzita Karlova" },
  "771": { label: "Dobrovolný svazek obcí", verifiedVia: "ARES PravniForma číselník 2026-08-22 — RECLASSIFIED batch 016: this table said 771 was 'Nadace' and filed it PRIVATE" },
  "801": { label: "Obec nebo městská část hlavního města Prahy", verifiedVia: "00254843 Město Ostrov; 00274046 Statutární město Pardubice; 00075370 Statutární město Plzeň" },
  "804": { label: "Kraj a hl.m.Praha", verifiedVia: "70889546 Královéhradecký kraj; 00064581 HLAVNÍ MĚSTO PRAHA" },
  "805": { label: "Regionální rada regionu soudržnosti", verifiedVia: "ARES PravniForma číselník — EXPIRED 2021-12-31, kept for historical records" },
  "811": { label: "Městská část, městský obvod", verifiedVia: "ARES PravniForma číselník" },
  "941": { label: "Evropské seskupení pro územní spolupráci", verifiedVia: "ARES PravniForma číselník 2026-08-22 — RECLASSIFIED batch 016: this table said 941 was 'Společenství vlastníků jednotek' and filed it PRIVATE" },
};

/**
 * Ordinary business forms — known NOT to be public bodies in their own right. Listing
 * these explicitly (rather than treating "not in PUBLIC_LEGAL_FORMS" as private) is what
 * makes the `unknown` verdict possible.
 *
 * DELIBERATELY ABSENT (money batch 016), so they answer `unknown` and reach a human:
 *   741 "Stavovská organizace - profesní komora" — a professional chamber exercises
 *       delegated public authority but lives on members' dues. Genuinely arguable, and
 *       this table may not assert either way. (It previously sat here labelled
 *       "Obecně prospěšná společnost", which is not what 741 is.)
 */
export const PRIVATE_LEGAL_FORMS: Record<string, LegalFormInfo> = {
  "100": { label: "Podnikající fyzická osoba tuzemská", verifiedVia: "ARES PravniForma číselník" },
  "101": { label: "Fyzická osoba podnikající dle živnostenského zákona", verifiedVia: "ARES PravniForma číselník (label corrected 2026-08-22)" },
  "112": { label: "Společnost s ručením omezeným", verifiedVia: "ARES PravniForma číselník" },
  "113": { label: "Společnost komanditní", verifiedVia: "ARES PravniForma číselník" },
  "121": { label: "Akciová společnost", verifiedVia: "ARES PravniForma číselník" },
  "205": { label: "Družstvo", verifiedVia: "ARES PravniForma číselník" },
  "421": { label: "Odštěpný závod zahraniční právnické osoby", verifiedVia: "ARES PravniForma číselník" },
  "701": { label: "Sdružení (svaz, spolek, společnost, klub aj.)", verifiedVia: "ARES PravniForma číselník — EXPIRED 2013-12-31, superseded by 706" },
  "705": { label: "Podnik nebo hospodářské zařízení sdružení", verifiedVia: "ARES PravniForma číselník (label corrected 2026-08-22)" },
  "706": { label: "Spolek", verifiedVia: "ARES PravniForma číselník (label corrected 2026-08-22 — was 'Pobočný spolek', which is 736)" },
  "716": { label: "Odborová organizace", verifiedVia: "NOT in the current ARES číselník (checked 2026-08-22) — retained for historical records, unverifiable" },
  "721": { label: "Církve a náboženské společnosti", verifiedVia: "ARES PravniForma číselník (label corrected 2026-08-22)" },
  "731": { label: "Organizační jednotka sdružení", verifiedVia: "ARES PravniForma číselník — EXPIRED 2017-12-31" },
  "736": { label: "Pobočný spolek", verifiedVia: "ARES PravniForma číselník (label corrected 2026-08-22 — was 'Dobrovolný svazek obcí', which is 771 and is PUBLIC)" },
  "751": { label: "Zájmové sdružení právnických osob", verifiedVia: "ARES PravniForma číselník" },
  "761": { label: "Honební společenstvo", verifiedVia: "ARES PravniForma číselník" },
  "773": { label: "Nadační fond", verifiedVia: "NOT in the current ARES číselník (checked 2026-08-22) — retained for historical records, unverifiable" },
};

/** true = public body, false = ordinary business form, null = code not in either table. */
export function isPublicLegalForm(code: string | null | undefined): boolean | null {
  if (!code) return null;
  const c = String(code).trim();
  if (c in PUBLIC_LEGAL_FORMS) return true;
  if (c in PRIVATE_LEGAL_FORMS) return false;
  return null;
}

/** One shareholder / member as read from an ARES VR record. */
export interface Shareholder {
  ico: string | null;
  name: string;
  legalForm: string | null;
  /** false once `datumVymazu` has passed — historical holders must not decide the verdict. */
  current: boolean;
}

export interface PublicMandateInput {
  ico: string;
  name: string;
  legalForm: string | null;
  /** Current + historical shareholders; pass an empty array when VR carried none. */
  shareholders: Shareholder[];
  /** Whether a VR record was actually retrieved. Absence of data is not evidence. */
  vrRetrieved: boolean;
  /**
   * How many CURRENT owner entries the VR record carried, natural persons INCLUDED
   * (`ownershipRecord().entriesCurrent`). Zero means the register names nobody today,
   * which is not the same as naming only private owners — see `ownership-not-published`.
   *
   * Optional: a caller that does not supply it keeps the pre-batch-015 behaviour rather
   * than having its verdicts silently change underneath it.
   */
  ownersRecorded?: number;
}

export type PublicMandateKind =
  | "public-body"
  | "publicly-owned"
  | "private"
  /**
   * VR was read and named NO current owner at all — so nothing is known about who owns
   * this company (money batch 015).
   *
   * This used to answer `private`, and that was the module's own doctrine violated in the
   * one place it was not looking. "Absence of data is not evidence" was enforced for a VR
   * record that could not be fetched, but not for a VR record that came back carrying no
   * current owner — which for an `akciová společnost` is the NORMAL case, because VR lists
   * shareholders only in special circumstances. Measured over the 57 attributable tied
   * companies: **49 of 52 `private` verdicts (18,05 mld. CZK, 98 % of the attributable
   * money) rested on that silence**, including Pražská energetika a.s., whose VR record
   * names no shareholder whatsoever while the company is city-owned through a holding.
   *
   * It is deliberately still `attributable: true`. Silence is not evidence of PUBLIC
   * ownership either, and quietly withdrawing 18 mld. from the surface on an absence
   * would be the same error pointed the other way. It marks the figure as unverified so
   * the surface can say so and the review queue can rank it.
   */
  | "ownership-not-published"
  | "unknown";

export interface PublicMandateVerdict {
  kind: PublicMandateKind;
  /** Human-readable Czech-first justification, safe to render. */
  reason: string;
  /** The shareholders that drove a `publicly-owned` verdict. */
  publicOwners: Shareholder[];
  /** Legal-form codes encountered that are in neither table — extend the tables, don't guess. */
  unknownCodes: string[];
  /** True when the money must NOT be attributed to a politician. */
  attributable: boolean;
}

/**
 * Classify one company. Order matters: own form first (a ministry is a public body no
 * matter who "owns" it), then current public shareholders, then the negative cases.
 */
export function classifyPublicMandate(input: PublicMandateInput): PublicMandateVerdict {
  const unknownCodes: string[] = [];
  const note = (code: string | null | undefined) => {
    if (code && isPublicLegalForm(code) === null) unknownCodes.push(String(code));
  };
  note(input.legalForm);
  for (const s of input.shareholders) note(s.legalForm);

  const ownIsPublic = isPublicLegalForm(input.legalForm);
  if (ownIsPublic === true) {
    const form = PUBLIC_LEGAL_FORMS[String(input.legalForm)];
    return {
      kind: "public-body",
      reason: `Veřejnoprávní subjekt — právní forma ${input.legalForm} (${form.label}). Prostředky jsou vlastní činností tohoto subjektu, nelze je přičítat politikovi.`,
      publicOwners: [],
      unknownCodes: [...new Set(unknownCodes)],
      attributable: false,
    };
  }

  const publicOwners = input.shareholders.filter((s) => s.current && isPublicLegalForm(s.legalForm) === true);
  if (publicOwners.length > 0) {
    const names = publicOwners.map((o) => o.name).join(", ");
    return {
      kind: "publicly-owned",
      reason: `Ve veřejném vlastnictví — společníkem/akcionářem je ${names}. Přestože právní forma (${input.legalForm ?? "neznámá"}) je soukromoprávní, prostředky jsou činností veřejného vlastníka; nelze je přičítat politikovi bez dalšího ověření.`,
      publicOwners,
      unknownCodes: [...new Set(unknownCodes)],
      attributable: false,
    };
  }

  // Negative cases. The expensive error is calling a public body private, so every path
  // that lacks evidence returns `unknown`, not `private`.
  if (ownIsPublic === null) {
    return {
      kind: "unknown",
      reason: `Právní forma ${input.legalForm ?? "(chybí)"} není v ověřené tabulce — subjekt nelze automaticky zařadit. Vyžaduje ruční posouzení.`,
      publicOwners: [],
      unknownCodes: [...new Set(unknownCodes)],
      attributable: false,
    };
  }
  if (!input.vrRetrieved) {
    return {
      kind: "unknown",
      reason: `Právní forma ${input.legalForm} je soukromoprávní, ale vlastnickou strukturu se nepodařilo načíst (chybí záznam VR) — nepřítomnost dat není důkazem soukromého vlastnictví.`,
      publicOwners: [],
      unknownCodes: [...new Set(unknownCodes)],
      attributable: false,
    };
  }
  const hasUnknownOwner = input.shareholders.some((s) => s.current && isPublicLegalForm(s.legalForm) === null);
  if (hasUnknownOwner) {
    return {
      kind: "unknown",
      reason: `Právní forma ${input.legalForm} je soukromoprávní, ale u některého ze současných společníků není právní forma v ověřené tabulce — vyžaduje ruční posouzení.`,
      publicOwners: [],
      unknownCodes: [...new Set(unknownCodes)],
      attributable: true,
    };
  }

  // The distinction this module was missing: "VR names owners, none of them public" is
  // evidence of private ownership; "VR names no current owner at all" is no evidence of
  // anything. `ownersRecorded` is undefined for callers that have not been updated —
  // those keep the old behaviour rather than being silently reclassified.
  if (input.ownersRecorded !== undefined && input.ownersRecorded === 0) {
    return {
      kind: "ownership-not-published",
      reason: `Právní forma ${input.legalForm} je soukromoprávní, ale veřejný rejstřík neuvádí k dnešnímu dni žádného společníka ani akcionáře — u akciové společnosti je to běžné a o vlastnictví to neříká nic. Vlastnictví není ověřeno; údaj o penězích se tím nemění, jen se neopírá o rejstříkový důkaz.`,
      publicOwners: [],
      unknownCodes: [...new Set(unknownCodes)],
      attributable: true,
    };
  }

  return {
    kind: "private",
    reason: `Soukromoprávní subjekt (právní forma ${input.legalForm}) bez veřejného vlastníka mezi současnými společníky/akcionáři.`,
    publicOwners: [],
    unknownCodes: [...new Set(unknownCodes)],
    attributable: true,
  };
}

/** Pull shareholders out of an ARES VR payload. Reads `akcionari` AND `spolecnici` —
 *  batch 002's P35 lesson: several VR arrays are load-bearing, not just one.
 *
 *  Legal persons only: the question is PUBLIC ownership, and a natural person can never
 *  be a public owner. Use `ownershipRecord` when you need to know whether VR recorded any
 *  owner at all — that is a different question, and conflating the two is what money
 *  batch 015 found costing 18 mld. CZK of unearned confidence. */
export function shareholdersFromVr(vr: unknown, asOf: string): Shareholder[] {
  return ownershipRecord(vr, asOf).legalPersons;
}

/** What the VR record SAYS about ownership — including the natural persons that
 *  `shareholdersFromVr` deliberately drops. */
export interface OwnershipRecord {
  /** Legal-person owners, current and historical. */
  legalPersons: Shareholder[];
  /** How many owner entries VR carried at all (legal + natural, current + historical). */
  entriesTotal: number;
  /** How many of those are CURRENT (no `datumVymazu`, or one still in the future). */
  entriesCurrent: number;
}

export function ownershipRecord(vr: unknown, asOf: string): OwnershipRecord {
  const record = (vr as { zaznamy?: unknown[] } | null)?.zaznamy?.[0] as Record<string, unknown> | undefined;
  const out: OwnershipRecord = { legalPersons: [], entriesTotal: 0, entriesCurrent: 0 };
  if (!record) return out;
  for (const key of ["akcionari", "spolecnici"]) {
    const groups = record[key];
    if (!Array.isArray(groups)) continue;
    for (const group of groups as Record<string, unknown>[]) {
      const members = group.clenoveOrganu;
      if (!Array.isArray(members)) continue;
      for (const m of members as Record<string, unknown>[]) {
        const po = m.pravnickaOsoba as Record<string, unknown> | undefined;
        const fo = m.fyzickaOsoba as Record<string, unknown> | undefined;
        if (!po && !fo) continue;
        const vymaz = typeof m.datumVymazu === "string" ? m.datumVymazu : null;
        const current = !vymaz || vymaz > asOf;
        out.entriesTotal += 1;
        if (current) out.entriesCurrent += 1;
        if (!po) continue; // a natural person is counted, never returned as a shareholder
        out.legalPersons.push({
          ico: typeof po.ico === "string" ? po.ico : null,
          name: typeof po.obchodniJmeno === "string" ? po.obchodniJmeno : "(bez názvu)",
          legalForm: typeof po.pravniForma === "string" ? po.pravniForma : null,
          current,
        });
      }
    }
  }
  return out;
}
