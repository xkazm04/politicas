"use client";

/*
 * /metodika — index přispění vysvětlený TÍM KÓDEM, KTERÝ HO POČÍTÁ.
 *
 * PROČ: platforma se profiluje jako metodicky průhledná, /zebricek cituje
 * „průchod grafu č. 42" a /referendum zve čtenáře index PŘEVÁŽIT — ale nikde
 * nebylo vidět, JAKÝ ten vzorec je. Referendum si dokonce zveřejněné váhy
 * psalo jako řetězec „25-20-20-15-10-10", který s CONTRIBUTION_WEIGHTS nic
 * nespojovalo; změna váhy by ho tiše nechala lhát.
 *
 * PRAVIDLO TÉHLE STRÁNKY: každé číslo na ní pochází z IMPORTU
 * (lib/analysis/contribution.ts, features/civicscore/componentDefs.ts) nebo
 * z grafu (provenience skóre). Žádný literál — změna váhy, nasycení nebo
 * otisku vzorce musí stránku PŘETÉCT, jinak by to byl jen další dokument,
 * který se rozejde s produktem, přesně jako těch šest popisků, co do dneška
 * žilo v pěti kopiích.
 *
 * ŽÁDNÁ VYMYŠLENÁ HISTORIE: graf nese jen aktuální `{pass, ref}` na uzlech
 * poslanců, takže se tiskne jen ten — jestli se uložený otisk shoduje s tím,
 * co kód deklaruje dnes, a nic o cestě mezi nimi.
 */

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import {
  COMMITTEE_ORGAN_TYPES,
  COMMITTEE_SATURATION,
  CONTRIBUTION_FORMULA_REF,
  CONTRIBUTION_WEIGHTS,
  LEADERSHIP_FUNCTIONS,
  LEGISLATIVE_SATURATION,
  SPEECH_SATURATION,
} from "@/lib/analysis/contribution";
import { COMPONENT_DEFS } from "./componentDefs";
import { storedRefLabel, type ContributionProvenance } from "./provenance";

/** Součet zveřejněných vah — POČÍTANÝ, ne napsaný. Kdyby se rozešel se stem,
 *  stránka to řekne místo aby stovku tvrdila dál. */
const WEIGHT_TOTAL = Object.values(CONTRIBUTION_WEIGHTS).reduce((a, b) => a + b, 0);

export default function MetodikaPage({ provenance }: { provenance: ContributionProvenance | null }) {
  const t = useTranslations("metodika");
  const f = useFormat();

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-4xl px-6">
        {/* ── Titulní pás ─────────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{t("sourceNote")}</SourceNote>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            {t("title")}
            <span className="text-signal">.</span>
          </h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">{t("lead")}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/zebricek"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-signal hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {t("backToLeaderboard")}
            </Link>
            <Link
              href="/referendum"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt hover:underline"
            >
              {t("toReferendum")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        {/* ── 01 Šest složek a jejich váhy ─────────────────────── */}
        <section className="border-t-4 border-ink pt-10">
          <SectionHeading
            index={1}
            title={t("weightsHeading")}
            aside={<SourceNote>{t("weightsSource", { total: f.int(WEIGHT_TOTAL) })}</SourceNote>}
          />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("weightsLead")}</p>
          <div className="mt-6 border-2 border-ink">
            <div className="grid grid-cols-[1fr_auto] gap-x-6 border-b-2 border-ink bg-paper-strong px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">
              <span>{t("colComponent")}</span>
              <span className="text-right">{t("colWeight")}</span>
            </div>
            {COMPONENT_DEFS.map((c) => (
              <div
                key={c.key}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-b border-hairline px-4 py-3 last:border-b-0"
              >
                <span>
                  <span className="block text-[15px] font-black uppercase tracking-tight">{c.label}</span>
                  <SourceNote className="mt-0.5">{c.source}</SourceNote>
                </span>
                <span className="text-right font-mono text-2xl font-black tabular-nums">
                  {f.int(c.weight)}
                  <span className="ml-1 text-xs font-bold text-steel-aa">{t("pointsUnit")}</span>
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-t-2 border-ink bg-paper-strong px-4 py-2.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                {t("weightsTotal")}
              </span>
              <span className="text-right font-mono text-lg font-black tabular-nums">
                {f.int(WEIGHT_TOTAL)}
              </span>
            </div>
          </div>
        </section>

        {/* ── 02 Nasycení počtů ───────────────────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={2}
            title={t("capsHeading")}
            aside={<SourceNote>{t("capsSource")}</SourceNote>}
          />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("capsLead")}</p>
          <div className="mt-6 grid gap-px border-2 border-ink bg-ink sm:grid-cols-3">
            {[
              { k: "committee", cap: COMMITTEE_SATURATION, label: t("capCommittee") },
              { k: "legislative", cap: LEGISLATIVE_SATURATION, label: t("capLegislative") },
              { k: "speech", cap: SPEECH_SATURATION, label: t("capSpeech") },
            ].map((s) => (
              <div key={s.k} className="bg-paper p-4">
                <p className="font-mono text-3xl font-black tabular-nums">{f.int(s.cap)}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-steel">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("ratesLead")}</p>
        </section>

        {/* ── 03 Výbory po tělesech, ne po řádcích ─────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={3}
            title={t("dedupeHeading")}
            aside={<SourceNote>{t("dedupeSource")}</SourceNote>}
          />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("dedupeLead")}</p>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-steel">{t("dedupeUnknownOrgan")}</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                {t("organTypesLabel")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {COMMITTEE_ORGAN_TYPES.map((o) => (
                  <li
                    key={o}
                    className="border border-hairline bg-paper-strong px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider"
                  >
                    {o}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                {t("leadershipLabel")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {LEADERSHIP_FUNCTIONS.map((fn) => (
                  <li
                    key={fn}
                    className="border border-hairline bg-paper-strong px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider"
                  >
                    {fn}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <SourceNote className="mt-4">{t("vocabSource")}</SourceNote>
        </section>

        {/* ── 04 Otisk vzorce a co nese graf ───────────────────── */}
        <section className="mt-14 border-t-4 border-ink pt-10 pb-16">
          <SectionHeading
            index={4}
            title={t("refHeading")}
            aside={<SourceNote>{t("refSource")}</SourceNote>}
          />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("refLead")}</p>
          <p className="mt-4 break-all border-l-4 border-signal bg-paper-strong px-4 py-3 font-mono text-sm font-bold">
            {CONTRIBUTION_FORMULA_REF}
          </p>

          {/* Co o svém původu tvrdí SAMA DATA — ne co si o nich myslí kód. */}
          {provenance === null ? (
            <SourceNote className="mt-6">{t("storeUnavailable")}</SourceNote>
          ) : provenance.state === "absent" ? (
            <SourceNote className="mt-6">{t("storeAbsent")}</SourceNote>
          ) : (
            <div className="mt-6">
              {provenance.state === "uniform" && provenance.pass !== null && (
                <SourceNote>
                  {t("storeUniform", {
                    pass: f.int(provenance.pass),
                    ref: provenance.ref ?? "—",
                    covered: f.int(provenance.covered),
                    total: f.int(provenance.total),
                  })}
                </SourceNote>
              )}
              {provenance.state === "mixed" && (
                <SourceNote>
                  {t("storeMixed", {
                    count: f.int(provenance.distinctCount),
                    covered: f.int(provenance.covered),
                    total: f.int(provenance.total),
                  })}
                </SourceNote>
              )}
              <SourceNote className="mt-1.5">
                {provenance.formulaMatch
                  ? t("storeMatch")
                  : t("storeMismatch", {
                      dataRef: storedRefLabel(provenance),
                      codeRef: provenance.declaredRef,
                    })}
              </SourceNote>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
