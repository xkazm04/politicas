/*
 * /volby/snemovna — index kandidátek PSP10. Táž kniha kandidátek jako sekce
 * /04 domovské plochy (VolbyHomeData.lists), jen jako vlastní adresa, na kterou
 * vede „Celá sněmovna" z pickeru. Žádné druhé čtení: data jsou z téhož loaderu.
 */

import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import type { VolbyHomeData } from "@/lib/analysis/volby/types";
import ListsLedger from "./components/ListsLedger";
import VolbyFrame from "./components/VolbyFrame";
import { volbyIntl } from "./volbyIntl";

export default async function SnemovnaPage({ data }: { data: VolbyHomeData }) {
  const { t, f } = await volbyIntl();
  return (
    <VolbyFrame
      title={t("snemovna.title")}
      lead={t("snemovna.lead")}
      eyebrow={t("ballot.snemovni")}
      provenance={data.provenance}
      t={t}
      f={f}
    >
      <section id="kandidatky">
        <SectionHeading index={1} title={t("lists.title")} aside={<SourceNote>{t("lists.source")}</SourceNote>} />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("lists.lead")}</p>
        <div className="mt-6">
          <ListsLedger lists={data.lists} t={t} f={f} />
        </div>
      </section>
    </VolbyFrame>
  );
}
