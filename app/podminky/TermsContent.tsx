/* <!-- OPERATOR REVIEW REQUIRED: template-grade terms of use. The operator
   identity is a marked placeholder ([PROVOZOVATEL — doplnit před spuštěním])
   and the final wording must be reviewed by the operator / counsel BEFORE
   LAUNCH. Nothing here is legal advice. --> */

/*
 * /podminky — podmínky užití. Krátké schválně: informační služba, data pod
 * CC BY (týž závazek, který už nese patička — messages `landing.footerRight`:
 * „otevřená data · cc by"), bez záruky, spory o metodu přes /metodika a
 * /overeni, zákaz vydávat výpočet za redakční názor, české právo.
 */

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";

export default async function TermsContent() {
  const t = await getTranslations("legal.terms");

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-4xl px-6 pb-16">
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
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-signal hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {t("backHome")}
            </Link>
          </div>
        </div>

        {/* ── 01 Povaha služby ────────────────────────────────── */}
        <section className="border-t-4 border-ink pt-10 pb-10">
          <SectionHeading index={1} title={t("s1Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s1Body")}</p>
        </section>

        {/* ── 02 Licence dat ──────────────────────────────────── */}
        <section className="border-t-4 border-ink pt-10 pb-10">
          <SectionHeading index={2} title={t("s2Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s2Body")}</p>
        </section>

        {/* ── 03 Bez záruky ───────────────────────────────────── */}
        <section className="border-t-4 border-ink pt-10 pb-10">
          <SectionHeading index={3} title={t("s3Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s3Body")}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/metodika"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt hover:underline"
            >
              {t("s3MethodLink")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              href="/overeni"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt hover:underline"
            >
              {t("s3VerifyLink")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </section>

        {/* ── 04 Zákaz zkreslování ────────────────────────────── */}
        <section className="border-t-4 border-ink pt-10 pb-10">
          <SectionHeading index={4} title={t("s4Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s4Body")}</p>
        </section>

        {/* ── 05 Rozhodné právo ───────────────────────────────── */}
        <section className="border-t-4 border-ink pt-10">
          <SectionHeading index={5} title={t("s5Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s5Body")}</p>
        </section>
      </div>
    </main>
  );
}
