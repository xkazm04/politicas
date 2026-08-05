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
import { useTranslations } from "next-intl";
import type { MoneyTie } from "../moneyTypes";

export default function AnalystNote({
  tie,
  className = "",
}: {
  tie: Pick<MoneyTie, "reviewerNote" | "corroborationProvenance" | "corroborationSource" | "reviewState">;
  /** Přijímáno kvůli starším call sites (ověřovací konzole) — jazyk řeší next-intl. */
  en?: boolean;
  className?: string;
}) {
  const t = useTranslations("money");
  const note = tie.reviewerNote?.trim();
  const prov = tie.corroborationProvenance;
  const stamp = !note
    ? []
    : ([
        prov.computedAt ? t("analystNote.written", { date: prov.computedAt.slice(0, 10) }) : null,
        prov.pass != null ? t("analystNote.pass", { pass: prov.pass }) : null,
        prov.ref,
      ].filter(Boolean) as string[]);
  if (!note) return null;

  return (
    <div className={className}>
      <p className="border-l-2 border-hairline pl-3 text-sm leading-relaxed text-steel-aa">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
          {t("analystNote.heading")}:{" "}
        </span>
        {note}
      </p>
      <p className="mt-1 pl-3 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel-aa">
        {stamp.length > 0 ? stamp.join(" · ") : t("analystNote.noStamp")}
        {" · "}
        {t("analystNote.notHuman")}
        {tie.reviewState === "pending_review" ? ` · ${t("analystNote.stillPending")}` : ""}
      </p>
      {tie.corroborationSource ? (
        <a
          href={tie.corroborationSource}
          target="_blank"
          rel="noreferrer"
          className="mt-1 ml-3 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          <ExternalLink className="h-3 w-3" />
          {t("analystNote.sourceLink")}
        </a>
      ) : (
        <p className="mt-1 pl-3 font-mono text-[10px] uppercase tracking-wider text-steel-aa">
          {t("analystNote.noSource")}
        </p>
      )}
    </div>
  );
}
