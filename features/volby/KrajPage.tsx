/*
 * /volby/kraj/[slug] — kraj jako zadavatel (krajský lístek), jeho poslanci
 * podle kandidátky a kandidátky s poslanci kraje. Celé RSC.
 *
 * Na kartě zadavatele žádné jméno osoby; poslanci jsou vlastní sekce (jsou
 * to volení zástupci kraje ve sněmovně, ne zadavatel) a vedou na spis.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import type { KrajData } from "@/lib/analysis/volby/types";
import ListsLedger from "./components/ListsLedger";
import SubjectCard from "./components/SubjectCard";
import VolbyFrame from "./components/VolbyFrame";
import { volbyIntl } from "./volbyIntl";

export default async function KrajPage({ data }: { data: KrajData }) {
  const { t, f } = await volbyIntl();
  const listLabel = new Map(data.lists.map((l) => [l.slug, l.label]));
  // Karta subjektu zabírá dva indexy (nálezy + časová osa); bez ní jeden.
  const iKrajske = 1;
  const iMps = iKrajske + (data.krajske ? 2 : 1);
  const iLists = iMps + 1;
  return (
    <VolbyFrame
      title={data.kraj.name}
      lead={t("lead")}
      eyebrow={`${t("ballot.krajske")} · ${data.kraj.nuts} · IČO ${data.kraj.krajIco}`}
      provenance={data.provenance}
      t={t}
      f={f}
    >
      {data.krajske ? (
        <SubjectCard card={data.krajske} title={t("kraj.krajskeTitle")} index={iKrajske} t={t} f={f} />
      ) : (
        <section id="nalezy-krajske" className="border-t-4 border-ink pt-10">
          <SectionHeading index={iKrajske} title={t("kraj.krajskeTitle")} />
          <p className="mt-4 max-w-2xl border-l-4 border-hairline pl-4 text-[15px] leading-relaxed text-steel-aa">
            {t("kraj.noAuthority")}
          </p>
        </section>
      )}

      <section id="poslanci" className="border-t-4 border-ink pt-10">
        <SectionHeading index={iMps} title={t("kraj.mpsTitle")} aside={<SourceNote>{t("kraj.mpsSource")}</SourceNote>} />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("kraj.mpsLead")}</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <caption className="sr-only">{t("kraj.mpsTitle")}</caption>
            <thead>
              <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel-aa">
                <th scope="col" className="py-2 pr-3">
                  {t("kraj.colName")}
                </th>
                <th scope="col" className="py-2 pr-3">
                  {t("kraj.colList")}
                </th>
                <th scope="col" className="py-2">
                  {t("kraj.colClub")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.mps.map((mp) => (
                <tr key={mp.pspId} className="border-b border-hairline hover:bg-paper-strong">
                  <th scope="row" className="py-3 pr-3 font-normal">
                    <Link
                      href={`/poslanec/${mp.pspId}`}
                      className="group inline-flex items-center gap-1 text-[15px] font-bold transition-colors hover:text-signal"
                    >
                      {mp.name}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </Link>
                  </th>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/volby/snemovna/${mp.listSlug}?kraj=${encodeURIComponent(data.kraj.slug)}`}
                      className="font-mono text-xs uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                    >
                      {listLabel.get(mp.listSlug) ?? mp.listSlug}
                    </Link>
                  </td>
                  <td className="py-3 font-mono text-[11px] uppercase tracking-wider text-steel-aa">{mp.club ?? t("list.clubNone")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="kandidatky" className="border-t-4 border-ink pt-10">
        <SectionHeading index={iLists} title={t("kraj.listsTitle")} aside={<SourceNote>{t("lists.source")}</SourceNote>} />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("lists.lead")}</p>
        <div className="mt-6">
          <ListsLedger lists={data.lists} pinKraj={data.kraj.slug} t={t} f={f} />
        </div>
      </section>
    </VolbyFrame>
  );
}
