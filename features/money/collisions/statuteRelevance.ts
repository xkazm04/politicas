// Vyhlášená tabulka relevance zákonů — ŽÁDNÁ inference, žádný model.
//
// Kredibilní jádro (financial-transparency.md § FollowTheMoney M1, „narrow,
// defensible core"): poslanec s ověřenou vazbou na firmu, která bere veřejné
// peníze, hlasoval o tisku, který novelizuje ZÁKON UPRAVUJÍCÍ PRÁVĚ TEN KANÁL
// veřejných peněz. Kanál → zákon je pevná, tady vypsaná tabulka; věcný dosah
// konkrétní novely tabulka netvrdí — proto každý kandidát vyžaduje lidské
// ověření. Tabulka se vykresluje DOSLOVA v bloku metodiky na /penize/strety.
//
// Čistý modul (bez server-importů), testovaný v deriveCollisions.test.ts.

import type { CollisionTieIn, RelevanceWhy, RelevantStatute } from "./collisionTypes";

/** Firma má veřejné zakázky → zákony upravující zadávání a uveřejňování smluv. */
export const CONTRACT_STATUTES: readonly { ref: string; label: string }[] = [
  { ref: "134/2016", label: "zákon o zadávání veřejných zakázek" },
  { ref: "340/2015", label: "zákon o registru smluv" },
] as const;

/** Firma čerpá dotace → rozpočtová pravidla (kanál, kterým dotace tečou). */
export const SUBSIDY_STATUTES: readonly { ref: string; label: string }[] = [
  { ref: "218/2000", label: "rozpočtová pravidla (zákon o rozpočtových pravidlech)" },
] as const;

/** Firma darovala politické straně → zákon upravující financování stran. */
export const DONATION_STATUTES: readonly { ref: string; label: string }[] = [
  { ref: "424/1991", label: "zákon o sdružování v politických stranách a v politických hnutích" },
] as const;

/** Verze pravidla joinu — mění se s KAŽDOU změnou tabulky nebo podmínek,
 *  aby dvě různě odvozené sady kandidátů nešly zaměnit. */
export const COLLISION_RULE_VERSION = "strety-v1";

/** Zákony relevantní pro JEDNU vazbu, podle toho, které kanály veřejných peněz
 *  na firmě reálně jsou (počty čte z peněžní vrstvy, nic nedopočítává).
 *  Deterministické pořadí: contracts → subsidies → donation, uvnitř pořadí
 *  tabulky. */
export function relevantStatutesFor(tie: {
  contractCount: number;
  subsidiesCount: number;
  donatedToPartyCzk: number | null;
}): RelevantStatute[] {
  const out: RelevantStatute[] = [];
  const add = (rows: readonly { ref: string; label: string }[], why: RelevanceWhy) => {
    for (const r of rows) out.push({ ...r, why });
  };
  if (tie.contractCount > 0) add(CONTRACT_STATUTES, "contracts");
  if (tie.subsidiesCount > 0) add(SUBSIDY_STATUTES, "subsidies");
  if ((tie.donatedToPartyCzk ?? 0) > 0) add(DONATION_STATUTES, "donation");
  return out;
}

/** Vstupní brána joinu — TŘI podmínky, všechny vyhlášené v metodice:
 *  1. vazba prošla lidskou kontrolou (review_state === "verified"; chybějící
 *     stav = pending, nikdy verified — paritní pravidlo moneyLoaderu),
 *  2. roli potvrdil obchodní rejstřík (corroboration === "registry-confirmed"),
 *  3. rejstřík eviduje začátek období role (role_valid_from). */
export function tieEntersJoin(tie: CollisionTieIn): boolean {
  return (
    tie.reviewState === "verified" &&
    tie.corroboration === "registry-confirmed" &&
    tie.roleValidFrom !== null
  );
}

/** Titulek hlasování → číslo sněmovního tisku. Vyhlášené pravidlo: první výskyt
 *  „tisk <číslo>" (i „tisku", volitelně „č."), 1–4 číslice; titulek bez čísla
 *  tisku hlasování z joinu poctivě vyřazuje (počítá se v coverage). */
export function tiskRefOf(title: string): number | null {
  const m = /\btisku?\s*(?:č\.?\s*)?(\d{1,4})\b/i.exec(title);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Den hlasování leží v rejstříkovém období role — OBA krajní dny včetně
 *  (hlasování v den zápisu role i v den jejího výmazu se počítá; vyhlášeno
 *  v metodice, testováno na hraničních dnech). ISO data se porovnávají
 *  lexikograficky. */
export function voteInRolePeriod(votedOn: string, from: string, to: string | null): boolean {
  const day = votedOn.slice(0, 10);
  if (day < from.slice(0, 10)) return false;
  if (to !== null && day > to.slice(0, 10)) return false;
  return true;
}
