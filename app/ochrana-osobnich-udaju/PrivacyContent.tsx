/* <!-- OPERATOR REVIEW REQUIRED: template-grade GDPR notice. The controller
   identity is a marked placeholder ([PROVOZOVATEL — doplnit před spuštěním])
   and the legal-basis wording (čl. 6(1)(f), čl. 85 GDPR) must be reviewed by
   the operator / counsel BEFORE LAUNCH. Nothing here is legal advice. --> */

/*
 * /ochrana-osobnich-udaju — GDPR privacy notice.
 *
 * PRAVIDLO STRÁNKY: každé technické tvrzení je doložené kódem, ne přáním —
 * cookie NEXT_LOCALE (lib/i18n/locale.ts, maxAge 1 rok), cookie
 * politicas_admin (app/admin/gateActions.ts + accessGate.ts: httpOnly,
 * path /admin, 12 h), Plausible env-gated bez cookies (app/layout.tsx),
 * Sentry env-gated (instrumentation-client.ts). Změní-li se kód, musí se
 * změnit i tenhle text — proto jsou zdroje vypsané tady v hlavičce.
 *
 * Kontakt: NEXT_PUBLIC_CONTACT_EMAIL je volitelný — bez něj se vykreslí
 * poctivá věta „bude doplněno", nikdy vymyšlená adresa (týž no-op-bez-env
 * vzor jako Sentry/Plausible).
 */

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";

export default async function PrivacyContent() {
  const t = await getTranslations("legal.privacy");
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

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

        {/* ── 01 Správce ──────────────────────────────────────── */}
        <section className="border-t-4 border-ink pt-10 pb-10">
          <SectionHeading index={1} title={t("s1Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s1Body")}</p>
        </section>

        {/* ── 02 Údaje o veřejných činitelích ─────────────────── */}
        <section className="border-t-4 border-ink pt-10 pb-10">
          <SectionHeading index={2} title={t("s2Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s2Lead")}</p>
          <ul className="mt-4 max-w-2xl border-2 border-ink">
            {(["s2SourcePsp", "s2SourceContracts", "s2SourceAres", "s2SourceLaws"] as const).map((key) => (
              <li
                key={key}
                className="border-b border-hairline px-4 py-3 text-[15px] leading-relaxed last:border-b-0"
              >
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s2Purpose")}</p>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s2LegalBasis")}</p>
        </section>

        {/* ── 03 Údaje o návštěvnících ────────────────────────── */}
        <section className="border-t-4 border-ink pt-10 pb-10">
          <SectionHeading index={3} title={t("s3Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s3Lead")}</p>
          <ul className="mt-4 max-w-2xl border-2 border-ink">
            {(["s3CookieLocale", "s3CookieAdmin"] as const).map((key) => (
              <li
                key={key}
                className="border-b border-hairline px-4 py-3 font-mono text-xs leading-relaxed last:border-b-0"
              >
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s3Analytics")}</p>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s3Sentry")}</p>
          <p className="mt-4 max-w-2xl text-[15px] font-bold leading-relaxed">{t("s3NoTracking")}</p>
        </section>

        {/* ── 04 Práva subjektů údajů ─────────────────────────── */}
        <section className="border-t-4 border-ink pt-10 pb-10">
          <SectionHeading index={4} title={t("s4Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s4Body")}</p>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s4Correction")}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/overeni"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt hover:underline"
            >
              {t("s4VerifyLink")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt hover:underline"
              >
                {t("s4ContactLabel")}: {contactEmail}
              </a>
            ) : (
              <SourceNote as="sentence">{t("s4NoContact")}</SourceNote>
            )}
          </div>
        </section>

        {/* ── 05 Doba uchování ────────────────────────────────── */}
        <section className="border-t-4 border-ink pt-10">
          <SectionHeading index={5} title={t("s5Heading")} />
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-steel">{t("s5Body")}</p>
          <div className="mt-5">
            <Link
              href="/metodika"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt hover:underline"
            >
              {t("s5MethodLink")}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
