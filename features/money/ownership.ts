/*
 * VLASTNICKÁ STRUKTURA FIRMY — čistá projekce hran `owns_stake` na řádky, které
 * spis firmy (/penize/firma/[ico]) vykreslí.
 *
 * Graf nese od průchodu 28 datovanou vrstvu vlastnictví: 33 hran `owns_stake`
 * (company → company, kde SRC je zapsaný akcionář a DST vlastněná firma) a 19
 * mateřských uzlů (Město Plzeň, HLAVNÍ MĚSTO PRAHA, Ministerstvo financí,
 * předchůdci AGROFERTu…). Zdrojem je hromadný výpis ISVR z dataor.justice.cz,
 * každá hrana nese `role`, `share`, `from`, `to`, `source` a `periods`. Do
 * 2026-08-12 to nevykreslovala žádná plocha — spis firmy ukazoval firmu bez
 * jakéhokoli okolí, přestože u AGROFERTu je vlastnictví celá páteř příběhu a
 * u Plzeňských městských dopravních podniků je vlastníkem samo město.
 *
 * PRAVIDLA, KTERÁ TENHLE MODUL DRŽÍ
 *
 *  1. JEN ZAPSANÉ VLASTNICTVÍ, JEDEN KROK. Projekce čte hrany, které se
 *     dotýkají TÉHLE firmy, a nic nedopočítává: žádný průchod řetězcem přes víc
 *     firem, žádná „expozice", žádné sousedství jako obvinění. Dvoukrokové
 *     odvození je tvrzení, které v grafu nikdo nezapsal.
 *  2. ČAS SE NEZAMLČUJE. `to === null` je otevřený zápis („podle rejstříku
 *     trvá"), `to` s datem je HISTORIE a řádek to musí říct — jinak by stránka
 *     tvrdila současné vlastnictví tam, kde rejstřík vede ukončený zápis.
 *     `multi_period_merged` znamená, že rejstřík vede víc období jednoho vztahu
 *     a nahoře je poslední z nich; počet období se přizná, nikdy se neschová.
 *  3. PROTISTRANA SE LINKUJE JEN PŘES KANONICKÉ IČO (`companyId.ts`). Uzel,
 *     jehož id nemá tvar `company:ico:<8 číslic>`, odkaz nedostane — tichý
 *     falešný odkaz je horší než žádný (memory/ico-node-id-canonical-form.md).
 *  4. ZANIKLÉ IČO SE NIKDY NEVYDÁVÁ ZA DOLOŽENÝ SUBJEKT. Dva předchůdci
 *     AGROFERTu (25130072, 60197773) nesou na uzlu uloženou anotaci
 *     `ico_unresolvable_in_ares` + `extinction_reason` + českou pracovní prózu
 *     analytika (včetně varování před záměnou názvů). Projekce ji vydá tak, jak
 *     je uložená — doslova, opatřená datem a průchodem. Prózu NEPOUŠTÍME
 *     jazykovou branou (`lib/analysis/language-gate.ts`): je to DATA, ne naše
 *     copy, a stopwordový klasifikátor rejstříkovou češtinu falešně označuje za
 *     angličtinu (měřeno na 14 z 211 poznámek u vazeb).
 *  5. PRÁZDNO JE NEPŘÍTOMNOST, NE PRÁZDNÝ BLOK. Firma bez jediné hrany
 *     `owns_stake` (166 ze 195 firem s vazbou na poslance) nedostane blok
 *     vůbec — `projectOwnership` vrací `null`.
 *  6. ZTRÁTA SE POČÍTÁ. Zápis, jehož protistranu graf nevrátil, se nevykreslí
 *     napůl: vypadne a přizná se v `droppedUnresolved`.
 *  7. PODÍL ŘEKNE, ODKUD JE (2026-08-13). Blok tiskl „100 %" jako zapsaný podíl.
 *     Nebyl to zapsaný podíl: jediný zapisovatel té hodnoty
 *     (`scripts/case-loops/money/dataor-ownership-chains.ts:177`) ji vyrábí
 *     shodou `/jedin[ýá]/i` NAD TEXTEM ROLE — a skutečné pole `stakePct`
 *     v `lib/ingest/sources/dataor.ts` je mrtvé (obě konstrukce píšou `null`).
 *     Číslo z odhadu se proto nesází jako procento; `shareOrigin` to rozliší a
 *     hodnota, kterou ten odhad vyrobit nemohl, si svoje procento ponechá.
 *     Nepřítomný podíl zůstává nepřítomný — nikdy z něj nebude „0 %".
 *
 * Čistý modul (žádný server, žádný DOM) — pravidla se testují bez PGlite,
 * viz `ownership.test.ts`.
 */

import type { KgEdgeRow, KgNodeRow } from "@/lib/db/types";
import { icoFromCompanyNodeId } from "./companyId";
import type { BasisComposition } from "./amountBasis";
import type { MoneyCompanyDetail } from "./moneyTypes";

/** Relace, kterou tenhle modul čte. Jedno místo, kde její jméno stojí. */
export const OWNS_STAKE_REL = "owns_stake";

/** Z pohledu zobrazované firmy: `owner` = protistrana ji vlastní,
 *  `subsidiary` = ona vlastní protistranu. */
export type OwnershipDirection = "owner" | "subsidiary";

/**
 * SLOVO „JEDINÝ" V TEXTU ROLE, ne procento z rejstříku.
 *
 * Zrcadlí VÝHRADNÍ tvar, kterým `scripts/case-loops/money/
 * dataor-ownership-chains.ts:177` vyrábí hodnotu `share`. Deklarované je to tady,
 * protože tenhle modul o tom pravidle ČTE a plocha na něm staví větu; správný
 * konečný stav je, aby ten skript importoval TENHLE výraz (precedent
 * `classifyTie` v `reviewTypes.ts`, který si tři skripty case-loopu importují) —
 * skript je mimo tuhle sadu, takže je to vedeno jako navazující krok a rozdíl
 * hlídá test.
 */
export const SOLE_OWNER_ROLE_RE = /jedin[ýá]/i;

/** Hodnota, kterou umí vyrobit `SOLE_OWNER_ROLE_RE` — a jen ta. */
export const SOLE_OWNER_SHARE = 100;

/** Odkud pochází `sharePct` u řádku (viz `OwnershipRow.shareOrigin`). */
export type ShareOrigin = "sole-owner-role" | "published" | null;

/**
 * Klasifikace podílu. Jediné místo, kde se rozhoduje, jestli se číslo smí vysázet
 * jako změřený údaj.
 *
 * Test hlídá obě strany: `100` z role tvaru „jediný akcionář" je ODVOZENÍ, a role
 * bez toho slova žádné číslo nevyrábí — takže jakmile by se v datech objevilo
 * procento, které tenhle odhad vyrobit nemohl, projde jako `published` a nikdo ho
 * nedegraduje.
 */
export function classifyShare(sharePct: number | null, role: string | null): ShareOrigin {
  if (sharePct === null) return null;
  if (sharePct === SOLE_OWNER_SHARE && role !== null && SOLE_OWNER_ROLE_RE.test(role)) {
    return "sole-owner-role";
  }
  return "published";
}

/** Uložená pravda o protistraně, kterou nelze ověřit v registru. Všechna pole
 *  jsou DOSLOVNÝ obsah `kg_node.props` — nic z toho produkt nepřepisuje. */
export interface OwnershipAnnotation {
  /** `ico_unresolvable_in_ares` — IČO nevrací ARES na žádném z ověřených endpointů. */
  unresolvableInAres: boolean;
  /** `ico_check_result`, doslova (i s anglickými částmi — je to pracovní záznam). */
  checkResult: string | null;
  /** Endpointy, na kterých se absence ověřovala. */
  checkedEndpoints: string[];
  /** `extinction_reason`, doslova (živě: „fúze"). */
  extinctionReason: string | null;
  /** `merged_into`, doslova („company:ico:26185610 (AGROFERT, a.s.)"). */
  mergedInto: string | null;
  /** Kanonické IČO nástupce, když se dá z uloženého řetězce přečíst id uzlu. */
  mergedIntoIco: string | null;
  mergedOn: string | null;
  /** `successor_candidate`, doslova. */
  successorCandidate: string | null;
  /** `not_an_anomaly` — analytik výslovně říká, že nejde o kaz v datech. */
  notAnomaly: boolean;
  /** Česká pracovní próza analytika (`analyst_note_cs`), doslova. */
  analystNoteCs: string | null;
  /** Datum a průchod z `ico_check_provenance` — anotace se sází datovaná. */
  recordedAt: string | null;
  pass: number | null;
}

/** Jeden zápis vlastnictví, jak se vykreslí. */
export interface OwnershipRow {
  direction: OwnershipDirection;
  /** kg id protistrany — stabilní klíč řádku. */
  counterpartId: string;
  counterpartName: string;
  /** Kanonické IČO, nebo null (pak řádek nikam neodkazuje). */
  counterpartIco: string | null;
  /** `props.role`, doslova (živě 33/33 „jediný akcionář"). */
  role: string | null;
  /** `props.share` v procentech; null, když hrana číslo nenese. SÁZET SE NESMÍ
   *  bez `shareOrigin` — viz jeho komentář. */
  sharePct: number | null;
  /**
   * ODKUD TO ČÍSLO JE. Do 2026-08-13 se `sharePct` sázelo jako „100 %", tedy
   * jako zapsaný podíl. Nebyl to zapsaný podíl: `scripts/case-loops/money/
   * dataor-ownership-chains.ts:177` píše `share: h.role && /jedin[ýá]/i
   * .test(h.role) ? 100 : null`, což je SHODA REGULÁRNÍHO VÝRAZU NA SLOVĚ
   * v textovém popisu funkce, ne procento, které by nějaký rejstřík zveřejnil.
   * (`lib/ingest/sources/dataor.ts` deklaruje skutečné pole `stakePct`, ale obě
   * jeho konstrukce píšou `null` — je mrtvé.)
   *
   *  • `sole-owner-role` — 100 vzniklo z toho odhadu nad textem role. Plocha
   *    NEVYSÁZÍ holé procento; řekne, co ta hodnota doopravdy znamená („registr
   *    uvádí jediného vlastníka"), a role se sází vedle jako doklad.
   *  • `published`       — číslo, které ten odhad vyrobit NEMOHL, takže pochází
   *    z jiného zápisu; sází se jako změřený údaj a nesmí se degradovat.
   *  • `null`            — hrana číslo nenese. NEPŘÍTOMNOST, nikdy nula.
   */
  shareOrigin: ShareOrigin;
  from: string | null;
  to: string | null;
  /** `to === null` — podle rejstříku zápis trvá. */
  open: boolean;
  /** Kolik období jednoho vztahu rejstřík vede (`props.periods`). */
  periodCount: number;
  /** `props.multi_period_merged` — nahoře je POSLEDNÍ z těch období. */
  multiPeriodMerged: boolean;
  /** `props.source`, doslova. */
  source: string | null;
  /** Jméno souboru zdroje, když je zdroj http(s) URL — jinak null a sází se text. */
  sourceLabel: string | null;
  /** Datum a průchod z provenance hrany. */
  recordedAt: string | null;
  pass: number | null;
  /** Uložená anotace protistrany; null u běžné, v registru dohledatelné firmy. */
  annotation: OwnershipAnnotation | null;
}

export interface OwnershipStructure {
  /** Kdo firmu vlastní (hrany mířící NA ni), od nejnovějšího zápisu. */
  owners: OwnershipRow[];
  /** Co firma vlastní (hrany Z ní), od nejnovějšího zápisu. */
  subsidiaries: OwnershipRow[];
  /** Zápisy vypuštěné proto, že protistranu graf nevrátil. Přiznává se na ploše. */
  droppedUnresolved: number;
  /** Kolik vykreslených řádků má podíl ODVOZENÝ ze slova v textu role
   *  (`shareOrigin === "sole-owner-role"`). Blok podle toho vykreslí větu o tom,
   *  odkud ta hodnota je — jednou nad seznamem, ne u každého řádku. Nula znamená,
   *  že žádné takové odvození na ploše není, a věta se nevykreslí. */
  soleOwnerDerived: number;
  /** `name_history_cs` samotné zobrazované firmy — doslovný záznam, který u
   *  AGROFERTu odlišuje tři různé subjekty téhož jména. Null, když ho uzel nenese. */
  subjectNameHistoryCs: string | null;
  /** Průchod, který vrstvu zapsal (z provenance hran) — jen když se na něm
   *  VŠECHNY vykreslené řádky shodnou. Dva průchody v jednom bloku by citace
   *  spojila do jednoho čísla, které neplatí ani pro jeden z nich. */
  pass: number | null;
}

/**
 * Payload spisu firmy. Deklarovaný TADY, ne v `moneyTypes.ts`: pole je produktem
 * tohohle modulu a klientská stránka ho musí umět importovat, aniž by sáhla na
 * `server-only` loader.
 */
export interface CompanyCaseFileData extends MoneyCompanyDetail {
  /** null = graf o okolí téhle firmy nic nevede a blok se nevykreslí vůbec. */
  ownership: OwnershipStructure | null;
  /**
   * SLOŽENÍ DAŇOVÝCH ZÁKLADEN za korunový součet téhle firmy — přes VŠECHNY
   * její smlouvy, ne jen přes vypsaných 40 řádků: součet nad hlavičkou je přes
   * všechny, takže složení o něm musí být taky.
   *
   * Bydlí TADY a ne v `moneyTypes.ts` ze stejného důvodu jako `ownership`:
   * pole je produktem loaderu téhle plochy a klientská stránka ho musí umět
   * importovat, aniž by sáhla na `server-only` modul.
   */
  contractBasis: BasisComposition;
}

/**
 * Spis firmy, kterou graf drží JEN v rejstříkové vrstvě: žádná hrana `linked_to`
 * na poslance k ní nevede, ale `owns_stake` kolem ní ano.
 *
 * Tyhle uzly nejsou okrajové — jsou to CÍLE ODKAZŮ, které blok vlastnictví sám
 * vykresluje (Město Plzeň, HLAVNÍ MĚSTO PRAHA, Ministerstvo financí, předchůdci
 * AGROFERTu a osm dalších soukromých matek bez vazby na poslance). Do 2026-08-12
 * na nich stránka odpovídala „znalostní graf nevede pro tohle IČO žádnou vazbu na
 * poslance" — tedy popřením té vrstvy, ze které se na ni čtenář právě proklikl,
 * zatímco graf tu hranu drží.
 *
 * CO TAHLE VARIANTA NENESE, JE PODSTATNÉ JAKO CO NESE: žádný dosah, žádný košík,
 * žádnou smluvní knihu. Bez vazby neexistuje třída vazby, a bez třídy neexistuje
 * pravidlo přiřazení (`reachableMoney.ts`), které by řeklo, ČÍ ty peníze jsou —
 * takže se tu žádné peníze nesází ani neraží jako citovatelný claim.
 *
 * Rozlišuje se polem `variant`, které vazbový payload NEMÁ: spis firmy s vazbami
 * jde proto po drátě bajt za bajt stejný jako předtím.
 */
export interface CompanyRegistryFileData {
  variant: "registry-only";
  companyId: string;
  ico: string;
  name: string;
  /** Nikdy null: bez jediného vykreslitelného zápisu tahle varianta nevznikne
   *  (loader vrací `null` a stránka zůstává u „graf o téhle firmě nic nevede"). */
  ownership: OwnershipStructure;
}

/** Co spis firmy vykresluje — jedna ze dvou variant, nikdy sloučený tvar. */
export type CompanyFileData = CompanyCaseFileData | CompanyRegistryFileData;

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Podíl v procentech. Číslo i číselný řetězec (jsonb nezaručuje, čím to je);
 *  cokoli jiného je NEPŘÍTOMNÝ údaj, ne nula — nula by byla tvrzení. */
function pct(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function passOf(provenance: unknown): number | null {
  const p = (provenance as Record<string, unknown> | null | undefined)?.pass;
  return typeof p === "number" && Number.isFinite(p) ? p : null;
}

function computedAtOf(provenance: unknown): string | null {
  return str((provenance as Record<string, unknown> | null | undefined)?.computedAt);
}

/** Krátký štítek zdroje — jméno souboru výpisu. Null u čehokoli, co není http(s)
 *  URL: plocha pak sází uložený text doslova a nikam neodkazuje. */
export function sourceFileLabel(source: string | null): string | null {
  if (!source || !/^https?:\/\//i.test(source)) return null;
  const withoutQuery = source.split(/[?#]/)[0];
  const tail = withoutQuery.split("/").filter(Boolean).pop();
  return tail && tail !== "" ? tail : null;
}

/** IČO nástupce z uloženého řetězce „company:ico:26185610 (AGROFERT, a.s.)".
 *  Čte se PREFIX id uzlu, ne první číslo v textu — název firmy taky obsahuje
 *  číslice a hádat z něj IČO je přesně ta tichá záměna, které se vyhýbáme. */
export function successorIcoFrom(raw: string | null): string | null {
  if (!raw) return null;
  const token = raw.trim().split(/\s+/)[0];
  return icoFromCompanyNodeId(token);
}

function annotationOf(node: KgNodeRow | undefined): OwnershipAnnotation | null {
  const p = (node?.props ?? {}) as Record<string, unknown>;
  const unresolvable = p.ico_unresolvable_in_ares === true;
  const extinctionReason = str(p.extinction_reason);
  const mergedInto = str(p.merged_into);
  const analystNoteCs = str(p.analyst_note_cs);
  const checkResult = str(p.ico_check_result);
  // Anotace se sází jen tehdy, když uzel nese aspoň jednu z věcí, které o něm
  // něco ŘÍKAJÍ. Prázdná kapsle by na ploše vypadala jako varování bez obsahu.
  if (!unresolvable && !extinctionReason && !mergedInto && !analystNoteCs && !checkResult) return null;
  const endpoints = Array.isArray(p.ico_checked_endpoints)
    ? (p.ico_checked_endpoints as unknown[]).map(str).filter((s): s is string => s !== null)
    : [];
  return {
    unresolvableInAres: unresolvable,
    checkResult,
    checkedEndpoints: endpoints,
    extinctionReason,
    mergedInto,
    mergedIntoIco: successorIcoFrom(mergedInto),
    mergedOn: str(p.merged_on),
    successorCandidate: str(p.successor_candidate),
    notAnomaly: p.not_an_anomaly === true,
    analystNoteCs,
    recordedAt: computedAtOf(p.ico_check_provenance),
    pass: passOf(p.ico_check_provenance),
  };
}

/** Nejnovější zápis první; chybějící `from` až za datovanými (nedatovaný zápis
 *  není novější, jen neznámý). Shoda se láme na id protistrany vzestupně, takže
 *  pořadí je totální a mezi buildy se nehýbe. */
function byRecency(a: OwnershipRow, b: OwnershipRow): number {
  if (a.from !== b.from) {
    if (a.from === null) return 1;
    if (b.from === null) return -1;
    return a.from < b.from ? 1 : -1;
  }
  return a.counterpartId < b.counterpartId ? -1 : a.counterpartId > b.counterpartId ? 1 : 0;
}

/**
 * Hrany `owns_stake` incidentní s jednou firmou → dva seřazené seznamy.
 * Vrací `null`, když z hran nezbyl ani jeden vykreslitelný řádek: blok pak na
 * stránce NEEXISTUJE (nepíše se prázdná sekce s větou „nic nevedeme").
 */
export function projectOwnership(args: {
  companyId: string;
  /** props zobrazované firmy — čte se z nich jen doslovná `name_history_cs`. */
  companyProps?: Record<string, unknown> | null;
  edges: readonly KgEdgeRow[];
  nodeById: ReadonlyMap<string, KgNodeRow>;
}): OwnershipStructure | null {
  const { companyId, edges, nodeById } = args;
  const owners: OwnershipRow[] = [];
  const subsidiaries: OwnershipRow[] = [];
  let droppedUnresolved = 0;

  for (const e of edges) {
    if (e.rel !== OWNS_STAKE_REL) continue;
    const isOwner = e.dst === companyId;
    const isSubsidiary = e.src === companyId;
    // Hrana, která se téhle firmy nedotýká, sem nepatří — a smyčku na sebe sama
    // graf nevede; kdyby ji vedl, čteme ji jako vlastníka a nekreslíme dvakrát.
    if (!isOwner && !isSubsidiary) continue;
    const counterpartId = isOwner ? e.src : e.dst;
    const node = nodeById.get(counterpartId);
    if (!node) {
      // Řádek bez protistrany není zápis, je to půlka zápisu. Vypadává a počítá se.
      droppedUnresolved += 1;
      continue;
    }
    const props = (e.props ?? {}) as Record<string, unknown>;
    const to = str(props.to);
    const source = str(props.source);
    const periods = Array.isArray(props.periods) ? (props.periods as unknown[]).length : 0;
    const role = str(props.role);
    const sharePct = pct(props.share);
    const row: OwnershipRow = {
      direction: isOwner ? "owner" : "subsidiary",
      counterpartId,
      counterpartName: node.label,
      counterpartIco: icoFromCompanyNodeId(counterpartId),
      role,
      sharePct,
      shareOrigin: classifyShare(sharePct, role),
      from: str(props.from),
      to,
      open: to === null,
      periodCount: periods,
      multiPeriodMerged: props.multi_period_merged === true,
      source,
      sourceLabel: sourceFileLabel(source),
      recordedAt: computedAtOf(e.provenance),
      pass: passOf(e.provenance),
      annotation: annotationOf(node),
    };
    (isOwner ? owners : subsidiaries).push(row);
  }

  // Blok neexistuje, dokud není co vykreslit ANI co přiznat. Kdyby všechny
  // zápisy vypadly na nedohledané protistraně, ztráta musí být vidět — mlčení
  // by z ní udělalo „firma nemá vlastníka", což je jiné tvrzení.
  if (owners.length === 0 && subsidiaries.length === 0 && droppedUnresolved === 0) return null;

  owners.sort(byRecency);
  subsidiaries.sort(byRecency);

  const passes = [...owners, ...subsidiaries].map((r) => r.pass);
  const uniformPass =
    passes.length > 0 && passes.every((p) => p !== null && p === passes[0]) ? passes[0] : null;

  return {
    owners,
    subsidiaries,
    droppedUnresolved,
    soleOwnerDerived: [...owners, ...subsidiaries].filter((r) => r.shareOrigin === "sole-owner-role")
      .length,
    subjectNameHistoryCs: str((args.companyProps ?? {}).name_history_cs),
    pass: uniformPass,
  };
}
