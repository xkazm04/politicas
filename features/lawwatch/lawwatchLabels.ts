// Shared Czech labels + tiny formatters for the LawWatch surfaces (browser list,
// per-bill dossier). Split out of LawWatchPage.tsx so the dossier route
// (features/lawwatch/BillDossierPage.tsx) doesn't need to import the whole
// (large, mock-carrying) page component just for these constants.
//
// Inline Czech literals (not next-intl `t()`) — same precedent as
// features/civicscore/components/LeaderboardTable.tsx's "Tiší pracanti" filter:
// messages/*.json is off-boundary for this pass; proposed keys are listed in the
// batch report for the orchestrator to fold in.

import type { BillOrigin } from "./getLawData";

/** Původ tisku (bill.props.origin) → český štítek. */
export const ORIGIN_CZ: Record<BillOrigin, string> = {
  government: "vládní návrh",
  mp: "poslanecký návrh",
  mp_group: "skupina poslanců",
  senate: "senátní návrh",
  other: "jiný návrh",
};

export const SEVERITY_CZ: Record<string, string> = {
  low: "nízká",
  medium: "střední",
  high: "vysoká",
};

/** assigned_to.props.role → český štítek (F15 formální přikázání výborům). */
export const ROLE_CZ: Record<string, string> = {
  garancni: "garanční výbor",
  dalsi: "další výbor",
};

/** assigned_to.props.status → český štítek (nejsilnější dosažený stav přikázání). */
export const STATUS_CZ: Record<string, string> = {
  prikazano: "přikázáno",
  navrzeno: "navrženo",
  iniciativne: "projednáno iniciativně",
};

export const DIFF_OP_CZ: Record<string, string> = { modified: "změněno", added: "přidáno", removed: "zrušeno" };

/** psp.cz historie tisku (PSP10 = o=10) — jediný stabilní veřejný odkaz na tisk. */
export const pspBillUrl = (cislo: number | null): string | null =>
  cislo != null ? `https://www.psp.cz/sqw/historie.sqw?o=10&t=${cislo}` : null;

/** Kompaktní CZK: 5 397 460 397 → „5,4 mld. Kč". */
export function czkCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} mld. Kč`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} mil. Kč`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} tis. Kč`;
  return `${n} Kč`;
}
