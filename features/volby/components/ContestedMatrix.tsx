/*
 * Sporná hlasování — ZÁZNAM pozic kandidátky ve dvanácti nejtěsnějších
 * hlasováních PSP10, v maticovém idiomu linií klubů
 * (votetrack/RealDisciplineBoard): tabulka se `scope`, linie jako glyfa
 * (▲ pro / ▼ proti / ◆ rozděleno) s textem pro odečítačku. Není to nález:
 * směr hlasování nemá odvoditelnou hodnotu (design record, vlna 2).
 */

import SourceNote from "@/features/shared/components/SourceNote";
import { votePspUrl } from "@/features/votetrack/record/anchor";
import type { RecordRow } from "@/lib/analysis/volby/types";
import type { VolbyIntl } from "../volbyIntl";
import { sharePct } from "../labels";

const LINE_GLYPH: Record<RecordRow["line"], string> = { yes: "▲", no: "▼", split: "◆" };
const LINE_CHIP: Record<RecordRow["line"], string> = {
  yes: "border-cobalt text-cobalt",
  no: "border-signal-deep text-signal-deep",
  split: "border-dashed border-steel text-steel-aa",
};
const LINE_KEY: Record<RecordRow["line"], string> = { yes: "list.lineYes", no: "list.lineNo", split: "list.lineSplit" };

export default function ContestedMatrix({
  rows,
  t,
  f,
}: {
  rows: readonly RecordRow[];
  t: VolbyIntl["t"];
  f: VolbyIntl["f"];
}) {
  if (rows.length === 0) {
    return <p className="border-l-4 border-hairline pl-4 text-[15px] leading-relaxed text-steel-aa">{t("sections.contestedEmpty")}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <caption className="sr-only">{t("sections.contested")}</caption>
        <thead>
          <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel-aa">
            <th scope="col" className="py-2 pr-3">
              {t("list.colDate")}
            </th>
            <th scope="col" className="py-2 pr-3">
              {t("list.colVote")}
            </th>
            <th scope="col" className="py-2 pr-3 text-center">
              {t("list.colLine")}
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              {t("list.colYes")}
            </th>
            <th scope="col" className="py-2 pr-3 text-right">
              {t("list.colNo")}
            </th>
            <th scope="col" className="py-2 text-right">
              {t("list.colContested")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.votePspId} className="border-b border-hairline hover:bg-paper-strong">
              <td className="py-2.5 pr-3 font-mono text-[11px] uppercase tracking-wider text-steel">{f.date(r.votedOn)}</td>
              <th scope="row" className="py-2.5 pr-3 text-[15px] font-normal leading-snug">
                <a
                  href={votePspUrl(r.votePspId)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("list.voteLink", { id: String(r.votePspId) })}
                  className="transition-colors hover:text-signal"
                >
                  {r.title}
                </a>
              </th>
              <td className="py-2.5 pr-3 text-center">
                <span
                  className={`inline-flex min-w-[3.75rem] items-center justify-center gap-1 border-2 px-1.5 py-1 font-mono text-xs font-bold ${LINE_CHIP[r.line]}`}
                >
                  <span aria-hidden>{LINE_GLYPH[r.line]}</span>
                  <span className="sr-only">{t(LINE_KEY[r.line])}</span>
                </span>
              </td>
              <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums">{f.int(r.yes)}</td>
              <td className="py-2.5 pr-3 text-right font-mono text-xs tabular-nums">{f.int(r.no)}</td>
              <td className="py-2.5 text-right font-mono text-xs tabular-nums">{f.dec(sharePct(r.contestedness))} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceNote className="mt-3">{t("sections.contestedSource")}</SourceNote>
    </div>
  );
}
