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
 *
 * SERVEROVÁ KOMPONENTA (od 2026-08-04). Spis byl celý `"use client"`, takže se
 * do RSC flightu serializoval CELÝ `ProfileData` — každý řádek smlouvy, název
 * tisku i kariérní páteř — u plochy, která je z 95 % statická. Klientské jsou
 * teď jen ostrůvky, kde opravdu žije interakce: `MotionIslands` (pohyb),
 * `AnimatedScore` (přechod čísla + jeho claim), `FollowButton`,
 * `ExpandableText`, `RebellionInstancesPending`. Překlad a formátování si
 * serverové komponenty berou přes `./serverIntl.ts` — tytéž dva objekty jako
 * `useTranslations`/`useFormat`, jen čtené na serveru.
 *
 * Dvě pravidla, která z toho plynou a nelze je porušit potichu:
 *   1) klientské komponentě se nesmí předat FUNKCE (proto `AnimatedScore`
 *      dostává `formatKind="dec"` místo `format={f.dec}`);
 *   2) ze serverové komponenty se nesmí číst HODNOTA z `"use client"` modulu
 *      (proto `COMPONENT_FILL` bydlí v `features/civicscore/componentFill.ts`).
 */

import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ProfileData } from "./getProfileData";
import { profileIntl } from "./serverIntl";
import { ComponentBar, HeaderReveal } from "@/features/profile/components/MotionIslands";
import AnimatedScore from "@/features/shared/components/AnimatedScore";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { COMPONENT_FILL } from "@/features/civicscore/componentFill";
import { storedRefLabel } from "@/features/civicscore/provenance";
import { contributionScoreClaim } from "@/features/civicscore/scoreClaim";
import { krajSlug } from "@/features/civicscore/kraj";
import { mpEntityKey } from "@/features/denik/deriveDenik";
import { entityDenikHref } from "@/features/schranka/followCodec";
import LowScoreReasonBadge from "@/features/profile/components/LowScoreReasonBadge";
import TenureNote from "@/features/profile/components/TenureNote";
import TenureTrendGate from "@/features/profile/components/TenureTrendGate";
import CareerSpineSection from "@/features/profile/components/CareerSpineSection";
import DossierSection, { hasDossierContent, type DossierContent } from "@/features/profile/components/DossierSection";
import MoneySection from "@/features/profile/components/MoneySection";
import ScoreLegibilityPanel from "@/features/profile/components/ScoreLegibilityPanel";
import FollowButton from "@/features/schranka/FollowButton";
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

export default async function ProfilePage({
  data,
  rebellionSlot,
}: {
  data: ProfileData;
  /** Jmenovité rebelie — streamovaný server-slot (features/profile/RebellionSlot.tsx).
   *  Přichází zvenčí, protože jejich zdroj je celý hlasovací záznam (~16 s cold) a
   *  spis na něj nesmí čekat; klientská komponenta ho jen umístí pod agregát. */
  rebellionSlot?: React.ReactNode;
}) {
  const [{ t, f }, { t: tcom }, { t: tm }] = await Promise.all([
    profileIntl(),
    profileIntl("common"),
    profileIntl("metodika"),
  ]);

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

  // Vlajkové číslo se razí JEDNOU: týž claim jde do `AnimatedScore` (atributy pro
  // stroje) i do odkazu „ověřit toto číslo" (adresa pro člověka). Dvě ražby téže
  // figury by se mohly rozejít a čtenář by ověřoval jiné číslo, než čte.
  const scoreClaim = contributionScoreClaim(person.pspId, person.score, data.provenance).claim;
  // Kraj je v hlavičce od začátku, ale jako mrtvý text — přitom /kraj/<slug> je
  // volební karta právě těch poslanců (slug počítá features/civicscore/kraj.ts,
  // jediný vlastník tvaru té adresy).
  const krajHref = person.region ? `/kraj/${krajSlug(person.region)}` : null;

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
        <HeaderReveal className="border-b border-hairline py-12">
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
            {person.region ? (
              <>
                {" · "}
                {krajHref ? (
                  <Link href={krajHref} className="underline-offset-2 hover:underline">
                    {person.region}
                  </Link>
                ) : (
                  person.region
                )}
              </>
            ) : (
              ""
            )}
          </SourceNote>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-8">
            <div>
              {/* Jméno je vysázené na dva řádky, ale ČTE se jako jedno jméno:
                  `{first}<br/>{lastName}` dával odečítači „Petr" a „Hladík" jako
                  dva samostatné texty (a u jednoslovného jména prázdný druhý
                  řádek). Přístupný název je tedy celé jméno jednou, sazba je
                  dekorace — a `<br/>` se vůbec nevykreslí, když příjmení není. */}
              <h1 className="text-6xl font-black uppercase leading-[0.92] tracking-tight sm:text-7xl">
                <span className="sr-only">{person.name}</span>
                <span aria-hidden>
                  {first}
                  {lastName ? (
                    <>
                      <br />
                      <span className="text-signal">{lastName}</span>
                    </>
                  ) : null}
                </span>
              </h1>
              {/* Sledování se razí TAM, kde entita je — do teď stálo jediné
                  tlačítko v liště pod popiskem „tahle stránka" a spis o schránce
                  nevěděl. Odkaz vedle je zpáteční cesta k tomu, co se právě
                  zapsalo. */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <FollowButton
                  entityKey={`poslanec:${person.pspId}`}
                  label={person.name}
                  subject={tcom("followSubjectMp", { name: person.name })}
                  words={{ follow: tcom("followWord"), following: tcom("followingWord") }}
                />
                <Link
                  href="/schranka"
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep hover:underline"
                >
                  {tcom("followInbox")}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
                {/* Deník je proud DATOVANÝCH faktů o téhle entitě — klíč `?entita=`
                    je týž, jakým se sleduje ve schránce (features/denik/deriveDenik.ts
                    vlastní jeho tvar, spis si ho neskládá po svém). Spis říká, KDO to
                    je; deník, co se s ním dělo. */}
                <Link
                  href={entityDenikHref(mpEntityKey(person.pspId))}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt hover:underline"
                >
                  {t("denikLink")}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
                {/* „Index spisů JE žebříček" (features/shell/navModel.ts) — a spis
                    na něj dosud nevedl vůbec, jen skóre a pořadí z něj tiskl. */}
                <Link
                  href="/zebricek"
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-steel hover:text-ink hover:underline"
                >
                  {t("leaderboardLink")}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
            <div className="text-right">
              {/* Vlajkové číslo platformy je CITACE: nese vlastní adresu, pass
                  grafu i ref formule (features/civicscore/scoreClaim.ts), takže
                  se dá ověřit na /overeni — a přepočet se pozná i tehdy, když
                  hodnota náhodou vyjde stejně. */}
              <AnimatedScore
                value={person.score}
                claim={scoreClaim}
                formatKind="dec"
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
              {/* Pas skóre + jeho LINIE. Spis tiskl číslo pasu i tehdy, když ho data
                  nesla jen na prvním uzlu, a linii metodiky nečetl vůbec — proto šest dní
                  ukazoval skóre staré formule bez jediného slova o tom. */}
              <SourceNote className="mt-1 !text-[10px]">
                {t("periodNote")}
                {data.provenancePass != null ? ` · ${t("indexPass", { pass: f.int(data.provenancePass) })}` : ""}
                {data.provenance.state === "mixed"
                  ? ` · ${t("indexPassMixed", { count: f.int(data.provenance.distinctCount) })}`
                  : ""}
                {!data.provenance.formulaMatch && data.provenance.state !== "absent"
                  ? ` · ${t("indexRefMismatch", {
                      dataRef: storedRefLabel(data.provenance),
                      codeRef: data.provenance.declaredRef,
                    })}`
                  : ""}
              </SourceNote>
              {/* Pas skóre pojmenuje průchod; odkaz ukáže vzorec, který ten průchod
                  počítal (vykreslený z lib/analysis/contribution.ts, ne z dokumentu). */}
              <p className="mt-1 flex flex-wrap justify-end gap-x-4 gap-y-1">
                <Link
                  href="/metodika"
                  className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-signal hover:underline"
                >
                  {tm("linkLabel")}
                  <ArrowUpRight className="h-2.5 w-2.5" aria-hidden />
                </Link>
                {/* Claim už nese celou adresu; do teď ji uměl přečíst jen stroj
                    z data-claim-* atributů. Tohle je táž adresa pro člověka. */}
                <Link
                  href={`/overeni?ref=${encodeURIComponent(scoreClaim.ref)}`}
                  className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt hover:underline"
                >
                  {t("verifyScore")}
                  <ArrowUpRight className="h-2.5 w-2.5" aria-hidden />
                </Link>
              </p>
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
              potlačeno (TenureTrendGate) místo zavádějících sazeb. Analytikova
              mezidobová próza (effort_psp9_trend_note) jde s ním v obou větvích. */}
          <TenureTrendGate
            trend={person.trend}
            componentLabels={Object.fromEntries(components.map((c) => [c.key, c.label])) as Partial<Record<ComponentKey, string>>}
            tenureDays={data.effortTenureDays}
            psp9TrendNote={data.effortPsp9TrendNote}
            recordedAt={person.effortRecordedAt}
          />

          {/* Kariérní spis — služební záznam přes volební období (mandáty jsou
              v registru pro všechna období; záznam aktivity jen pro běžící a
              částečně PSP9 — stuha to přiznává po obdobích). */}
          <CareerSpineSection career={data.career} asOf={data.seatsAsOf} />
        </HeaderReveal>

        {/* ── Složky přispění (číslo odvozuje `no()`) ──────────── */}
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
                  <ComponentBar
                    pct={Math.min(100, (pts / c.weight) * 100)}
                    color={fill.color}
                    opacity={fill.opacity}
                  />
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

        {/* ── Nejbližší spojenci (číslo oddílu odvozuje `no()`) ─── */}
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

        {/* ── Rebelie proti klubu (číslo odvozuje `no()`) ──────── */}
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
          {/* Míra je odvozená z jednotlivých hlasování; tady jsou ta hlasování.
              Vykresluje se i u poslance bez rebelie (čestný prázdný stav), aby
              se mlčení nedalo splést se skrytým nálezem. */}
          {rebellionSlot}
        </section>

        {/* ── Výbory a komise (číslo odvozuje `no()`) ──────────── */}
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
