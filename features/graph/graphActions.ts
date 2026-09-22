"use server";

/*
 * Serverové akce playgroundu — jediný most z plátna do grafu.
 *
 * Proč akce a ne jednorázový náklad na stránce: celý graf váží ~3 200 uzlů a
 * ~25 000 hran. Poslat to do prohlížeče při každém otevření stránky by byly
 * megabajty, které čtenář z 99 % nepoužije. Místo toho stránka pošle jen
 * rozcestí (sčítání + nabídnuté vstupy) a zbytek se dotahuje na vyžádání.
 *
 * Vstupy z klienta se validují — akce je veřejný endpoint, ne funkce.
 */

import { getLocale } from "next-intl/server";
import { isKgNodeKind } from "./kindStyle";
import {
  getMapData,
  getNeighbourhood,
  getNodeDetail,
  getPathBetween,
  getTrails,
  searchGraph,
} from "./graphLoader";
import { issuePermalink } from "./getPermalinkData";
import { encodeGraphRef, parseViewState, permalinkPath } from "./permalink";
import type {
  MapData,
  Neighbourhood,
  NodeDetail,
  PathQueryResult,
  SearchHit,
  Trail,
} from "./graphTypes";

export async function searchGraphAction(q: unknown, kinds: unknown): Promise<SearchHit[]> {
  if (typeof q !== "string") return [];
  const kindList = Array.isArray(kinds) ? kinds.filter((k): k is string => typeof k === "string").filter(isKgNodeKind) : null;
  return searchGraph(q.slice(0, 120), kindList && kindList.length > 0 ? kindList : null, 24);
}

export async function nodeDetailAction(id: unknown): Promise<NodeDetail | null> {
  if (typeof id !== "string" || !id) return null;
  const locale = await getLocale();
  return getNodeDetail(id, locale);
}

export async function mapAction(): Promise<MapData | null> {
  return getMapData();
}

export async function trailsAction(): Promise<Trail[] | null> {
  return getTrails();
}

/**
 * Vydání trvalé citace pohledu: stav se přísně validuje (veřejný endpoint),
 * obsah se rozliší z týchž loaderů jako na /graf/p/[ref] a do adresy se
 * otiskne jeho hash — citace tak od první vteřiny říká, CO přesně doložila.
 * null = pohled teď doložit nejde (sklad neběží / obsah neexistuje).
 */
export async function citeViewAction(state: unknown): Promise<{ ref: string; path: string } | null> {
  const parsed = parseViewState(state);
  if (parsed === null) return null;
  const hash = await issuePermalink(parsed);
  if (hash === null) return null;
  const ref = encodeGraphRef(parsed, hash);
  return { ref, path: permalinkPath(ref) };
}

/** „Spoj dva body": nejkratší doložené cesty mezi dvěma uzly grafu. */
export async function pathAction(src: unknown, dst: unknown): Promise<PathQueryResult | null> {
  if (typeof src !== "string" || typeof dst !== "string") return null;
  const a = src.slice(0, 200);
  const b = dst.slice(0, 200);
  if (!a || !b || a === b) return null;
  return getPathBetween(a, b);
}

/**
 * Okolí jednoho uzlu na vyžádání — vrstva, kterou mapa masy ZÁMĚRNĚ nekreslí
 * (48 647 zakázek a 12 467 zakázkových firem by z payloadu udělalo ~60 tisíc
 * uzlů), ale kterou čtenář smí dotáhnout ke konkrétní entitě.
 *
 * Vstup se validuje týmž způsobem jako u `pathAction`: akce je veřejný
 * endpoint, ne funkce. Relace se propouštějí jen jako neprázdné řetězce a
 * strop si loader ořízne sám — klient si ho nesmí zvednout.
 */
export async function neighbourhoodAction(id: unknown, rels: unknown): Promise<Neighbourhood | null> {
  if (typeof id !== "string") return null;
  const key = id.slice(0, 200);
  if (!key) return null;
  const relList = Array.isArray(rels)
    ? rels.filter((r): r is string => typeof r === "string" && r.length > 0 && r.length <= 80).slice(0, 12)
    : undefined;
  return getNeighbourhood(key, relList && relList.length > 0 ? { rels: relList } : {});
}
