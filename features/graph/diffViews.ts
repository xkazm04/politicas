/*
 * TEHDY / DNES — čistý rozdíl dvou verzí TÉHOŽ citovaného pohledu.
 *
 * Zastaralá citace uměla říct jen „otisk v adrese ≠ otisk dnes". To je rozdíl
 * mezi „tahle citace je stará" a „tahle citace byla špatně" — a čtenář, který
 * přišel z půl roku starého článku, potřebuje to druhé: KTERÁ vazba byla
 * zamítnuta, KTERÁ smlouva přibyla, KUDY se cesta přesměrovala.
 *
 * Modul je ČISTÝ a pracuje nad KANONICKÝM OBSAHEM pohledu — přesně nad tím,
 * co hashuje `hashViewContent`. To je záměr: co se otisklo, to se i porovnává,
 * takže „otisky se liší, ale rozdíl je prázdný" je detekovatelná nesrovnalost,
 * ne tichý stav. Rich typy plátna (Trail, NodeDetail, PathTrailDto) se čtou
 * jen jako STRUKTURA, nikdy se nesází — sazba je věc stránky.
 *
 * ČTYŘI PRAVIDLA
 *
 * 1. HRANA SE POZNÁ PODLE KLÍČE `src|rel|dst`, ne podle pořadí v poli.
 *    Přeuspořádané pole není změna grafu.
 * 2. VÁHY SE NEZAOKROUHLUJÍ. Účtenkové pravidlo: rozdíl 0,87 → 0,88 je rozdíl,
 *    i když by ho sazba na jedno desetinné místo spolkla.
 * 3. CHYBĚJÍCÍ NENÍ NULA. Hrana bez váhy proti hraně s váhou je změna; uzel,
 *    který zmizel, je `removed`, ne „nula hran".
 * 4. ROZDÍL NIC NEVYSVĚTLUJE. Vrací fakta (přibylo / ubylo / změnilo se), ne
 *    věty — proč se to stalo, ví /denik a účtenka, ne tenhle modul.
 */

import type { GraphEdge } from "./graphTypes";

/** Klíč hrany v obou verzích — uložená orientace, jako všude v grafu. */
export const edgeKey = (e: { src: string; rel: string; dst: string }): string =>
  `${e.src}|${e.rel}|${e.dst}`;

/** Jedna hrana, jak ji rozdíl pojmenuje: klíč plus to, co se o ní sází. */
export interface DiffEdge {
  key: string;
  src: string;
  rel: string;
  dst: string;
  weight: number | null;
  /** Čekala na lidskou kontrolu (review_state) — pro překlopení brány. */
  pending: boolean;
}

/** Hrana, která v obou verzích JE, ale něco se na ní pohnulo. */
export interface DiffEdgeChange {
  key: string;
  then: DiffEdge;
  now: DiffEdge;
  /** Váha se změnila (přesně, bez zaokrouhlení). */
  weightChanged: boolean;
  /** Překlopila se lidská brána (čekající ↔ rozhodnutá). */
  gateFlipped: boolean;
}

/** Fakt uzlu, který se přepsal — „přesně jak uloženo", žádné dopočty. */
export interface DiffFactChange {
  label: string;
  then: string | null;
  now: string | null;
}

export interface ViewDiff {
  /** Jsou obě verze obsahově totožné? Pak citace „zastarala" jen otiskem. */
  identical: boolean;
  addedEdges: DiffEdge[];
  removedEdges: DiffEdge[];
  changedEdges: DiffEdgeChange[];
  addedNodes: string[];
  removedNodes: string[];
  changedFacts: DiffFactChange[];
  /** Cesta mezi dvěma body vede dnes jinudy (jiná posloupnost uzlů). */
  pathRerouted: boolean;
  /**
   * Verze se liší tvarem obsahu (jiný druh pohledu, nebo jedna strana pohled
   * vůbec nenese). Rozdíl pak vrací jen tohle: srovnávat uzel s trasou by
   * vyrobilo seznam „přibylo všechno", což není zjištění, ale artefakt.
   */
  incomparable: boolean;
}

const EMPTY: ViewDiff = {
  identical: true,
  addedEdges: [],
  removedEdges: [],
  changedEdges: [],
  addedNodes: [],
  removedNodes: [],
  changedFacts: [],
  pathRerouted: false,
  incomparable: false,
};

const toDiffEdge = (e: GraphEdge): DiffEdge => ({
  key: edgeKey(e),
  src: e.src,
  rel: e.rel,
  dst: e.dst,
  weight: e.weight,
  pending: e.pending,
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const edgesOf = (v: unknown): GraphEdge[] =>
  isRecord(v) && Array.isArray(v.edges) ? (v.edges as GraphEdge[]) : [];

const nodeIdsOf = (v: unknown): string[] => {
  if (!isRecord(v)) return [];
  if (Array.isArray(v.nodeIds)) return (v.nodeIds as unknown[]).filter((x): x is string => typeof x === "string");
  if (Array.isArray(v.nodes)) {
    return (v.nodes as unknown[])
      .map((n) => (isRecord(n) && typeof n.id === "string" ? n.id : null))
      .filter((x): x is string => x !== null);
  }
  return [];
};

function diffEdgeSets(thenEdges: GraphEdge[], nowEdges: GraphEdge[]) {
  const thenByKey = new Map(thenEdges.map((e) => [edgeKey(e), e]));
  const nowByKey = new Map(nowEdges.map((e) => [edgeKey(e), e]));
  const added: DiffEdge[] = [];
  const removed: DiffEdge[] = [];
  const changed: DiffEdgeChange[] = [];
  for (const [key, now] of nowByKey) {
    const before = thenByKey.get(key);
    if (!before) {
      added.push(toDiffEdge(now));
      continue;
    }
    // Object.is, ne ==: null proti 0 je rozdíl (pravidlo 3), a NaN se nesmí
    // stát „beze změny" jen proto, že se nerovná sám sobě.
    const weightChanged = !Object.is(before.weight, now.weight);
    const gateFlipped = before.pending !== now.pending;
    if (weightChanged || gateFlipped) {
      changed.push({ key, then: toDiffEdge(before), now: toDiffEdge(now), weightChanged, gateFlipped });
    }
  }
  for (const [key, before] of thenByKey) {
    if (!nowByKey.has(key)) removed.push(toDiffEdge(before));
  }
  return { added, removed, changed };
}

function diffFacts(then: unknown, now: unknown): DiffFactChange[] {
  const read = (v: unknown): Map<string, string> => {
    const out = new Map<string, string>();
    if (!isRecord(v) || !Array.isArray(v.facts)) return out;
    for (const f of v.facts) {
      if (isRecord(f) && typeof f.label === "string" && typeof f.value === "string") out.set(f.label, f.value);
    }
    return out;
  };
  const a = read(then);
  const b = read(now);
  const changes: DiffFactChange[] = [];
  for (const [label, value] of b) {
    const before = a.get(label);
    if (before !== value) changes.push({ label, then: before ?? null, now: value });
  }
  for (const [label, value] of a) {
    if (!b.has(label)) changes.push({ label, then: value, now: null });
  }
  return changes;
}

const settle = (d: Omit<ViewDiff, "identical">): ViewDiff => ({
  ...d,
  identical:
    !d.incomparable &&
    d.addedEdges.length === 0 &&
    d.removedEdges.length === 0 &&
    d.changedEdges.length === 0 &&
    d.addedNodes.length === 0 &&
    d.removedNodes.length === 0 &&
    d.changedFacts.length === 0 &&
    !d.pathRerouted,
});

/**
 * Rozdíl dvou kanonických obsahů téhož pohledu (`{kind, …}` tak, jak je
 * skládá `resolveView`). `then === null` = tehdejší verzi neumíme přehrát;
 * volající pak dostane `incomparable` a MUSÍ to napsat — prázdný rozdíl by
 * se četl jako „nic se nezměnilo".
 */
export function diffViews(then: unknown, now: unknown): ViewDiff {
  if (then === null || then === undefined || now === null || now === undefined) {
    return settle({ ...EMPTY, incomparable: true });
  }
  if (!isRecord(then) || !isRecord(now) || then.kind !== now.kind) {
    return settle({ ...EMPTY, incomparable: true });
  }

  if (then.kind === "uzel") {
    const a = isRecord(then.detail) ? then.detail : null;
    const b = isRecord(now.detail) ? now.detail : null;
    if (a === null || b === null) return settle({ ...EMPTY, incomparable: true });
    return settle({ ...EMPTY, changedFacts: diffFacts(a, b), incomparable: false });
  }

  if (then.kind === "trasa") {
    const a = then.trail;
    const b = now.trail;
    const { added, removed, changed } = diffEdgeSets(edgesOf(a), edgesOf(b));
    const thenIds = new Set(nodeIdsOf(a));
    const nowIds = new Set(nodeIdsOf(b));
    return settle({
      ...EMPTY,
      addedEdges: added,
      removedEdges: removed,
      changedEdges: changed,
      addedNodes: [...nowIds].filter((id) => !thenIds.has(id)),
      removedNodes: [...thenIds].filter((id) => !nowIds.has(id)),
      incomparable: false,
    });
  }

  // cesta: `path` je vítězná (či zvolená) trasa, nebo null, když ji dnešní
  // graf pod tímtéž indexem nedokládá. Jedna strana null a druhá ne JE
  // přesměrování — cesta se ztratila nebo se objevila.
  const a = then.path ?? null;
  const b = now.path ?? null;
  if (a === null || b === null) {
    return settle({
      ...EMPTY,
      pathRerouted: a !== b,
      incomparable: false,
      removedEdges: a === null ? [] : edgesOf(a).map(toDiffEdge),
      addedEdges: b === null ? [] : edgesOf(b).map(toDiffEdge),
      removedNodes: a === null ? [] : nodeIdsOf(a),
      addedNodes: b === null ? [] : nodeIdsOf(b),
    });
  }
  const { added, removed, changed } = diffEdgeSets(edgesOf(a), edgesOf(b));
  const thenIds = nodeIdsOf(a);
  const nowIds = nodeIdsOf(b);
  return settle({
    ...EMPTY,
    addedEdges: added,
    removedEdges: removed,
    changedEdges: changed,
    addedNodes: nowIds.filter((id) => !thenIds.includes(id)),
    removedNodes: thenIds.filter((id) => !nowIds.includes(id)),
    // Pořadí u cesty NESE význam (je to posloupnost kroků), na rozdíl od
    // hran trasy — přesměrování je tedy jiná POSLOUPNOST, ne jiná množina.
    pathRerouted: thenIds.join(">") !== nowIds.join(">"),
    incomparable: false,
  });
}
