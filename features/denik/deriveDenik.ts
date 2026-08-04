/*
 * Deník republiky — PURE derivation of the daily record (moonshot batch-3, 3A).
 *
 * ── CO DENÍK JE A CO POCTIVĚ NENÍ ───────────────────────────────────────────
 * Návrh mluvil o „diffu mezi průchody ingestů". Průzkum úložiště (2026-07-30):
 * graf drží JEN SOUČASNOU materializaci — kg_node nese `first_seen_pass` a
 * hrany `provenance.pass`, ale žádná tabulka snímků průchodů neexistuje;
 * historie průchodů žije jen jako nadpisy v trezoru
 * (docs/data-analysis/graph-log.md), bez dat. Diff „co přibylo mezi pass 41 a
 * 42" se z toho poctivě spočítat NEDÁ.
 *
 * Deník proto stojí na tom, co je skutečné — a pravidlo se vypisuje na ploše:
 *
 *   1. SVĚTOVÁ DATA FAKTŮ: smlouva má datum podpisu, rejstříková role datum
 *      zápisu/výmazu, přikázání výboru a vyhlášení ve Sbírce svá procesní data.
 *      Den deníku je den, kdy se ta událost STALA — ne den, kdy ji ingest našel.
 *   2. ZÁZNAMOVÁ DATA LIDSKÉ BRÁNY: review_audit je jediný append-only log
 *      v systému; u rozhodnutí revizora je datum záznamu totéž co datum
 *      události. Jen tahle skupina je skutečné „co vstoupilo do záznamu dnes".
 *
 * ── PROUD „ZAZNAMENÁNO" (moonshot 5C, aditivní — pravidlo výš se NEMĚNÍ) ────
 * Od zavedení bitemporálního grafu (3C) a tabulky change_event (5C) systém
 * záznamový čas ZNÁ: každá verze vazby a každá nová smlouva v grafu nese
 * recorded_at. Deník proto vedle světově datovaných řádků („účinné") nese
 * i řádky datované dnem ZÁZNAMU („zaznamenáno") — typované change eventy
 * (nová vazba, změna vazby, smlouva v grafu). Každý řádek přiznává, kterým
 * časem je datován (`timeBasis`); rozhodnutí brány byla záznamovým časem vždy.
 * Události před epochou bitemporální migrace poctivě neexistují — change_event
 * je nenese (tichá nultá událost, žádná záplava zpětně orazítkovaných řádků).
 *
 * ── PRAVIDLA (zděděná z knihy datovaných faktů, ../dashboard/datedFacts.ts) ──
 *   – Žádná vymyšlená věta, datum ani částka; co graf nenese, se nezobrazí.
 *   – Fakt bez možného data není datovaný fakt: mimo [PLAUSIBLE_FROM, dnes]
 *     se řádek vyhazuje, POČÍTÁ a plocha ten počet přizná. Datum se neopravuje.
 *   – Peníze jen tam, kam se smí přisoudit: smlouvy jen u firem s vazbou typu
 *     vlastník/jednatel (filtr dělá loader tím, co sem pošle — steward smlouvy
 *     jsou aktivitou instituce, ne poslance).
 *   – Rozhodnutí brány mluví jen brankovanou češtinou (DECISION_CS z Deníku
 *     důkazů) — nikdy poznámkou revizora.
 *
 * ── DETERMINISMUS ───────────────────────────────────────────────────────────
 * Dny sestupně; uvnitř dne skupiny v pevném pořadí (smlouvy → legislativa →
 * rejstřík → brána → záznam grafu) a uvnitř skupiny id vzestupně. Dvě sestavení téhož vstupu
 * v libovolném pořadí dají byte-identický deník — testy to přibíjejí.
 */

import { PLAUSIBLE_FROM } from "@/features/dashboard/datedFacts";
import { DECISION_CS } from "@/features/dukazy/deriveFeed";
import { canonicalIco } from "@/features/money/companyId";

export type DenikKind =
  | "contract"
  | "billAssigned"
  | "billPublished"
  | "roleStart"
  | "roleEnd"
  | "review"
  | "change"
  /** Mandát poslance podle snímků psp.cz (vznik / změna / zánik v evidenci). */
  | "mandate"
  /** Funkce ve sněmovním orgánu podle snímků psp.cz — jiná věc než rejstříková
   *  role (`roleStart`/`roleEnd`), která je zápisem v ARES. */
  | "organRole";

/** Kterým časem je řádek datován: světovým dnem události („účinné"), nebo dnem,
 *  kdy fakt vstoupil do záznamu („zaznamenáno"). Plocha to u řádku přizná. */
export type DenikTimeBasis = "ucinne" | "zaznamenano";

/** Entita, kterou lze v deníku „sledovat" — klíč je veřejná URL adresa filtru. */
export interface DenikEntity {
  /** `poslanec:<pspId>` | `firma:<ico>` | `tisk:<cislo>` — stabilní veřejný klíč. */
  key: string;
  label: string;
  /** Interní evidenční stránka entity, je-li jaká. */
  href: string | null;
}

export interface DenikEntry {
  /** Deterministické id — veřejná adresa záznamu ve feedu (guid). */
  id: string;
  /** `YYYY-MM-DD` — den zápisu (viz hlavička: světový čas / čas záznamu brány). */
  date: string;
  kind: DenikKind;
  /** Brankovaná česká věta záznamu — jediný hlas, kterým deník mluví. */
  titleCs: string;
  /** Částka v Kč, jen u smluv, které ji nesou. Formátuje klientská plocha. */
  czk?: number;
  /** Záznam stojí na vazbě, která čeká na lidskou kontrolu. */
  pending: boolean;
  /** Den řádku je světovým dnem události, nebo dnem záznamu (viz hlavička). */
  timeBasis: DenikTimeBasis;
  /** Doslovné jméno registru / záznamu, ze kterého fakt pochází. */
  source: string;
  tone: "signal" | "cobalt" | "ink" | "ochre";
  /** Entity záznamu — přes ně jde filtr „sledovat entitu". Nikdy prázdné. */
  entities: DenikEntity[];
  /** Interní evidenční odkaz věty (první entita s href). */
  internalHref: string | null;
}

export interface DenikDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Kotva dne: `d-<date>` — veřejná adresa vydání. */
  anchor: string;
  entries: DenikEntry[];
}

export interface DenikLedger {
  days: DenikDay[];
  /** Kolik zapsaných dnů korpus celkem nese, než se seřízl na `DAYS_SHOWN`. */
  daysTotal: number;
  /** Kolik záznamů dny na ploše celkem obsahují. */
  totalEntries: number;
  /** Kolik záznamů korpus celkem nabídl (po vyhození nemožných dat). */
  consideredEntries: number;
  /** Kolik záznamů mělo nemožné datum a bylo vyhozeno (nikdy opraveno). */
  droppedImplausible: number;
  /** Kolik vstupních řádků o smlouvách se slilo do jiného (jedna smlouva =
   *  jeden řádek; uzel smlouvy může viset na víc dodavatelských firem). */
  mergedContractRows: number;
  /** Kolik slitých smluv neslo rozporné částky, a proto neuvádí žádnou. */
  contractAmountConflicts: number;
}

/** Kolik zapsaných dnů stránka ukáže. Starší dny zůstávají dostupné přes filtr
 *  entity (filtr se řeže až po vyfiltrování) — plocha to přizná. */
export const DAYS_SHOWN = 30;

/** Kolik záznamů nesou strojové podoby deníku (RSS/JSON). */
export const FEED_ENTRIES = 100;

export const dayAnchor = (date: string): string => `d-${date}`;

/** Deterministický český den v týdnu z `YYYY-MM-DD` — bez Intl (server a
 *  klient mohou mít různé verze ICU; toLocaleDateString by rozjelo hydrataci).
 *  Zóna se sem NEVRACÍ ani po pražské opravě dne (features/denik/pragueDay.ts):
 *  vstupem je DATUM, ne okamžik, a den v týdnu data se počítá kalendářně. Zóna
 *  rozhoduje jen o tom, KTERÝ den je „dnes" — a to řeší loader na serveru. */
const WEEKDAYS_CS = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"] as const;
export function czechWeekday(isoDate: string): string | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(t)) return null;
  return WEEKDAYS_CS[new Date(t).getUTCDay()];
}

// ── Veřejné klíče entit (adresa filtru = adresa odběru) ─────────────────────

export const mpEntityKey = (pspId: number) => `poslanec:${pspId}`;
export const companyEntityKey = (ico: string) => `firma:${ico}`;
export const billEntityKey = (cislo: number) => `tisk:${cislo}`;

const SOURCE_CONTRACT = "registr smluv — smlouvy.gov.cz";
const SOURCE_REGISTRY = "ares — veřejný rejstřík";
const SOURCE_PSP = "psp.cz — historie tisku";
const SOURCE_GATE = "review_audit — lidská brána";
const SOURCE_CHANGE = "change_event — záznam grafu";

// ── Vstup (loader mapuje projekce getMoneyData/getLawData/listReviewAudit) ──

export interface DenikContract {
  /** id uzlu smlouvy v grafu — vstupuje do id záznamu, takže je stabilní. */
  id: string;
  title: string;
  signedOn: string | null;
  amountCzk: number | null;
  company: string;
  /** KANONICKÉ osmimístné IČO, nebo null, když ho z korpusu takové udělat nejde
   *  (loader validuje `canonicalIco`; viz companyEntity). */
  ico: string | null;
  /** Poslanci, jimž se smlouvy firmy SMÍ přisoudit (vazba vlastník/jednatel). */
  mps: { pspId: number; name: string; pending: boolean }[];
}

export interface DenikRole {
  company: string;
  /** KANONICKÉ osmimístné IČO, nebo null (viz DenikContract.ico). */
  ico: string | null;
  mpName: string;
  pspId: number;
  role: string;
  validFrom: string | null;
  validTo: string | null;
  pending: boolean;
}

export interface DenikBill {
  cislo: number;
  title: string;
  sponsors: { pspId: number; name: string }[];
  committees: { organLabel: string; assignedOn: string | null }[];
  fateSb: string | null;
  fatePublishedOn: string | null;
}

export interface DenikReview {
  /** review_audit řádek — uuid, append-only, nikdy přečíslovaný. */
  id: string;
  decision: "confirm" | "reject" | "needs-more";
  /** ISO timestamp rozhodnutí — u brány je čas záznamu časem události. */
  decidedAt: string;
  mpName: string;
  company: string;
  pspId: number | null;
  ico: string | null;
}

/**
 * Druhy change eventů, které deník UMÍ vyslovit českou větou. Je to
 * CHANGE_EVENT_TYPES (lib/ingest/changeEvents.ts) MÍNUS `review-decision`:
 * rozhodnutí brány už deník nese ze svého vlastního čtení review_audit
 * a duplikát by lhal o počtu událostí dne.
 *
 * Do 2026-08-04 tu stály jen tři typy a zbylých šest loader mlčky zahazoval —
 * takže „poslanec ztratil mandát" nemělo v produktu ŽÁDNOU plochu. Union je
 * teď uzavřený a loader typ, který v něm není, POČÍTÁ a plocha ten počet
 * přizná (nikdy tiché zahození).
 */
export const DENIK_CHANGE_TYPES = [
  "tie-new",
  "tie-changed",
  "contract-new",
  "mandate-new",
  "mandate-changed",
  "mandate-removed",
  "role-new",
  "role-changed",
  "role-removed",
] as const;

export type DenikChangeType = (typeof DENIK_CHANGE_TYPES)[number];

/** Typovaný change event z tabulky change_event (5C) — proud „zaznamenáno". */
export interface DenikChange {
  /** change_event.id — deterministický, vstupuje do id záznamu. */
  id: string;
  eventType: DenikChangeType;
  /** ISO instant záznamu — den řádku je dnem ZÁZNAMU, ne účinnosti. */
  recordedAt: string;
  mpName: string | null;
  pspId: number | null;
  company: string | null;
  /** KANONICKÉ IČO, nebo null (viz companyEntity). */
  ico: string | null;
  /** Popisek smlouvy (uzlu), jen u contract-new, je-li v grafu. */
  contractLabel: string | null;
  /** Volební období mandátu (`payload.termCode`), u mandate-* eventů. */
  termCode: string | null;
  /** Název funkce ve sněmovním orgánu (`payload.functionNameCz`), u role-*. */
  functionNameCz: string | null;
  /** Doslovný název záznamu, ze kterého byl event odvozen (`change_event.source`)
   *  — kg_edge_history, nebo diff snímků psp.cz. Deník cituje TENHLE řetězec,
   *  ne jméno tabulky, ve které event skončil. */
  source: string;
  /** Vazba, na které event stojí, čeká na lidskou kontrolu. */
  pending: boolean;
}

export interface DenikInput {
  contracts: DenikContract[];
  roles: DenikRole[];
  bills: DenikBill[];
  reviews: DenikReview[];
  /** Proud „zaznamenáno" (5C). Volitelný: starší volající deník nemění. */
  changes?: DenikChange[];
  /** Dnešek podle serveru — záznam s pozdějším datem je vada dat, ne novinka. */
  today: string;
}

// ── Sestavení záznamů ───────────────────────────────────────────────────────

const KIND_ORDER: Record<DenikKind, number> = {
  contract: 0,
  billAssigned: 1,
  billPublished: 2,
  roleStart: 3,
  roleEnd: 4,
  review: 5,
  change: 6,
  mandate: 7,
  organRole: 8,
};

const mpEntity = (pspId: number, name: string): DenikEntity => ({
  key: mpEntityKey(pspId),
  label: name,
  href: `/poslanec/${pspId}`,
});

/**
 * Firma má vlastní spis od 2026-08-04 (/penize/firma/[ico]) — do té doby tu
 * stálo `href: null` a řádek o smlouvě vedl na profil poslance.
 *
 * IČO SE VALIDUJE, NE OŘEŽE (oprava 2026-08-04). Klíč se stavěl ze SUROVÉHO
 * IČO (`firma:${ico}`), zatímco adresa spisu z kanonického — dvě podoby jedné
 * firmy na jednom řádku. Horší: prázdné nebo chybějící IČO dalo klíč `firma:`,
 * pod který spadly VŠECHNY firmy bez IČO dohromady, a filtr `?entita=firma:`
 * by pak ukázal řádky o nesouvisejících firmách jako jednu entitu (schránka
 * takový klíč navíc mlčky odmítá — `isEntityKey` chce `\d{6,8}`). Nekanonické
 * IČO proto entitu firmy NEVYDÁ vůbec: řádek se zobrazí dál (jméno firmy je ve
 * větě), jen bez čipu a bez odkazu, a loader ten počet přizná.
 */
const companyEntity = (ico: string | null, company: string): DenikEntity | null => {
  const canonical = ico === null ? null : canonicalIco(ico);
  if (canonical === null) return null;
  return {
    key: companyEntityKey(canonical),
    label: company,
    href: `/penize/firma/${canonical}`,
  };
};

const billEntity = (cislo: number): DenikEntity => ({
  key: billEntityKey(cislo),
  label: `sn. tisk ${cislo}`,
  href: `/zakony/${cislo}`,
});

const firstHref = (entities: DenikEntity[]): string | null =>
  entities.find((e) => e.href !== null)?.href ?? null;

type RawEntry = Omit<DenikEntry, "date"> & { date: string | null };

/** `YYYY-MM-DD` z ISO timestampu; nevalidní vstup → null (řádek se počítá jako
 *  vyhozený, nikdy se nedatuje odhadem). */
const datePart = (iso: string | null): string | null => {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/**
 * Jedna smlouva = JEDEN řádek (oprava 2026-08-04). Loader posílá jeden vstup na
 * dvojici (firma, smlouva), a uzel smlouvy může viset na VÍC dodavatelských
 * firem — na živém grafu 5 uzlů ze 4 380 vydávalo dva řádky s TÝMŽ id, tedy
 * duplicitní React key a duplicitní guid ve feedu (čtečka by tutéž smlouvu
 * ukázala dvakrát). Řádky se proto slévají podle id uzlu:
 *   – dodavatelé se vypisují všichni, seřazení podle IČO (determinismus),
 *   – poslanci se SJEDNOTÍ (řádek patří všem, jimž se smlouva smí přisoudit),
 *   – `pending` je disjunkce (stačí jedna nezkontrolovaná vazba),
 *   – ČÁSTKA se slévá jen tehdy, když se všechny shodují; jinak řádek částku
 *     NEUVEDE a vrátí to jako `amountConflicts` — vybrat jednu z rozporných
 *     hodnot by znamenalo vymyslet peníze.
 */
interface MergedContracts {
  entries: RawEntry[];
  /** Kolik vstupních řádků slévání pohltilo (počet = duplicity v korpusu). */
  merged: number;
  /** Kolik slitých smluv nese rozporné částky, a proto žádnou. */
  amountConflicts: number;
}

function mergeContracts(contracts: readonly DenikContract[]): MergedContracts {
  const byNode = new Map<string, DenikContract[]>();
  let merged = 0;
  for (const c of contracts) {
    if (c.mps.length === 0) continue; // bez přisouditelné vazby smlouva do deníku nepatří
    const prev = byNode.get(c.id);
    if (prev) {
      prev.push(c);
      merged += 1;
    } else {
      byNode.set(c.id, [c]);
    }
  }

  let amountConflicts = 0;
  const entries: RawEntry[] = [];
  for (const [id, group] of byNode) {
    const suppliers = [...group].sort(
      (a, b) => (a.ico ?? "").localeCompare(b.ico ?? "") || a.company.localeCompare(b.company),
    );
    const first = suppliers[0];

    const mps = new Map<number, { pspId: number; name: string; pending: boolean }>();
    for (const s of suppliers) {
      for (const m of s.mps) {
        const prev = mps.get(m.pspId);
        mps.set(m.pspId, prev ? { ...prev, pending: prev.pending || m.pending } : m);
      }
    }
    const mpList = [...mps.values()].sort((a, b) => a.pspId - b.pspId);

    const amounts = suppliers
      .map((s) => s.amountCzk)
      .filter((a): a is number => typeof a === "number" && Number.isFinite(a));
    const agreed = amounts.length > 0 && amounts.every((a) => a === amounts[0]);
    if (amounts.length > 1 && !agreed) amountConflicts += 1;

    const entities: DenikEntity[] = [];
    for (const s of suppliers) {
      const en = companyEntity(s.ico, s.company);
      // Táž firma může být v poli dvakrát jen chybou vstupu; klíč to zachytí.
      if (en && !entities.some((x) => x.key === en.key)) entities.push(en);
    }
    for (const m of mpList) entities.push(mpEntity(m.pspId, m.name));

    entries.push({
      id: `contract:${id}`,
      date: datePart(first.signedOn),
      kind: "contract",
      titleCs: `podepsána smlouva — ${suppliers.map((s) => s.company).join(" + ")}: ${first.title}`,
      czk: agreed ? amounts[0] : undefined,
      pending: mpList.some((m) => m.pending),
      timeBasis: "ucinne",
      source: SOURCE_CONTRACT,
      tone: "signal",
      entities,
      internalHref: firstHref(entities),
    });
  }
  return { entries, merged, amountConflicts };
}

/**
 * Jeden change event → jeden řádek deníku. Věta je vždy o tom, co záznam
 * SKUTEČNĚ nese: mandátové a orgánové eventy vznikají diffem snímků psp.cz,
 * takže se říká „v evidenci", ne „poslanec přišel o mandát" — snímek nemluví
 * o důvodu ani o okamžiku, jen o tom, že řádek v dumpu už není.
 *
 * Řádky mandátu a funkce ve sněmovním orgánu mají VLASTNÍ druhy (`mandate`,
 * `organRole`): pod společné „zápis do grafu" by zánik mandátu vypadal jako
 * technická událost úložiště, což není.
 */
function changeEntry(ch: DenikChange): RawEntry {
  const entities: DenikEntity[] = [];
  if (ch.pspId !== null) entities.push(mpEntity(ch.pspId, ch.mpName ?? `poslanec ${ch.pspId}`));
  const company = companyEntity(ch.ico, ch.company ?? (ch.ico ? `IČO ${ch.ico}` : ""));
  if (company) entities.push(company);

  const companyCs = ch.company ?? (ch.ico ? `IČO ${ch.ico}` : "neurčená firma");
  const mpCs = ch.mpName ?? (ch.pspId !== null ? `poslanec ${ch.pspId}` : "neurčená osoba");
  const term = ch.termCode ? ` (období ${ch.termCode})` : "";
  const fn = ch.functionNameCz ? `: ${ch.functionNameCz}` : "";

  const kind: DenikKind = ch.eventType.startsWith("mandate-")
    ? "mandate"
    : ch.eventType.startsWith("role-")
      ? "organRole"
      : "change";

  let titleCs: string;
  let tone: DenikEntry["tone"];
  switch (ch.eventType) {
    case "tie-new":
      titleCs = `zaznamenána nová vazba — ${mpCs} ↔ ${companyCs}`;
      tone = "cobalt";
      break;
    case "tie-changed":
      titleCs = `zaznamenána změna vazby — ${mpCs} ↔ ${companyCs}`;
      tone = "cobalt";
      break;
    case "contract-new":
      titleCs = `zaznamenána smlouva v grafu — ${companyCs}${ch.contractLabel ? `: ${ch.contractLabel}` : ""}`;
      tone = "signal";
      break;
    case "mandate-new":
      titleCs = `zaznamenán vznik mandátu v evidenci — ${mpCs}${term}`;
      tone = "cobalt";
      break;
    case "mandate-changed":
      titleCs = `zaznamenána změna mandátu v evidenci — ${mpCs}${term}`;
      tone = "cobalt";
      break;
    case "mandate-removed":
      titleCs = `zaznamenán zánik mandátu v evidenci — ${mpCs}${term}`;
      tone = "ochre";
      break;
    case "role-new":
      titleCs = `zaznamenán vznik funkce ve sněmovním orgánu — ${mpCs}${fn}`;
      tone = "cobalt";
      break;
    case "role-changed":
      titleCs = `zaznamenána změna funkce ve sněmovním orgánu — ${mpCs}${fn}`;
      tone = "cobalt";
      break;
    case "role-removed":
      titleCs = `zaznamenán zánik funkce ve sněmovním orgánu — ${mpCs}${fn}`;
      tone = "ochre";
      break;
  }

  return {
    id: `change:${ch.id}`,
    date: datePart(ch.recordedAt),
    kind,
    titleCs,
    pending: ch.pending,
    timeBasis: "zaznamenano",
    // Zdroj je DOSLOVNÝ řetězec eventu (kg_edge_history / diff snímků psp.cz),
    // ne jméno tabulky, ve které event skončil. Chybí-li, řekne se aspoň ta.
    source: ch.source.length > 0 ? ch.source : SOURCE_CHANGE,
    tone,
    entities: entities.length > 0 ? entities : [{ key: `zaznam:${ch.id}`, label: titleCs, href: null }],
    internalHref: firstHref(entities),
  };
}

interface RawCollection {
  raw: RawEntry[];
  mergedContractRows: number;
  contractAmountConflicts: number;
}

function collectRaw(input: DenikInput): RawCollection {
  const contracts = mergeContracts(input.contracts);
  const raw: RawEntry[] = [...contracts.entries];

  for (const r of input.roles) {
    const company = companyEntity(r.ico, r.company);
    const entities = [mpEntity(r.pspId, r.mpName), ...(company ? [company] : [])];
    const base = {
      pending: r.pending,
      timeBasis: "ucinne" as const,
      source: SOURCE_REGISTRY,
      tone: "cobalt" as const,
      entities,
      internalHref: firstHref(entities),
    };
    raw.push({
      // Klíč řádku: IČO, a když ho firma nemá, její JMÉNO — dvě firmy bez IČO
      // u jednoho poslance by pod `role-from:<pspId>:null` splynuly v jeden
      // řádek a jedna z rolí by z deníku beze stopy zmizela.
      id: `role-from:${r.pspId}:${r.ico ?? `bez-ico|${r.company}`}`,
      date: datePart(r.validFrom),
      kind: "roleStart",
      titleCs: `zápis role v rejstříku — ${r.mpName}: ${r.role} — ${r.company}`,
      ...base,
    });
    raw.push({
      id: `role-to:${r.pspId}:${r.ico ?? `bez-ico|${r.company}`}`,
      date: datePart(r.validTo),
      kind: "roleEnd",
      titleCs: `výmaz role v rejstříku — ${r.mpName}: ${r.role} — ${r.company}`,
      ...base,
    });
  }

  for (const b of input.bills) {
    const entities = [billEntity(b.cislo), ...b.sponsors.map((s) => mpEntity(s.pspId, s.name))];
    const base = {
      pending: false,
      timeBasis: "ucinne" as const,
      source: SOURCE_PSP,
      tone: "ink" as const,
      entities,
      internalHref: firstHref(entities),
    };
    for (const c of b.committees) {
      raw.push({
        id: `assigned:${b.cislo}:${c.organLabel}`,
        date: datePart(c.assignedOn),
        kind: "billAssigned",
        titleCs: `sn. tisk ${b.cislo} přikázán výboru — ${c.organLabel}`,
        ...base,
      });
    }
    if (b.fateSb) {
      raw.push({
        id: `published:${b.cislo}`,
        date: datePart(b.fatePublishedOn),
        kind: "billPublished",
        titleCs: `sn. tisk ${b.cislo} vyhlášen ve Sbírce — ${b.fateSb}`,
        ...base,
      });
    }
  }

  for (const rv of input.reviews) {
    const entities: DenikEntity[] = [];
    if (rv.pspId !== null) entities.push(mpEntity(rv.pspId, rv.mpName));
    const rvCompany = companyEntity(rv.ico, rv.company);
    if (rvCompany) entities.push(rvCompany);
    raw.push({
      id: `review:${rv.id}`,
      date: datePart(rv.decidedAt),
      kind: "review",
      titleCs: `${DECISION_CS[rv.decision]} — ${rv.mpName} ↔ ${rv.company}`,
      // Rozhodnutí brány JE rozhodnutí — nevisí na ničem nezkontrolovaném.
      pending: false,
      // Datum rozhodnutí je datem zápisu — brána byla záznamovým časem vždy.
      timeBasis: "zaznamenano",
      source: SOURCE_GATE,
      tone: "ochre",
      entities: entities.length > 0 ? entities : [{ key: `zaznam:${rv.id}`, label: `${rv.mpName} ↔ ${rv.company}`, href: null }],
      internalHref: firstHref(entities),
    });
  }

  // Proud „zaznamenáno" (5C): typované change eventy, datované dnem ZÁZNAMU.
  for (const ch of input.changes ?? []) {
    raw.push(changeEntry(ch));
  }

  return { raw, mergedContractRows: contracts.merged, contractAmountConflicts: contracts.amountConflicts };
}

const entryCompare = (a: DenikEntry, b: DenikEntry): number => {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return a.id.localeCompare(b.id);
};

export interface DenikEntries {
  /** Všechny datované, možné záznamy — dny sestupně, uvnitř dne deterministicky. */
  entries: DenikEntry[];
  droppedImplausible: number;
  mergedContractRows: number;
  contractAmountConflicts: number;
}

/** Krok 1: záznamy z celého korpusu, datované a seřazené. */
export function deriveDenikEntries(input: DenikInput): DenikEntries {
  const { raw, mergedContractRows, contractAmountConflicts } = collectRaw(input);
  const dated = raw.filter((r) => r.date !== null);
  const plausible = dated.filter((r) => r.date! >= PLAUSIBLE_FROM && r.date! <= input.today);
  const entries = (plausible as DenikEntry[]).slice().sort(entryCompare);
  return {
    entries,
    droppedImplausible: dated.length - plausible.length,
    mergedContractRows,
    contractAmountConflicts,
  };
}

/** Krok 2 (čistý filtr „sledovat entitu"): záznamy, jejichž entity nesou klíč. */
export function filterDenikEntries(entries: readonly DenikEntry[], entityKey: string): DenikEntry[] {
  return entries.filter((e) => e.entities.some((en) => en.key === entityKey));
}

/** Popisek sledované entity, jak ho nesou samotné záznamy (žádný extra lookup). */
export function entityLabel(entries: readonly DenikEntry[], entityKey: string): string | null {
  for (const e of entries) {
    const hit = e.entities.find((en) => en.key === entityKey);
    if (hit) return hit.label;
  }
  return null;
}

/** Krok 3: seskupení po dnech + seříznutí na posledních `daysShown` zapsaných dnů. */
export function groupDenikDays(
  entries: readonly DenikEntry[],
  daysShown: number = DAYS_SHOWN,
): { days: DenikDay[]; daysTotal: number } {
  const byDate = new Map<string, DenikEntry[]>();
  for (const e of entries) {
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));
  const days = dates.slice(0, Math.max(0, daysShown)).map((date) => ({
    date,
    anchor: dayAnchor(date),
    entries: byDate.get(date)!,
  }));
  return { days, daysTotal: dates.length };
}

export interface DenikView {
  ledger: DenikLedger;
  /** Popisek sledované entity; null = bez filtru, nebo klíč v záznamech není. */
  entityLabelCs: string | null;
}

/**
 * Celý deník jedním voláním: odvození → volitelný filtr entity → dny.
 * Filtr se řeže na dny AŽ PO vyfiltrování, aby entita dostala svých posledních
 * N zapsaných dnů, ne průnik s posledními dny celku. Popisek entity se bere ze
 * VŠECH záznamů (mimo filtr by byl týž) — jedno odvození, žádný extra lookup.
 */
export function buildDenik(input: DenikInput, entityKey?: string | null): DenikView {
  const { entries, droppedImplausible, mergedContractRows, contractAmountConflicts } =
    deriveDenikEntries(input);
  const scoped = entityKey ? filterDenikEntries(entries, entityKey) : entries;
  const { days, daysTotal } = groupDenikDays(scoped);
  return {
    ledger: {
      days,
      daysTotal,
      totalEntries: days.reduce((s, d) => s + d.entries.length, 0),
      consideredEntries: scoped.length,
      droppedImplausible,
      mergedContractRows,
      contractAmountConflicts,
    },
    entityLabelCs: entityKey ? entityLabel(entries, entityKey) : null,
  };
}
