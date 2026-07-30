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
import { getMapData, getNodeDetail, getPathBetween, getTrails, searchGraph } from "./graphLoader";
import type { MapData, NodeDetail, PathQueryResult, SearchHit, Trail } from "./graphTypes";

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

/** „Spoj dva body": nejkratší doložené cesty mezi dvěma uzly grafu. */
export async function pathAction(src: unknown, dst: unknown): Promise<PathQueryResult | null> {
  if (typeof src !== "string" || typeof dst !== "string") return null;
  const a = src.slice(0, 200);
  const b = dst.slice(0, 200);
  if (!a || !b || a === b) return null;
  return getPathBetween(a, b);
}
