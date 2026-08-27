/*
 * Karta subjektu — štítek, volební lístek, okno volebního období, ledger,
 * nálezy, časová osa. Jedna komponenta pro obec, kraj i kandidátku: liší se
 * jen tím, co je subjekt, ne tím, jak se o něm mluví.
 *
 * Na komunální a krajské kartě NIKDY nestojí jméno osoby (design record
 * election-replay, vlna 2): karta nese zadavatele; lidi jmenuje jen lidsky
 * brány modul peněz. Nulový stav není prázdno — říká, podle jakých pravidel
 * a v jakém období se nic nenašlo.
 */

import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { termWindow } from "@/lib/analysis/volby/terms";
import type { SubjectCard as SubjectCardData } from "@/lib/analysis/volby/types";
import type { VolbyIntl } from "../volbyIntl";
import FindingRow from "./FindingRow";
import LedgerTiles from "./LedgerTiles";
import OutcomeTimeline from "./OutcomeTimeline";

export default function SubjectCard({
  card,
  title,
  index,
  t,
  f,
}: {
  card: SubjectCardData;
  /** Nadpis sekce (např. „Obec jako zadavatel"). */
  title: string;
  /** Index sekce pro SectionHeading (/02, /03 …); časová osa dostane index + 1. */
  index: number;
  t: VolbyIntl["t"];
  f: VolbyIntl["f"];
}) {
  const window = termWindow(card.ballot);
  const isTender = card.ballot !== "snemovni";
  return (
    <>
      <section id={`nalezy-${card.ballot}`} className="border-t-4 border-ink pt-10">
        <SectionHeading
          index={index}
          title={title}
          aside={<SourceNote>{t("card.window", { label: window.label })}</SourceNote>}
        />
        <p className="mt-4 text-2xl font-black uppercase tracking-tight">{card.label}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel-aa">{t(`ballot.${card.ballot}`)}</p>
        <div className="mt-6">
          <LedgerTiles ledger={card.ledger} t={t} f={f} />
        </div>
        {isTender && <p className="mt-3 text-sm text-steel-aa">{t("card.noPersons")}</p>}

        <h3 className="mt-8 text-xl font-black uppercase tracking-tight">
          {t("sections.findings")}
          <span className="text-signal">.</span>
        </h3>
        {card.findings.length === 0 ? (
          <p className="mt-3 border-l-4 border-hairline pl-4 text-[15px] leading-relaxed text-steel-aa">
            {t(isTender ? "card.zeroTender" : "card.zeroMp", { window: window.label })}
          </p>
        ) : (
          <div className="mt-3 border-t-2 border-ink">
            {card.findings.map((finding) => (
              <FindingRow key={finding.id} finding={finding} t={t} f={f} />
            ))}
          </div>
        )}
      </section>

      <section id={`dnes-${card.ballot}`} className="border-t-4 border-ink pt-10">
        <SectionHeading
          index={index + 1}
          title={t("sections.timeline")}
          aside={<SourceNote>{t("sections.timelineSource")}</SourceNote>}
        />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("sections.timelineLead")}</p>
        <div className="mt-6">
          <OutcomeTimeline timeline={card.timeline} t={t} f={f} />
        </div>
      </section>
    </>
  );
}
