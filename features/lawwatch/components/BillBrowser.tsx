"use client";

/*
 * Bill browser — the /zakony section 1 replacement for the old single accreted
 * list+inline-detail split. Filters (origin, forensic posudek, §-diff, možný
 * střet, přikázání výborům) + free-text search over title/cislo, then a dense
 * row list. Each row that carries a public print number routes to the
 * dossier at /zakony/[cislo] — bills without a `cislo` (rare) render as a
 * non-clickable row since `cislo`, never the internal `tiskId`, is the URL key.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BillOrigin, LawBillView, LawData } from "../getLawData";
import { ORIGIN_CZ } from "../lawwatchLabels";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";

type FacetKey = "diff" | "forensic" | "conflict" | "committee";

const FACETS: { key: FacetKey; label: string; test: (b: LawBillView) => boolean }[] = [
  { key: "diff", label: "§-diff", test: (b) => b.paragraphDiffs.length > 0 },
  { key: "forensic", label: "posudek", test: (b) => b.forensic != null },
  { key: "conflict", label: "možný střet", test: (b) => b.flaggedConflict },
  { key: "committee", label: "přikázáno výboru", test: (b) => b.committees.length > 0 },
];

const ORIGIN_ORDER: BillOrigin[] = ["government", "mp_group", "mp", "senate", "other"];

export default function BillBrowser({ data }: { data: LawData }) {
  const f = useFormat();
  const [origin, setOrigin] = useState<BillOrigin | null>(null);
  const [facet, setFacet] = useState<FacetKey | null>(null);
  const [query, setQuery] = useState("");

  const activeFacet = FACETS.find((x) => x.key === facet) ?? null;

  // Facet badges must count against the ORIGIN-filtered subset (and vice
  // versa) — otherwise a badge shows "posudek · 12" computed over ALL bills
  // while the origin filter is narrowed to a handful, so clicking it can
  // legitimately yield zero rows even though the badge just promised 12. The
  // two filters read each other's active selection, not the raw dataset.
  const originFilteredBills = useMemo(
    () => (origin ? data.bills.filter((b) => b.origin === origin) : data.bills),
    [data.bills, origin],
  );
  const facetFilteredBills = useMemo(
    () => (activeFacet ? data.bills.filter((b) => activeFacet.test(b)) : data.bills),
    [data.bills, activeFacet],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.bills.filter(
      (b) =>
        (!origin || b.origin === origin) &&
        (!activeFacet || activeFacet.test(b)) &&
        (!q ||
          b.title.toLowerCase().includes(q) ||
          (b.summary?.toLowerCase().includes(q) ?? false) ||
          String(b.cislo ?? "").includes(q) ||
          b.amendedLaws.some((l) => l.ref.includes(q))),
    );
  }, [data.bills, origin, activeFacet, query]);

  return (
    <div>
      {/* filtry: původ */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOrigin(null)}
          className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
            origin === null ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
          }`}
          aria-pressed={origin === null}
        >
          vše
        </button>
        {ORIGIN_ORDER.filter((o) => data.originCounts[o]).map((o) => {
          const count = facetFilteredBills.filter((b) => b.origin === o).length;
          return (
            <button
              key={o}
              type="button"
              onClick={() => setOrigin(origin === o ? null : o)}
              className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                origin === o ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:text-ink"
              }`}
              aria-pressed={origin === o}
            >
              {ORIGIN_CZ[o]} · {f.int(count)}
            </button>
          );
        })}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="hledat tisk, shrnutí, zákon č. …"
          aria-label="Hledat tisk podle shrnutí, názvu, čísla nebo novelizovaného zákona"
          className="ml-auto border-2 border-hairline bg-paper px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-ink placeholder:text-steel focus:border-ink focus:outline-none"
        />
      </div>

      {/* filtry: stav zpracování */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-steel">Stav:</span>
        {FACETS.map((x) => {
          const count = originFilteredBills.filter(x.test).length;
          const active = facet === x.key;
          // Hide a zero-count facet UNLESS it's the currently active one — an
          // active facet whose count drops to 0 under a newly-combined origin
          // filter must stay visible so the user has a way to clear it.
          if (count === 0 && !active) return null;
          return (
            <button
              key={x.key}
              type="button"
              onClick={() => setFacet(active ? null : x.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                active ? "border-cobalt bg-cobalt text-paper" : "border-hairline text-steel hover:text-ink"
              }`}
            >
              {x.label} · {f.int(count)}
            </button>
          );
        })}
      </div>

      {/* seznam */}
      <div className="mt-6 border-t-2 border-ink">
        {rows.map((b) => {
          const content = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal">
                  {b.cislo != null ? `sn. tisk ${b.cislo}` : `tisk ${b.tiskId}`}
                </span>
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-steel">
                  {b.paragraphDiffs.length > 0 && <span className="font-black text-ochre">§-diff</span>}
                  {b.forensic && <span className="font-black text-cobalt">posudek</span>}
                  {b.flaggedConflict && <span className="font-black text-signal">možný střet</span>}
                  <span>{b.amendedLaws.length}× zákon</span>
                </span>
              </span>
              {/* „co to mění" je to první, co čtenář uvidí — oficiální název tisku je až pod ním. */}
              <span className="mt-1 block text-[15px] font-bold leading-snug">
                {b.summary ?? "Shrnutí zatím není"}
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-steel">{b.title}</span>
              <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                {ORIGIN_CZ[b.origin]}
              </span>
            </>
          );
          return b.cislo != null ? (
            <Link
              key={b.tiskId}
              href={`/zakony/${b.cislo}`}
              className="group block border-b border-hairline py-4 pr-2 transition-colors hover:bg-paper-strong"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">{content}</span>
                <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-signal opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </Link>
          ) : (
            <div key={b.tiskId} className="border-b border-hairline py-4 pr-2 opacity-70">
              {content}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="border-2 border-dashed border-hairline p-6 text-sm text-steel">
            Žádný tisk neodpovídá filtru.
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <SourceNote>
          zobrazeno {f.int(rows.length)} z {f.int(data.totalBills)} tisků · {f.int(data.summaryCount)} se shrnutím
        </SourceNote>
        <SourceNote className="!text-[10px]">psp.cz tisky · průchod grafu {data.pass ?? "?"}</SourceNote>
      </div>
    </div>
  );
}
