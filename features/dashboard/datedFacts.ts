/*
 * Provoz grafu jako KNIHA DATOVANÝCH FAKTŮ — čistá funkce, žádná beletrie.
 *
 * Znalostní graf nevede changelog, takže „co se v grafu změnilo" se nedá
 * postavit poctivě. Vede ale DATOVANÁ FAKTA: smlouvy s datem podpisu a
 * částkou, přikázání tisku výboru s datem, vyhlášení ve Sbírce, zápis a výmaz
 * role v obchodním rejstříku. Chronologická kniha těchto faktů je poctivá
 * verze téhož produktu — a jediné, co dá titulní straně důvod se mezi
 * návštěvami změnit.
 *
 * ── PRAVIDLA, KTERÁ SE NESMÍ PORUŠIT ────────────────────────────────────────
 *
 * 1. ŽÁDNÁ VYMYŠLENÁ VĚTA, DATUM ANI ČÁSTKA. Řádek je typovaný fakt; větu
 *    kolem něj sází i18n šablona. Co graf nenese, se nezobrazí.
 * 2. FAKT BEZ MOŽNÉHO DATA NENÍ DATOVANÝ FAKT. Korpus smluv obsahuje podpisy
 *    v roce 0002, 2027, 2029 i 3062. Takový řádek do chronologie nepatří —
 *    vyhazuje se, počítá se a plocha ten počet přizná. Datum se NIKDY neopravuje.
 * 3. KAŽDÝ ŘÁDEK MUSÍ TREFIT UZEL VE VÝŘEZU. Fakt, jehož entity plátno
 *    nekreslí, by měl mrtvý zaměřovač — do knihy se nedostane.
 * 3b. ZAMĚŘOVAČ PŘIPÍNÁ PODMĚT VĚTY, ne první prvek pole. Pravidlo je
 *    explicitní (`subjectRef`, viz níž), protože pořadí v `refs` je detail
 *    sestavení — kdyby o výběru rozhodovalo, stačilo by prohodit dva řádky ve
 *    stateSlice.ts a zaměřovač by beze slova začal připínat něco jiného.
 * 3c. `refs` JE FILTR, `subjectRef` PODMĚT — a jsou to dvě různá pole právě
 *    proto, aby se `refs` daly rozšířit (které uzly řádek rozsvítí), aniž by se
 *    hnul zaměřovač. Které uzly to jsou, rozhoduje výhradně stateSlice.ts;
 *    tenhle modul je jen přebírá a nikdy si k nim žádný nedomýšlí.
 * 4. CO STOJÍ NA NEOVĚŘENÉ VAZBĚ, JE OZNAČENO. Smlouva i role visí na
 *    `linked_to`, které čeká na lidskou kontrolu; řádek to říká.
 * 5. PENÍZE JEN TAM, KAM SE SMÍ PŘISOUDIT. Smlouvy institucí, kde poslanec jen
 *    zasedá v orgánu (steward), do knihy nepatří — jsou to peníze té instituce.
 *    Filtr dělá volající tím, co sem pošle.
 * 6. OKNO KNIHY NENÍ HRANICE ODVODITELNOSTI. `facts` nese jen `FEED_ROWS`
 *    nejnovějších řádků, protože panel je rubrika, ne výpis logu. Kdo se ptá na
 *    KONKRÉTNÍ fakt (exponát /dashboard/exponat/…, brána /overeni), staví tutéž
 *    knihu BEZ seříznutí (`limit: null`) — jinak by citovaný řádek umřel
 *    dvanáctým novějším faktem, ačkoli ho týž průchod pořád odvozuje, a brána by
 *    o existujícím záznamu odpovídala „zaznam-nenalezen".
 *
 * ── PROČ PARAMETR, A NE DRUHÝ SEZNAM V KNIZE ────────────────────────────────
 * Zvažovaná varianta byla `DatedFactLedger.lookup` (plná množina vedle okna).
 * Odmítnuta: kniha by pak měla DVA tvary téhož obsahu a ten širší by musel
 * vypadnout na drátě (features/dashboard/publicWire.ts) — tedy další místo,
 * kde se dá tiše zapomenout. Seříznutí je rozhodnutí VOLAJÍCÍHO: titulní strana
 * si ho vyžádá (výchozí `FEED_ROWS`), rozlišovací cesta exponátu ne. Kniha má
 * pořád jeden tvar, drát se nemění a `locateDatedFact()` níž řekne oběma
 * volajícím totéž.
 *
 * ── POŘADÍ ──────────────────────────────────────────────────────────────────
 * Datum sestupně, při shodě id vzestupně. Nic jiného. Dvě sestavení téhož
 * vstupu proto dají tutéž knihu.
 */

export type DatedFactKind = "contract" | "roleStart" | "roleEnd" | "billAssigned" | "billPublished";

export interface DatedFact {
  /** Deterministické id — nese ho i React key a rozhoduje shodu dat. */
  id: string;
  /** `YYYY-MM-DD`, vždy v možném rozsahu (viz `PLAUSIBLE_FROM`). */
  date: string;
  kind: DatedFactKind;
  /** Id uzlů výřezu, které řádek rozsvítí. Nikdy prázdné. */
  refs: string[];
  /**
   * Uzel, který zaměřovač připne — PODMĚT věty toho faktu (firma u smlouvy,
   * poslanec u rejstříkové role, tisk u legislativního kroku). `null` znamená,
   * že podmět v tomhle výřezu nakreslený není; řádek to pak řekne a zaměřovač
   * nenabídne, místo aby připnul jinou entitu, o které řádek není.
   */
  subjectRef: string | null;
  /** Hlavní entita věty (firma, poslanec, tisk). */
  subject: string;
  /** Druhá entita nebo název dokumentu — podle druhu faktu. */
  detail?: string;
  /** Částka v Kč. Číslo — formátuje ji klient podle locale. */
  czk?: number;
  /** Fakt stojí na vazbě, která čeká na lidskou kontrolu. */
  pending: boolean;
  /** Doslovné jméno registru, ze kterého fakt pochází. */
  source: string;
  tone: "signal" | "cobalt" | "ink";
}

/**
 * JAK DOPADLO ČTENÍ SMLUVNÍ VRSTVY KNIHY — sourozenec pravidla 2 v hlavičce.
 *
 * Kniha se složí i tehdy, když se smlouvy nepřečtou: zbydou rejstříkové role a
 * kroky tisků a plocha vypadá zdravě. „Výřez nemá přisouditelnou smlouvu" a
 * „smlouvy se nepodařilo přečíst" jsou přitom dvě různá tvrzení a jenom první
 * je o výřezu. Stav čtení proto putuje s knihou až na plochu.
 *
 * Nic se nedopočítává a nic neopravuje: čísla jsou to, co čtení skutečně
 * vidělo, a `failed` říká, že velikost mezery NEZNÁME — ne že je nulová.
 *
 * Typ bydlí tady (čistý modul), aby ho směl číst i klientský panel; hodnotu
 * plní loader, který jediný čte graf (features/dashboard/getDashboardData.ts).
 */
export interface ContractLayerRead {
  /** `ok` — každá firma výřezu přečtena celá · `truncated` — aspoň jedna vrátila
   *  přesně strop hran, takže její nejlevnější smlouvy v knize nejsou ·
   *  `failed` — čtení spadlo; kolik smluv chybí, nevíme. */
  state: "ok" | "truncated" | "failed";
  /** Kolik firem výřezu se četlo. */
  companies: number;
  /** Kolik z nich se vrátilo přesně na stropu. */
  truncatedCompanies: number;
  /** Ten strop — vlastní evidence věty o useknutí. */
  edgeCap: number;
}

export interface DatedFactLedger {
  /** Řádky knihy — datum sestupně. Seříznuté podle `DatedFactOptions.limit`
   *  (výchozí `FEED_ROWS`); bez seříznutí je to celá možná množina. */
  facts: DatedFact[];
  /** Kolik faktů mělo nemožné datum a bylo vyhozeno (nikdy opraveno). */
  droppedImplausible: number;
  /** Kolik datovaných faktů výřez celkem nabídl, než se seřízl na `FEED_ROWS`. */
  considered: number;
}

export interface DatedFactOptions {
  /**
   * Kolik nejnovějších řádků kniha ponese. Výchozí `FEED_ROWS` (rubrika velína);
   * `null` = bez seříznutí, což je cesta rozlišení jednoho citovaného faktu
   * (viz pravidlo 6 v hlavičce). Nikdy se nepředává na drát — plnou knihu čte
   * jen server.
   */
  limit?: number | null;
}

/** Registr smluv začíná 2016, ale rejstříkové role sahají do 90. let; hranice je
 *  vznik ČR. Pod ní a nad „dnes" už nejde o datum, ale o vadu dat. */
export const PLAUSIBLE_FROM = "1993-01-01";

/** Kolik řádků kniha ukáže. Panel scrolluje; víc řádků z něj dělá výpis logu. */
export const FEED_ROWS = 12;

// ── Vstup ───────────────────────────────────────────────────────────────────

export interface FactContract {
  /** id uzlu smlouvy v grafu — vstupuje do id faktu, takže je stabilní. */
  id: string;
  title: string;
  signedOn: string | null;
  amountCzk: number | null;
  company: string;
  /** Uzly výřezu, které tahle smlouva rozsvítí (firma, případně peníze). */
  refs: string[];
  /** Uzel firmy — podmět věty „podepsána smlouva — <firma>: …". */
  subjectRef: string;
  pending: boolean;
}

export interface FactTie {
  company: string;
  /**
   * Uzel firmy, u které role platí. Do IDENTITY faktu vstupuje tenhle uzel a
   * podmět — NE `refs`: ty se rozšiřují podle toho, co všechno výřez kolem
   * nakreslil (strana, peníze), a identita faktu se s tím pohnout nesmí.
   */
  companyRef: string;
  mpName: string;
  role: string;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  refs: string[];
  /** Uzel poslance — podmět věty „<poslanec> zapsán do rejstříku — …". */
  subjectRef: string;
  pending: boolean;
}

export interface FactBill {
  cislo: number;
  refs: string[];
  /** Uzel tisku — podmět věty „sn. tisk N přikázán výboru …". */
  subjectRef: string;
  committees: { organLabel: string; role: string; assignedOn: string | null }[];
  fateSb: string | null;
  fatePublishedOn: string | null;
}

export interface DatedFactInput {
  contracts: FactContract[];
  ties: FactTie[];
  bills: FactBill[];
  /** Dnešek podle serveru — fakt s pozdějším datem je vada dat, ne novinka.
   *  Předává se dovnitř, aby builder zůstal čistý a testovatelný. */
  today: string;
}

const SOURCE_CONTRACT = "registr smluv — smlouvy.gov.cz";
const SOURCE_REGISTRY = "ares — veřejný rejstřík";
const SOURCE_PSP = "psp.cz — historie tisku";

/**
 * PRAVIDLO RELEVANCE ZAMĚŘOVAČE. Podmět se připne jen tehdy, když ho výřez
 * skutečně kreslí — jinak `null` a řádek to přizná. Nikdy se nedosazuje náhrada
 * z `refs`: fakt „podepsána smlouva — ABC s.r.o." není o poslanci, i když je
 * poslanec v `refs` a firma ne.
 */
const subjectRefOf = (refs: string[], subjectRef: string): string | null =>
  refs.includes(subjectRef) ? subjectRef : null;

export function buildDatedFacts(
  input: DatedFactInput,
  options: DatedFactOptions = {},
): DatedFactLedger {
  const { today } = input;
  const limit = options.limit === undefined ? FEED_ROWS : options.limit;
  const raw: (Omit<DatedFact, "date"> & { date: string | null })[] = [];

  for (const c of input.contracts) {
    if (c.refs.length === 0) continue;
    raw.push({
      id: `contract:${c.id}`,
      date: c.signedOn,
      kind: "contract",
      refs: c.refs,
      subjectRef: subjectRefOf(c.refs, c.subjectRef),
      subject: c.company,
      detail: c.title,
      czk: c.amountCzk ?? undefined,
      pending: c.pending,
      source: SOURCE_CONTRACT,
      tone: "signal",
    });
  }

  for (const t of input.ties) {
    if (t.refs.length === 0) continue;
    const base = {
      refs: t.refs,
      subjectRef: subjectRefOf(t.refs, t.subjectRef),
      subject: t.mpName,
      detail: `${t.role} — ${t.company}`,
      pending: t.pending,
      source: SOURCE_REGISTRY,
      tone: "cobalt" as const,
    };
    // Identita = podmět + firma (viz FactTie.companyRef). Dřív to byl `refs`
    // spojený svislítkem, takže rozšíření filtru přepisovalo trvalé adresy
    // exponátů — id faktu nesmí záviset na tom, co je kolem něj nakresleno.
    const key = `${t.subjectRef}|${t.companyRef}`;
    raw.push({ id: `role-from:${key}`, date: t.roleValidFrom, kind: "roleStart", ...base });
    raw.push({ id: `role-to:${key}`, date: t.roleValidTo, kind: "roleEnd", ...base });
  }

  for (const b of input.bills) {
    if (b.refs.length === 0) continue;
    for (const c of b.committees) {
      raw.push({
        id: `assigned:${b.cislo}:${c.organLabel}`,
        date: c.assignedOn,
        kind: "billAssigned",
        refs: b.refs,
        subjectRef: subjectRefOf(b.refs, b.subjectRef),
        subject: `sn. tisk ${b.cislo}`,
        detail: c.organLabel,
        pending: false,
        source: SOURCE_PSP,
        tone: "ink",
      });
    }
    if (b.fateSb) {
      raw.push({
        id: `published:${b.cislo}`,
        date: b.fatePublishedOn,
        kind: "billPublished",
        refs: b.refs,
        subjectRef: subjectRefOf(b.refs, b.subjectRef),
        subject: `sn. tisk ${b.cislo}`,
        detail: b.fateSb,
        pending: false,
        source: SOURCE_PSP,
        tone: "ink",
      });
    }
  }

  // Datum, které v tomhle světě nemohlo nastat, není datum — řádek padá a počítá se.
  const dated = raw.filter((r) => r.date !== null);
  const plausible = dated.filter((r) => r.date! >= PLAUSIBLE_FROM && r.date! <= today);
  const droppedImplausible = dated.length - plausible.length;

  const ordered = (plausible as DatedFact[]).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id),
  );
  const facts = limit === null ? ordered : ordered.slice(0, limit);

  return { facts, droppedImplausible, considered: ordered.length };
}

/**
 * Kde jeden fakt stojí vůči OKNU titulní knihy — jediné pravidlo pro exponát
 * i pro bránu, aby se dvě plochy nerozešly v tom, co znamená „ten řádek už tu
 * není".
 *
 * `null` = dnešní průchod ten fakt neodvozuje (data se změnila, vazba zmizela,
 * datum se stalo nemožným) — to je opravdové „gone".
 * `beyondWindow: true` = fakt odvozený JE, jen sedí za `FEED_ROWS` nejnovějšími
 * řádky, které rubrika velína ukazuje. Řádek na to čtenáře upozorní; citace
 * zůstává platná, protože pořadí knihy je deterministické a okno je jen řez
 * jejím prefixem.
 *
 * Nad seříznutou knihou (`limit: FEED_ROWS`) `beyondWindow` z definice nikdy
 * nenastane — funkce je proto bezpečná na obou cestách.
 */
export function locateDatedFact(
  ledger: DatedFactLedger,
  factId: string,
): { fact: DatedFact; beyondWindow: boolean } | null {
  const index = ledger.facts.findIndex((f) => f.id === factId);
  if (index < 0) return null;
  return { fact: ledger.facts[index], beyondWindow: index >= FEED_ROWS };
}
