"use client";

/**
 * Kronika rebelií + nezávislost vzorku — kdo vybočil z linie a jak se to
 * propisuje do pilíře Nezávislost. Proklik do spisů; interpretace patří
 * čtenáři, čísla nesou citace.
 */

import { useTranslations } from "next-intl";
import { MPS, ROLL_CALLS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";

const REBELLIONS = ROLL_CALLS.flatMap((rc) =>
  rc.rebels.map((id) => {
    const mp = MPS.find((m) => m.id === id)!;
    return { rc, mp, vote: rc.perMP[id] };
  }),
).sort((a, b) => b.rc.date.localeCompare(a.rc.date));

/** Hodnota VoteChoice z dat (česky) → klíč common.voteChoice. */
const VOTE_CHOICE_KEY: Record<string, string> = {
  pro: "for",
  proti: "against",
  "zdržel se": "abstained",
  omluven: "excused",
};

export default function Rebellions() {
  const t = useTranslations("votetrack");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <div className="min-w-0">
        <SourceNote>{t("rebellionChronicleNote")}</SourceNote>
        <div className="mt-3 border-t-2 border-ink">
          {/* Ilustrativní vzorek — smyšlení poslanci nemají reálný profil,
              takže řádek NEODKAZUJE na /poslanec/[id] (byl by to mrtvý
              odkaz); jde o čitelný záznam, ne prokliknutelný spis. */}
          {REBELLIONS.map((r) => (
            <div
              key={`${r.rc.id}-${r.mp.id}`}
              className="block border-b border-hairline px-2 py-4"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs uppercase tracking-wider text-steel">{f.date(r.rc.date)}</span>
              </span>
              <span className="mt-1 block text-[15px] leading-relaxed">
                <span className="font-black uppercase">{r.mp.name}</span>{" "}
                <span className="text-steel">({r.mp.party})</span> {t("votedVerb")}{" "}
                <span className="font-mono text-sm font-bold uppercase text-signal">
                  {tcom(`voteChoice.${VOTE_CHOICE_KEY[r.vote]}`)}
                </span>{" "}
                {t("againstPartyLine")} {tc(`rollCalls.${r.rc.id}.title`).toLowerCase()}
              </span>
            </div>
          ))}
          {REBELLIONS.length === 0 && (
            <div className="border-2 border-dashed border-hairline p-6 text-sm text-steel">
              {t("noRebellions")}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <SourceNote>{t("independencePillarNote")}</SourceNote>
        <div className="mt-3 border-t-2 border-ink">
          {[...MPS]
            .sort((a, b) => b.pillars.independence - a.pillars.independence)
            .map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3 border-b border-hairline px-2 py-3.5"
              >
                <span className="truncate text-sm font-black uppercase tracking-tight">
                  {m.name.split(" ").at(-1)}
                  <span className="ml-1.5 font-mono text-[10px] font-normal text-steel">{m.party}</span>
                </span>
                <span className="h-4 w-full bg-hairline">
                  <span className="block h-full bg-ink" style={{ width: `${m.pillars.independence}%` }} />
                </span>
                <span className="text-right text-lg font-black tabular-nums">{f.int(m.pillars.independence)}</span>
              </div>
            ))}
        </div>
        <p className="mt-4 max-w-md text-sm italic leading-relaxed text-steel">{t("independenceFootnote")}</p>
      </div>
    </div>
  );
}
