// Kraj crosswalk — the three kraj vocabularies the repo carries had no join:
//   psp.cz volební-kraj organ nameCz  (`regionLabel` in features/civicscore/getLeaderboardData.ts)
//   MONITOR NUTS3                     (`KRAJE` in features/budget/data/registryData.generated.ts)
//   ČSÚ VOLKRAJ 1–14                  (`VOLKRAJ_NAME` in lib/ingest/sources/volby.ts)
// plus the kraj's OWN IČO as zadavatel, which is how a kraj shows up in the tender
// graph (`company:ico:<8>`). Hand-authored, 14 rows, tested for uniqueness on every key.
//
// `slug` is `krajSlug(regionLabel(pspLabel))` — the same address /kraj/[kraj] already
// uses, so /volby/kraj/[slug] and /kraj/[kraj] never disagree (kraje.test.ts asserts it).

import { krajSlug } from "@/features/civicscore/kraj";
import type { KrajRow } from "./types";

/**
 * psp.cz organ nameCz → the label the product renders. Mirrors the private
 * `regionLabel` in features/civicscore/getLeaderboardData.ts (kept private there
 * because that file is `server-only`); kraje.test.ts pins the three shapes.
 */
export function regionLabelFromPspName(nameCz: string): string {
  if (nameCz === "Hlavní město Praha") return "Praha";
  if (nameCz === "Vysočina") return "Vysočina";
  return `${nameCz} kraj`;
}

const row = (pspLabel: string, nuts: string, volkraj: number, krajIco: string, name: string): KrajRow => ({
  slug: krajSlug(regionLabelFromPspName(pspLabel)),
  pspLabel,
  nuts,
  volkraj,
  krajIco,
  name,
});

/** 14 rows in VOLKRAJ order (= the ČSÚ / psp.cz canonical order of the kraje). */
export const KRAJ_CROSSWALK: readonly KrajRow[] = [
  row("Hlavní město Praha", "CZ010", 1, "00064581", "Hlavní město Praha"),
  row("Středočeský", "CZ020", 2, "70891095", "Středočeský kraj"),
  row("Jihočeský", "CZ031", 3, "70890650", "Jihočeský kraj"),
  row("Plzeňský", "CZ032", 4, "70890366", "Plzeňský kraj"),
  row("Karlovarský", "CZ041", 5, "70891168", "Karlovarský kraj"),
  row("Ústecký", "CZ042", 6, "70892156", "Ústecký kraj"),
  row("Liberecký", "CZ051", 7, "70891508", "Liberecký kraj"),
  row("Královéhradecký", "CZ052", 8, "70889546", "Královéhradecký kraj"),
  row("Pardubický", "CZ053", 9, "70892822", "Pardubický kraj"),
  row("Vysočina", "CZ063", 10, "70890749", "Kraj Vysočina"),
  row("Jihomoravský", "CZ064", 11, "70888337", "Jihomoravský kraj"),
  row("Olomoucký", "CZ071", 12, "60609460", "Olomoucký kraj"),
  row("Zlínský", "CZ072", 13, "70891320", "Zlínský kraj"),
  row("Moravskoslezský", "CZ080", 14, "70890692", "Moravskoslezský kraj"),
];

export const krajBySlug = (slug: string): KrajRow | null => KRAJ_CROSSWALK.find((k) => k.slug === slug) ?? null;
export const krajByPspLabel = (pspLabel: string): KrajRow | null =>
  KRAJ_CROSSWALK.find((k) => k.pspLabel === pspLabel) ?? null;
export const krajByNuts = (nuts: string): KrajRow | null => KRAJ_CROSSWALK.find((k) => k.nuts === nuts) ?? null;
export const krajByVolkraj = (volkraj: number): KrajRow | null =>
  KRAJ_CROSSWALK.find((k) => k.volkraj === volkraj) ?? null;
/** The kraj that is the zadavatel behind a `company:ico:<8>` node, if it is a kraj. */
export const krajByIco = (ico: string): KrajRow | null => KRAJ_CROSSWALK.find((k) => k.krajIco === ico) ?? null;
