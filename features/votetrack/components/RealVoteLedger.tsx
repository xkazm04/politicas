"use client";

/**
 * Deník hlasování nad REÁLNÝM záznamem — the LEDGER_WINDOW most recent valid
 * roll calls as a selectable chronicle. Each row carries the vote's permanent
 * anchor id (`h-<pspId>`, see record/anchor.ts); selecting a row writes that
 * fragment into the address bar, and arriving with the fragment scrolls to and
 * highlights the row (useVoteAnchor). The mock VoteLedger stays behind the
 * store-outage fallback only.
 */

import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import CopyLinkButton from "@/features/shared/components/CopyLinkButton";
import SourceNote from "@/features/shared/components/SourceNote";
import { voteAnchorId } from "../record/anchor";
import type { ThresholdCoverage } from "../record/threshold";
import type { ClubTally, LedgerVote } from "../record/types";

function RatioBar({ total }: { total: ClubTally }) {
  const seats = total.yes + total.no + total.k + total.away;
  if (seats === 0) return <div className="h-3 w-full bg-hairline" />;
  const w = (n: number) => `${(n / seats) * 100}%`;
  return (
    <div className="flex h-3 w-full overflow-hidden bg-hairline">
      {total.yes > 0 && <span className="h-full bg-cobalt" style={{ width: w(total.yes) }} />}
      {total.k > 0 && <span className="h-full bg-ochre" style={{ width: w(total.k) }} />}
      {total.away > 0 && <span className="h-full bg-hairline" style={{ width: w(total.away) }} />}
      {total.no > 0 && <span className="h-full bg-signal" style={{ width: w(total.no) }} />}
    </div>
  );
}

export default function RealVoteLedger({
  votes,
  selectedId,
  highlightedId,
  onSelect,
  ledgerWindow,
  validTotal,
  thresholds,
}: {
  votes: LedgerVote[];
  selectedId: number;
  /** Row arriving via a #h-… permalink — gets the temporary flash treatment. */
  highlightedId: number | null;
  onSelect: (votePspId: number) => void;
  ledgerWindow: number;
  validTotal: number;
  /** Práh přes CELÝ záznam, ne přes okno deníku. Nález „práh není prostou většinou
   *  přítomných" je v korpusu vzácný, takže by ho čtenář v padesáti řádcích skoro
   *  nikdy nepotkal — populace proto stojí pod seznamem. */
  thresholds: ThresholdCoverage;
}) {
  const t = useTranslations("votetrack");
  const tcom = useTranslations("common");
  const f = useFormat();
  /** Rozdíl proti prahu jako krátká fráze do řádku. `null` = spočítat ho nejde,
   *  a řádek pak mlčí právě o něm — chybějící sloupec pojmenují dvě jmenovky vedle. */
  const marginPhrase = (margin: number | null): string | null =>
    margin === null
      ? null
      : margin === 0
        ? t("record.thresholdRowExact")
        : margin > 0
          ? t("record.thresholdRowOver", { n: margin, nFmt: f.int(margin) })
          : t("record.thresholdRowUnder", { n: -margin, nFmt: f.int(-margin) });
  const sessionVote = (session: number | null, vote: number | null) =>
    [
      session !== null ? t("record.sessionLabel", { session }) : null,
      vote !== null ? t("record.voteNumberLabel", { vote }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <div className="min-w-0">
      {/* Deník JE seznam a odečítačka to má vědět — kolik má položek a kde
          položka končí. Do 2026-08-12 to byl proud holých <div>ů (týž nález
          a týž lék jako v /denik, kde se vydání dne stalo <article> a jeho
          zápisy <ul>/<li>).

          Tabulkou to schválně NENÍ: řádek deníku není mřížka hodnot, ale
          skládaná karta (datum · titulek na dva řádky · pruh sálu · poměr
          a odkaz) a od 2026-08-10 je celý obalem kolem tlačítka + kopírovacího
          odkazu. Role `row`/`cell` by nad tímhle tvarem musely obalit tlačítko
          buňkou — tedy zahodit jeho roli — nebo celý řádek prohlásit za jednu
          buňku, což je tabulka jen naoko. Sloupcovou mřížkou je vedle matice
          linií a ta tabulka opravdu je. */}
      <ul className="list-none border-t-2 border-ink" aria-label={t("record.ledgerListAria")}>
        {votes.map((v) => {
          const selected = v.pspId === selectedId;
          const flashed = v.pspId === highlightedId;
          const margin = marginPhrase(v.threshold.margin);
          return (
            // Řádek je od 2026-08-10 obal, ne tlačítko: trvalý odkaz sliboval jen
            // `title`, takže si ho čtenář musel složit z adresního řádku sám —
            // a tlačítko „kopírovat odkaz" uvnitř tlačítka je neplatné HTML.
            // Kotva `#h-…` proto sedí na obalu, který se i posouvá do zorného pole.
            <li
              key={v.pspId}
              id={voteAnchorId(v.pspId)}
              className={`scroll-mt-24 border-b border-hairline transition-colors duration-500 motion-reduce:transition-none ${
                selected ? "border-l-4 border-l-signal bg-paper-strong pl-3" : "pl-0"
              } ${flashed ? "bg-paper-strong ring-2 ring-inset ring-signal" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelect(v.pspId)}
                aria-pressed={selected}
                title={t("record.permalinkTitle")}
                className="block w-full pr-2 pt-4 text-left transition-colors hover:bg-paper-strong motion-reduce:transition-none"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs uppercase tracking-wider text-steel-aa">
                    {v.votedOn ? f.date(v.votedOn) : "—"}
                    {v.time ? ` · ${v.time}` : ""} · {sessionVote(v.sessionNo, v.voteNo)}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-black uppercase tracking-wider ${
                      v.outcome === "accepted" ? "text-cobalt" : "text-signal-deep"
                    }`}
                  >
                    {v.outcome === "accepted" ? tcom("voteResult.accepted") : tcom("voteResult.rejected")}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 block text-[15px] font-bold leading-snug">{v.title}</span>
                <span className="mt-2 block">
                  <RatioBar total={v.stat.total} />
                </span>
              </button>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pb-3 pr-2">
                <span className="flex flex-wrap items-center gap-x-3 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                  {/* „150:30" je pro odečítačku jen dvě čísla s dvojtečkou.
                      Vidět zůstává poměr, slyšet obě strany i s podmětem. */}
                  <span className="tabular-nums" aria-hidden>
                    {f.int(v.stat.total.yes)}:{f.int(v.stat.total.no)}
                  </span>
                  <span className="sr-only">
                    {t("record.tallyAria", { yes: f.int(v.stat.total.yes), no: f.int(v.stat.total.no) })}
                  </span>
                  {/* Kolik jich v sále bylo a kolik hlasů bylo potřeba — sloupce
                      zdroje u tohoto hlasování. Čtou se jako slova, takže tu
                      žádná dvojice aria-hidden/sr-only nevzniká; chybějící sloupec
                      má vlastní větu a nikdy se nesází nulou. */}
                  <span className="tabular-nums">
                    {v.threshold.present === null
                      ? t("record.thresholdRowPresentNone")
                      : t("record.thresholdRowPresent", { nFmt: f.int(v.threshold.present) })}
                  </span>
                  <span className="tabular-nums">
                    {v.threshold.quorum === null
                      ? t("record.thresholdRowQuorumNone")
                      : t("record.thresholdRowQuorum", { nFmt: f.int(v.threshold.quorum) })}
                  </span>
                  {margin !== null && <span className="font-bold tabular-nums text-ink">{margin}</span>}
                  {v.rebels.length > 0 && (
                    <span className="font-bold text-signal-deep">{t("rebelsCount", { n: v.rebels.length })}</span>
                  )}
                </span>
                {/* Sdílená katalogová komponenta, nikdy druhá kopie — a kopíruje
                    přesně tu adresu, kterou slibuje `title` na řádku. */}
                <CopyLinkButton
                  path={`/hlasovani#${voteAnchorId(v.pspId)}`}
                  label={t("record.copyPermalink")}
                  errorContext="deník hlasování: kopírování trvalého odkazu selhalo"
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 space-y-1.5">
        <SourceNote>{t("record.ledgerFootnote", { window: ledgerWindow, valid: validTotal })}</SourceNote>
        {/* Druhá citace, ne delší první: mluví o JINÉ populaci — o celém záznamu,
            ne o okně deníku nad ní. Bez ní by se řádkový nález („práh se od prosté
            většiny přítomných liší") četl jako vlastnost padesáti vypsaných
            hlasování, přestože derivace ho zná u každého platného. */}
        <SourceNote>
          {t("record.thresholdFootnote", {
            comparable: f.int(thresholds.thresholdComparable),
            differs: f.int(thresholds.thresholdDiffers),
            withoutQuorum: f.int(thresholds.withoutQuorum),
          })}
        </SourceNote>
      </div>
    </div>
  );
}
