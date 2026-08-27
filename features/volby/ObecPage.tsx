/*
 * /volby/obec/[ico] — obec jako zadavatel (komunální lístek), její kraj jako
 * zadavatel (krajský lístek) a kandidátky s poslanci z kraje (sněmovní lístek).
 * Celé RSC.
 *
 * Propojení obec ↔ zadavatel je JEN rovnost IČO; příspěvkové organizace a
 * městské firmy jsou celostátní počet „nejasné" arény a plocha to říká
 * doslova — nikdy je nelokalizuje k této obci (design record, vlna 2).
 * Na kartách zadavatelů nestojí žádné jméno osoby.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { krajBySlug } from "@/lib/analysis/volby/kraje";
import type { ObecData } from "@/lib/analysis/volby/types";
import ListsLedger from "./components/ListsLedger";
import SubjectCard from "./components/SubjectCard";
import VolbyFrame from "./components/VolbyFrame";
import { volbyIntl } from "./volbyIntl";

export default async function ObecPage({ data }: { data: ObecData }) {
  const { t, f } = await volbyIntl();
  const kraj = krajBySlug(data.obec.krajSlug);
  const krajName = kraj?.name ?? data.obec.krajSlug;
  // Sekce se číslují průběžně; karta subjektu zabírá dva indexy (nálezy + časová osa).
  const iKomunalni = 1;
  const iUnlinked = iKomunalni + (data.komunalni ? 2 : 1);
  const iKraj = iUnlinked + 1;
  const iLists = iKraj + (data.krajCard ? 2 : 1);
  return (
    <VolbyFrame
      title={data.obec.name}
      lead={t("lead")}
      eyebrow={
        <span>
          {t("obec.meta", { county: data.obec.county, kraj: krajName })}
          <span className="ml-2 normal-case tracking-normal">
            {t("obec.population", { population: f.int(data.obec.population) })}
          </span>
        </span>
      }
      provenance={data.provenance}
      t={t}
      f={f}
    >
      <SourceNote>{t("obec.populationSource")}</SourceNote>

      {data.komunalni ? (
        <SubjectCard card={data.komunalni} title={t("obec.komunalniTitle")} index={iKomunalni} t={t} f={f} />
      ) : (
        <section id="nalezy-komunalni" className="border-t-4 border-ink pt-10">
          <SectionHeading index={iKomunalni} title={t("obec.komunalniTitle")} />
          <p className="mt-4 max-w-2xl border-l-4 border-hairline pl-4 text-[15px] leading-relaxed text-steel-aa">
            {t("obec.noAuthority")}
          </p>
        </section>
      )}

      <section id="nepropojeno" className="border-t-4 border-ink pt-10">
        <SectionHeading index={iUnlinked} title={t("obec.unlinkedTitle")} aside={<SourceNote>{t("obec.unlinkedSource")}</SourceNote>} />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">
          {t("obec.unlinkedBody", { count: f.int(data.unlinked.nejasneNational) })}
        </p>
      </section>

      {data.krajCard ? (
        <SubjectCard card={data.krajCard} title={t("obec.krajTitle")} index={iKraj} t={t} f={f} />
      ) : (
        <section id="nalezy-krajske" className="border-t-4 border-ink pt-10">
          <SectionHeading index={iKraj} title={t("obec.krajTitle")} />
          <p className="mt-4 max-w-2xl border-l-4 border-hairline pl-4 text-[15px] leading-relaxed text-steel-aa">
            {t("kraj.noAuthority")}
          </p>
        </section>
      )}
      {kraj && (
        <Link
          href={`/volby/kraj/${kraj.slug}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {t("obec.krajOpen")} · {kraj.name}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}

      <section id="kandidatky" className="border-t-4 border-ink pt-10">
        <SectionHeading index={iLists} title={t("obec.listsTitle")} aside={<SourceNote>{t("lists.source")}</SourceNote>} />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("lists.lead")}</p>
        <div className="mt-6">
          <ListsLedger lists={data.lists} pinKraj={kraj?.slug ?? null} t={t} f={f} />
        </div>
      </section>
    </VolbyFrame>
  );
}
