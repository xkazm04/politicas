/*
 * PENÍZE NA SPISU — projekce, ne druhá aritmetika.
 *
 * Do 2026-08-04 si spis poslance sčítal dosažitelné veřejné peníze SÁM: vlastní
 * čtení `supplies` (vlastní strop, vlastní fallback na `contract.amount`) a
 * vlastní `attributableCzk += czk` PO VAZBÁCH. Byl to ČTVRTÝ součet dosažitelných
 * peněz v repozitáři — přesně to, čemu má `features/money/reachableMoney.ts`
 * bránit — a měřitelně jiný než ten, který o témž poslanci tiskne /penize:
 *
 *   Petr Hladík (6881):  spis 23 790 791 881,98 Kč   /penize 23 570 594 009,66 Kč
 *   Andrej Babiš (6150): spis      16 511 233,47 Kč   /penize      16 436 383,47 Kč
 *
 * Rozdíl (u Hladíka 220 197 872,32 Kč) nebyl v zaokrouhlení: spis bral částku
 * jako `supplies.weight ?? contract.props.amount`, kdežto peněžní vrstva bere
 * VÝHRADNĚ `weight` (měřeno: každá ze 33 628 hran bez váhy míří na uzel bez
 * `amount`, takže fallback nezachraňoval nic a jen vyráběl druhou odpověď).
 *
 * Tenhle modul je proto ČISTÁ PROJEKCE `MoneyMpDetail` — objektu, který vydává
 * `getMoneyMpDetail()`, tedy loader plochy /penize/[pspId] — do tvaru, jaký
 * spis vykresluje. Neprovádí žádnou peněžní aritmetiku: součet přichází hotový
 * z `reachableMoney()` a figura se razí `mpBucketClaim()`, takže /overeni ji
 * umí znovu odvodit toutéž cestou, jakou ji vydala druhá plocha.
 *
 * CO SPIS DÁL DĚLÁ JINAK NEŽ /penize — a proč to není druhá pravda:
 *  • Peníze instituce (`steward`) se na spis osoby NEPŘISUZUJÍ. Vazba svou
 *    částku nese (loader ji načte, /penize ji tiskne jako peníze instituce),
 *    spis ji u řádku vědomě nevykresluje a řekne proč + odkáže na spis peněz.
 *    To je redakční pravidlo o PŘIČÍTÁNÍ, ne druhý výpočet.
 *  • Datum, které nemohlo nastat, se u řádku potlačí a přizná (plausible-date).
 */

import { mpBucketClaim, type MoneyFigure } from "@/features/money/moneyClaims";
import { isAttributable, type ReachableMoney } from "@/features/money/reachableMoney";
import { canonicalIco } from "@/features/money/companyId";
import {
  emptyBasisComposition,
  type AmountBasis,
  type BasisComposition,
} from "@/features/money/amountBasis";
import type { Corroboration, MoneyMpDetail, ReviewState, TieClass } from "@/features/money/moneyTypes";
import { plausibleIsoDateOrNull } from "@/lib/analysis/plausible-date";

/** Kolik smluvních řádků se u vazby vypíše; zbytek se počítá, nikdy nezahazuje. */
export const PROFILE_CONTRACT_LINES = 5;

/** Jeden dosažitelný smluvní řádek pod přisouditelnou vazbou. */
export interface ProfileContractLine {
  id: string;
  title: string;
  amountCzk: number | null;
  /** `signedOn` JEN když je to datum, které mohlo nastat — viz
   *  `lib/analysis/plausible-date.ts`. Nesmyslné datum se nikdy neopravuje. */
  signedOn: string | null;
  /** Řádek nese `signedOn`, které korpus neunese; datum se potlačí a řádek to
   *  řekne, místo aby zmizel. */
  dateUnusable: boolean;
  /** V jaké daňové základně je `amountCzk` vykázaná — doslova z hrany
   *  (`features/money/amountBasis.ts`). Nepřepočítává se, jen se říká. */
  amountBasis: AmountBasis;
}

/**
 * Jedna vazba `linked_to` tak, jak ji vykresluje SPIS.
 *
 * Peníze jen tam, kam je smí přisoudit atribuční pravidlo /penize
 * (`owner-operator`, `manager`). Dozorčí či správní funkce (`steward`) je
 * funkce ve veřejné instituci — její zakázky jsou její vlastní veřejná činnost
 * (~91 % dosažitelného objemu), a tisknout je na spisu osoby je způsob, jak se
 * z rozpočtu nemocnice stane obvinění. Steward řádek proto nese funkci, období,
 * účtenku a odkazy, a ŽÁDNÉ Kč.
 */
export interface ProfileMoneyTie {
  companyId: string;
  ico: string;
  company: string;
  role: string;
  tieClass: TieClass;
  reviewState: ReviewState;
  /** Doslovná provenience z hrany — cituje se, nepřepisuje. */
  source: string;
  corroboration: Corroboration | null;
  temporalStatus: string | null;
  roleValidFrom: string | null;
  roleValidTo: string | null;
  /** TRVALÁ ADRESA tvrzení (hrana osoba→firma), raženáí `mapLinkedToTie()`. Spis
   *  z ní staví odkaz na /zdroj — stejnou účtenku, jakou vydává kniha vazeb. */
  receiptRef: string;
  /** Spis firmy — `/penize/firma/<ičo>` v kanonickém 8místném tvaru; null, když
   *  IČO nemá tvar IČO (adresu si nedomýšlíme). */
  companyHref: string | null;
  /** null u steward vazby: ty peníze nejsou poslancovy, aby je spis hlásil. */
  contractCount: number | null;
  contractCzk: number | null;
  /** Největší smlouvy vazby; zbytek je spočítaný, ne zahozený. */
  topContracts: ProfileContractLine[];
  contractsMoreCount: number;
  /**
   * Složení daňových základen za `contractCzk` — přes VŠECHNY smlouvy firmy,
   * ne přes vypsaných pět řádků. Přebírá se hotové z `MoneyTieDetail
   * .contractBasis`; spis nic nepočítá (a nepřepočítává už vůbec).
   *
   * `null` u steward vazby ze stejného důvodu jako `contractCzk`: spis ty
   * peníze vědomě nesčítá, takže o jejich složení nic netvrdí.
   */
  contractBasis: BasisComposition | null;
}

/** Celý náklad oddílu Peníze. Prázdné `ties` je odpověď, ne mezera. */
export interface ProfileMoney {
  ties: ProfileMoneyTie[];
  /**
   * SDÍLENÁ DEFINICE dosažitelných peněz (`reachableMoney`), spočítaná
   * `getMoneyMpDetail()` — týž objekt, jaký vykresluje /penize/[pspId]. Spis
   * z něj tiskne jen stranu `attributable`; `coverage` říká, jestli je číslo
   * součet, nebo dolní mez. Null, když poslanec nemá vazby.
   */
  reach: ReachableMoney | null;
  /** Figura, kterou spis sází, i s claimem — `MONEY_METRIC.mpOwned`. */
  attributableFigure: MoneyFigure | null;
  /** Kolik vazeb je přisouditelných (vlastník/jednatel) — popisek k figuře. */
  attributableTies: number;
  /** Kolik vazeb je dozorčích/správních, jejichž peníze spis vědomě nesčítá. */
  stewardTies: number;
  pendingTies: number;
  verifiedTies: number;
  rejectedTies: number;
  /** Vypsané smluvní řádky, jejichž datum podpisu korpus neunese. */
  unusableDates: number;
  /** Průchod grafu, který peněžní vrstvu materializoval — cituje se na ploše. */
  pass: number | null;
  /**
   * Poslanec vazby MÁ (spis je vidí ve vlastním čtení hran), ale peněžní vrstva
   * se přečíst nedala. Bez tohohle rozlišení by výpadek loaderu vykreslil
   * „žádné vazby" — tedy hotové tvrzení o člověku vyrobené z chyby.
   */
  unavailable: boolean;
}

/** Prázdný oddíl: buď poslanec vazby nemá, nebo se peněžní vrstva nedala číst. */
export function emptyProfileMoney(unavailable: boolean): ProfileMoney {
  return {
    ties: [],
    reach: null,
    attributableFigure: null,
    attributableTies: 0,
    stewardTies: 0,
    pendingTies: 0,
    verifiedTies: 0,
    rejectedTies: 0,
    unusableDates: 0,
    pass: null,
    unavailable,
  };
}

/**
 * `MoneyMpDetail` → náklad spisu. Žádné sčítání: `detail.money` je výsledek
 * `reachableMoney()` a přebírá se, jak přišel.
 *
 * `asOf` je den, proti kterému se posuzuje uvěřitelnost data podpisu (spis ho
 * i tiskne, takže musí být jeden pro celou stránku).
 */
export function toProfileMoney(detail: MoneyMpDetail, asOf: string): ProfileMoney {
  let unusableDates = 0;
  const ties: ProfileMoneyTie[] = detail.ties.map((t) => {
    const attributable = isAttributable(t.tieClass);
    const lines: ProfileContractLine[] = attributable
      ? t.contracts.slice(0, PROFILE_CONTRACT_LINES).map((c) => {
          const signedOn = plausibleIsoDateOrNull(c.signedOn, asOf);
          const dateUnusable = typeof c.signedOn === "string" && c.signedOn !== "" && signedOn === null;
          if (dateUnusable) unusableDates += 1;
          return {
            id: c.id,
            title: c.label,
            amountCzk: c.amountCzk,
            signedOn,
            dateUnusable,
            amountBasis: c.amountBasis,
          };
        })
      : [];
    const ico = canonicalIco(t.ico);
    return {
      companyId: t.companyId,
      ico: t.ico,
      company: t.company,
      role: t.role,
      tieClass: t.tieClass,
      reviewState: t.reviewState,
      source: t.source,
      corroboration: t.corroboration ?? null,
      temporalStatus: t.temporalStatus ?? null,
      roleValidFrom: t.roleValidFrom ?? null,
      roleValidTo: t.roleValidTo ?? null,
      receiptRef: t.receiptRef,
      companyHref: ico ? `/penize/firma/${ico}` : null,
      contractCount: attributable ? t.contractCount : null,
      contractCzk: attributable ? t.contractCzk : null,
      topContracts: lines,
      contractsMoreCount: attributable ? Math.max(0, t.contractCount - lines.length) : 0,
      // Steward vazba nemá na spisu korunový součet, takže o jeho složení
      // netvrdí nic — null, ne prázdné složení (to by četlo jako „nula smluv").
      contractBasis: attributable ? (t.contractBasis ?? emptyBasisComposition()) : null,
    };
  });

  // Vazby stojící ZA přisouditelnou stranou součtu — jejich stav brány je stav
  // agregátu (moneyClaims pravidlo 4), tatáž množina, jakou pro tutéž dlaždici
  // skládá /penize/[pspId].
  const ownedStates = detail.ties.filter((t) => isAttributable(t.tieClass)).map((t) => t.reviewState);

  // Řazení: nejdřív přisouditelné (tam stojí tvrzení spisu), pak podle peněz,
  // pak podle id firmy — nikdy podle toho, co vrátila databáze.
  const CLASS_ORDER: Record<TieClass, number> = { "owner-operator": 0, manager: 1, steward: 2 };
  ties.sort(
    (a, b) =>
      CLASS_ORDER[a.tieClass] - CLASS_ORDER[b.tieClass] ||
      (b.contractCzk ?? 0) - (a.contractCzk ?? 0) ||
      (a.companyId < b.companyId ? -1 : a.companyId > b.companyId ? 1 : 0),
  );

  return {
    ties,
    reach: detail.money,
    attributableFigure: mpBucketClaim(detail.pspId, "owned", detail.money.attributable, ownedStates, detail.pass),
    attributableTies: ownedStates.length,
    stewardTies: ties.length - ownedStates.length,
    pendingTies: ties.filter((t) => t.reviewState === "pending_review").length,
    verifiedTies: ties.filter((t) => t.reviewState === "verified").length,
    rejectedTies: ties.filter((t) => t.reviewState === "rejected").length,
    unusableDates,
    pass: detail.pass,
    unavailable: false,
  };
}
