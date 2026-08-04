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
import { getLawData } from "@/features/lawwatch/getLawData";
import { icoFromDst, pspIdFromSrc } from "@/features/dukazy/deriveFeed";
import type { DenikBill, DenikChange, DenikContract, DenikReview, DenikRole } from "./deriveDenik";

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

export interface DenikSourceData {
  contracts: DenikContract[];
  roles: DenikRole[];
  bills: DenikBill[];
  reviews: DenikReview[];
  changes: DenikChange[];
  coverage: DenikCoverage;
  /** Kolik řádků review_audit branou prošlo — cituje se v hlavičce plochy. */
  auditRows: number;
  /** `YYYY-MM-DD` serveru — `today` čistého odvození a datum sestavení plochy. */
  builtOn: string;
}

/** Strop firem, pro které se čtou jednotlivé smlouvy (bodové čtení po firmě).
 *  Přisouditelných firem je dnes řádově nižší počet; strop je pojistka proti
 *  budoucímu růstu korpusu, a když se dosáhne, plocha to přizná v coverage
 *  poznámce loaderu (reportLoaderFailure). */
const MAX_CONTRACT_COMPANIES = 500;

// ── dávkové vrstvy: memo s expirací (viz hlavička) ──────────────────────────

interface BatchLayers {
  contracts: DenikContract[];
  roles: DenikRole[];
  bills: DenikBill[];
  moneyOk: boolean;
  lawOk: boolean;
}

let batchPromise: Promise<BatchLayers> | null = null;
let batchMemoAt = 0;

async function readMoneyLayers(): Promise<{ contracts: DenikContract[]; roles: DenikRole[]; ok: boolean }> {
  try {
    const money = await getMoneyData();
    if (!money) {
      reportLoaderFailure(
        "getDenikData.money",
        new Error("peněžní vrstva nedostupná — deník degraduje bez smluv a rolí"),
      );
      return { contracts: [], roles: [], ok: false };
    }

    // Rejstříkové role: každá vazba je fakt o poslanci, i steward — role sama
    // není penězi. Přisouditelnost omezuje jen SMLOUVY níž.
    const roles: DenikRole[] = [];
    // Přisouditelné firmy → jejich smlouvy smí deník nést; jedna firma může
    // vázat víc poslanců (smlouva je fakt o firmě, poslanci jsou entity filtru).
    const attributable = new Map<
      string,
      { kgId: string; ico: string; company: string; mps: { pspId: number; name: string; pending: boolean }[] }
    >();

    for (const mp of money.mps) {
      for (const t of mp.ties) {
        const pending = t.reviewState !== "verified";
        roles.push({
          company: t.company,
          ico: t.ico,
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
          ico: t.ico,
          company: t.company,
          mps: [],
        };
        existing.mps.push({ pspId: mp.pspId, name: mp.name, pending });
        attributable.set(t.companyId, existing);
      }
    }

    // Deterministické pořadí čtení + strop (viz MAX_CONTRACT_COMPANIES).
    const companies = [...attributable.values()].sort((a, b) => a.ico.localeCompare(b.ico));
    if (companies.length > MAX_CONTRACT_COMPANIES) {
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
      for (const c of companies.slice(0, MAX_CONTRACT_COMPANIES)) {
        const { edges, nodes } = await store.kgNeighbours({ id: c.kgId, rels: ["supplies"], limit: 500 });
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

    return { contracts, roles, ok: true };
  } catch (err) {
    reportLoaderFailure("getDenikData.money", err);
    return { contracts: [], roles: [], ok: false };
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
      return { contracts: money.contracts, roles: money.roles, bills: law.bills, moneyOk: money.ok, lawOk: law.ok };
    })().then((value) => {
      // Vrstvu, která se nepřečetla, nedrží memo celé okno — příští request to zkusí znovu.
      if (!value.moneyOk || !value.lawOk) batchPromise = null;
      return value;
    });
    batchPromise = batchPromise.catch((err) => {
      batchPromise = null;
      reportLoaderFailure("getDenikData.batch", err);
      return { contracts: [], roles: [], bills: [], moneyOk: false, lawOk: false };
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

async function readChanges(): Promise<{ changes: DenikChange[]; ok: boolean }> {
  try {
    const repo = await getChangesRepo();
    if (!repo) return { changes: [], ok: false };
    await ensureChangesBackfilled();
    const events = await repo.listChangeEvents({ limit: MAX_CHANGE_EVENTS });

    // review-decision eventy deník NEPŘEBÍRÁ — rozhodnutí brány už nese ze
    // svého čtení review_audit; duplikát by lhal o počtu událostí dne.
    const relevant = events.filter(
      (e): e is typeof e & { eventType: "tie-new" | "tie-changed" | "contract-new" } =>
        e.eventType === "tie-new" || e.eventType === "tie-changed" || e.eventType === "contract-new",
    );

    // Labely endpointů (jméno poslance, firma, popisek smlouvy) — obohacení;
    // bez nich deník degraduje na klíče, neumírá.
    const ids = [...new Set(relevant.flatMap((e) => [e.src, e.dst].filter((v): v is string => v !== null)))];
    const labels = new Map<string, string>();
    if (ids.length > 0) {
      try {
        const store = await getStore();
        if (store) for (const n of await store.getKgNodes(ids)) labels.set(n.id, n.label);
      } catch (err) {
        reportLoaderFailure("getDenikData.changeLabels", err);
      }
    }

    const changes: DenikChange[] = relevant.map((e) => {
      const pspId = e.src ? pspIdFromSrc(e.src) : null;
      const icoKey = e.entityKeys.find((k) => k.startsWith("firma:"));
      const ico = icoKey ? icoKey.slice("firma:".length) : null;
      const isContract = e.eventType === "contract-new";
      // U supplies hrany je firma na SRC uzlu a smlouva na DST uzlu.
      const companyId = isContract ? e.src : e.dst;
      return {
        id: e.id,
        eventType: e.eventType,
        recordedAt: e.recordedAt,
        mpName: pspId !== null && e.src ? (labels.get(e.src) ?? null) : null,
        pspId,
        company: companyId ? (labels.get(companyId) ?? null) : null,
        ico,
        contractLabel: isContract && e.dst ? (labels.get(e.dst) ?? null) : null,
        pending: !isContract && e.payload.review_state !== "verified",
      };
    });
    return { changes, ok: true };
  } catch (err) {
    reportLoaderFailure("getDenikData.changes", err);
    return { changes: [], ok: false };
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
    auditRows: gate.auditRows,
    builtOn: new Date().toISOString().slice(0, 10),
  };
}
