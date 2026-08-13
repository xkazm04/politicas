/*
 * DAŇOVÁ ZÁKLADNA SMLUVNÍ ČÁSTKY — čistý modul, žádné peníze se tu nepřepočítávají.
 *
 * PROČ EXISTUJE. Registr smluv zveřejňuje hodnotu smlouvy ve DVOU základnách —
 * `hodnotaBezDph` a `hodnotaVcetneDph` — a `lib/ingest/sources/smlouvy-dump.ts`
 * to říká ve své vlastní hlavičce: *„They are NOT summable with each other, and a
 * CZK total that mixes them is wrong."* Sklizeň je přesto do jednoho pole složí
 * (`scripts/case-loops/money/persist-contract-harvest.ts`: `amount =
 * hodnotaVcetneDph ?? hodnotaBezDph`), ALE ZAPÍŠE, KTEROU POUŽILA: `amountBasis`
 * jde na uzel smlouvy i na každou hranu `supplies`.
 *
 * Do 2026-08-13 to nečetla ani jedna plocha (`grep -rn "amountBasis" features/ app/`
 * vracel nulu), takže KAŽDÝ součet Kč, který produkt o jmenovaném poslanci nebo
 * firmě publikuje, obě základny tiše míchal. Rozložení korpusu je zapsané v
 * `docs/data-analysis/graph-log.md:950-951`: bezDph 82 918 · vcetneDph 36 580 ·
 * ciziMena 2 959.
 *
 * CO TENHLE MODUL DĚLÁ A CO ZÁMĚRNĚ NEDĚLÁ
 *
 *  1. NEOPRAVUJE. Sazba DPH u smlouvy v grafu není, takže přepočet mezi
 *     základnami by byl vymyšlené číslo — přesně ten zločin, kvůli kterému tenhle
 *     repozitář existuje. Precedent je `lib/analysis/plausible-date.ts`: nemožné
 *     datum se PŘIZNÁ, nikdy se neopraví. Tady se přizná složení součtu.
 *  2. NEPŘESOUVÁ ANI JEDNU KORUNU. Modul nesahá na `weight` ani na žádnou sumu;
 *     počítá jen ŘÁDKY podle základny. Že se součty nepohnuly, hlídá test.
 *  3. NEZNÁMÁ ZÁKLADNA NENÍ ANI JEDNA ZE STRAN. Řádek bez zapsané základny
 *     (`unrecorded`), s explicitním „registr hodnotu nezveřejnil" (`none`) i
 *     smlouva v cizí měně (`ciziMena`) se počítají zvlášť a do žádné z obou
 *     DPH stran nespadnou.
 *
 * Čistý modul (žádný server, žádný DOM) — importuje ho loader i klientská sazba.
 */

/** Základny, které sklizeň zapisuje, plus stav „hrana žádnou nenese".
 *
 *  `none` a `unrecorded` jsou DVĚ RŮZNÁ TVRZENÍ a neslučují se:
 *   • `none`       — sklizeň běžela a zapsala, že registr u té smlouvy hodnotu
 *                    nezveřejnil vůbec (žádná ze tří číselných variant).
 *   • `unrecorded` — hrana základnu nenese; tenhle graf o ní nic neví (starší
 *                    průchody než re-ingest batch-012 pole nezapisovaly).
 *  „Registr mlčel" a „my jsme se nezeptali" je rozdíl, který se na ploše hlásí. */
export const AMOUNT_BASES = ["vcetneDph", "bezDph", "ciziMena", "none", "unrecorded"] as const;
export type AmountBasis = (typeof AMOUNT_BASES)[number];

/** Základny, jejichž korunové hodnoty NEJSOU vzájemně sčitatelné. Jediné místo,
 *  kde ten pár stojí; `mixed` se odvozuje výhradně z něj. */
export const VAT_BASES = ["bezDph", "vcetneDph"] as const;
export type VatBasis = (typeof VAT_BASES)[number];

const KNOWN = new Set<string>(AMOUNT_BASES);

/**
 * Základna z `props` hrany `supplies` (nebo uzlu smlouvy). NULOVÉ ČTENÍ ZE STORE:
 * `listKgEdges` i `kgNeighbours` dělají `select * from kg_edge`, takže `props`
 * jsou u ruky už dnes — fold je jen zahazoval.
 *
 * Token, který tenhle build neumí pojmenovat, se počítá jako `unrecorded`, NIKDY
 * se nepřiřadí k některé ze stran: neznámá hodnota nesmí nafouknout ani jednu
 * polovinu tvrzení o sčitatelnosti.
 */
export function readAmountBasis(props: unknown): AmountBasis {
  if (props === null || typeof props !== "object") return "unrecorded";
  const raw = (props as Record<string, unknown>).amountBasis;
  if (typeof raw !== "string") return "unrecorded";
  return KNOWN.has(raw) ? (raw as AmountBasis) : "unrecorded";
}

/** Hrubé počty řádků podle základny — tvar, ve kterém fold běží a ve kterém se
 *  agregáty slučují. Mutovatelný schválně: fold jde přes ~153 700 hran. */
export type BasisCounts = Record<AmountBasis, number>;

export function emptyBasisCounts(): BasisCounts {
  return { vcetneDph: 0, bezDph: 0, ciziMena: 0, none: 0, unrecorded: 0 };
}

/** Přičte JEDEN řádek. Mutuje `counts` (hot path). */
export function countBasis(counts: BasisCounts, basis: AmountBasis): void {
  counts[basis] += 1;
}

/** Sloučí dva počty do NOVÉHO objektu — pro agregaci přes firmy. */
export function mergeBasisCounts(a: BasisCounts, b: BasisCounts): BasisCounts {
  const out = emptyBasisCounts();
  for (const k of AMOUNT_BASES) out[k] = a[k] + b[k];
  return out;
}

/** Složení součtu tak, jak se vykresluje. Odvozené, nikdy literál. */
export interface BasisComposition extends BasisCounts {
  /** Kolik řádků do součtu vstoupilo (součet všech pěti počtů). */
  counted: number;
  /** Jediná základna, kterou nesou VŠECHNY započtené řádky; null, když se
   *  neshodnou nebo se nezapočetlo nic. */
  sole: AmountBasis | null;
  /** Součet míchá obě DPH základny — tvrzení, které registr sám nepodporuje. */
  mixed: boolean;
  /** Řádky, které nestojí ani na jedné DPH straně (cizí měna, bez hodnoty,
   *  bez zapsané základny). Nula NENÍ „vše v pořádku", je to nepřítomnost. */
  outsideVatSplit: number;
}

/** Počty → složení. Čistá funkce; jediné místo, kde `sole` a `mixed` vznikají. */
export function basisComposition(counts: BasisCounts): BasisComposition {
  const counted = AMOUNT_BASES.reduce((n, k) => n + counts[k], 0);
  const present = AMOUNT_BASES.filter((k) => counts[k] > 0);
  return {
    ...counts,
    counted,
    sole: present.length === 1 ? present[0] : null,
    mixed: counts.bezDph > 0 && counts.vcetneDph > 0,
    outsideVatSplit: counts.ciziMena + counts.none + counts.unrecorded,
  };
}

/** Prázdné složení — firma bez jediné smlouvy. `counted: 0` je odpověď, ne mezera. */
export function emptyBasisComposition(): BasisComposition {
  return basisComposition(emptyBasisCounts());
}

/** Přímý fold z posloupnosti základen (testy a malé množiny). */
export function foldBasis(bases: Iterable<AmountBasis>): BasisComposition {
  const counts = emptyBasisCounts();
  for (const b of bases) countBasis(counts, b);
  return basisComposition(counts);
}

/* ── copy: modul vrací KLÍČE, ne české věty ──────────────────────────────────
 *
 * Vzor `features/overeni/verdict.ts` a `lib/analysis/low-score-reason.ts`: čistá
 * logika vydá klíč katalogu a čísla, sazba je přeloží. Bez toho by se tahle věta
 * musela napsat DVAKRÁT — jednou pro klientskou knihu vazeb a spisy, podruhé pro
 * serverový oddíl Peníze na spisu poslance (ten je schválně bez klienta) — a dvě
 * kopie jedné věty o téže vlastnosti je přesně to, čemu se tu vyhýbáme.
 */

/** Popisek základny u JEDNOHO řádku → klíč v `money.basis.*`. */
export const BASIS_TAG_KEYS = {
  bezDph: "tagBezDph",
  vcetneDph: "tagVcetneDph",
  ciziMena: "tagCiziMena",
  none: "tagNone",
  unrecorded: "tagUnrecorded",
} as const satisfies Record<AmountBasis, string>;

/** Jedna věta přiznání. `key` je klíč v `money.basis.*`; čísla se formátují až
 *  v sazbě (`lib/format.ts`) a do ICU se posílají DVAKRÁT — surové číslo vybírá
 *  množnou větev, naformátované se vykresluje (precedent /denik). */
export type BasisSentence =
  | { key: "mixed"; bez: number; vcetne: number }
  | { key: "allBezDph" | "allVcetneDph" | "noVatBasis" | "foreignCurrency" | "unstated"; count: number };

/** Všechny klíče, které tenhle modul umí vydat — katalogový test je pin. */
export const BASIS_COPY_KEYS = [
  "tagLabel",
  "rule",
  "mixed",
  "allBezDph",
  "allVcetneDph",
  "noVatBasis",
  "foreignCurrency",
  "unstated",
  ...Object.values(BASIS_TAG_KEYS),
] as const;

/**
 * Složení → věty. Prázdné pole znamená „nic se nezapočetlo", tedy že se
 * nevykreslí NIC: věta o složení prázdného součtu by byla šum.
 *
 * Pořadí je pevné: nejdřív tvrzení o DPH stranách (kvůli němu tenhle blok
 * existuje), potom to, co mimo ně stojí. Řádky mimo DPH rozdělení se přiznávají
 * ZVLÁŠŤ a nikdy se nepřičtou k žádné ze stran.
 */
export function basisSentences(c: BasisComposition): BasisSentence[] {
  if (c.counted === 0) return [];
  const out: BasisSentence[] = [];
  if (c.mixed) out.push({ key: "mixed", bez: c.bezDph, vcetne: c.vcetneDph });
  else if (c.bezDph > 0) out.push({ key: "allBezDph", count: c.bezDph });
  else if (c.vcetneDph > 0) out.push({ key: "allVcetneDph", count: c.vcetneDph });
  else out.push({ key: "noVatBasis", count: c.counted });
  if (c.ciziMena > 0) out.push({ key: "foreignCurrency", count: c.ciziMena });
  const unstated = c.none + c.unrecorded;
  if (unstated > 0) out.push({ key: "unstated", count: unstated });
  return out;
}
