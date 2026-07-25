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
import Link from "next/link";
import { ArrowUpDown, ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MONEY_TIES, MPS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import {
  compactCzk,
  temporalBadge,
  tieClassInfo,
  type MoneyData,
  type MoneyMp,
  type MoneyTie,
  type TieClass,
} from "../moneyTypes";
import TieClassExplainer from "./TieClassExplainer";

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

const CHIP_CAP = 36; // MPs without ties rendered as chips before "+ N more"
const PAGE_SIZE = 25;

export default function TiesLedger({ data }: { data: MoneyData | null }) {
  if (data) return <RealLedger data={data} />;
  return <MockLedger />;
}

// ── Real: filterable/sortable/paginated ledger over the knowledge-graph money layer ──

type FlatRow = { mp: MoneyMp; tie: MoneyTie };
type SortKey = "reach" | "mp" | "company";
type CorroborationFilter = "all" | "confirmed" | "unconfirmed" | "conflicting" | "unchecked";
type TemporalFilter = "all" | "current" | "ended" | "warn" | "unknown";

function RealLedger({ data }: { data: MoneyData }) {
  const t = useTranslations("money");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const en = locale === "en";

  const rows: FlatRow[] = useMemo(
    () => data.mps.flatMap((mp) => mp.ties.map((tie) => ({ mp, tie }))),
    [data.mps],
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
  const [sortKey, setSortKey] = useState<SortKey>("reach");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ mp, tie }) => {
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
      if (q && !mp.name.toLowerCase().includes(q) && !tie.company.toLowerCase().includes(q) && !tie.ico.includes(q))
        return false;
      return true;
    });
  }, [rows, search, classFilter, corrFilter, temporalFilter, clubFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sortKey === "mp") return sortDir * a.mp.name.localeCompare(b.mp.name, "cs");
      if (sortKey === "company") return sortDir * a.tie.company.localeCompare(b.tie.company, "cs");
      const reachA = a.tie.contractCzk + a.tie.subsidiesCzk;
      const reachB = b.tie.contractCzk + b.tie.subsidiesCzk;
      return sortDir * (reachA - reachB);
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
      setSortDir(key === "mp" || key === "company" ? 1 : -1);
    }
  };

  const shownChips = data.mpsWithoutTies.slice(0, CHIP_CAP);
  const restChips = data.mpsWithoutTies.length - shownChips.length;

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
          placeholder={en ? "search MP, company, IČO…" : "hledat poslance, firmu, IČO…"}
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
              {c === "all" ? (en ? "all classes" : "všechny třídy") : en ? tieClassInfo(c).labelEn : tieClassInfo(c).labelCs}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", en ? "any corroboration" : "vše (korroborace)"],
              ["confirmed", en ? "registry-confirmed" : "potvrzeno OR"],
              ["unconfirmed", en ? "no registry record" : "OR bez záznamu"],
              ["conflicting", en ? "conflicting" : "v rozporu"],
              ["unchecked", en ? "not checked" : "neověřeno"],
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
              ["all", en ? "any status" : "vše (stav)"],
              ["current", en ? "current" : "trvá"],
              ["ended", en ? "ended" : "ukončeno"],
              ["warn", en ? "flagged" : "k prověření"],
              ["unknown", en ? "unknown" : "neznámo"],
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
              <option value="all">{en ? "all clubs" : "všechny kluby"}</option>
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
        {en ? `${sorted.length} of ${rows.length} ties` : `${sorted.length} z ${rows.length} vazeb`}
      </p>

      {/* ── table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto border-t-2 border-ink">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-ink font-mono text-[10px] uppercase tracking-widest text-steel">
              <Th onClick={() => toggleSort("mp")} active={sortKey === "mp"} dir={sortDir}>
                {en ? "MP" : "poslanec"}
              </Th>
              <Th onClick={() => toggleSort("company")} active={sortKey === "company"} dir={sortDir}>
                {en ? "company" : "firma"}
              </Th>
              <th className="px-3 py-2">{en ? "class" : "třída"}</th>
              <th className="px-3 py-2">{en ? "status" : "stav"}</th>
              <Th onClick={() => toggleSort("reach")} active={sortKey === "reach"} dir={sortDir} align="right">
                {en ? "reach" : "dosah"}
              </Th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ mp, tie }) => {
              const reach = tie.contractCzk + tie.subsidiesCzk;
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
                    <span className="font-bold">{tie.company}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-steel">IČO {tie.ico}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${CLASS_TONE_CLS[info.tone]}`}
                    >
                      {en ? info.labelEn : info.labelCs}
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
                          {en ? "rejected" : "zamítnuto"}
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
                    <span className={`block font-black tabular-nums ${reach > 0 ? "text-signal" : "text-steel"}`}>
                      {reach > 0 ? compactCzk(reach, locale) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center italic text-steel">
                  {en ? "no ties match these filters" : "žádná vazba neodpovídá filtru"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
            {en ? "prev" : "předchozí"}
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
            {en ? "next" : "další"}
          </button>
        </div>
      )}

      {/* ── tie-class explainer (P29 rule) ─────────────────────── */}
      <div className="mt-10">
        <SourceNote>{en ? "how to read the tie class" : "jak číst třídu vazby"}</SourceNote>
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

      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        {t("real.ledger.disclaimer", { pendingLabel: tcom("pendingReview") })}
      </p>
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

// ── Mock fallback (unchanged behaviour, kept for graceful degradation) ───────

const WITH_TIES = MPS.filter((m) => MONEY_TIES.some((tie) => tie.mpId === m.id));
const WITHOUT_TIES = MPS.filter((m) => !MONEY_TIES.some((tie) => tie.mpId === m.id));

function MockLedger() {
  const t = useTranslations("money");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();

  return (
    <div>
      {WITH_TIES.map((mp) => {
        const ties = MONEY_TIES.filter((tie) => tie.mpId === mp.id);
        return (
          <div key={mp.id} className="mb-8">
            <Link
              href={`/poslanec/${mp.id}`}
              className="group flex items-center justify-between gap-3 border-b-2 border-ink pb-2 transition-colors hover:text-signal"
            >
              <span className="text-xl font-black uppercase tracking-tight">
                {mp.name}
                <span className="ml-2 font-mono text-xs font-normal normal-case tracking-normal text-steel">
                  · {mp.party} · {t("ledger.caseFile", { rank: f.int(mp.rank) })}
                </span>
              </span>
              <ArrowUpRight className="h-5 w-5 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            {ties.map((tie) => {
              const i = MONEY_TIES.indexOf(tie);
              return (
                <div
                  key={`${tie.mpId}-${tie.company}`}
                  className="grid gap-3 border-b border-hairline px-1 py-4 sm:grid-cols-[1.2fr_1fr_auto]"
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black uppercase tracking-tight">{tc(`moneyTies.${i}.company`)}</span>
                      {tie.verified ? (
                        <span className="border-2 border-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
                          {tcom("verified")}
                        </span>
                      ) : (
                        <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                          {tcom("pendingReview")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                      IČO {tie.ico} · {tc(`moneyTies.${i}.kind`)}
                    </span>
                  </span>
                  <span className="text-[15px] leading-relaxed text-steel">{tc(`moneyTies.${i}.note`)}</span>
                  <span className="text-right">
                    <span className={`block text-xl font-black tabular-nums ${tie.amount === "—" ? "text-steel" : "text-signal"}`}>
                      {tc(`moneyTies.${i}.amount`)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                      {tie.year} · {tc(`moneyTies.${i}.source`)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="border-2 border-dashed border-hairline p-5">
        <SourceNote>{t("ledger.noTiesNote")}</SourceNote>
        <div className="mt-2 flex flex-wrap gap-2">
          {WITHOUT_TIES.map((mp) => (
            <Link
              key={mp.id}
              href={`/poslanec/${mp.id}`}
              className="border-2 border-hairline px-3 py-1.5 text-sm font-bold transition-colors hover:border-ink hover:bg-paper-strong"
            >
              {mp.name}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        {t("ledger.disclaimer", { pendingLabel: tcom("pendingReview") })}
      </p>
    </div>
  );
}
