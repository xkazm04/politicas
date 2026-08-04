"use client";

/*
 * Spis poslance (/poslanec/<pspId>) — REÁLNÁ DATA ze znalostního grafu.
 * Hlavička se skóre indexu přispění a pořadím z 207, pak číslované oddíly:
 * Složky přispění (šest vážených složek) / Pracovní profil (dosier, jen když
 * poslanec nese obsah) / Peněžní vazby (linked_to + supplies, vždy — i jako
 * čestný prázdný stav) / Nejbližší spojenci (co_votes_with) / Rebelie proti
 * klubu (rebels_against) / Výbory a komise (membership × organ).
 *
 * Čísla oddílů se ODVOZUJÍ z toho, co se skutečně vykreslí (`order`/`no()`) —
 * pevné indexy nechávaly u poslanců bez dosieru stránku číst 01 → 03 → 04 → 05.
 *
 * Citace u každého čísla. Žádná čtvrtletní řada / delta / trend (jedno období,
 * bez reálného podloží) — místo nich čestné „jedno období".
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ProfileData } from "./getProfileData";
import { useFormat } from "@/lib/i18n/useFormat";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { COMPONENT_FILL } from "@/features/civicscore/components/LeaderboardTable";
import { storedRefLabel } from "@/features/civicscore/provenance";
import LowScoreReasonBadge from "@/features/profile/components/LowScoreReasonBadge";
import TenureNote from "@/features/profile/components/TenureNote";
import TenureTrendGate from "@/features/profile/components/TenureTrendGate";
import CareerSpineSection from "@/features/profile/components/CareerSpineSection";
import DossierSection, { hasDossierContent, type DossierContent } from "@/features/profile/components/DossierSection";
import MoneySection from "@/features/profile/components/MoneySection";
import ScoreLegibilityPanel from "@/features/profile/components/ScoreLegibilityPanel";
import type { ComponentKey } from "@/lib/analysis/contribution-trend";
import { MIN_SHARED_VOTES } from "@/lib/analysis/kg";

/** Internal committee-role enum -> the copy a reader sees. The enum
 *  (`chair` | `vice` | `member`, lib/analysis/kg.ts) used to print raw on an
 *  otherwise all-Czech page. */
const ROLE_KEY: Record<string, string> = {
  chair: "committeeRoleChair",
  vice: "committeeRoleVice",
  member: "committeeRoleMember",
};

export default function ProfilePage({ data }: { data: ProfileData }) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations("profile");
  const tcom = useTranslations("common");
  const f = useFormat();

  const { person, total, components, coVoters, rebellions, committees } = data;
  const [first, ...rest] = person.name.split(" ");
  const lastName = rest.join(" ");

  const dossier: DossierContent = {
    publicRole: person.effortPublicRole,
    workThemes: data.effortWorkThemes,
    billFocus: data.effortBillFocus,
    notes: data.effortNotes,
    dataFlag: data.effortDataFlag,
    sponsoredBills: data.sponsoredBills,
    billsFirstSigned: data.billsFirstSigned,
    billsCoSigned: data.billsCoSigned,
    rapporteurBills: data.rapporteurBills,
    amendmentsAuthored: data.amendmentsAuthored,
    // Pracovní záznam: co poslanec doopravdy odvedl, ne jen jaké má skóre.
    floorSpeeches: data.floorSpeeches,
    floorSpeechTurns: data.floorSpeechTurns,
    amendmentBills: data.amendmentBills,
    amendmentBillCount: data.amendmentBillCount,
    speechTurnsTotal: data.speechTurnsTotal,
    interpellations: data.interpellations,
    absenceRate: data.absenceRate,
    workhorseFlavour: person.effortWorkhorse ? person.effortWorkhorseFlavour : null,
    rapporteurLoad: person.effortRapporteurLoad,
    effortRecordedAt: person.effortRecordedAt,
  };
  // Section numbers are DERIVED from what actually renders. DossierSection is
  // omitted for an MP with no dossier content, and the fixed index={2} then left
  // the page reading 01 -> 03 -> 04 -> 05 for exactly those MPs.
  // "money" is unconditional: an MP with no tie gets the honest empty state, because
  // a silently omitted money section is indistinguishable from a hidden finding.
  const order = [
    "components",
    ...(hasDossierContent(dossier) ? ["dossier"] : []),
    "money",
    "allies",
    "rebellions",
    "committees",
  ];
  const no = (key: string) => order.indexOf(key) + 1;

  // The index counts membership ROWS (psp.cz files a leadership seat as two rows
  // on one body); the list below shows each body ONCE at its highest role. Where
  // the two disagree the page SAYS so, rather than letting a reader find two
  // contradicting counts on one screen with nothing to explain them. Deliberately
  // not a silent reconciliation — the scoring formula is not this page's to change.
  const committeeCountDiverges = committees.length !== person.committeeCount;

  // Čestný „headline" z reálných props: vlajka nepřítomného manažera, jinak
  // nejsilnější složka. Nikdy vymyšlené číslo. Every other data gap on this
  // page degrades gracefully by design — guard this one the same way instead
  // of assuming `components` is always non-empty (partial ingest, a future
  // LeaderboardData refactor), which would otherwise crash the whole page on
  // `topComponent.label` below.
  const topComponent =
    components.length > 0
      ? [...components].sort(
          (x, y) => person.components[y.key] / y.weight - person.components[x.key] / x.weight,
        )[0]
      : null;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ {t("breadcrumb")}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Hlavička spisu ────────────────────────────────── */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-hairline py-12"
        >
          <SourceNote tone="signal">
            {/* Pořadí je soutěžní (1, 2, 2, 4): shodná skóre sdílejí jedno místo, takže
                „#2 z 207" u dvou poslanců není chyba — a spis to musí říct, jinak by
                tvrdil výlučnost, kterou index nemá. */}
            {person.tiedCount > 1
              ? t("rankOfShared", {
                  rank: f.int(person.rank),
                  total: f.int(total),
                  tied: person.tiedCount,
                  tiedFmt: f.int(person.tiedCount),
                })
              : t("rankOf", { rank: f.int(person.rank), total: f.int(total) })}{" "}
            · {person.clubName}
            {person.region ? ` · ${person.region}` : ""}
          </SourceNote>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-8">
            <h1 className="text-6xl font-black uppercase leading-[0.92] tracking-tight sm:text-7xl">
              {first}
              <br />
              <span className="text-signal">{lastName}</span>
            </h1>
            <div className="text-right">
              <AnimatedScore
                value={person.score}
                format={f.dec}
                className="text-[7rem] font-black leading-[0.85] tracking-tighter sm:text-[8rem]"
              />
              <div className="mt-2 flex items-center justify-end gap-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: person.clubColor }} />
                  {person.clubName}
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-steel">
                  {tcom("of100")}
                </span>
              </div>
              {/* Pas sk\u00f3re + jeho LINIE. Spis tiskl \u010d\u00edslo pasu i tehdy, kdy\u017e ho data
                  nesla jen na prvn\u00edm uzlu, a linii metodiky ne\u010detl v\u016fbec \u2014 proto \u0161est dn\u00ed
                  ukazoval sk\u00f3re star\u00e9 formule bez jedin\u00e9ho slova o tom. */}
              <SourceNote className="mt-1 !text-[10px]">
                {t("periodNote")}
                {data.provenancePass != null ? ` \u00b7 ${t("indexPass", { pass: f.int(data.provenancePass) })}` : ""}
                {data.provenance.state === "mixed"
                  ? ` \u00b7 ${t("indexPassMixed", { count: f.int(data.provenance.distinctCount) })}`
                  : ""}
                {!data.provenance.formulaMatch && data.provenance.state !== "absent"
                  ? ` \u00b7 ${t("indexRefMismatch", {
                      dataRef: storedRefLabel(data.provenance),
                      codeRef: data.provenance.declaredRef,
                    })}`
                  : ""}
              </SourceNote>
            </div>
          </div>
          <p className="mt-6 max-w-2xl border-l-4 border-signal pl-4 text-base italic leading-relaxed text-steel">
            {person.absenteeManagerLead ? t("absenteeFlag") : (topComponent?.label ?? "")}
          </p>
          {/* Ta vlajka je odvozená z peněžních vazeb, které jsou VŠECHNY
              pending_review. Bez téhle kvalifikace stála na spisu jako hotové
              obvinění bez jediného důkazu vedle sebe — teď říká, na čem stojí,
              a odkazuje na oddíl, kde ten důkaz je. */}
          {person.absenteeManagerLead && (
            <div className="mt-3 max-w-2xl border-l-4 border-ochre pl-4">
              <p className="text-[14px] leading-relaxed text-ink">{t("absenteeFlagQualifier")}</p>
              <SourceNote className="mt-1.5 !text-[10px]">{t("absenteeFlagSource")}</SourceNote>
            </div>
          )}

          {/* Poctivý korektiv nízkého skóre — vykreslí se jen když enrichment
              stage effort-loopu uložil effort_low_score_reason z uzavřeného
              slovníku (batch 001+ postupně pokrývá dalších poslanců). */}
          <LowScoreReasonBadge reason={person.effortLowScoreReason} publicRole={person.effortPublicRole} />

          {/* Mandátová poznámka — vykreslí se jen pro replacement/departed
              tenure_class (batch 005, Q-effort-5 follow-through). */}
          <TenureNote
            tenureClass={data.effortTenureClass}
            tenureStart={data.effortTenureStart}
            tenureEnd={data.effortTenureEnd}
          />

          {/* Vývoj proti minulému období — vykreslí se jen když existuje reálné
              srovnání (contribution_psp9); pod ~90 dní tenure je srovnání
              potlačeno (TenureTrendGate) místo zavádějících sazeb. */}
          <TenureTrendGate
            trend={person.trend}
            componentLabels={Object.fromEntries(components.map((c) => [c.key, c.label])) as Partial<Record<ComponentKey, string>>}
            tenureDays={data.effortTenureDays}
          />

          {/* Kariérní spis — služební záznam přes volební období (mandáty jsou
              v registru pro všechna období; záznam aktivity jen pro běžící a
              částečně PSP9 — stuha to přiznává po obdobích). */}
          <CareerSpineSection career={data.career} asOf={data.seatsAsOf} />
        </motion.div>

        {/* ── 01 Složky přispění ────────────────────────────── */}
        <section id="slozky" className="pt-12">
          <SectionHeading
            index={no("components")}
            title={t("componentsHeading")}
            aside={<SourceNote>{t("componentsAside")}</SourceNote>}
          />
          <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-3">
            {components.map((c) => {
              const fill = COMPONENT_FILL[c.key] ?? { color: undefined };
              const pts = person.components[c.key];
              return (
                <div key={c.key} className="bg-paper p-6">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                    {c.label} × {c.weight}
                  </p>
                  <p className="mt-3 text-5xl font-black tabular-nums">
                    {f.dec(pts)}
                    <span className="ml-1 align-top text-lg font-bold text-steel">/{c.weight}</span>
                  </p>
                  <div className="mt-3 h-2 w-full bg-hairline">
                    <motion.div
                      className="h-full"
                      style={{ background: fill.color, opacity: fill.opacity }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(100, (pts / c.weight) * 100)}%` }}
                      viewport={{ once: true }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.6 }}
                    />
                  </div>
                  <SourceNote className="mt-3 !text-[10px]">
                    {tcom("sourcePrefix")} {c.source}
                  </SourceNote>
                </div>
              );
            })}
          </div>

          {/* Čitelnost indexu: hodnota / strop / medián sněmovny po složkách a
              pořadí při naplnění stropu — vše odvozené a takto označené, celé
              z dat, která stránka už načetla. */}
          <ScoreLegibilityPanel
            legibility={data.legibility}
            labels={Object.fromEntries(components.map((c) => [c.key, c.label]))}
          />
        </section>

        {/* ── Pracovní profil (dosier) ───────────────────────── */}
        <DossierSection index={no("dossier")} {...dossier} />

        {/* ── Peněžní vazby ──────────────────────────────────── */}
        <MoneySection index={no("money")} money={data.money} pspId={person.pspId} />

        {/* ── 03 Nejbližší spojenci ─────────────────────────── */}
        <section id="spojenci" className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading
            index={no("allies")}
            title={t("alliesHeading")}
            aside={<SourceNote>{t("alliesAside")}</SourceNote>}
          />
          {/* Honest empty state, matching the rebellions/committees pattern. An MP
              whose every pairing sits below the shared-ballot floor used to get a
              bare heading followed by an orphan citation citing nothing. */}
          {coVoters.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-[15px] leading-relaxed text-steel">
                {t("noAllies", { minShared: f.int(MIN_SHARED_VOTES) })}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 border-t-2 border-ink">
                {coVoters.map((cv) => (
                  <div
                    key={cv.pspId}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-hairline px-2 py-3 transition-colors hover:bg-paper-strong"
                  >
                    <Link
                      href={`/poslanec/${cv.pspId}`}
                      className="group inline-flex min-w-0 items-center gap-1.5 text-[15px] font-black uppercase tracking-tight hover:text-signal"
                    >
                      <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cv.clubColor }} />
                      <span className="truncate">{cv.name}</span>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-steel">· {cv.clubAbbrev}</span>
                    </Link>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                      {t("sharedBallots", { count: f.int(cv.shared) })}
                    </span>
                    <span className="w-16 text-right text-lg font-black tabular-nums text-signal">
                      {f.dec(cv.agreement * 100)}%
                    </span>
                  </div>
                ))}
              </div>
              <SourceNote className="mt-3 !text-[10px]">
                {t("agreementLabel")} · psp.cz · co_votes_with
              </SourceNote>
            </>
          )}
        </section>

        {/* ── 04 Rebelie proti klubu ────────────────────────── */}
        <section id="rebelie" className="mt-16 border-t-4 border-ink pt-10">
          <SectionHeading
            index={no("rebellions")}
            title={t("rebellionsHeading")}
            aside={<SourceNote>{t("rebellionsAside")}</SourceNote>}
          />
          {rebellions.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-[15px] leading-relaxed text-steel">{t("noRebellions")}</p>
            </div>
          ) : (
            <div className="mt-8 border-t-2 border-ink">
              {rebellions.map((r) => (
                <div
                  key={r.club}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-hairline px-2 py-4"
                >
                  <span className="text-lg font-black uppercase tracking-tight">{r.club}</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-steel">
                    {f.int(r.rebelVotes)} / {f.int(r.eligibleVotes)}
                  </span>
                  <span className="w-16 text-right text-lg font-black tabular-nums text-signal">
                    {f.dec(r.rate * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 05 Výbory a komise ────────────────────────────── */}
        <section id="vybory" className="mt-16 border-t-4 border-ink pt-10 pb-8">
          <SectionHeading
            index={no("committees")}
            title={t("committeesHeading")}
            aside={<SourceNote>{t("committeesAside")}</SourceNote>}
          />
          {committees.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-[15px] leading-relaxed text-steel">{t("noCommittees")}</p>
            </div>
          ) : (
            <>
              {committeeCountDiverges && (
                <p className="mt-6 max-w-3xl border-l-4 border-hairline pl-4 text-[13px] leading-relaxed text-steel">
                  {t("committeeCountNote", {
                    indexCount: f.int(person.committeeCount),
                    listCount: f.int(committees.length),
                  })}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                {/* batch-006: past seats (toAt in the past — e.g. vacated on taking a
                    ministerial post) render de-emphasized rather than indistinguishable
                    from a current seat; getProfileData sorts current seats first. */}
                {committees.map((cm, i) => (
                  <div
                    key={`${cm.abbrev}-${i}`}
                    className={`border-2 border-hairline px-4 py-3 ${cm.current ? "" : "opacity-50"}`}
                  >
                    <p className="text-lg font-black uppercase tracking-tight">{cm.abbrev}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">
                      {cm.organType ?? "—"} · {ROLE_KEY[cm.role] ? t(ROLE_KEY[cm.role]) : cm.role}
                    </p>
                    {cm.toAtUnreadable && (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ochre">
                        {t("seatEndUnreadable")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {/* The current/past split is evaluated against a date and this page is
                  statically generated, so the page states the date it is asserting. */}
              <SourceNote className="mt-3 !text-[10px]">
                {t("seatsAsOf", { date: f.date(data.seatsAsOf) })}
              </SourceNote>
            </>
          )}
        </section>

        {/* ── Listování spisy ───────────────────────────────── */}
        <nav className="mb-20 grid gap-px border border-ink bg-ink sm:grid-cols-2">
          {[
            { pspId: data.prevPspId, dir: "prev" as const, label: t("prevFile"), Icon: ArrowLeft, align: "text-left" },
            { pspId: data.nextPspId, dir: "next" as const, label: t("nextFile"), Icon: ArrowRight, align: "text-right sm:justify-items-end" },
          ].map(({ pspId, dir, label, Icon, align }) => (
            <Link
              key={dir}
              href={`/poslanec/${pspId}`}
              className={`grid gap-1 bg-paper p-5 transition-colors hover:bg-paper-strong ${align}`}
            >
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {dir === "prev" && <Icon className="h-3.5 w-3.5" />}
                {label}
                {dir === "next" && <Icon className="h-3.5 w-3.5" />}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
