/*
 * /volby — Volby: zrcadlo, domovská plocha. RSC až na pickery (VolbyLookup).
 *
 *   /01 Kde volíte?            obec · kraj · celá sněmovna
 *   /02 Kdo se vám zodpovídá   census čtyř arén zadavatelů (StatTile + citace)
 *   /03 Nálezy                 dvacet naposledy datovaných nálezů (hlas FactRow)
 *   /04 Sněmovní kandidátky    kniha kandidátek (ListSummary)
 *   /05 Pravidla               odkaz na metodiku, která prahy importuje
 *
 * Data přicházejí hotová z getVolbyHomeData (WP2); null řeší routa
 * (DataUnavailable). Rejstřík obcí jde do klientského pickeru jako prop —
 * týž rejstřík, kterým se propojuje obec ↔ zadavatel (rovnost IČO), takže
 * odkaz z nálezu na obec ví, jestli obec v rejstříku je.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getMunicipality, getRegistry } from "@/features/budget/mirrorData";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import StatTile from "@/features/shared/components/StatTile";
import { KRAJ_CROSSWALK } from "@/lib/analysis/volby/kraje";
import { VOLBY_RULES_REF } from "@/lib/analysis/volby/rules";
import type { Finding, VolbyHomeData } from "@/lib/analysis/volby/types";
import FindingRow from "./components/FindingRow";
import ListsLedger from "./components/ListsLedger";
import VolbyFrame from "./components/VolbyFrame";
import VolbyLookup from "./components/VolbyLookup";
import { sharePct, subjectHref } from "./labels";
import { volbyIntl } from "./volbyIntl";

const isObec = (ico: string) => getMunicipality(ico) !== null;

/** Štítek subjektu nálezu bez čtení grafu: obec/kraj podle IČO, jinak samotné id. */
function subjectLabel(finding: Finding): string {
  if (finding.subjectId.startsWith("company:ico:")) {
    const ico = finding.subjectId.slice("company:ico:".length);
    const kraj = KRAJ_CROSSWALK.find((k) => k.krajIco === ico);
    if (kraj) return kraj.name;
    const obec = getMunicipality(ico);
    if (obec) return obec.name;
    return ico;
  }
  return finding.subjectId;
}

export default async function VolbyPage({ data }: { data: VolbyHomeData }) {
  const { t, f } = await volbyIntl();
  const registry = getRegistry();
  return (
    <VolbyFrame title={t("title")} lead={t("lead")} provenance={data.provenance} t={t} f={f}>
      <section id="kde-volite">
        <SectionHeading index={1} title={t("lookup.title")} />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("lookup.lead")}</p>
        <div className="mt-8">
          <VolbyLookup registry={registry} kraje={KRAJ_CROSSWALK} />
        </div>
      </section>

      <section id="areny" className="border-t-4 border-ink pt-10">
        <SectionHeading
          index={2}
          title={t("census.title")}
          aside={<SourceNote>{t("census.source", { pass: data.provenance.pass === null ? "—" : f.int(data.provenance.pass) })}</SourceNote>}
        />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("census.lead")}</p>
        <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
          {data.census.map((c) => (
            <StatTile
              key={c.arena}
              label={t(`census.arena.${c.arena}`)}
              value={f.int(c.authorities)}
              sub={`${t("census.authorities")} · ${t("census.sub", {
                lots: f.int(c.lots),
                flagged: `${f.dec(sharePct(c.flaggedShare))} %`,
                czk: f.czk(c.czkFloor),
              })}`}
              source={t("census.source", { pass: data.provenance.pass === null ? "—" : f.int(data.provenance.pass) })}
            />
          ))}
        </div>
      </section>

      <section id="nalezy" className="border-t-4 border-ink pt-10">
        <SectionHeading
          index={3}
          title={t("latest.title")}
          aside={<SourceNote>{t("latest.source", { ref: VOLBY_RULES_REF })}</SourceNote>}
        />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("latest.lead")}</p>
        {data.latest.length === 0 ? (
          <p className="mt-6 border-l-4 border-hairline pl-4 text-[15px] leading-relaxed text-steel-aa">{t("latest.empty")}</p>
        ) : (
          <div className="mt-6 border-t-2 border-ink">
            {data.latest.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                subject={{ label: subjectLabel(finding), href: subjectHref(finding.subjectId, isObec) }}
                t={t}
                f={f}
              />
            ))}
          </div>
        )}
      </section>

      <section id="kandidatky" className="border-t-4 border-ink pt-10">
        <SectionHeading
          index={4}
          title={t("lists.title")}
          aside={
            <Link
              href="/volby/snemovna"
              className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              {t("snemovna.title")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("lists.lead")}</p>
        <div className="mt-6">
          <ListsLedger lists={data.lists} t={t} f={f} />
        </div>
      </section>

      <section id="pravidla" className="border-t-4 border-ink pt-10">
        <SectionHeading index={5} title={t("rules.title")} aside={<SourceNote>{VOLBY_RULES_REF}</SourceNote>} />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("rules.lead")}</p>
        <Link
          href="/metodika#volby"
          className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {t("rules.link")}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </section>
    </VolbyFrame>
  );
}
