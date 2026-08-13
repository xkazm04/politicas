"use client";

/**
 * Orchestrátor reálného záznamu — sections 01–04 of /hlasovani when the store
 * delivers the real ledger: 01 Seismograf (hero), 02 Deník a sál, 03 Linie
 * klubů, 04 Rebelie. Owns the selected-vote state and the permalink anchors
 * (useVoteAnchor); the mock components render only in the outage fallback,
 * which lives in VoteTrackPage.
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import type { VoteRecordData } from "../record/types";
import RealChamberDetail from "./RealChamberDetail";
import RealDisciplineBoard from "./RealDisciplineBoard";
import RealRebellions from "./RealRebellions";
import RealVoteLedger from "./RealVoteLedger";
import Seismograf from "./Seismograf";
import { useVoteAnchor } from "./useVoteAnchor";

export default function RealVoteTrack({ record }: { record: VoteRecordData }) {
  const t = useTranslations("votetrack");
  const f = useFormat();
  const [selectedId, setSelectedId] = useState(record.ledger[0].pspId);
  const ledgerIds = useMemo(() => record.ledger.map((l) => l.pspId), [record.ledger]);
  const { highlighted, setAnchor, jumpTo } = useVoteAnchor(ledgerIds, setSelectedId);
  const selected = record.ledger.find((l) => l.pspId === selectedId) ?? record.ledger[0];

  const select = (id: number) => {
    setSelectedId(id);
    setAnchor(id);
  };

  return (
    <>
      {/* Nepojmenovaná `<section>` se jako orientační bod vůbec nevystaví, takže
          pět kotev lišty nemělo v odečítačce protějšek. Jméno je titulek sekce
          — týž řetězec, jaký na kotvu ukazuje PAGE_SECTIONS. */}
      {/* ── 01 Seismograf ─────────────────────────────────────── */}
      <section id="seismograf" aria-label={t("record.seismoTitle")}>
        <SectionHeading index={1} title={t("record.seismoTitle")} aside={<SourceNote>{t("record.seismoNote")}</SourceNote>} />
        <div className="mt-8">
          <Seismograf data={record} onJumpToVote={jumpTo} />
        </div>
      </section>

      {/* ── 02 Deník + sál ────────────────────────────────────── */}
      <section id="denik" aria-label={t("record.ledgerTitle")} className="mt-14 border-t-4 border-ink pt-10">
        <SectionHeading index={2} title={t("record.ledgerTitle")} aside={<SourceNote>{t("record.ledgerNote")}</SourceNote>} />
        {/* Výběr zápisu vymění CELÝ pohled do sálu vedle — a dělal to mlčky.
            JEDNA živá oblast na celou tu výměnu (ne jedna na řádek), a stojí
            MIMO panel, který se přerenderovává, aby ji výměna nesmazala. */}
        <p role="status" aria-live="polite" className="sr-only">
          {t("record.selectionAria", {
            title: selected.title,
            date: selected.votedOn ? f.date(selected.votedOn) : t("record.reconcileWorstNoDate"),
          })}
        </p>
        <div className="mt-8 grid gap-10 pb-4 lg:grid-cols-[5fr_7fr]">
          <RealVoteLedger
            votes={record.ledger}
            selectedId={selected.pspId}
            highlightedId={highlighted}
            onSelect={select}
            ledgerWindow={record.coverage.ledgerWindow}
            validTotal={record.coverage.valid}
            // Práh se v deníku tiskne po jednom hlasování, ale jeho populace je
            // celý záznam — `coverage` ta tři čísla nese a strukturálně JE
            // `ThresholdCoverage`, takže se tu nic nesestavuje podruhé.
            thresholds={record.coverage}
          />
          <div className="lg:sticky lg:top-8 lg:self-start">
            <RealChamberDetail vote={selected} />
          </div>
        </div>
      </section>

      {/* ── 03 Linie klubů ────────────────────────────────────── */}
      <section id="linie" aria-label={t("record.disciplineTitle")} className="mt-14 border-t-4 border-ink pt-10">
        <SectionHeading
          index={3}
          title={t("record.disciplineTitle")}
          aside={<SourceNote>{t("record.disciplineNote", { valid: record.coverage.valid })}</SourceNote>}
        />
        <div className="mt-8">
          <RealDisciplineBoard data={record} onSelectVote={jumpTo} />
        </div>
      </section>

      {/* ── 04 Rebelie ────────────────────────────────────────── */}
      <section id="rebelie" aria-label={t("record.rebelsTitle")} className="mt-14 border-t-4 border-ink pt-10">
        <SectionHeading
          index={4}
          title={t("record.rebelsTitle")}
          aside={
            <SourceNote>
              {t("record.chronicleNote", {
                shown: f.int(record.chronicle.length),
                total: f.int(record.chronicleTotal),
              })}
            </SourceNote>
          }
        />
        <div className="mt-8">
          <RealRebellions data={record} onSelectVote={jumpTo} />
        </div>
      </section>
    </>
  );
}
