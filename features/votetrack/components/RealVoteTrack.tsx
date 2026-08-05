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
      {/* ── 01 Seismograf ─────────────────────────────────────── */}
      <section id="seismograf">
        <SectionHeading index={1} title={t("record.seismoTitle")} aside={<SourceNote>{t("record.seismoNote")}</SourceNote>} />
        <div className="mt-8">
          <Seismograf data={record} onJumpToVote={jumpTo} />
        </div>
      </section>

      {/* ── 02 Deník + sál ────────────────────────────────────── */}
      <section id="denik" className="mt-14 border-t-4 border-ink pt-10">
        <SectionHeading index={2} title={t("record.ledgerTitle")} aside={<SourceNote>{t("record.ledgerNote")}</SourceNote>} />
        <div className="mt-8 grid gap-10 pb-4 lg:grid-cols-[5fr_7fr]">
          <RealVoteLedger
            votes={record.ledger}
            selectedId={selected.pspId}
            highlightedId={highlighted}
            onSelect={select}
            ledgerWindow={record.coverage.ledgerWindow}
            validTotal={record.coverage.valid}
          />
          <div className="lg:sticky lg:top-8 lg:self-start">
            <RealChamberDetail vote={selected} />
          </div>
        </div>
      </section>

      {/* ── 03 Linie klubů ────────────────────────────────────── */}
      <section id="linie" className="mt-14 border-t-4 border-ink pt-10">
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
      <section id="rebelie" className="mt-14 border-t-4 border-ink pt-10">
        <SectionHeading
          index={4}
          title={t("record.rebelsTitle")}
          aside={<SourceNote>{t("record.chronicleNote", { cap: record.chronicle.length })}</SourceNote>}
        />
        <div className="mt-8">
          <RealRebellions data={record} onSelectVote={jumpTo} />
        </div>
      </section>
    </>
  );
}
