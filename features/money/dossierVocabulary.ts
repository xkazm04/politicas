/*
 * SLOVNÍK STROJOVÝCH VÝRAZŮ RUČNÍHO SPISU (/penize/kauzy) — jedno místo, kde se
 * token z payloadu mění v klíč čitelné věty.
 *
 * Ruční spis (docs/data-analysis/case-money/payloads/batch-005-lead-*.json) nese
 * dva uzavřené výčty, které se do 2026-08-11 sázely na nejcitlivější veřejnou
 * plochu platformy DOSLOVA, anglicky, jako by to byl text pro čtenáře:
 *   • `confidence`  — „medium" (obě dnešní kauzy),
 *   • `claims[].sourceKind` — „primary" / „media".
 * Ani jedno není copy. Jsou to identifikátory, které analytik zapsal do dat.
 *
 * Pravidla (vzor features/money/tieFlags.ts a features/overeni/gateVocabulary.ts):
 *  1. Slovník vlastní KLASIFIKACI, katalog vlastní COPY. Modul proto vrací klíče
 *     do `messages/*.json` (money.kauzy.vocab.*), ne hotovou českou větu —
 *     dvojjazyčná plocha nesmí mít dva zdroje pravdy.
 *  2. Neznámý token se NESKRÝVÁ a nepřekládá se odhadem: vrací se
 *     `known: false` a klíč věty, která ten token vypíše DOSLOVA a označí jako
 *     nepřeložený strojový výraz. Čtenář má vědět, že spis nese značku, pro
 *     kterou produkt zatím větu nemá.
 *  3. Prázdná hodnota má vlastní jméno — nikdy se nesází prázdno.
 *  4. Čistý modul (žádný server ani DOM), takže se pravidla dají otestovat bez
 *     PGlite i bez renderu — viz dossierVocabulary.test.ts.
 *
 * ANALYTICKÁ PRÓZA SEM NEPATŘÍ. `whatSourcesSustain`, `signalWhy`, `claims[].claim`
 * a `mediaContext[].gist` jsou DATA — pracovní materiál analytika, anglicky —
 * a produkt je nepřepisuje ani nepřekládá; plocha u nich jen přizná, co to je.
 */

/** Normalizovaná spolehlivost spisu. `unmapped` = token, který slovník nezná. */
export type DossierConfidence = "high" | "medium" | "low" | "unmapped";

/** Normalizovaný druh zdroje jednoho tvrzení. */
export type DossierSourceKind = "primary" | "media" | "unmapped";

export interface DossierTermInfo<K extends string> {
  /** Doslovný token z payloadu — vždy k dispozici, i u přeloženého výrazu. */
  token: string;
  /** false ⇒ slovník token nezná; copy říká právě tohle, nic si nedomýšlí. */
  known: boolean;
  kind: K;
  /** Klíč do money.kauzy.*; klíč pro `unmapped` bere {token}. */
  labelKey: string;
}

const CONFIDENCE: Record<string, Exclude<DossierConfidence, "unmapped">> = {
  high: "high",
  medium: "medium",
  low: "low",
};

const SOURCE_KIND: Record<string, Exclude<DossierSourceKind, "unmapped">> = {
  primary: "primary",
  media: "media",
};

const CONFIDENCE_KEYS: Record<DossierConfidence, string> = {
  high: "kauzy.vocab.confidenceHigh",
  medium: "kauzy.vocab.confidenceMedium",
  low: "kauzy.vocab.confidenceLow",
  unmapped: "kauzy.vocab.unmappedTerm",
};

const SOURCE_KIND_KEYS: Record<DossierSourceKind, string> = {
  primary: "kauzy.vocab.sourcePrimary",
  media: "kauzy.vocab.sourceMedia",
  unmapped: "kauzy.vocab.unmappedTerm",
};

/** Prázdná hodnota má vlastní jméno — neznámý výraz nikdy nesází prázdno. */
export const DOSSIER_EMPTY_TOKEN_KEY = "kauzy.vocab.emptyToken";

/**
 * Stav lidské brány, ve kterém ruční spis JE.
 *
 * `LeadDossier` nenese pole se stavem brány — payload ho prostě nemá. Doktrína
 * je ale jednoznačná a psaná na dvou místech (hlavička getLeadDossiers.ts a
 * `proposedAnnotation.requiresGate` v samotném payloadu): ruční podnět nikdy
 * automaticky nepotvrzuje vazbu, nemění `review_state` a nesytí skóre — čeká na
 * člověka. Konstanta je proto JEDNO místo, kde je ta doktrína vyslovená jako
 * token, a plocha ji posílá do sdíleného slovníku brány
 * (features/overeni/gateVocabulary.ts), aby /penize/kauzy a /overeni neříkaly
 * o jednom stavu dvě různé věty. Kdyby payload jednou stav nesl, čte se odtud.
 */
export const LEAD_DOSSIER_GATE_TOKEN = "pending_review";

/** „ano" / „ne" pro logické pole navržené anotace — `true` v závorce u čtenáře
 *  je strojový výpis, ne věta. */
export const DOSSIER_BOOL_KEYS = {
  true: "kauzy.vocab.boolTrue",
  false: "kauzy.vocab.boolFalse",
} as const;

export function confidenceInfo(raw: string): DossierTermInfo<DossierConfidence> {
  const token = raw.trim();
  const known = CONFIDENCE[token.toLowerCase()];
  const kind: DossierConfidence = known ?? "unmapped";
  return { token, known: known !== undefined, kind, labelKey: CONFIDENCE_KEYS[kind] };
}

export function sourceKindInfo(raw: string): DossierTermInfo<DossierSourceKind> {
  const token = raw.trim();
  const known = SOURCE_KIND[token.toLowerCase()];
  const kind: DossierSourceKind = known ?? "unmapped";
  return { token, known: known !== undefined, kind, labelKey: SOURCE_KIND_KEYS[kind] };
}

/** Nerozepsaná strojová struktura pod stropem zanoření — vypisuje se doslova
 *  a označená, nikdy skrytá (vzor tieFlags.ts, pravidlo 2). */
export const DOSSIER_MACHINE_STRUCTURE_KEY = "kauzy.vocab.machineStructure";

/** Všechny klíče, které tenhle modul umí vrátit — pro test úplnosti katalogu. */
export const DOSSIER_COPY_KEYS: readonly string[] = [
  ...new Set([
    ...Object.values(CONFIDENCE_KEYS),
    ...Object.values(SOURCE_KIND_KEYS),
    DOSSIER_EMPTY_TOKEN_KEY,
    DOSSIER_MACHINE_STRUCTURE_KEY,
    DOSSIER_BOOL_KEYS.true,
    DOSSIER_BOOL_KEYS.false,
  ]),
];
