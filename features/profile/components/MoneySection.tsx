"use client";

/*
 * Peníze na spisu — důkaz vedle tvrzení.
 *
 * Spis nesl vlajku „možný nepřítomný manažer" jako kurzívní obvinění a žádný
 * důkaz k němu neukazoval. Ta vlajka se počítá z peněžních vazeb; tahle sekce
 * je ukazuje.
 *
 * ── PRAVIDLA, KTERÁ SE NESMÍ PORUŠIT ────────────────────────────────────────
 *
 * 1. NIC TU NENÍ HOTOVÝ NÁLEZ. Všech 211 vazeb `linked_to` v grafu je
 *    `pending_review` — žádnou zatím neschválil člověk. Každý řádek to říká
 *    sám za sebe, ne jen poznámka pod sekcí.
 * 2. PENÍZE JEN TAM, KAM SE SMÍ PŘISOUDIT (pravidlo P29, /penize). Dozorčí či
 *    správní funkce ve veřejné instituci (`steward`) není poslancův byznys:
 *    zakázky té nemocnice nebo univerzity jsou její vlastní veřejná činnost.
 *    Loader k takové vazbě žádnou částku ani nenačte a sekce ji nesečte —
 *    místo čísla stojí u řádku věta, proč tam číslo není.
 * 3. DATUM, KTERÉ NEMOHLO NASTAT, SE NEUKÁŽE A NEOPRAVÍ. Korpus nese podpisy
 *    v letech 0002, 1970, 2027 i 3062. Řádek zůstane (smlouva a částka jsou
 *    skutečné), datum se potlačí a sekce ten počet přizná.
 * 4. KAŽDÉ ČÍSLO CITUJE ZDROJ a prochází `lib/format.ts`.
 *
 * Sekce se vykresluje VŽDY, i bez jediné vazby — nepřítomnost nálezu je taky
 * nález a tiché vynechání by se od skrytého nálezu nedalo odlišit.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { temporalBadge, tieClassInfo } from "@/features/money/moneyTypes";
import type { ProfileMoney, ProfileMoneyTie } from "../getProfileData";

const CLASS_TONE_CLS: Record<string, string> = {
  signal: "border-signal text-signal",
  cobalt: "border-cobalt text-cobalt",
  steel: "border-hairline text-steel",
};
const BADGE_TONE_CLS: Record<string, string> = {
  current: "border-cobalt text-cobalt",
  ended: "border-hairline text-steel",
  warn: "border-ochre bg-ochre/15 text-ink",
  unknown: "border-dashed border-hairline text-steel",
};

export default function MoneySection({
  index,
  money,
  pspId,
}: {
  index: number;
  money: ProfileMoney;
  pspId: number;
}) {
  const t = useTranslations("profile");
  const f = useFormat();
  const locale = useLocale();
  const en = locale === "en";

  const attributableTies = money.ties.filter((tie) => tie.tieClass !== "steward");

  return (
    <section id="penize" className="mt-16 border-t-4 border-ink pt-10">
      <SectionHeading
        index={index}
        title={t("moneyHeading")}
        aside={<SourceNote>{t("moneyAside")}</SourceNote>}
      />

      {money.ties.length === 0 ? (
        <div className="mt-8 border-2 border-dashed border-hairline p-8">
          <p className="text-lg font-black uppercase tracking-tight">{t("moneyEmptyTitle")}</p>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-steel">{t("moneyEmptyBody")}</p>
          <SourceNote className="mt-4 !text-[10px]">{t("moneySourceEmpty")}</SourceNote>
        </div>
      ) : (
        <>
          {/* Souhrn — jediné číslo, které spis o poslanci tvrdí. */}
          <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-3">
            <div className="bg-paper p-6">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {t("moneyTieCount")}
              </p>
              <p className="mt-2 text-4xl font-black tabular-nums">{f.int(money.ties.length)}</p>
              <SourceNote className="mt-2 !text-[10px]">{t("moneyTieCountSource")}</SourceNote>
            </div>
            <div className="bg-paper p-6 sm:col-span-2">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                {t("moneyAttributableLabel")}
              </p>
              {attributableTies.length === 0 ? (
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-steel">
                  {t("moneyNoAttributable")}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-4xl font-black tabular-nums text-signal">
                    {money.anyTruncated ? `${t("moneyAtLeast")} ` : ""}
                    {f.czk(money.attributableCzk)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel">
                    {t("moneyContractsOf", {
                      contracts: money.attributableContracts,
                      contractsFmt: f.int(money.attributableContracts),
                      firms: attributableTies.length,
                      firmsFmt: f.int(attributableTies.length),
                    })}
                  </p>
                </>
              )}
              <SourceNote className="mt-2 !text-[10px]">{t("moneyAttributableSource")}</SourceNote>
            </div>
          </div>

          {/* Stav kontroly — nikdy jen jako poznámka pod čarou. */}
          {money.pendingTies > 0 && (
            <p className="mt-6 max-w-3xl border-l-4 border-ochre pl-4 text-[15px] font-bold leading-relaxed text-ink">
              {t("moneyPendingLead", {
                pending: money.pendingTies,
                pendingFmt: f.int(money.pendingTies),
                totalFmt: f.int(money.ties.length),
              })}
            </p>
          )}
          {money.stewardTies > 0 && (
            <p className="mt-4 max-w-3xl border-l-4 border-hairline pl-4 text-[13px] leading-relaxed text-steel">
              {t("moneyStewardNote", { count: money.stewardTies, countFmt: f.int(money.stewardTies) })}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-6">
            {money.ties.map((tie) => (
              <TieRow key={tie.companyId} tie={tie} en={en} />
            ))}
          </div>

          {money.unusableDates > 0 && (
            <p className="mt-6 max-w-3xl border-l-4 border-ochre pl-4 text-[13px] leading-relaxed text-steel">
              {t("moneyUnusableDates", { count: money.unusableDates, countFmt: f.int(money.unusableDates) })}
            </p>
          )}
          {money.anyTruncated && (
            <p className="mt-4 max-w-3xl border-l-4 border-ochre pl-4 text-[13px] leading-relaxed text-steel">
              {t("moneyTruncated")}
            </p>
          )}

          <p className="mt-8 max-w-3xl text-sm italic leading-relaxed text-steel">{t("moneyDisclaimer")}</p>
          <SourceNote className="mt-3 !text-[10px]">
            {t("moneySource")}
            {money.pass != null ? ` · ${t("moneyPass", { pass: f.int(money.pass) })}` : ""}
          </SourceNote>
        </>
      )}

      <Link
        href={`/penize/${pspId}`}
        className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
      >
        {t("moneyLink")}
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Link>
    </section>
  );
}

function TieRow({ tie, en }: { tie: ProfileMoneyTie; en: boolean }) {
  const t = useTranslations("profile");
  const f = useFormat();
  const info = tieClassInfo(tie.tieClass);
  const temporal = temporalBadge(tie);

  return (
    <article className="border-2 border-ink">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink bg-paper-strong px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-lg font-black uppercase leading-tight tracking-tight">{tie.company}</h3>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel">
            {t("moneyIco", { ico: tie.ico })}
            {tie.role ? ` · ${tie.role}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span
            className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${CLASS_TONE_CLS[info.tone]}`}
            title={en ? info.descEn : info.descCs}
          >
            {en ? info.labelEn : info.labelCs}
          </span>
          <span
            className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
              tie.reviewState === "verified"
                ? "border-cobalt text-cobalt"
                : tie.reviewState === "rejected"
                  ? "border-steel text-steel"
                  : "border-ochre bg-ochre/15 text-ink"
            }`}
          >
            {tie.reviewState === "verified"
              ? t("moneyVerified")
              : tie.reviewState === "rejected"
                ? t("moneyRejected")
                : t("moneyPending")}
          </span>
          <span
            className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${BADGE_TONE_CLS[temporal.tone]}`}
          >
            {en ? temporal.labelEn : temporal.labelCs}
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        {tie.tieClass === "steward" ? (
          // Pravidlo P29: peníze instituce nejsou peníze poslance, takže se tu
          // žádné nevykreslí — a řádek říká proč, aby to nevypadalo jako mezera.
          <p className="max-w-3xl text-[14px] leading-relaxed text-steel">{t("moneyStewardRow")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-steel">
                  {t("moneyContractsLabel")}
                </p>
                <p className="mt-0.5 text-2xl font-black tabular-nums">
                  {tie.contractCzk != null && tie.contractCzk > 0 ? (
                    <>
                      {tie.contractsTruncated ? `${t("moneyAtLeast")} ` : ""}
                      {f.czk(tie.contractCzk)}
                    </>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-steel">
                  {t("moneyContractCount", {
                    count: tie.contractCount ?? 0,
                    countFmt: f.int(tie.contractCount ?? 0),
                  })}
                </p>
              </div>
            </div>

            {tie.topContracts.length > 0 && (
              <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                {tie.topContracts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-steel" title={c.title}>
                      {c.title}
                    </span>
                    <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums">
                      {c.amountCzk != null ? f.czk(c.amountCzk) : t("moneyAmountMissing")}
                    </span>
                    <span className="w-32 shrink-0 text-right font-mono text-[11px] uppercase tracking-wider text-steel">
                      {c.signedOn ? (
                        f.date(c.signedOn)
                      ) : c.dateUnusable ? (
                        <span className="text-ochre">{t("moneyDateUnusable")}</span>
                      ) : (
                        t("moneyDateMissing")
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {tie.contractsMoreCount > 0 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel">
                {t("moneyMoreContracts", {
                  count: tie.contractsMoreCount,
                  countFmt: f.int(tie.contractsMoreCount),
                })}
              </p>
            )}
            <SourceNote className="mt-3 !text-[10px]">{t("moneyContractsSource")}</SourceNote>
          </>
        )}

        {/* Doslovná provenience hrany — necituje se přeformulovaně. */}
        {tie.source && (
          <p className="mt-4 break-words font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
            {t("moneyTieSource", { source: tie.source })}
          </p>
        )}
      </div>
    </article>
  );
}
