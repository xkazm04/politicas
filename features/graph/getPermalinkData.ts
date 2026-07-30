/*
 * Znovuodvození citovaného pohledu na graf — serverová strana /graf/p/[ref].
 *
 * SERVEROVÝ MODUL (doktrína graphLoader.ts) — nikdy se neimportuje do
 * klientské komponenty. Stránka je čistě čtecí: adresa nese stav pohledu a
 * otisk obsahu, server pohled deterministicky odvodí znovu z týchž loaderů
 * (getTrails, getPathBetween, getNodeDetail) a NIC nezapisuje — citace není
 * řádek v databázi, ale adresovaný výpočet (vzor getExhibitData.ts).
 *
 * TŘI STAVY, KTERÉ SE NESMÍ SLÍT (pravidlo Exponátu):
 *   invalid      — nerozluštitelná adresa: opravdové „neexistuje", stránka 404;
 *   unavailable  — datový sklad neběží: NENÍ 404, plocha to poctivě řekne;
 *   gone         — adresa je čitelná, ale dnešní graf už pohled nedokládá
 *                  (uzel zmizel, trasa se přestala počítat): stránka to přizná.
 *
 * OTISK: hashViewContent nad týmž obsahem, který hashovala vydávající akce
 * (citeViewAction). Detail uzlu se odvozuje VŽDY v locale „cs" — fakta nesou
 * zformátované hodnoty a otisk nesmí záviset na jazyku prohlížeče.
 */

import { getNodeDetail, getPathBetween, getTrails } from "./graphLoader";
import {
  decodeGraphRef,
  hashViewContent,
  KIND_LABELS,
  TRAIL_TITLES,
  type GraphViewState,
  type PermalinkCore,
  type PermalinkView,
} from "./permalink";

export type PermalinkResult =
  | { status: "invalid" }
  | { status: "unavailable" }
  | { status: "gone"; ref: string; urlHash: string; retrievedOn: string }
  | { status: "ok"; view: PermalinkView };

/** Locale otisku — fakta v detailu uzlu jsou zformátované řetězce a otisk
 *  obsahu nesmí záviset na jazyku prohlížeče; citace je česká plocha. */
const HASH_LOCALE = "cs";

const today = (): string => new Date().toISOString().slice(0, 10);

/** Rozlišený obsah pohledu: jádro pro sazbu + KANONICKÝ obsah pro otisk.
 *  Jediná společná cesta pro vydání citace (citeViewAction) i její
 *  znovuodvození (getPermalinkData) — dvě cesty by se rozešly tiše. */
type Resolved =
  | { status: "unavailable" }
  | { status: "gone" }
  | { status: "ok"; content: unknown; title: string; core: PermalinkCore };

async function resolveView(state: GraphViewState): Promise<Resolved> {
  if (state.kind === "uzel") {
    const detail = await getNodeDetail(state.node, HASH_LOCALE);
    if (detail === null) {
      // getNodeDetail vrací null i při nedostupném skladu, i pro neznámý
      // uzel. Rozsoudí to druhý, levný dotaz: běží-li trasy, sklad běží a
      // null znamená „uzel v dnešním grafu není" — poctivé gone, ne výpadek.
      const probe = await getTrails();
      return probe === null ? { status: "unavailable" } : { status: "gone" };
    }
    return {
      status: "ok",
      content: { kind: "uzel", detail },
      title: `${KIND_LABELS[detail.node.kind] ?? detail.node.kind}: ${detail.node.label}`,
      core: { kind: "uzel", detail },
    };
  }

  if (state.kind === "trasa") {
    const trails = await getTrails();
    if (trails === null) return { status: "unavailable" };
    const trail = trails.find((t) => t.key === state.trail);
    if (!trail) return { status: "gone" };
    return {
      status: "ok",
      content: { kind: "trasa", trail },
      title: TRAIL_TITLES[trail.key] ?? trail.key,
      core: { kind: "trasa", trail },
    };
  }

  const result = await getPathBetween(state.from, state.to);
  if (result.status === "unavailable") return { status: "unavailable" };
  if (result.from === null || result.to === null) return { status: "gone" };
  // Zvolený index alternativy se NEklame na jinou cestu: když dnešní graf
  // pod tímto indexem cestu nedokládá, payload nese null a otisk se rozejde
  // s adresou — stránka rozdíl přizná (fresh=false), místo aby tiše ukázala
  // „něco podobného".
  const trail = result.paths[state.path] ?? null;
  return {
    status: "ok",
    content: { kind: "cesta", from: result.from.id, to: result.to.id, path: trail },
    title: `${result.from.label} → ${result.to.label}`,
    core: {
      kind: "cesta",
      from: result.from,
      to: result.to,
      trail,
      totalFound: result.totalFound,
      capped: result.capped,
      maxCost: result.maxCost,
      hubDegree: result.hubDegree,
    },
  };
}

/** Otisk + adresa pro PRÁVĚ vydávanou citaci — volá ji citeViewAction.
 *  null = pohled teď nejde doložit (sklad neběží, nebo obsah neexistuje);
 *  nic se nevydává, afordance to čtenáři řekne. */
export async function issuePermalink(state: GraphViewState): Promise<string | null> {
  const resolved = await resolveView(state);
  if (resolved.status !== "ok") return null;
  return hashViewContent(resolved.content);
}

export async function getPermalinkData(ref: string): Promise<PermalinkResult> {
  const decoded = decodeGraphRef(ref);
  if (decoded === null) return { status: "invalid" };

  const resolved = await resolveView(decoded.state);
  if (resolved.status === "unavailable") return { status: "unavailable" };
  if (resolved.status === "gone") {
    return { status: "gone", ref, urlHash: decoded.hash, retrievedOn: today() };
  }

  const currentHash = hashViewContent(resolved.content);
  return {
    status: "ok",
    view: {
      ref,
      state: decoded.state,
      urlHash: decoded.hash,
      currentHash,
      fresh: currentHash === decoded.hash,
      retrievedOn: today(),
      title: resolved.title,
      ...resolved.core,
    } as PermalinkView,
  };
}
