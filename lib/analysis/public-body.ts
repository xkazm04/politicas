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
  "325": { label: "Organizační složka státu", verifiedVia: "00006947 Ministerstvo financí; 75112779 Ústav pro studium totalitních režimů" },
  "331": { label: "Příspěvková organizace (územní)", verifiedVia: "ARES PravniForma číselník" },
  "332": { label: "Státní příspěvková organizace", verifiedVia: "ARES PravniForma číselník" },
  "333": { label: "Státní příspěvková organizace ostatní", verifiedVia: "ARES PravniForma číselník" },
  "352": { label: "Státní fond", verifiedVia: "ARES PravniForma číselník" },
  "361": { label: "Veřejnoprávní instituce", verifiedVia: "00027383 ČESKÁ TELEVIZE" },
  "362": { label: "Česká tisková kancelář", verifiedVia: "ARES PravniForma číselník" },
  "382": { label: "Státní fond nezapisovaný do OR", verifiedVia: "ARES PravniForma číselník" },
  "391": { label: "Všeobecná zdravotní pojišťovna", verifiedVia: "41197518 VŠEOBECNÁ ZDRAVOTNÍ POJIŠŤOVNA ČR" },
  "392": { label: "Zdravotní pojišťovna", verifiedVia: "ARES PravniForma číselník" },
  "525": { label: "Vnitřní organizační jednotka organizační složky státu", verifiedVia: "ARES PravniForma číselník" },
  "601": { label: "Vysoká škola (veřejná)", verifiedVia: "00216208 Univerzita Karlova" },
  "801": { label: "Obec / město", verifiedVia: "00254843 Město Ostrov; 00274046 Statutární město Pardubice; 00075370 Statutární město Plzeň" },
  "804": { label: "Kraj", verifiedVia: "70889546 Královéhradecký kraj; 00064581 HLAVNÍ MĚSTO PRAHA" },
  "805": { label: "Regionální rada regionu soudržnosti", verifiedVia: "ARES PravniForma číselník" },
  "811": { label: "Městská část, městský obvod", verifiedVia: "ARES PravniForma číselník" },
};

/**
 * Ordinary business forms — known NOT to be public bodies in their own right. Listing
 * these explicitly (rather than treating "not in PUBLIC_LEGAL_FORMS" as private) is what
 * makes the `unknown` verdict possible.
 */
export const PRIVATE_LEGAL_FORMS: Record<string, string> = {
  "100": "Podnikající fyzická osoba tuzemská",
  "101": "Zemědělský podnikatel — fyzická osoba",
  "112": "Společnost s ručením omezeným",
  "113": "Společnost komanditní",
  "121": "Akciová společnost",
  "205": "Družstvo",
  "301": "Státní podnik",
  "421": "Odštěpný závod zahraniční právnické osoby",
  "701": "Spolek",
  "705": "Podnikatelské seskupení",
  "706": "Pobočný spolek",
  "716": "Odborová organizace",
  "721": "Církevní organizace",
  "731": "Organizační jednotka sdružení",
  "736": "Dobrovolný svazek obcí",
  "741": "Obecně prospěšná společnost",
  "751": "Zájmové sdružení právnických osob",
  "761": "Honební společenstvo",
  "771": "Nadace",
  "773": "Nadační fond",
  "941": "Společenství vlastníků jednotek",
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
}

export type PublicMandateKind = "public-body" | "publicly-owned" | "private" | "unknown";

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
  return {
    kind: "private",
    reason: `Soukromoprávní subjekt (právní forma ${input.legalForm}) bez veřejného vlastníka mezi současnými společníky/akcionáři.`,
    publicOwners: [],
    unknownCodes: [...new Set(unknownCodes)],
    attributable: true,
  };
}

/** Pull shareholders out of an ARES VR payload. Reads `akcionari` AND `spolecnici` —
 *  batch 002's P35 lesson: several VR arrays are load-bearing, not just one. */
export function shareholdersFromVr(vr: unknown, asOf: string): Shareholder[] {
  const record = (vr as { zaznamy?: unknown[] } | null)?.zaznamy?.[0] as Record<string, unknown> | undefined;
  if (!record) return [];
  const out: Shareholder[] = [];
  for (const key of ["akcionari", "spolecnici"]) {
    const groups = record[key];
    if (!Array.isArray(groups)) continue;
    for (const group of groups as Record<string, unknown>[]) {
      const members = group.clenoveOrganu;
      if (!Array.isArray(members)) continue;
      for (const m of members as Record<string, unknown>[]) {
        const po = m.pravnickaOsoba as Record<string, unknown> | undefined;
        if (!po) continue; // natural persons are out of scope — this asks about PUBLIC ownership
        const vymaz = typeof m.datumVymazu === "string" ? m.datumVymazu : null;
        out.push({
          ico: typeof po.ico === "string" ? po.ico : null,
          name: typeof po.obchodniJmeno === "string" ? po.obchodniJmeno : "(bez názvu)",
          legalForm: typeof po.pravniForma === "string" ? po.pravniForma : null,
          current: !vymaz || vymaz > asOf,
        });
      }
    }
  }
  return out;
}
