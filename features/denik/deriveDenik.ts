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
  | "change";

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
}

/** Kolik zapsaných dnů stránka ukáže. Starší dny zůstávají dostupné přes filtr
 *  entity (filtr se řeže až po vyfiltrování) — plocha to přizná. */
export const DAYS_SHOWN = 30;

/** Kolik záznamů nesou strojové podoby deníku (RSS/JSON). */
export const FEED_ENTRIES = 100;

export const dayAnchor = (date: string): string => `d-${date}`;

/** Deterministický český den v týdnu z `YYYY-MM-DD` — bez Intl (server a
 *  klient mohou mít různé verze ICU; toLocaleDateString by rozjelo hydrataci). */
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
  ico: string;
  /** Poslanci, jimž se smlouvy firmy SMÍ přisoudit (vazba vlastník/jednatel). */
  mps: { pspId: number; name: string; pending: boolean }[];
}

export interface DenikRole {
  company: string;
  ico: string;
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
 * Typovaný change event z tabulky change_event (5C) — proud „zaznamenáno".
 * Loader NEPOSÍLÁ eventy typu review-decision: rozhodnutí brány už deník nese
 * ze svého vlastního čtení review_audit a duplikát by lhal o počtu událostí.
 */
export interface DenikChange {
  /** change_event.id — deterministický, vstupuje do id záznamu. */
  id: string;
  eventType: "tie-new" | "tie-changed" | "contract-new";
  /** ISO instant záznamu — den řádku je dnem ZÁZNAMU, ne účinnosti. */
  recordedAt: string;
  mpName: string | null;
  pspId: number | null;
  company: string | null;
  ico: string | null;
  /** Popisek smlouvy (uzlu), jen u contract-new, je-li v grafu. */
  contractLabel: string | null;
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
};

const mpEntity = (pspId: number, name: string): DenikEntity => ({
  key: mpEntityKey(pspId),
  label: name,
  href: `/poslanec/${pspId}`,
});

/** Firma má vlastní spis od 2026-08-04 (/penize/firma/[ico]) — do té doby tu
 *  stálo `href: null` a řádek o smlouvě vedl na profil poslance. IČO se
 *  normalizuje na kanonický osmimístný tvar (companyId.ts), protože právě tak
 *  je klíčovaný uzel firmy; nekanonické IČO by vedlo na prázdnou adresu. */
const companyEntity = (ico: string, company: string): DenikEntity => {
  const canonical = canonicalIco(ico);
  return {
    key: companyEntityKey(ico),
    label: company,
    href: canonical === null ? null : `/penize/firma/${canonical}`,
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

function collectRaw(input: DenikInput): RawEntry[] {
  const raw: RawEntry[] = [];

  for (const c of input.contracts) {
    if (c.mps.length === 0) continue; // bez přisouditelné vazby smlouva do deníku nepatří
    const entities = [companyEntity(c.ico, c.company), ...c.mps.map((m) => mpEntity(m.pspId, m.name))];
    raw.push({
      id: `contract:${c.id}`,
      date: datePart(c.signedOn),
      kind: "contract",
      titleCs: `podepsána smlouva — ${c.company}: ${c.title}`,
      czk: typeof c.amountCzk === "number" && Number.isFinite(c.amountCzk) ? c.amountCzk : undefined,
      pending: c.mps.some((m) => m.pending),
      timeBasis: "ucinne",
      source: SOURCE_CONTRACT,
      tone: "signal",
      entities,
      internalHref: firstHref(entities),
    });
  }

  for (const r of input.roles) {
    const entities = [mpEntity(r.pspId, r.mpName), companyEntity(r.ico, r.company)];
    const base = {
      pending: r.pending,
      timeBasis: "ucinne" as const,
      source: SOURCE_REGISTRY,
      tone: "cobalt" as const,
      entities,
      internalHref: firstHref(entities),
    };
    raw.push({
      id: `role-from:${r.pspId}:${r.ico}`,
      date: datePart(r.validFrom),
      kind: "roleStart",
      titleCs: `zápis role v rejstříku — ${r.mpName}: ${r.role} — ${r.company}`,
      ...base,
    });
    raw.push({
      id: `role-to:${r.pspId}:${r.ico}`,
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
    if (rv.ico !== null) entities.push(companyEntity(rv.ico, rv.company));
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
    const entities: DenikEntity[] = [];
    if (ch.pspId !== null) entities.push(mpEntity(ch.pspId, ch.mpName ?? `poslanec ${ch.pspId}`));
    if (ch.ico !== null) entities.push(companyEntity(ch.ico, ch.company ?? `IČO ${ch.ico}`));
    const companyCs = ch.company ?? (ch.ico ? `IČO ${ch.ico}` : "neurčená firma");
    const mpCs = ch.mpName ?? (ch.pspId !== null ? `poslanec ${ch.pspId}` : "neurčená osoba");
    const titleCs =
      ch.eventType === "tie-new"
        ? `zaznamenána nová vazba — ${mpCs} ↔ ${companyCs}`
        : ch.eventType === "tie-changed"
          ? `zaznamenána změna vazby — ${mpCs} ↔ ${companyCs}`
          : `zaznamenána smlouva v grafu — ${companyCs}${ch.contractLabel ? `: ${ch.contractLabel}` : ""}`;
    raw.push({
      id: `change:${ch.id}`,
      date: datePart(ch.recordedAt),
      kind: "change",
      titleCs,
      pending: ch.pending,
      timeBasis: "zaznamenano",
      source: SOURCE_CHANGE,
      tone: ch.eventType === "contract-new" ? "signal" : "cobalt",
      entities:
        entities.length > 0 ? entities : [{ key: `zaznam:${ch.id}`, label: titleCs, href: null }],
      internalHref: firstHref(entities),
    });
  }

  return raw;
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
}

/** Krok 1: záznamy z celého korpusu, datované a seřazené. */
export function deriveDenikEntries(input: DenikInput): DenikEntries {
  const raw = collectRaw(input);
  const dated = raw.filter((r) => r.date !== null);
  const plausible = dated.filter((r) => r.date! >= PLAUSIBLE_FROM && r.date! <= input.today);
  const entries = (plausible as DenikEntry[]).slice().sort(entryCompare);
  return { entries, droppedImplausible: dated.length - plausible.length };
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
  const { entries, droppedImplausible } = deriveDenikEntries(input);
  const scoped = entityKey ? filterDenikEntries(entries, entityKey) : entries;
  const { days, daysTotal } = groupDenikDays(scoped);
  return {
    ledger: {
      days,
      daysTotal,
      totalEntries: days.reduce((s, d) => s + d.entries.length, 0),
      consideredEntries: scoped.length,
      droppedImplausible,
    },
    entityLabelCs: entityKey ? entityLabel(entries, entityKey) : null,
  };
}
