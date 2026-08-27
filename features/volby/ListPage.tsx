/*
 * /volby/snemovna/[slug] — jedna zvolená kandidátka: ledger nálezů svých
 * poslanců (kandidátka, NIKDY klub — „dnes sedí v" je vedle, ne místo),
 * časová osa, poslanci kandidátky (připnutí kraje přes ?kraj=) a záznam
 * sporných hlasování. Celé RSC.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { krajSlug } from "@/features/civicscore/kraj";
import { krajBySlug } from "@/lib/analysis/volby/kraje";
import type { ListData } from "@/lib/analysis/volby/types";
import ContestedMatrix from "./components/ContestedMatrix";
import SubjectCard from "./components/SubjectCard";
import VolbyFrame from "./components/VolbyFrame";
import { volbyIntl, type VolbyIntl } from "./volbyIntl";

type Member = ListData["members"][number];

function MembersTable({ members, caption, t, f }: { members: readonly Member[]; caption: string; t: VolbyIntl["t"]; f: VolbyIntl["f"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel-aa">
            <th scope="col" className="py-2 pr-3">
              {t("list.colName")}
            </th>
            <th scope="col" className="py-2 pr-3">
              {t("list.colRegion")}
            </th>
            <th scope="col" className="py-2 pr-3">
              {t("list.colClub")}
            </th>
            <th scope="col" className="py-2 text-right">
              {t("list.colFindings")}
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.pspId} className="border-b border-hairline hover:bg-paper-strong">
              <th scope="row" className="py-3 pr-3 font-normal">
                <Link
                  href={`/poslanec/${m.pspId}`}
                  className="group inline-flex items-center gap-1 text-[15px] font-bold transition-colors hover:text-signal"
                >
                  {m.name}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </Link>
              </th>
              <td className="py-3 pr-3 text-sm text-steel">{m.region ?? "—"}</td>
              <td className="py-3 pr-3 font-mono text-[11px] uppercase tracking-wider text-steel-aa">{m.club ?? t("list.clubNone")}</td>
              <td className="py-3 text-right font-mono text-xs tabular-nums">
                {m.findings.length === 0 ? (
                  <span className="text-steel-aa">{t("list.memberFindingsNone")}</span>
                ) : (
                  f.int(m.findings.length)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceNote className="mt-3">{t("sections.membersSource")}</SourceNote>
    </div>
  );
}

export default async function ListPage({ data }: { data: ListData }) {
  const { t, f } = await volbyIntl();
  const pinned = data.pinnedKraj ? krajBySlug(data.pinnedKraj) : null;
  // Kraj poslance přichází jako štítek (regionLabel) — srovnává se přes týž
  // slug, kterým je adresován kraj, ne přes rovnost řetězců tří slovníků.
  const pinnedMembers = pinned
    ? data.members.filter((m) => m.region !== null && (krajSlug(m.region) === pinned.slug || m.region === pinned.pspLabel))
    : [];
  const clubs = Object.entries(data.list.clubsToday)
    .sort((a, b) => b[1] - a[1])
    .map(([club, n]) => `${club} ${f.int(n)}`)
    .join(" · ");
  return (
    <VolbyFrame
      title={data.list.label}
      lead={t("lists.lead")}
      eyebrow={
        <span>
          {t("ballot.snemovni")} · {t("list.seats", { seats: f.int(data.list.seats) })}
          <span className="ml-2">
            · {t("list.clubsToday")} {clubs}
          </span>
        </span>
      }
      provenance={data.provenance}
      t={t}
      f={f}
    >
      <SourceNote>{t("lists.source")}</SourceNote>

      <SubjectCard card={data.card} title={t("sections.findings")} index={1} t={t} f={f} />

      {pinned && (
        <section id="poslanci-kraje" className="border-t-4 border-ink pt-10">
          <SectionHeading index={3} title={t("list.pinnedTitle", { kraj: pinned.name })} aside={<SourceNote>{t("kraj.mpsSource")}</SourceNote>} />
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("list.pinnedLead")}</p>
          <div className="mt-6">
            <MembersTable members={pinnedMembers} caption={t("list.pinnedTitle", { kraj: pinned.name })} t={t} f={f} />
          </div>
          <Link
            href={`/volby/kraj/${pinned.slug}`}
            className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            {t("obec.krajOpen")} · {pinned.name}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>
      )}

      <section id="poslanci" className="border-t-4 border-ink pt-10">
        <SectionHeading index={pinned ? 4 : 3} title={t("sections.members")} aside={<SourceNote>{t("sections.membersSource")}</SourceNote>} />
        <div className="mt-6">
          <MembersTable members={data.members} caption={t("sections.members")} t={t} f={f} />
        </div>
      </section>

      <section id="sporna-hlasovani" className="border-t-4 border-ink pt-10">
        <SectionHeading index={pinned ? 5 : 4} title={t("sections.contested")} aside={<SourceNote>{t("sections.contestedSource")}</SourceNote>} />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("sections.contestedLead")}</p>
        <div className="mt-6">
          <ContestedMatrix rows={data.contested} t={t} f={f} />
        </div>
      </section>
    </VolbyFrame>
  );
}
