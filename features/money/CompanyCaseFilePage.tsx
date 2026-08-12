"use client";

/**
 * Spis firmy (/penize/firma/[ico]) — firma je v grafu KŘIŽOVATKA: potkává se v ní
 * smlouva, dotace, dar straně a (u 14 firem) víc poslanců najednou. Do teď byl ten
 * pohled spočitatelný a nikde nezveřejněný — kniha vazeb ukazuje řádek na VAZBU a spis
 * poslance jednu stranu té vazby, takže větu „v téhle firmě sedí tři poslanci" neřekla
 * žádná plocha.
 *
 * NENÍ TO ŽEBŘÍČEK a nad touhle stránkou žádný rozcestník firem nestojí. Vazby se sázejí
 * v pořadí síly důkazu (reviewRank), ne podle peněz, a sousedství není obvinění.
 *
 * DVĚ VARIANTY (2026-08-12). Firma bez jediné vazby na poslance, kolem které ale graf
 * vede zapsané vlastnictví, dostane REJSTŘÍKOVÝ VÝPIS místo popření: identita, odkazy do
 * rejstříků, blok vlastnictví a jedna věta o tom, co přesně tu chybí. Žádný dosah, žádná
 * kniha smluv, žádný ražený claim — bez vazby neexistuje pravidlo přiřazení, které by
 * řeklo, čí ty peníze jsou. Rozlišuje se polem `variant`, které vazbový payload nemá.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import FlagList from "@/features/shared/components/FlagList";
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import { buildRegistryLinks } from "./reviewTypes";
import { tieFlagInfos } from "./tieFlags";
import AnalystNote from "./components/AnalystNote";
import OwnershipBlock from "./components/OwnershipBlock";
import TieClassExplainer from "./components/TieClassExplainer";
import FollowButton from "@/features/schranka/FollowButton";
import { companyEntityKey } from "@/features/denik/deriveDenik";
import { entityDenikHref } from "@/features/schranka/followCodec";
import CitableNumber from "@/lib/claims/CitableNumber";
import type { Locale } from "@/lib/i18n/config";
import { companyReachClaim } from "./moneyClaims";
import { bucketReachCzk, isAttributable } from "./reachableMoney";
import type { CompanyFileData, CompanyRegistryFileData } from "./ownership";
import {
  compactCzk,
  temporalBadge,
  tieClassInfo,
  tieClassOriginInfo,
  type CompanyTie,
} from "./moneyTypes";

const BADGE_TONE_CLS: Record<string, string> = {
  current: "border-cobalt text-cobalt",
  ended: "border-hairline text-steel",
  warn: "border-ochre bg-ochre/15 text-ink",
  unknown: "border-dashed border-hairline text-steel",
};
const CLASS_TONE_CLS: Record<string, string> = {
  signal: "border-signal text-signal",
  cobalt: "border-cobalt text-cobalt",
  steel: "border-hairline text-steel",
};

export default function CompanyCaseFilePage({ data }: { data: CompanyFileData | null }) {
  const locale = useLocale();
  const en = locale === "en";
  const t = useTranslations("money");
  const tcom = useTranslations("common");

  if (!data) {
    return (
      <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="border-2 border-dashed border-hairline p-8">
            <SourceNote>{t("shared.sourceKnowledgeGraph")}</SourceNote>
            <p className="mt-3 text-lg">{t("companyFile.noTie")}</p>
            <Link
              href="/penize"
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              ← {t("companyFile.backToLedger")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Firma, kterou graf zná jen z rejstříku vlastnictví. Zúžení přes `in` — vazbový payload
  // pole `variant` nenese, takže se po drátě nezměnil ani o bajt.
  if ("variant" in data) return <RegistryOnlyFile data={data} />;

  // Which side of the attribution split this firm falls on — from the SHARED definition,
  // not a local class test. Exactly one bucket carries a one-company population.
  const attributable = data.money.attributable.companies > 0;
  const bucket = attributable ? data.money.attributable : data.money.steward;
  const reachCzk = bucketReachCzk(bucket);
  // Gate states of the ties the figure rests on — an aggregate is confirmed only when
  // all of them are (moneyClaims.ts rule 4), and all 211 in the graph are pending today.
  const tieStates = data.ties.map((x) => x.reviewState);
  const mpCount = new Set(data.ties.map((x) => x.pspId)).size;
  // „Nejméně" tu může znít z JEDINÉHO důvodu: čtení smluv narazilo na vlastní strop.
  // Korpusovou heuristiku (`perCompanyCap`) `reachableMoney` nad jednou firmou vůbec
  // nespouští — od 2026-08-12 dostává `readScope`, takže tenhle příznak je odpověď
  // čtení, ne odhad ze vzorku (viz MpCaseFilePage, tatáž dvojice vět).
  const reachIsFloor = data.money.coverage.isFloor;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <FileHeader />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">{t("companyFile.eyebrow", { pass: data.pass })}</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {data.name}
          <span className="text-signal">.</span>
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-steel">
          IČO {data.ico} · {t("companyFile.tiesMps", { ties: data.ties.length, mps: mpCount })}
        </p>
        {/* Sledování se razí tam, kde entita je. Klíč je týž veřejný klíč, kterým
            deník adresuje `?entita=` — jedna adresa odběru pro celou aplikaci. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <FollowButton
            entityKey={companyEntityKey(data.ico)}
            label={data.name}
            subject={t("companyFile.followSubject", { name: data.name })}
            words={{
              follow: tcom("followWord"),
              following: tcom("followingWord"),
            }}
          />
          <Link
            href="/schranka"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            {tcom("followInbox")}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
          {/* Sledovat entitu a PŘEČÍST SI, co se u ní dělo, jsou dvě věci —
              dosud tu bylo jen to první. Týž klíč, jaký sleduje tlačítko vedle;
              adresu staví kodek schránky, klíč builder deníku. */}
          <Link
            href={entityDenikHref(companyEntityKey(data.ico))}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            {t("companyFile.dailyRecord")}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        {/* The cross-MP fact, stated as a fact and immediately qualified. Sitting on the
            same board is not a finding about either person — it is why this page exists,
            and why it is not a ranking. */}
        {mpCount > 1 && (
          <p className="mt-4 max-w-2xl border-l-4 border-cobalt bg-cobalt/10 px-4 py-3 text-sm leading-relaxed text-ink">
            {t("companyFile.multiMpNote", { count: mpCount })}
          </p>
        )}

        {/* ── money ───────────────────────────────────────────── */}
        <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-3">
          <div className="bg-paper p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("companyFile.reachLabel")}
            </p>
            <p
              className={`mt-2 text-3xl font-black tabular-nums tracking-tight ${attributable ? "text-signal" : "text-ink"}`}
            >
              {/* The headline figure is what a journalist quotes, so it carries its own
                  citable address (`claim:…:dosah-firmy:company:ico:<ičo>`) — the value
                  comes from the shared arithmetic and /overeni re-derives it through the
                  same loader. Gate state is part of the claim: this total is „verified"
                  only if EVERY tie behind it is (moneyClaims.ts, rule 4). */}
              {reachCzk > 0 ? (
                <>
                  {reachIsFloor ? `${t("shared.atLeast")} ` : ""}
                  <CitableNumber
                    value={reachCzk}
                    claim={companyReachClaim(data.ico, bucket, tieStates, data.pass).claim}
                    locale={locale as Locale}
                    kind="czkCompact"
                  />
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {t("shared.contractsCount", { count: bucket.contractCount })}
              {data.subsidiesCzk > 0
                ? ` · ${t("shared.subsidies")} ${compactCzk(data.subsidiesCzk, locale)}`
                : ""}
            </p>
            {/* The P29 rule AT the number: a steward institution's billions must never be
                read like a firm an MP owns. */}
            <p className="mt-2 text-sm leading-relaxed text-steel">
              {attributable ? t("companyFile.attributableRule") : t("companyFile.stewardRule")}
            </p>
            <SourceNote className="mt-3 !text-[10px]">
              {t("companyFile.reachSource")}
              {reachIsFloor ? t("companyFile.reachReadCapped") : ""}
            </SourceNote>
          </div>
          <div className="bg-paper p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("companyFile.subsidiesDrawn")}
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums tracking-tight">
              {data.subsidiesCzk > 0 ? compactCzk(data.subsidiesCzk, locale) : "—"}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {t("shared.titlesCount", { count: data.subsidiesCount })}
            </p>
            <SourceNote className="mt-3 !text-[10px]">{t("companyFile.subsidiesSource")}</SourceNote>
          </div>
          <div className="bg-paper p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {t("companyFile.donatedLabel")}
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums tracking-tight">
              {data.donatedToPartyCzk != null && data.donatedToPartyCzk > 0
                ? compactCzk(data.donatedToPartyCzk, locale)
                : "—"}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {data.donationRecipientParty ?? t("companyFile.noDonation")}
            </p>
            <SourceNote className="mt-3 !text-[10px]">{t("companyFile.donationSource")}</SourceNote>
          </div>
        </div>

        {/* ── registry ────────────────────────────────────────── */}
        <RegistryLinks ico={data.ico} />

        {/* ── vlastnická struktura ────────────────────────────── */}
        {/* Zapsané okolí firmy stojí HNED za rejstříkovými odkazy a PŘED vazbami na
            poslance: je to rejstříkový fakt o firmě samotné, ne tvrzení o žádném
            člověku. Blok se vykreslí jen tehdy, když pro tuhle firmu graf zápis
            vlastnictví vede (živě 29 ze 195 firem s vazbou) — jinak neexistuje. */}
        {data.ownership && <OwnershipBlock ownership={data.ownership} />}

        {/* ── ties ────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-black uppercase tracking-tight">
            {t("companyFile.tiesTitle")}
          </h2>
          <SourceNote className="mt-2">{t("companyFile.tiesOrderNote")}</SourceNote>
          <div className="mt-6 space-y-6">
            {data.ties.map((tie) => (
              <TieCard key={`${tie.pspId}-${tie.companyId}`} tie={tie} en={en} />
            ))}
          </div>
        </section>

        {/* ── contracts ───────────────────────────────────────── */}
        {data.contracts.length > 0 && (
          <section className="mt-12 border-t-4 border-ink pt-8">
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {t("companyFile.contractsTitle")}
            </h2>
            <SourceNote className="mt-2">
              {t("companyFile.contractsSource", {
                shown: data.contracts.length,
                total: data.contracts.length + data.contractsMoreCount,
              })}
            </SourceNote>
            <ul className="mt-4 divide-y divide-hairline border-t-2 border-ink">
              {data.contracts.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-steel">{c.label}</span>
                  <span className="shrink-0 font-mono text-xs font-bold tabular-nums">
                    {c.amountCzk != null ? compactCzk(c.amountCzk, locale) : "—"}
                  </span>
                  <span className="w-24 shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-steel">
                    {c.signedOn ?? t("companyFile.noUsableDate")}
                  </span>
                </li>
              ))}
            </ul>
            {data.contractsMoreCount > 0 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel">
                {t("companyFile.moreContractsInGraph", { count: data.contractsMoreCount })}
              </p>
            )}
            {/* An impossible signature is not a date. The row and its amount stay, the
                date goes, and the count is disclosed — the date is never repaired. */}
            {data.implausibleDateCount > 0 && (
              <p className="mt-3 max-w-2xl border-l-2 border-ochre pl-3 text-sm leading-relaxed text-steel">
                {t("companyFile.implausibleDates", {
                  count: data.implausibleDateCount,
                  asOf: data.asOf,
                })}
              </p>
            )}
          </section>
        )}

        <div className="mt-14 border-t-4 border-ink pt-8">
          <SourceNote>{t("shared.howToReadTieClass")}</SourceNote>
          <div className="mt-4">
            <TieClassExplainer compact />
          </div>
        </div>

        <p className="mt-10 max-w-2xl text-sm italic leading-relaxed text-steel">
          {t("companyFile.disclaimer")}
        </p>
      </div>
    </main>
  );
}

/** Horní lišta spisu firmy. Jedna pro obě varianty — dvě kopie záhlaví jsou dvě
 *  místa, kde se od sebe stránka jednou odchýlí. */
function FileHeader() {
  const t = useTranslations("money");
  return (
    <header className="border-b-4 border-ink">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <span className="font-mono text-xs uppercase tracking-widest text-steel">/ penize / firma</span>
        <Link
          href="/penize"
          className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          ← {t("companyFile.ledgerShort")}
        </Link>
      </div>
    </header>
  );
}

/** Primární záznamy k IČO. Adresy staví sdílený `buildRegistryLinks` z IČO samotného
 *  uzlu — žádná z nich není tvrzení, jsou to rejstříky, do kterých se dá podívat.
 *  Rejstříkový výpis firmy bez vazby je vykresluje ze STEJNÉHO builderu, takže obě
 *  varianty posílají čtenáře na tytéž záznamy. */
function RegistryLinks({ ico }: { ico: string }) {
  const t = useTranslations("money");
  const links = buildRegistryLinks(ico, "");
  return (
    <div className="mt-8 border-2 border-hairline p-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">
        {t("companyFile.verifyInRegistries")}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {[
          { label: t("shared.registryAresSubject"), href: links.aresSubject },
          { label: "ARES VR", href: links.aresVr },
          { label: t("shared.registryCommercial"), href: links.justiceVr },
          { label: t("shared.registryContracts"), href: links.registrSmluv },
          { label: t("shared.registryHlidacCompany"), href: links.hlidacSubjekt },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ExternalLink className="h-3 w-3" /> {l.label}
          </a>
        ))}
      </div>
      <SourceNote className="mt-3 !text-[10px]">{t("companyFile.deepLinksNote")}</SourceNote>
    </div>
  );
}

/**
 * Firma, kterou graf drží jen v rejstříkové vrstvě — cíl odkazu z bloku vlastnictví.
 *
 * CO TU SCHVÁLNĚ NENÍ:
 *  • ŽÁDNÉ PENÍZE. Bez vazby neexistuje třída vazby, bez třídy pravidlo přiřazení —
 *    a `reachableMoney([])` by vrátilo nulu, tedy číslo, které graf nikdy nespočítal.
 *    Nula jako dosah je tvrzení, ne mlčení.
 *  • ŽÁDNÉ SLEDOVÁNÍ ANI DENÍK. Deník je klíčovaný přes smlouvy firem, které poslanci
 *    vlastní nebo řídí; tahle firma tam žádný řádek mít nebude, takže nabídnout odběr
 *    znamená slíbit doručení, které nikdo nesplní (precedens `obec:` ve schránce).
 *  • ŽÁDNÝ CITOVATELNÝ CLAIM. Nerazí se adresa čísla, které se nesází.
 */
function RegistryOnlyFile({ data }: { data: CompanyRegistryFileData }) {
  const t = useTranslations("money");
  const pass = data.ownership.pass;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <FileHeader />

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Průchod se bere z PROVENIENCE VLASTNICKÝCH HRAN, nikdy z `ties[0]` — ty tu
            žádné nejsou a `slice.pass` by byl 0. Když se řádky na jednom průchodu
            neshodnou (nebo ho nenesou), věta žádný neuvádí. */}
        <SourceNote tone="signal">
          {pass != null
            ? t("companyFile.registryOnlyEyebrow", { pass })
            : t("companyFile.registryOnlyEyebrowNoPass")}
        </SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {data.name}
          <span className="text-signal">.</span>
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-steel">IČO {data.ico}</p>

        <div className="mt-6 max-w-2xl border-l-4 border-hairline bg-paper-strong px-4 py-3">
          <p className="text-sm leading-relaxed text-ink">{t("companyFile.registryOnlyLead")}</p>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            {t("companyFile.registryOnlyNotEmpty")}
          </p>
          <SourceNote className="mt-3 !text-[10px]">
            {t("companyFile.registryOnlySource")}
          </SourceNote>
        </div>

        <RegistryLinks ico={data.ico} />

        <OwnershipBlock ownership={data.ownership} />

        <p className="mt-14 max-w-2xl border-t-4 border-ink pt-8 text-sm italic leading-relaxed text-steel">
          {t("companyFile.registryOnlyDisclaimer")}
        </p>

        <Link
          href="/penize"
          className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          ← {t("companyFile.backToLedger")}
        </Link>
      </div>
    </main>
  );
}

function TieCard({ tie, en }: { tie: CompanyTie; en: boolean }) {
  const t = useTranslations("money");
  const tcom = useTranslations("common");
  const temporal = temporalBadge(tie);
  const info = tieClassInfo(tie.tieClass);
  const origin = tieClassOriginInfo(tie.tieClassOrigin);
  const overrides = tie.tieClassOrigin === "stored" && tie.tieClassHeuristic !== tie.tieClass;

  return (
    <article className="border-2 border-ink">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink bg-paper-strong px-5 py-4">
        <div>
          <Link
            href={`/penize/${tie.pspId}`}
            className="text-xl font-black uppercase tracking-tight transition-colors hover:text-signal"
          >
            {tie.mpName}
          </Link>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel">
            {tie.club ? `${tie.club} · ` : ""}
            {tie.role || t("companyFile.roleNotRecorded")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="flex flex-col items-end gap-0.5">
            <span
              className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${CLASS_TONE_CLS[info.tone]}`}
            >
              {en ? info.labelEn : info.labelCs}
            </span>
            <span
              className={`font-mono text-[9px] uppercase tracking-widest ${tie.tieClassOrigin === "stored" ? "text-steel" : "text-ochre"}`}
            >
              {en ? origin.labelEn : origin.labelCs}
            </span>
          </span>
          {tie.reviewState === "verified" ? (
            <span className="border-2 border-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
              {tcom("verified")}
            </span>
          ) : tie.reviewState === "rejected" ? (
            <span className="border-2 border-steel px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-steel">
              {t("shared.rejected")}
            </span>
          ) : (
            <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
              {tcom("pendingReview")}
            </span>
          )}
          <span
            className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${BADGE_TONE_CLS[temporal.tone]}`}
          >
            {en ? temporal.labelEn : temporal.labelCs}
          </span>
        </div>
      </div>

      <div className="px-5 py-5">
        <p className="text-sm leading-relaxed text-steel">{en ? info.descEn : info.descCs}</p>
        <p
          className={`mt-3 border-l-2 pl-3 text-sm leading-relaxed ${tie.tieClassOrigin === "stored" ? "border-hairline text-steel" : "border-ochre text-steel"}`}
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
            {en ? origin.labelEn : origin.labelCs}:{" "}
          </span>
          {en ? origin.noteEn : origin.noteCs}
          {overrides ? (
            <span className="mt-1 block">
              {t("shared.heuristicOverride", {
                label: en ? tieClassInfo(tie.tieClassHeuristic).labelEn : tieClassInfo(tie.tieClassHeuristic).labelCs,
              })}
            </span>
          ) : null}
        </p>

        <FlagList
          className="mt-4"
          heading={t("shared.flagsHeading")}
          items={tieFlagInfos(tie.flags).map((f) => ({
            key: f.token,
            label: en ? f.labelEn : f.labelCs,
            note: en ? f.noteEn : f.noteCs,
            tone: f.tone,
          }))}
        />

        <AnalystNote tie={tie} className="mt-4" />

        <p className="mt-4 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
          {t("shared.sourceLabel")}: {tie.source || "—"}
          {" · "}
          {t("companyFile.attributionLabel")}:{" "}
          {isAttributable(tie.tieClass)
            ? t("companyFile.attributionOwned")
            : t("companyFile.attributionSteward")}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href={`/penize/${tie.pspId}`}
            className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            {t("shared.mpMoneyFile")} →
          </Link>
          <Link
            href={`/poslanec/${tie.pspId}`}
            className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            {t("shared.fullProfile")} →
          </Link>
          <Link
            href={claimRefPath(tie.receiptRef)}
            className="inline-flex items-center gap-1.5 border-2 border-cobalt px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:border-signal hover:text-signal"
          >
            {t("shared.provenanceReceipt")} →
          </Link>
        </div>
      </div>
    </article>
  );
}
