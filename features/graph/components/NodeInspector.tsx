"use client";

/*
 * Inspektor uzlu — místo, kde se láme celý slib produktu: „každá položka je
 * dohledatelná k oficiálnímu zdroji".
 *
 * Panel proto rozděluje dvě věci, které se nesmí slít:
 *
 *   ZÁZNAM V GRAFU (provenience) — odkud se ten uzel v našich datech vzal:
 *       pass, metoda (deterministic = spočítáno kódem / verdict = návrh
 *       modelu prošlý branou), ref a čas výpočtu. Tohle máme vždycky.
 *   REGISTRY — kde si to čtenář ověří u zdroje. Odkazy se skládají z uloženého
 *       identifikátoru (IČO, pspId, číslo tisku), nebo — když ho uzel nese —
 *       z uložené adresy (smlouva, vývěska). Rozlišujeme „detail" (kanonická
 *       stránka té entity) a „dotaz" (hledání v registru, které netvrdí, že
 *       vede přesně sem); to rozlišení je celý smysl tohohle panelu.
 *
 * Když registr chybí, panel to ŘEKNE. Odvozené uzly (blok, téma) žádný registr
 * nevedou, klub ani výbor nemají na psp.cz vlastní stránku — mlčet o tom by
 * bylo horší než prázdno. (Do 2026-08-13 tenhle komentář tvrdil, že ingest
 * zahazuje i URL vývěsky; nezahazuje — viz lib/kg/sourceLinks.ts.)
 */

import { useTranslations } from "next-intl";
import { ExternalLink, Plus, X } from "lucide-react";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { glyphPath, KIND_STYLE } from "../kindStyle";
import type { NodeDetail } from "../graphTypes";

export default function NodeInspector({
  detail,
  loading,
  onClose,
  onExpand,
  onRemove,
  expandLabel,
}: {
  detail: NodeDetail | null;
  loading: boolean;
  onClose: () => void;
  /** Rozbalit okolí uzlu — varianta si určí, co to znamená. */
  onExpand?: (id: string) => void;
  onRemove?: (id: string) => void;
  expandLabel?: string;
}) {
  const t = useTranslations("graph");
  const f = useFormat();

  if (loading) {
    return (
      <div className="border-2 border-ink bg-paper p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-steel">{t("inspector.loading")}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="border-2 border-ink bg-paper p-5">
        <p className="font-mono text-xs uppercase tracking-widest text-steel">{t("inspector.empty")}</p>
      </div>
    );
  }

  const { node, provenance, links, facts, citableId, degree } = detail;
  const style = KIND_STYLE[node.kind];

  return (
    <div className="flex max-h-full flex-col border-2 border-ink bg-paper shadow-lg">
      <div className="flex items-start justify-between gap-3 border-b-2 border-ink px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
            <svg viewBox="-12 -12 24 24" className="h-3 w-3 shrink-0" aria-hidden>
              <path d={glyphPath(style.shape, 9)} fill={style.fill} />
            </svg>
            {t(`kinds.${node.kind}`)}
          </p>
          <h3 className="mt-1 text-lg font-black uppercase leading-tight tracking-tight">{node.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("inspector.close")}
          className="shrink-0 border border-hairline p-1 text-steel transition-colors hover:border-ink hover:text-signal"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-hairline px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-steel">
          <span>
            {t("inspector.degree")}: <span className="font-bold text-ink">{f.int(degree)}</span>
          </span>
          {citableId && (
            <span>
              {t("inspector.identifier")}: <span className="font-bold text-ink">{citableId}</span>
            </span>
          )}
        </div>

        {facts.length > 0 && (
          <dl className="border-b border-hairline px-4 py-3">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline justify-between gap-4 py-1">
                {/* Klíč se ukazuje tak, jak se jmenuje v grafu — čtenář pak ví,
                    které pole si má u zdroje ověřit. */}
                <dt className="font-mono text-[11px] uppercase tracking-wider text-steel">{fact.label}</dt>
                <dd className="text-right text-sm font-bold tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* ── Registry ─────────────────────────────────────────────── */}
        <div className="border-b border-hairline px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-signal">
            {t("inspector.registries")}
          </p>
          {links.length === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-steel">{t(`inspector.noSource.${node.kind}`)}</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex items-baseline justify-between gap-2 text-sm transition-colors hover:text-signal"
                  >
                    <span className="min-w-0 truncate font-medium underline-offset-2 group-hover:underline">
                      {l.registry}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                      {t(`inspector.tier.${l.tier}`)}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Provenience ──────────────────────────────────────────── */}
        <div className="px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-steel">
            {t("inspector.provenance")}
          </p>
          <div className="mt-2 space-y-1 font-mono text-[11px] uppercase tracking-wider text-steel">
            {provenance.method && (
              <p>
                {t("inspector.method")}:{" "}
                <span className={provenance.method === "deterministic" ? "font-bold text-cobalt" : "font-bold text-ochre"}>
                  {t(`inspector.methodValue.${provenance.method === "deterministic" ? "deterministic" : "verdict"}`)}
                </span>
              </p>
            )}
            {provenance.pass !== null && <p>pass {provenance.pass}</p>}
            {provenance.ref && <p className="break-all normal-case">{provenance.ref}</p>}
            {provenance.computedAt && <p>{f.date(provenance.computedAt.slice(0, 10))}</p>}
            {!provenance.method && !provenance.ref && <p>{t("inspector.noProvenance")}</p>}
          </div>
        </div>
      </div>

      {(onExpand || onRemove) && (
        <div className="flex shrink-0 gap-px border-t-2 border-ink bg-ink">
          {onExpand && (
            <button
              type="button"
              onClick={() => onExpand(node.id)}
              className="flex flex-1 items-center justify-center gap-1.5 bg-paper px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-paper-strong"
            >
              <Plus className="h-3.5 w-3.5 text-signal" />
              {expandLabel ?? t("inspector.expand")}
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(node.id)}
              className="flex flex-1 items-center justify-center gap-1.5 bg-paper px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-paper-strong"
            >
              <X className="h-3.5 w-3.5 text-steel" />
              {t("inspector.remove")}
            </button>
          )}
        </div>
      )}

      <div className="shrink-0 border-t border-hairline px-4 py-2">
        <SourceNote>{t("inspector.footnote")}</SourceNote>
      </div>
    </div>
  );
}
