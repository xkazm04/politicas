/*
 * GRAF PENĚZ PRO KLÁVESNICI — čistý adaptér mezi obrázkem /penize a SDÍLENÝM
 * pravidlem procházení grafu (features/dashboard/graphTraversal.ts).
 *
 * ── Proč adaptér, a ne druhý algoritmus ─────────────────────────────────────
 * Velín má od 2026-08-05 pravidlo, jak se grafem chodí šipkami: kandidáty jsou
 * SOUSEDÉ, vyhraje nejmenší úhel od směru šipky, shodu rozhodne id vzestupně a
 * směr bez souseda NIC NEUDĚLÁ. To pravidlo je čisté, otestované a nesmí se
 * opisovat — druhá kopie by se rozešla na první úpravě. Peněžní graf má jen
 * jiný TVAR uzlu (nese popisky, třídu vazby, stav kontroly), takže se tady
 * ořezává na to, co pravidlo potřebuje: `{id, x, y}` a `{from, to}`.
 *
 * ── Adresa spisu se odvozuje z TVARU ID, nikdy z pozice v poli ──────────────
 * Uzly obrázku mají layoutová id („person", „c0", „m1") — ta o entitě neříkají
 * nic. Entitu nese `entityId` v id-gramatice grafu (`psp:person:<pspId>` /
 * `company:ico:<ičo>`) a čte ji JEDINÝ vlastník toho tvaru
 * (features/shared/provenance/caseFileLink.ts) plus kanonizace IČO
 * (features/money/companyId.ts). Cokoli jiného — a tedy KAŽDÝ uzel označeného
 * vzorku, který stojí za vymyšlenou firmu — dostane `null` a žádný odkaz:
 * vzorkový uzel nesmí razit adresu skutečného spisu (precedens
 * features/dashboard/entityLinks.ts).
 *
 * Čistý modul (žádný server, žádný DOM) — sází ho reálný i vzorkový renderer a
 * platí o něm colocated test.
 */

import type { TraversalEdge, TraversalNode } from "@/features/dashboard/graphTraversal";
import { icoFromEntityId, pspIdFromEntityId } from "@/features/shared/provenance/caseFileLink";
import { canonicalIco } from "./companyId";

/** Druh uzlu, jak ho obrázek kreslí. `party` kreslí jen označený vzorek. */
export type MoneyNodeKind = "person" | "company" | "money" | "party";

/** Minimum, které pravidlo procházení potřebuje vidět na uzlu. */
export interface NavNode {
  id: string;
  x: number;
  y: number;
}

/** Minimum, které pravidlo procházení potřebuje vidět na hraně. */
export interface NavEdge {
  from: string;
  to: string;
}

/** Uzly obrázku → uzly pravidla. Pořadí se NEMĚNÍ: Home/End skáčou na první a
 *  poslední uzel v pořadí, v jakém plátno kreslí. */
export const traversalNodes = <T extends NavNode>(nodes: readonly T[]): TraversalNode[] =>
  nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }));

/** Hrany obrázku → hrany pravidla. Popisek ani „trail" do navigace nevstupují. */
export const traversalEdges = <T extends NavEdge>(edges: readonly T[]): TraversalEdge[] =>
  edges.map((e) => ({ from: e.from, to: e.to }));

/**
 * Adresa spisu pro uzel — jen z tvaru jeho `entityId`, jinak `null`.
 *
 *  • `psp:person:<pspId>` → `/penize/<pspId>` (peněžní spis poslance; profil
 *    `/poslanec/<pspId>` je jiná plocha a odsud se na něj neodkazuje)
 *  • `company:ico:<ičo>`  → `/penize/firma/<kanonické ičo>`
 *  • cokoli jiného, prázdné, `undefined` → `null`
 */
export function moneyNodeHref(entityId: string | null | undefined): string | null {
  if (!entityId) return null;
  const pspId = pspIdFromEntityId(entityId);
  if (pspId !== null) return `/penize/${pspId}`;
  const raw = icoFromEntityId(entityId);
  if (raw === null) return null;
  const ico = canonicalIco(raw);
  return ico === null ? null : `/penize/firma/${ico}`;
}

/** Kolik hran se uzlu dotýká — počítá se z hran, které obrázek OPRAVDU kreslí,
 *  ne ze stupně v grafu. Popisek uzlu ho nese, aby byl krok šipkou
 *  orientovatelný i bez obrázku. */
export function degreeOf(id: string, edges: readonly NavEdge[]): number {
  return edges.filter((e) => e.from === id || e.to === id).length;
}
