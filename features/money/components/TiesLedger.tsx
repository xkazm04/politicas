"use client";

/**
 * Kniha doložených vazeb — filtrovatelná, řaditelná, stránkovaná tabulka 211
 * vazeb poslanec↔firma. S reálnými daty ze znalostního grafu (person
 * --linked_to--> company --supplies--> contract) čte třídu vazby, korroboraci
 * v ARES VR a dosažitelné veřejné peníze; KAŽDÁ vazba je human-gated
 * (review_state) — dokud ji neschválí člověk, nese okrový štítek „čeká na
 * kontrolu" a do skóre se nepropisuje. Jméno poslance otevírá plný spis
 * (/penize/[pspId]). Bez store se vykreslí původní, výslovně označený mock
 * (graceful degradation).
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpDown, ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import { foldTieQuery, tieMatches, tieSearchFold } from "../ledgerSearch";
import {
  temporalBadge,
  tieClassInfo,
  tieClassOriginInfo,
  type TieClass,
} from "../moneyTypes";
import {
  LEDGER_CHIP_CAP,
  reachInput,
  type MoneyLedgerData,
  type PublicMoneyMp,
  type PublicMoneyTie,
} from "../publicWire";
import type { ReviewSummary } from "../reviewSummary";
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import ReportClaimLink from "@/features/shared/components/ReportClaimLink";
import CitableNumber from "@/lib/claims/CitableNumber";
import type { Locale } from "@/lib/i18n/config";
import { tieReachClaim } from "../moneyClaims";
import { tieReach } from "../reachableMoney";
import TieClassExplainer from "./TieClassExplainer";
import { BasisNote } from "./BasisDisclosure";

/* The labelled sample ledger is a FALLBACK — it renders only when the money layer is
   unavailable. Importing it (and with it the 27 KB `lib/civic/data.ts`) at module scope
   put it in the bundle of every request that will never show it. `next/dynamic` without
   `ssr: false` keeps the fallback working on the server too. */
const MockLedger = dynamic(() => import("./MockLedger"));

const BADGE_TONE_CLS: Record<string, string> = {
  current: "border-cobalt text-cobalt",
  ended: "border-hairline text-steel",
  warn: "border-ochre bg-ochre/15 text-ink",
  unknown: "border-dashed border-hairline text-steel",
};

const CLASS_TONE_CLS: Record<string, string> = {
  signal: "border-signal text-signal",
  cobalt: "border-cobalt text-cobalt",
  steel: "border-hairline text-steel",
};

const PAGE_SIZE = 25;

export default function TiesLedger({
  data,
  review,
}: {
  data: MoneyLedgerData | null;
  /** Co lidská brána SKUTEČNĚ rozhodla — týž odvozený objekt, jaký sází pruh pod
   *  titulkem a patička grafu. Do 2026-08-12 tu místo něj stála jedna věta tvrdící,
   *  že „všechny záznamy" čekají na kontrolu; první rozhodnutí v konzoli ji vyvrátí. */
  review: ReviewSummary;
}) {
  if (data) return <RealLedger data={data} review={review} />;
  return <MockLedger />;
}

// ── Real: filterable/sortable/paginated ledger over the knowledge-graph money layer ──

type FlatRow = { mp: PublicMoneyMp; tie: PublicMoneyTie };
/** Řádek + jeho složený tvar pro hledání. Skládá se JEDNOU na seznam, ne při
 *  každém úhozu nad každým řádkem (vzor LeaderboardTable.tsx). */
type SearchRow = FlatRow & { fold: string };
// "evidence" = the batch-005 review order (reviewRank: registry-confirmed
// owner-operator first, then manager, then steward, unconfirmed/conflicting
// last; reachable CZK only breaks ties within the same tier). Default sort —
// a reader should meet the strongest-evidence tie first, not the biggest
// number (UX audit 2026-07-27, #3).
//
// TEN SLOUPEC SE JMENUJE PODLE TOHO, PODLE ČEHO ŘADÍ (2026-08-12). Do teď nesl
// hlavičku „třída" nad komparátorem `reviewRank`, který je ale korroborace
// NEJDŘÍV a peníze až uvnitř úrovně (reviewTypes.ts) — takže poslední řádek z 211
// je vlastník-provozovatel pod 154 stewardy a čtenář, který kliknul na „třída",
// dostal pořadí, o kterém hlavička nic neřekla. Ovládací prvek zůstal JEDEN
// (druhý by jen zdvojil totéž řazení), přejmenoval se na „sílu důkazu" a pravidlo
// se VYPISUJE nad tabulkou.
type SortKey = "evidence" | "reach" | "mp" | "company";
type CorroborationFilter = "all" | "confirmed" | "unconfirmed" | "conflicting" | "unchecked";
type TemporalFilter = "all" | "current" | "ended" | "warn" | "unknown";

function RealLedger({ data, review }: { data: MoneyLedgerData; review: ReviewSummary }) {
  const t = useTranslations("money");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const f = useFormat();
  const en = locale === "en";

  const rows: FlatRow[] = useMemo(
    () => data.mps.flatMap((mp) => mp.ties.map((tie) => ({ mp, tie }))),
    [data.mps],
  );
  /* HLEDÁNÍ BEZ DIAKRITIKY (2026-08-12). Do teď se porovnávalo syrové
     `toLowerCase()`, takže „teplarny" nenašlo Teplárny Brno a „reznicek"
     nenašlo Řezníčka — v české sněmovně a v českém obchodním rejstříku to není
     okrajový případ, je to většina jmen. Pravidlo je čistá funkce s testy
     (../ledgerSearch.ts); složený tvar se počítá JEDNOU na seznam, nikdy per
     úhoz per řádek (vzor LeaderboardTable.tsx). */
  const searchRows: SearchRow[] = useMemo(
    () => rows.map((r) => ({ ...r, fold: tieSearchFold(r.mp.name, r.tie.company, r.tie.ico) })),
    [rows],
  );
  const clubs = useMemo(
    () => Array.from(new Set(data.mps.map((mp) => mp.club).filter((c): c is string => Boolean(c)))).sort(),
    [data.mps],
  );

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<TieClass | "all">("all");
  const [corrFilter, setCorrFilter] = useState<CorroborationFilter>("all");
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>("all");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("evidence");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = foldTieQuery(search);
    return searchRows.filter(({ mp, tie, fold }) => {
      if (classFilter !== "all" && tie.tieClass !== classFilter) return false;
      if (clubFilter !== "all" && mp.club !== clubFilter) return false;
      if (corrFilter !== "all") {
        const c = tie.corroboration ?? null;
        if (corrFilter === "confirmed" && c !== "registry-confirmed") return false;
        if (corrFilter === "unconfirmed" && c !== "registry-unconfirmed") return false;
        if (corrFilter === "conflicting" && c !== "conflicting") return false;
        if (corrFilter === "unchecked" && c !== null) return false;
      }
      if (temporalFilter !== "all" && temporalBadge(tie).tone !== temporalFilter) return false;
      if (!tieMatches(fold, q)) return false;
      return true;
    });
  }, [searchRows, search, classFilter, corrFilter, temporalFilter, clubFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "mp") return sortDir * a.mp.name.localeCompare(b.mp.name, "cs");
      if (sortKey === "company") return sortDir * a.tie.company.localeCompare(b.tie.company, "cs");
      if (sortKey === "evidence") return sortDir * (a.tie.reviewRank - b.tie.reviewRank);
      // Sort key and cell come from the SAME shared definition (`tieReach`) — the column
      // used to re-add `contractCzk + subsidiesCzk` here and again at the cell, which was
      // a fourth answer to "kolik peněz je v dosahu" living inside the ledger.
      return sortDir * (tieReach(reachInput(a.tie)).czk - tieReach(reachInput(b.tie)).czk);
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const shown = sorted.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    setPage(0);
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(key === "mp" || key === "company" || key === "evidence" ? 1 : -1);
    }
  };

  // The server already cut this list to what renders (`toLedgerData`); the count of the
  // rest travels as a NUMBER, not as 108 unrendered stubs.
  const shownChips = data.mpsWithoutTies.slice(0, LEDGER_CHIP_CAP);
  const restChips = data.mpsWithoutTiesCount - shownChips.length;

  return (
    <div>
      {/* ── filters ─────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder={t("real.ledger.searchPlaceholder")}
          className="w-full max-w-sm border-2 border-hairline bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink"
        />
        <div className="flex flex-wrap gap-2">
          {(["all", "owner-operator", "manager", "steward"] as (TieClass | "all")[]).map((c) => (
            <FilterChip
              key={c}
              active={classFilter === c}
              onClick={() => {
                setClassFilter(c);
                setPage(0);
              }}
            >
              {/* `tieClassInfo` je UZAVŘENÝ dvojjazyčný slovník sdílený pěti
                  plochami (spis, konzole, paket, graf, kniha) — zůstává tam, kde
                  je; do katalogu šla jen věta, která patřila TÉHLE ploše. */}
              {c === "all" ? t("real.ledger.filterAllClasses") : en ? tieClassInfo(c).labelEn : tieClassInfo(c).labelCs}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", t("real.ledger.filterCorrAll")],
              ["confirmed", t("real.ledger.filterCorrConfirmed")],
              ["unconfirmed", t("real.ledger.filterCorrUnconfirmed")],
              ["conflicting", t("real.ledger.filterCorrConflicting")],
              ["unchecked", t("real.ledger.filterCorrUnchecked")],
            ] as [CorroborationFilter, string][]
          ).map(([key, label]) => (
            <FilterChip
              key={key}
              active={corrFilter === key}
              onClick={() => {
                setCorrFilter(key);
                setPage(0);
              }}
            >
              {label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", t("real.ledger.filterStatusAll")],
              ["current", t("real.ledger.filterStatusCurrent")],
              ["ended", t("real.ledger.filterStatusEnded")],
              ["warn", t("real.ledger.filterStatusWarn")],
              ["unknown", t("real.ledger.filterStatusUnknown")],
            ] as [TemporalFilter, string][]
          ).map(([key, label]) => (
            <FilterChip
              key={key}
              active={temporalFilter === key}
              onClick={() => {
                setTemporalFilter(key);
                setPage(0);
              }}
            >
              {label}
            </FilterChip>
          ))}
          {clubs.length > 0 && (
            <select
              value={clubFilter}
              onChange={(e) => {
                setClubFilter(e.target.value);
                setPage(0);
              }}
              className="border-2 border-hairline bg-paper px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-steel outline-none focus:border-ink"
            >
              <option value="all">{t("real.ledger.filterAllClubs")}</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-steel">
        {t("real.ledger.resultCount", {
          shownFmt: f.int(sorted.length),
          total: rows.length,
          totalFmt: f.int(rows.length),
        })}
      </p>
      {/* PRAVIDLO VÝCHOZÍHO POŘADÍ, vypsané u tabulky, které se týká. Sloupec
          nese třídu vazby, ale řadí se podle síly důkazu (`reviewRank`) —
          korroborace před penězi — a to z hlavičky uhodnout nejde. */}
      <div className="mb-3">
        <SourceNote>{t("real.ledger.evidenceRule")}</SourceNote>
      </div>

      {/* ── table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto border-t-2 border-ink">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-ink font-mono text-[10px] uppercase tracking-widest text-steel">
              <Th onClick={() => toggleSort("mp")} active={sortKey === "mp"} dir={sortDir}>
                {t("real.ledger.colMp")}
              </Th>
              <Th onClick={() => toggleSort("company")} active={sortKey === "company"} dir={sortDir}>
                {t("real.ledger.colCompany")}
              </Th>
              {/* „třída" → „síla důkazu": hlavička pojmenuje to, podle čeho
                  tlačítko řadí (reviewRank), ne to, co v buňce svítí. */}
              <Th onClick={() => toggleSort("evidence")} active={sortKey === "evidence"} dir={sortDir}>
                {t("real.ledger.colEvidence")}
              </Th>
              <th className="px-3 py-2">{t("real.ledger.colStatus")}</th>
              <Th onClick={() => toggleSort("reach")} active={sortKey === "reach"} dir={sortDir} align="right">
                {t("real.ledger.reachHeader")}
              </Th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ mp, tie }) => {
              const reach = tieReach(reachInput(tie));
              const temporal = temporalBadge(tie);
              const info = tieClassInfo(tie.tieClass);
              return (
                <tr
                  key={`${mp.pspId}-${tie.companyId}`}
                  className="border-b border-hairline hover:bg-paper-strong"
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/penize/${mp.pspId}`}
                      className="group inline-flex items-center gap-1 font-bold uppercase tracking-tight transition-colors hover:text-signal"
                    >
                      {mp.name}
                      <ArrowUpRight className="h-3.5 w-3.5 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    {mp.club && <span className="ml-1.5 font-mono text-[10px] text-steel">{mp.club}</span>}
                  </td>
                  <td className="px-3 py-3">
                    {/* The company is the graph's JUNCTION node — 14 of them are tied to
                        more than one MP, a fact this ledger's one-row-per-tie shape
                        cannot show. Its own file can. */}
                    <Link
                      href={`/penize/firma/${tie.ico}`}
                      className="font-bold transition-colors hover:text-signal"
                    >
                      {tie.company}
                    </Link>
                    <span className="ml-1.5 font-mono text-[10px] text-steel">IČO {tie.ico}</span>
                    {/* Every row is a money CLAIM about a named person, so every row has a
                        permanent address that /overeni can resolve. The label states what
                        the receipt cites — a claim and its gate state — not a verdict. */}
                    <Link
                      href={claimRefPath(tie.receiptRef)}
                      className="mt-0.5 block font-mono text-[10px] uppercase tracking-widest text-cobalt transition-colors hover:text-signal"
                    >
                      {t("real.ledger.receiptLink")}
                      {tie.reviewState === "pending_review" ? ` · ${tcom("pendingReview")}` : ""}
                    </Link>
                    {/* A receipt says what the gate holds; a reader who thinks the CLAIM
                        is wrong needs a human address, not a re-derivation. Env-gated —
                        renders nothing without NEXT_PUBLIC_CONTACT_EMAIL. */}
                    <ReportClaimLink
                      claimRef={tie.receiptRef}
                      className="mt-0.5 block font-mono text-[9px] uppercase tracking-widest text-steel transition-colors hover:text-signal"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${CLASS_TONE_CLS[info.tone]}`}
                    >
                      {en ? info.labelEn : info.labelCs}
                    </span>
                    {/* a guessed class must not read like a recorded one, even in a dense
                        table — the explainer below the table carries the full rule. */}
                    <span
                      className={`mt-0.5 block font-mono text-[9px] uppercase tracking-widest ${tie.tieClassOrigin === "stored" ? "text-steel" : "text-ochre"}`}
                    >
                      {en
                        ? tieClassOriginInfo(tie.tieClassOrigin).labelEn
                        : tieClassOriginInfo(tie.tieClassOrigin).labelCs}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {tie.reviewState === "verified" ? (
                        <span className="border-2 border-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
                          {tcom("verified")}
                        </span>
                      ) : tie.reviewState === "rejected" ? (
                        <span className="border-2 border-steel px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-steel">
                          {t("shared.rejected")}
                        </span>
                      ) : (
                        <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                          {tcom("pendingReview")}
                        </span>
                      )}
                      <span
                        className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${BADGE_TONE_CLS[temporal.tone]}`}
                      >
                        {en ? temporal.labelEn : temporal.labelCs}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {/* A steward's number is the institution's own public activity — it
                        may not be printed in the alarm colour, at any density. Same rule
                        the case file already applied (MpCaseFilePage's reach panel). */}
                    <span
                      className={`block font-black tabular-nums ${reach.czk > 0 && reach.attributable ? "text-signal" : "text-steel"}`}
                    >
                      {/* The NUMBER is what gets quoted, so the number carries its own
                          address: the same `data-claim-*` payload /overeni re-derives,
                          minted from the tie's own receipt ref and the shared reach
                          arithmetic (moneyClaims.ts). Zero new wire fields — every input
                          is already `public` in TIE_WIRE. A zero reach is not a claim. */}
                      {reach.czk > 0 ? (
                        <CitableNumber
                          value={reach.czk}
                          claim={tieReachClaim(reachInput(tie), data.pass).claim}
                          locale={locale as Locale}
                          kind="czkCompact"
                        />
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-widest text-steel">
                      {reach.czk > 0
                        ? reach.attributable
                          ? t("real.ledger.reachAttributable")
                          : t("real.ledger.reachSteward")
                        : ""}
                    </span>
                    {/* KOLIK SMLUV za tím číslem stojí. `contractCount` se vozil na
                        veřejném drátě klasifikovaný jako vstup dosahu — což byla
                        nepravda (reachableMoney.ts ho nečte) — a nevykresloval se
                        nikde, ačkoli `real.ledger.reachNote` pod tabulkou čtenáři
                        slibuje „smlouvy z registru smluv … + dotace". Jedna miliarda
                        v jedné smlouvě a v tisíci smlouvách nejsou totéž. */}
                    {tie.contractCount > 0 && (
                      <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-widest text-steel">
                        {t("shared.contractsCount", { count: tie.contractCount })}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center italic text-steel">
                  {t("real.ledger.emptyFilters")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* The reach column is a number about money and therefore cites what it is: which
          arithmetic, over which population, and that the class decides how to read it. */}
      <div className="mt-3">
        <SourceNote>{t("real.ledger.reachNote")}</SourceNote>
        {/* SLOŽENÍ DAŇOVÝCH ZÁKLADEN, jednou nad celou tabulkou. Sloupec „dosah"
            nese u každého řádku součet, který obě nesčitatelné základny registru
            míchá; přiznání sedí TADY, ne u řádku, protože `MoneyTie` po drátě
            složení nenese (viz `moneyTypes.ts::MoneyTieDetail.contractBasis` —
            pole na `MoneyTie` by musel zatřídit `TIE_WIRE` a poslat 211 řádkům,
            které ho nekreslí). Populace je stejná, o jaké tabulka tvrdí: firmy
            s aspoň jednou vazbou, každá jednou. Spis firmy i spis poslance
            přiznávají složení SVÉHO vlastního součtu na svých plochách. */}
        <BasisNote basis={data.stats.contractBasis} className="mt-1" withRule />
      </div>

      {/* ── pagination ──────────────────────────────────────── */}
      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-steel">
          <button
            type="button"
            disabled={clampedPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="border-2 border-hairline px-3 py-1.5 font-bold transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("real.ledger.prevPage")}
          </button>
          <span>
            {clampedPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={clampedPage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="border-2 border-hairline px-3 py-1.5 font-bold transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("real.ledger.nextPage")}
          </button>
        </div>
      )}

      {/* ── tie-class explainer (P29 rule) ─────────────────────── */}
      <div className="mt-10">
        {/* Týž klíč, jaký nese spis i konzole — věta tu stála znovu jako literál. */}
        <SourceNote>{t("shared.howToReadTieClass")}</SourceNote>
        <div className="mt-3">
          <TieClassExplainer compact />
        </div>
      </div>

      <div className="mt-10 border-2 border-dashed border-hairline p-5">
        <SourceNote>{t("real.ledger.noTiesNote")}</SourceNote>
        <div className="mt-2 flex flex-wrap gap-2">
          {shownChips.map((mp) => (
            <Link
              key={mp.pspId}
              href={`/poslanec/${mp.pspId}`}
              className="border-2 border-hairline px-3 py-1.5 text-sm font-bold transition-colors hover:border-ink hover:bg-paper-strong"
            >
              {mp.name}
              {mp.club ? (
                <span className="ml-1.5 font-mono text-[10px] font-normal text-steel">{mp.club}</span>
              ) : null}
            </Link>
          ))}
          {restChips > 0 && (
            <span className="px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-steel">
              {t("real.ledger.moreCount", { count: restChips })}
            </span>
          )}
        </div>
      </div>

      {/* CO BRÁNA SKUTEČNĚ ROZHODLA — odvozeno, ne napsáno. Do 2026-08-12 tu stálo
          „Všechny záznamy nesou štítek «čeká na kontrolu»", tedy literál, který první
          potvrzení v /penize/kontrola vyvrátí; konzole umí zapsat verified i rejected
          od e8bf6c8. Věta teď čte TÝŽ `ReviewSummary`, jaký sází pruh pod titulkem a
          patička grafu, takže tři místa jedné stránky nemohou o téže bráně tvrdit tři
          různé věci. */}
      <div className="mt-4 max-w-3xl">
        <p className="text-sm italic leading-relaxed text-steel">
          {review.phase === "all-pending"
            ? t("real.ledger.disclaimerAllPending", {
                total: f.int(review.total),
                pendingLabel: tcom("pendingReview"),
              })
            : review.phase === "all-decided"
              ? t("real.ledger.disclaimerAllDecided", {
                  total: f.int(review.total),
                  verified: f.int(review.verified),
                  rejected: f.int(review.rejected),
                })
              : review.phase === "mixed"
                ? t("real.ledger.disclaimerMixed", {
                    decided: f.int(review.decided),
                    pending: f.int(review.pending),
                    total: f.int(review.total),
                    pendingLabel: tcom("pendingReview"),
                  })
                : t("real.ledger.disclaimerEmpty")}
        </p>
        <SourceNote className="mt-2">
          {tcom("sourcePrefix")} {t("real.review.source")}
        </SourceNote>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  align = "left",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: 1 | -1;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {children}
        <ArrowUpDown className={`h-3 w-3 ${active ? (dir === 1 ? "rotate-180" : "") : "opacity-40"}`} />
      </button>
    </th>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
