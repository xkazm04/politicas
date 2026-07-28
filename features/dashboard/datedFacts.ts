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
 * 4. CO STOJÍ NA NEOVĚŘENÉ VAZBĚ, JE OZNAČENO. Smlouva i role visí na
 *    `linked_to`, které čeká na lidskou kontrolu; řádek to říká.
 * 5. PENÍZE JEN TAM, KAM SE SMÍ PŘISOUDIT. Smlouvy institucí, kde poslanec jen
 *    zasedá v orgánu (steward), do knihy nepatří — jsou to peníze té instituce.
 *    Filtr dělá volající tím, co sem pošle.
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

export interface DatedFactLedger {
  facts: DatedFact[];
  /** Kolik faktů mělo nemožné datum a bylo vyhozeno (nikdy opraveno). */
  droppedImplausible: number;
  /** Kolik datovaných faktů výřez celkem nabídl, než se seřízl na `FEED_ROWS`. */
  considered: number;
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
  pending: boolean;
}

export interface FactTie {
  company: string;
  mpName: string;
  role: string;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  refs: string[];
  pending: boolean;
}

export interface FactBill {
  cislo: number;
  refs: string[];
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

export function buildDatedFacts(input: DatedFactInput): DatedFactLedger {
  const { today } = input;
  const raw: (Omit<DatedFact, "date"> & { date: string | null })[] = [];

  for (const c of input.contracts) {
    if (c.refs.length === 0) continue;
    raw.push({
      id: `contract:${c.id}`,
      date: c.signedOn,
      kind: "contract",
      refs: c.refs,
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
    const base = { refs: t.refs, subject: t.mpName, detail: `${t.role} — ${t.company}`, pending: t.pending, source: SOURCE_REGISTRY, tone: "cobalt" as const };
    raw.push({ id: `role-from:${t.refs.join("|")}`, date: t.roleValidFrom, kind: "roleStart", ...base });
    raw.push({ id: `role-to:${t.refs.join("|")}`, date: t.roleValidTo, kind: "roleEnd", ...base });
  }

  for (const b of input.bills) {
    if (b.refs.length === 0) continue;
    for (const c of b.committees) {
      raw.push({
        id: `assigned:${b.cislo}:${c.organLabel}`,
        date: c.assignedOn,
        kind: "billAssigned",
        refs: b.refs,
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

  const facts = (plausible as DatedFact[])
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)))
    .slice(0, FEED_ROWS);

  return { facts, droppedImplausible, considered: plausible.length };
}
