"use client";

/*
 * ANALYTICKÁ POZNÁMKA U VAZBY — jedna sazba pro veřejný spis (/penize/[pspId]) i pro
 * interní ověřovací konzoli (/penize/kontrola).
 *
 * `kg_edge.props.reviewer_note` je próza, kterou napsal analytický průchod (ARES-VR
 * rekonciliace, dataor, re-verifikace) — na živém grafu ji nese 211 z 211 vazeb. Nese ji
 * i strojová kontrola jazykovým modelem. Takový text se NESMÍ sázet stejným hlasem jako
 * doložený fakt: patří k němu, KDO ho napsal (průchod), KDY (computedAt), z jakého
 * DOKLADU (corroboration_source) a že vazba pořád čeká na lidskou bránu.
 *
 * Chybějící pole se přiznává („průchod ani datum graf u téhle poznámky nevede"), nikdy se
 * nedoplňuje ani nemlčí. Text se nezkracuje ani nepřepisuje — je to doklad.
 *
 * JAZYKOVÁ BRÁNA (měřeno 2026-08-04): `lib/analysis/language-gate.ts` označí 14 z 211
 * těchto poznámek za anglické, ačkoli všechny jsou česky — klasifikátor je stopwordový a
 * rejstříková čeština je plná homografů („OR" = obchodní rejstřík, „evidence", „ARES VR").
 * Poznámky proto NEZADRŽUJEME (zadržet doklad recenzentovi je horší než ho ukázat);
 * bránou prochází copy, kterou píšeme my — viz `features/money/tieFlags.test.ts`.
 */

import { ExternalLink } from "lucide-react";
import type { MoneyTie } from "../moneyTypes";

export default function AnalystNote({
  tie,
  en,
  className = "",
}: {
  tie: Pick<MoneyTie, "reviewerNote" | "corroborationProvenance" | "corroborationSource" | "reviewState">;
  en: boolean;
  className?: string;
}) {
  const note = tie.reviewerNote?.trim();
  if (!note) return null;
  const prov = tie.corroborationProvenance;
  const stamp = [
    prov.computedAt ? (en ? `written ${prov.computedAt.slice(0, 10)}` : `zapsáno ${prov.computedAt.slice(0, 10)}`) : null,
    prov.pass != null ? (en ? `graph pass ${prov.pass}` : `průchod grafu ${prov.pass}`) : null,
    prov.ref,
  ].filter(Boolean) as string[];

  return (
    <div className={className}>
      <p className="border-l-2 border-hairline pl-3 text-sm leading-relaxed text-steel-aa">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
          {en ? "analysis note" : "poznámka analýzy"}:{" "}
        </span>
        {note}
      </p>
      <p className="mt-1 pl-3 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel-aa">
        {stamp.length > 0
          ? stamp.join(" · ")
          : en
            ? "the graph records no pass or date for this note"
            : "průchod ani datum graf u téhle poznámky nevede"}
        {" · "}
        {en
          ? "an analysis pass wrote this, not a human review"
          : "napsal analytický průchod, ne lidská kontrola"}
        {tie.reviewState === "pending_review"
          ? en
            ? " · the tie is still pending review"
            : " · vazba stále čeká na kontrolu"
          : ""}
      </p>
      {tie.corroborationSource ? (
        <a
          href={tie.corroborationSource}
          target="_blank"
          rel="noreferrer"
          className="mt-1 ml-3 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          <ExternalLink className="h-3 w-3" />
          {en ? "the registry record the pass read" : "doklad, ze kterého průchod četl"}
        </a>
      ) : (
        <p className="mt-1 pl-3 font-mono text-[10px] uppercase tracking-wider text-steel-aa">
          {en ? "no registry document cited for this note" : "k poznámce není uvedený rejstříkový doklad"}
        </p>
      )}
    </div>
  );
}
