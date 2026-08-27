/*
 * Kniha kandidátek — tabulka ListSummary řádků: kandidátka, mandáty, počty
 * nálezů po valenci a „dnes sedí v" (klub ≠ kandidátka; rozdíl je viditelný
 * v posledním sloupci, nikdy sloučený). Sdílí ji domovská plocha (/volby) a
 * index /volby/snemovna. Každý řádek vede na stránku kandidátky; `pinKraj`
 * přenese kraj do adresy, aby se poslanci toho kraje připnuli nahoře.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import type { ListSummary, Valence } from "@/lib/analysis/volby/types";
import type { VolbyIntl } from "../volbyIntl";

const sum = (l: ListSummary, v: Valence) => l.ledger.counts[v].high + l.ledger.counts[v].medium + l.ledger.counts[v].low;

export default function ListsLedger({
  lists,
  pinKraj,
  t,
  f,
}: {
  lists: readonly ListSummary[];
  /** Slug kraje, který má stránka kandidátky připnout (?kraj=). */
  pinKraj?: string | null;
  t: VolbyIntl["t"];
  f: VolbyIntl["f"];
}) {
  if (lists.length === 0) {
    return <p className="border-l-4 border-hairline pl-4 text-[15px] leading-relaxed text-steel-aa">{t("lists.empty")}</p>;
  }
  const href = (slug: string) => (pinKraj ? `/volby/snemovna/${slug}?kraj=${encodeURIComponent(pinKraj)}` : `/volby/snemovna/${slug}`);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <caption className="sr-only">{t("lists.title")}</caption>
        <thead>
          <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel-aa">
            <th scope="col" className="py-2 pr-3">
              {t("lists.colList")}
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              {t("lists.colSeats")}
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              {t("lists.colNegative")}
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              {t("lists.colPositive")}
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              {t("lists.colUnrated")}
            </th>
            <th scope="col" className="py-2">
              {t("lists.colClubs")}
            </th>
          </tr>
        </thead>
        <tbody>
          {lists.map((l) => (
            <tr key={l.slug} className="border-b border-hairline hover:bg-paper-strong">
              <th scope="row" className="py-3 pr-3 font-normal">
                <Link
                  href={href(l.slug)}
                  aria-label={t("lists.open", { label: l.label })}
                  className="group inline-flex items-center gap-1 text-[15px] font-black uppercase tracking-tight transition-colors hover:text-signal"
                >
                  {l.label}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </Link>
              </th>
              <td className="py-3 pr-3 text-right font-mono text-xs tabular-nums">{f.int(l.seats)}</td>
              <td className="py-3 pr-3 text-right font-mono text-xs font-bold tabular-nums text-signal-deep">{f.int(sum(l, "negative"))}</td>
              <td className="py-3 pr-3 text-right font-mono text-xs font-bold tabular-nums text-cobalt">{f.int(sum(l, "positive"))}</td>
              <td className="py-3 pr-3 text-right font-mono text-xs tabular-nums text-steel-aa">{f.int(sum(l, "unrated"))}</td>
              <td className="py-3 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                {Object.entries(l.clubsToday)
                  .sort((a, b) => b[1] - a[1])
                  .map(([club, n]) => `${club} ${f.int(n)}`)
                  .join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceNote className="mt-3">{t("lists.source")}</SourceNote>
    </div>
  );
}
