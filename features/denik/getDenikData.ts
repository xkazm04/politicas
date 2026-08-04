// Server-only: loader /denik — čte STRIKTNĚ read-only tři vrstvy, které už
// vlastní jiné loadery, a mapuje je na vstup čistého odvození (deriveDenik.ts):
//
//   1. Peněžní vrstva (getMoneyData) → rejstříkové role všech vazeb a smlouvy
//      PŘISOUDITELNÝCH firem (vlastník/jednatel — pravidlo /penize; steward
//      smlouvy jsou aktivitou instituce a do deníku poslanců nepatří).
//      Jednotlivé smlouvy se čtou indexovaně přes kgNeighbours po firmách,
//      nikdy scanem 153k řádků `supplies`.
//   2. Legislativní vrstva (getLawData) → přikázání výborům + vyhlášení ve
//      Sbírce.
//   3. Lidská brána (store.listReviewAudit + getKgNodes na labely) — jediný
//      append-only log; čte se ČERSTVĚ za requestu (rozhodnutí revizora se
//      nesmí opozdit o memo okno dávkových vrstev).
//   4. Proud „zaznamenáno" (change_event, 5C) — typované change eventy grafu
//      (nová vazba, změna vazby, smlouva v grafu), datované časem ZÁZNAMU.
//      Idempotentní backfill běží nejvýš jednou za memo okno; čtení eventů za
//      requestu. review-decision eventy se nepřebírají (viz readChanges).
//
// Dávkové vrstvy (1+2) jsou drahé (~12 s studený start peněz) a mění se jen
// s `npm run da:kg-compute` — memoizují se s expirací MONEY_MEMO_TTL_MS,
// stejná politika a stejné zdůvodnění jako features/dashboard/getDashboardData.
// Neúspěch se nememoizuje. Každá vrstva degraduje NEZÁVISLE; `coverage` říká
// ploše, které skupiny záznamů deník právě unese, a plocha to přizná.
// null vrací loader jen když nie je čitelná ŽÁDNÁ vrstva (úložiště nedostupné).

import "server-only";
import { reportLoaderFailure } from "@/lib/db/loaderGuard";
import { getStore } from "@/lib/db/store";
import { getChangesRepo } from "@/lib/db/pglite/repositories/changes";
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import { getMoneyData } from "@/features/money/getMoneyData";
import { isAttributable } from "@/features/money/reachableMoney";
import { canonicalIco } from "@/features/money/companyId";
import { getLawData } from "@/features/lawwatch/getLawData";
import { icoFromDst, pspIdFromSrc } from "@/features/dukazy/deriveFeed";
import { pragueDay } from "./pragueDay";
import { DENIK_CHANGE_TYPES } from "./deriveDenik";
import type {
  DenikBill,
  DenikChange,
  DenikChangeType,
  DenikContract,
  DenikReview,
  DenikRole,
} from "./deriveDenik";

export interface DenikCoverage {
  /** Peněžní vrstva čitelná → deník nese smlouvy a rejstříkové role. */
  money: boolean;
  /** Legislativní vrstva čitelná → deník nese přikázání a vyhlášení. */
  law: boolean;
  /** Lidská brána čitelná → deník nese rozhodnutí revizorů. */
  reviews: boolean;
  /** change_event čitelná → deník nese proud „zaznamenáno" (5C). */
  changes: boolean;
}

/**
 * MEZE ČTENÍ, SPOČÍTANÉ A PŘIZNANÉ (2026-08-04).
 *
 * Do téhle opravy hlásil loader jen strop FIREM (reportLoaderFailure do
 * konzole), zatímco strop HRAN na firmu (`kgNeighbours limit`) ořezával mlčky:
 * na živém grafu narazilo 5 z 35 čtených firem přesně na 500 hran, takže
 * **4 872 smluv** — víc, než kolik jich deník vůbec ukazoval — z ledgeru mizelo
 * bez jediné věty. Precedens je `droppedImplausible`: vyhozeno, spočítáno,
 * počet vypsán. Detekce je táž heuristika jako `warnIfTruncated` v lib/db
 * (výsledek délky přesně `limit` je pravděpodobně useknutý).
 */
export interface DenikLimits {
  /** Firem s vazbou vlastník/jednatel, jejichž smlouvy se četly. */
  contractCompanies: number;
  /** Strop firem; kolik jich ho přesáhlo (jejich smlouvy se nečetly vůbec). */
  companyCap: number;
  companiesOverCap: number;
  /** Strop hran na firmu; kolik firem na něj narazilo (starší smlouvy chybí). */
  edgeCap: number;
  companiesEdgeTruncated: number;
  /** Vazeb, jejichž IČO nelze převést na kanonický tvar → řádek bez čipu firmy. */
  malformedIco: number;
  /** change eventy typu review-decision — deník je ZÁMĚRNĚ nepřebírá (nese
   *  rozhodnutí brány ze svého čtení review_audit; duplikát by lhal o počtu). */
  changesFromGate: number;
  /** change eventy, jejichž typ deník neumí vyslovit — spočítané, ne zamlčené. */
  changesUndisplayable: number;
}

export interface DenikSourceData {
  contracts: DenikContract[];
  roles: DenikRole[];
  bills: DenikBill[];
  reviews: DenikReview[];
  changes: DenikChange[];
  coverage: DenikCoverage;
  limits: DenikLimits;
  /** Kolik řádků review_audit branou prošlo — cituje se v hlavičce plochy. */
  auditRows: number;
  /** `YYYY-MM-DD` v Europe/Prague — `today` čistého odvození a datum sestavení
   *  plochy. Pražský, ne UTC: deník je denní záznam ČESKÉ republiky a mezi
   *  půlnocí a druhou hodinou je pražský den o den napřed (features/denik/
   *  pragueDay.ts). Pod UTC dnem padala dnešní pražská smlouva za horní mez
   *  `date <= today` a započítala se do `droppedImplausible` — do čísla, kterým
   *  plocha přiznává vadná data v korpusu. */
  builtOn: string;
}

/** Strop firem, pro které se čtou jednotlivé smlouvy (bodové čtení po firmě).
 *  Přisouditelných firem je dnes 57; strop je pojistka proti budoucímu růstu
 *  korpusu, a když se dosáhne, plocha to přizná (DenikLimits). */
const MAX_CONTRACT_COMPANIES = 500;

/** Strop hran `supplies` na JEDNU firmu. Byl 500 a mlčky ořezával: 5 firem
 *  živého grafu má 580–2 387 smluv, dohromady 4 872 řádků, které do deníku
 *  nikdy nedorazily. Nový strop je nad dnešním maximem s rezervou (měřeno:
 *  čtení všech 57 firem stálo 1 468 ms proti 1 009 ms při stropu 500, a děje
 *  se jednou za memo okno), a když na něj firma přesto narazí, plocha to
 *  přizná — pojistka smí data ztratit, ale ne potichu. */
const MAX_CONTRACT_EDGES = 5_000;

// ── dávkové vrstvy: memo s expirací (viz hlavička) ──────────────────────────

/** Meze, které umí spočítat jen peněžní čtení (zbytek DenikLimits přidá vstupní bod). */
type MoneyLimits = Pick<
  DenikLimits,
  "contractCompanies" | "companiesOverCap" | "companiesEdgeTruncated" | "malformedIco"
>;

interface BatchLayers {
  contracts: DenikContract[];
  roles: DenikRole[];
  bills: DenikBill[];
  moneyOk: boolean;
  lawOk: boolean;
  moneyLimits: MoneyLimits;
}

let batchPromise: Promise<BatchLayers> | null = null;
let batchMemoAt = 0;

async function readMoneyLayers(): Promise<{
  contracts: DenikContract[];
  roles: DenikRole[];
  ok: boolean;
  limits: MoneyLimits;
}> {
  const limits: MoneyLimits = {
    contractCompanies: 0,
    companiesOverCap: 0,
    companiesEdgeTruncated: 0,
    malformedIco: 0,
  };
  try {
    const money = await getMoneyData();
    if (!money) {
      reportLoaderFailure(
        "getDenikData.money",
        new Error("peněžní vrstva nedostupná — deník degraduje bez smluv a rolí"),
      );
      return { contracts: [], roles: [], ok: false, limits };
    }

    // Rejstříkové role: každá vazba je fakt o poslanci, i steward — role sama
    // není penězi. Přisouditelnost omezuje jen SMLOUVY níž.
    const roles: DenikRole[] = [];
    // Přisouditelné firmy → jejich smlouvy smí deník nést; jedna firma může
    // vázat víc poslanců (smlouva je fakt o firmě, poslanci jsou entity filtru).
    const attributable = new Map<
      string,
      {
        kgId: string;
        ico: string | null;
        company: string;
        mps: { pspId: number; name: string; pending: boolean }[];
      }
    >();

    for (const mp of money.mps) {
      for (const t of mp.ties) {
        const pending = t.reviewState !== "verified";
        // IČO se VALIDUJE tady, jednou, TOUŽ funkcí, jakou se klíčuje uzel
        // firmy (features/money/companyId.ts) — nekanonické IČO by v deníku
        // dalo klíč entity, který schránka mlčky odmítne, a odkaz do prázdna.
        const ico = canonicalIco(t.ico ?? "");
        if (ico === null) limits.malformedIco += 1;
        roles.push({
          company: t.company,
          ico,
          mpName: mp.name,
          pspId: mp.pspId,
          role: t.role,
          validFrom: t.roleValidFrom ?? null,
          validTo: t.roleValidTo ?? null,
          pending,
        });
        // Pravidlo /penize, JEDNOU napsané (features/money/reachableMoney.ts) — tady
        // stávala třetí kopie téhož testu na třídu vazby.
        if (!isAttributable(t.tieClass)) continue;
        const existing = attributable.get(t.companyId) ?? {
          kgId: t.companyId,
          ico,
          company: t.company,
          mps: [],
        };
        existing.mps.push({ pspId: mp.pspId, name: mp.name, pending });
        attributable.set(t.companyId, existing);
      }
    }

    // Deterministické pořadí čtení + strop (viz MAX_CONTRACT_COMPANIES).
    const companies = [...attributable.values()].sort((a, b) =>
      (a.ico ?? a.kgId).localeCompare(b.ico ?? b.kgId),
    );
    limits.companiesOverCap = Math.max(0, companies.length - MAX_CONTRACT_COMPANIES);
    if (limits.companiesOverCap > 0) {
      reportLoaderFailure(
        "getDenikData.contracts",
        new Error(
          `přisouditelných firem ${companies.length} > strop ${MAX_CONTRACT_COMPANIES} — smlouvy nad stropem se nečtou`,
        ),
      );
    }

    const contracts: DenikContract[] = [];
    const store = await getStore();
    if (store) {
      const read = companies.slice(0, MAX_CONTRACT_COMPANIES);
      limits.contractCompanies = read.length;
      for (const c of read) {
        const { edges, nodes } = await store.kgNeighbours({
          id: c.kgId,
          rels: ["supplies"],
          limit: MAX_CONTRACT_EDGES,
        });
        // Táž heuristika jako warnIfTruncated (lib/db/pglite/internals.ts):
        // výsledek přesně délky stropu je pravděpodobně useknutý, a protože je
        // dotaz řazený, useknutý systematicky.
        if (edges.length >= MAX_CONTRACT_EDGES) {
          limits.companiesEdgeTruncated += 1;
          reportLoaderFailure(
            "getDenikData.contracts",
            new Error(
              `firma ${c.kgId} vrátila přesně strop ${MAX_CONTRACT_EDGES} hran supplies — starší smlouvy se nepřečetly`,
            ),
          );
        }
        const byId = new Map(nodes.map((n) => [n.id, n]));
        for (const e of edges) {
          const node = byId.get(e.dst);
          if (!node) continue;
          const signedOn = node.props?.signedOn;
          const amount = typeof e.weight === "number" ? e.weight : node.props?.amount;
          contracts.push({
            id: node.id,
            title: node.label,
            signedOn: typeof signedOn === "string" ? signedOn : null,
            amountCzk: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
            company: c.company,
            ico: c.ico,
            mps: [...c.mps].sort((a, b) => a.pspId - b.pspId),
          });
        }
      }
    } else if (companies.length > 0) {
      reportLoaderFailure(
        "getDenikData.contracts",
        new Error("úložiště nedostupné — smlouvy přisouditelných firem se nepřečetly"),
      );
    }

    return { contracts, roles, ok: true, limits };
  } catch (err) {
    reportLoaderFailure("getDenikData.money", err);
    return { contracts: [], roles: [], ok: false, limits };
  }
}

async function readLawLayer(): Promise<{ bills: DenikBill[]; ok: boolean }> {
  try {
    const law = await getLawData();
    if (!law) {
      reportLoaderFailure(
        "getDenikData.law",
        new Error("legislativní vrstva nedostupná — deník degraduje bez tisků"),
      );
      return { bills: [], ok: false };
    }
    const bills: DenikBill[] = law.bills.flatMap((b) => {
      if (b.cislo === null) return [];
      return [
        {
          cislo: b.cislo,
          title: b.title,
          sponsors: b.sponsors.map((s) => ({ pspId: s.pspId, name: s.name })),
          committees: b.committees.map((c) => ({ organLabel: c.organLabel, assignedOn: c.assignedOn })),
          fateSb: b.fateSb,
          fatePublishedOn: b.fatePublishedOn,
        },
      ];
    });
    return { bills, ok: true };
  } catch (err) {
    reportLoaderFailure("getDenikData.law", err);
    return { bills: [], ok: false };
  }
}

function batchLayers(): Promise<BatchLayers> {
  if (batchPromise !== null && Date.now() - batchMemoAt >= MONEY_MEMO_TTL_MS) batchPromise = null;
  if (batchPromise === null) {
    batchMemoAt = Date.now();
    batchPromise = (async (): Promise<BatchLayers> => {
      const [money, law] = await Promise.all([readMoneyLayers(), readLawLayer()]);
      return {
        contracts: money.contracts,
        roles: money.roles,
        bills: law.bills,
        moneyOk: money.ok,
        lawOk: law.ok,
        moneyLimits: money.limits,
      };
    })().then((value) => {
      // Vrstvu, která se nepřečetla, nedrží memo celé okno — příští request to zkusí znovu.
      if (!value.moneyOk || !value.lawOk) batchPromise = null;
      return value;
    });
    batchPromise = batchPromise.catch((err) => {
      batchPromise = null;
      reportLoaderFailure("getDenikData.batch", err);
      return {
        contracts: [],
        roles: [],
        bills: [],
        moneyOk: false,
        lawOk: false,
        moneyLimits: {
          contractCompanies: 0,
          companiesOverCap: 0,
          companiesEdgeTruncated: 0,
          malformedIco: 0,
        },
      };
    });
  }
  return batchPromise;
}

// ── lidská brána: čerstvě za requestu ───────────────────────────────────────

async function readReviews(): Promise<{ reviews: DenikReview[]; ok: boolean; auditRows: number }> {
  try {
    const store = await getStore();
    if (!store) return { reviews: [], ok: false, auditRows: 0 };
    const audit = await store.listReviewAudit({ limit: 10_000 });

    const ids = [...new Set(audit.flatMap((r) => [r.src, r.dst]))];
    const labels = new Map<string, string>();
    if (ids.length > 0) {
      try {
        for (const n of await store.getKgNodes(ids)) labels.set(n.id, n.label);
      } catch (err) {
        // Labely jsou obohacení; deník degraduje na id uzlů, neumírá.
        reportLoaderFailure("getDenikData.reviewLabels", err);
      }
    }

    const reviews: DenikReview[] = audit.map((r) => ({
      id: r.id,
      decision: r.decision,
      decidedAt: r.decidedAt,
      mpName: labels.get(r.src) ?? r.src,
      company: labels.get(r.dst) ?? r.dst,
      pspId: pspIdFromSrc(r.src),
      ico: icoFromDst(r.dst),
    }));
    return { reviews, ok: true, auditRows: audit.length };
  } catch (err) {
    reportLoaderFailure("getDenikData.reviews", err);
    return { reviews: [], ok: false, auditRows: 0 };
  }
}

// ── proud „zaznamenáno": change_event (5C) ──────────────────────────────────
//
// Odvození (backfill) je idempotentní — deterministická id znamenají, že
// opakovaný běh přepíše řádky na místě a nikdy nezdvojí proud. Běží nejvýš
// jednou za MONEY_MEMO_TTL_MS (stejná politika jako dávkové vrstvy: korpus se
// mění jen s ingestem/kg-compute); neúspěch se nememoizuje. Čtení eventů je
// pak levné a běží za requestu.

let changesBackfillPromise: Promise<void> | null = null;
let changesBackfillAt = 0;

function ensureChangesBackfilled(): Promise<void> {
  if (changesBackfillPromise !== null && Date.now() - changesBackfillAt >= MONEY_MEMO_TTL_MS) {
    changesBackfillPromise = null;
  }
  if (changesBackfillPromise === null) {
    changesBackfillAt = Date.now();
    changesBackfillPromise = (async () => {
      const repo = await getChangesRepo();
      if (!repo) return;
      await repo.backfillChangeEvents();
    })().catch((err) => {
      changesBackfillPromise = null;
      reportLoaderFailure("getDenikData.changesBackfill", err);
    });
  }
  return changesBackfillPromise;
}

/** Strop čtených eventů — pojistka, ne stránkování; plocha řeže po dnech. */
const MAX_CHANGE_EVENTS = 5_000;

async function readChanges(): Promise<{
  changes: DenikChange[];
  ok: boolean;
  fromGate: number;
  undisplayable: number;
}> {
  try {
    const repo = await getChangesRepo();
    if (!repo) return { changes: [], ok: false, fromGate: 0, undisplayable: 0 };
    await ensureChangesBackfilled();
    const events = await repo.listChangeEvents({ limit: MAX_CHANGE_EVENTS });

    // Tabulka deklaruje 10 typů; deník jich vyslovuje 9. Do 2026-08-04 uměl
    // TŘI a zbylých šest (mandátové a orgánové) mizelo mlčky — „poslanec
    // ztratil mandát" tak nemělo v produktu žádnou plochu. Teď se dělí na tři
    // hromádky a dvě z nich se POČÍTAJÍ:
    //   • zobrazitelné (DENIK_CHANGE_TYPES),
    //   • review-decision — záměrně vynechané (deník nese rozhodnutí brány ze
    //     svého čtení review_audit; duplikát by lhal o počtu událostí dne),
    //   • cokoli jiného — typ, který tenhle build neumí vyslovit; NIKDY tichý.
    const displayable = new Set<string>(DENIK_CHANGE_TYPES);
    const relevant: (typeof events)[number][] = [];
    let fromGate = 0;
    let undisplayable = 0;
    for (const e of events) {
      if (displayable.has(e.eventType)) relevant.push(e);
      else if (e.eventType === "review-decision") fromGate += 1;
      else undisplayable += 1;
    }
    if (undisplayable > 0) {
      reportLoaderFailure(
        "getDenikData.changes",
        new Error(`${undisplayable} change eventů nese typ, který deník neumí vyslovit — počet se přiznává na ploše`),
      );
    }

    // Labely endpointů (jméno poslance, firma, popisek smlouvy) — obohacení;
    // bez nich deník degraduje na klíče, neumírá. U mandátových a orgánových
    // eventů nejsou endpointy grafu (diff snímků psp.cz je nemá), takže se
    // jméno hledá pod ODVOZENÝM id osoby z klíče `poslanec:<pspId>` — netrefa
    // je neškodná (řádek pak řekne „poslanec N"), na rozdíl od citace, kde by
    // rekonstruované id předstíralo záznam.
    const pspIdOf = (e: (typeof events)[number]): number | null => {
      if (e.src) {
        const fromSrc = pspIdFromSrc(e.src);
        if (fromSrc !== null) return fromSrc;
      }
      const key = e.entityKeys.find((k) => /^poslanec:\d+$/.test(k));
      return key ? Number(key.slice("poslanec:".length)) : null;
    };
    const personId = (pspId: number): string => `psp:person:${pspId}`;

    const ids = [
      ...new Set([
        ...relevant.flatMap((e) => [e.src, e.dst].filter((v): v is string => v !== null)),
        ...relevant.flatMap((e) => {
          const pspId = pspIdOf(e);
          return pspId === null ? [] : [personId(pspId)];
        }),
      ]),
    ];
    const labels = new Map<string, string>();
    if (ids.length > 0) {
      try {
        const store = await getStore();
        if (store) for (const n of await store.getKgNodes(ids)) labels.set(n.id, n.label);
      } catch (err) {
        reportLoaderFailure("getDenikData.changeLabels", err);
      }
    }

    const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

    const changes: DenikChange[] = relevant.map((e) => {
      const pspId = pspIdOf(e);
      const icoKey = e.entityKeys.find((k) => k.startsWith("firma:"));
      const ico = icoKey ? canonicalIco(icoKey.slice("firma:".length)) : null;
      const isContract = e.eventType === "contract-new";
      const isTie = e.eventType === "tie-new" || e.eventType === "tie-changed";
      // U supplies hrany je firma na SRC uzlu a smlouva na DST uzlu.
      const companyId = isContract ? e.src : e.dst;
      return {
        id: e.id,
        eventType: e.eventType as DenikChangeType,
        recordedAt: e.recordedAt,
        mpName: pspId === null ? null : (labels.get(personId(pspId)) ?? null),
        pspId,
        company: companyId ? (labels.get(companyId) ?? null) : null,
        ico,
        contractLabel: isContract && e.dst ? (labels.get(e.dst) ?? null) : null,
        evidence: e.evidence,
        termCode: strOrNull(e.payload.termCode),
        functionNameCz: strOrNull(e.payload.functionNameCz),
        source: e.source,
        // „Čeká na kontrolu" je stav VAZBY. Mandátové a orgánové eventy na
        // žádné vazbě nestojí, takže o kontrole nic netvrdí.
        pending: isTie && e.payload.review_state !== "verified",
      };
    });
    return { changes, ok: true, fromGate, undisplayable };
  } catch (err) {
    reportLoaderFailure("getDenikData.changes", err);
    return { changes: [], ok: false, fromGate: 0, undisplayable: 0 };
  }
}

// ── vstupní bod ─────────────────────────────────────────────────────────────

export async function getDenikData(): Promise<DenikSourceData | null> {
  const [batch, gate, changeStream] = await Promise.all([batchLayers(), readReviews(), readChanges()]);
  const coverage: DenikCoverage = {
    money: batch.moneyOk,
    law: batch.lawOk,
    reviews: gate.ok,
    changes: changeStream.ok,
  };

  if (!coverage.money && !coverage.law && !coverage.reviews && !coverage.changes) {
    reportLoaderFailure(
      "getDenikData",
      new Error("žádná vrstva není čitelná — /denik zobrazí čestný stav „nečitelné, ne prázdné“"),
    );
    return null;
  }

  return {
    contracts: batch.contracts,
    roles: batch.roles,
    bills: batch.bills,
    reviews: gate.reviews,
    changes: changeStream.changes,
    coverage,
    limits: {
      ...batch.moneyLimits,
      companyCap: MAX_CONTRACT_COMPANIES,
      edgeCap: MAX_CONTRACT_EDGES,
      changesFromGate: changeStream.fromGate,
      changesUndisplayable: changeStream.undisplayable,
    },
    auditRows: gate.auditRows,
    builtOn: pragueDay(),
  };
}
