/*
 * Peníze na spisu — důkaz vedle tvrzení.
 *
 * Spis nesl vlajku „možný nepřítomný manažer" jako kurzívní obvinění a žádný
 * důkaz k němu neukazoval. Ta vlajka se počítá z peněžních vazeb; tahle sekce
 * je ukazuje.
 *
 * ── PRAVIDLA, KTERÁ SE NESMÍ PORUŠIT ────────────────────────────────────────
 *
 * 1. NIC TU NENÍ HOTOVÝ NÁLEZ. Stav brány nese KAŽDÝ řádek sám za sebe, ne jen
 *    poznámka pod sekcí — konzole /penize/kontrola umí zapsat „ověřeno" i
 *    „zamítnuto", takže věta „všechny vazby čekají" už není konstanta (měřeno
 *    2026-08-04: 211 z 211 hran `linked_to` je pořád `pending_review`, ale
 *    stránka to čte z dat, ne z komentáře).
 * 2. PENÍZE JEN TAM, KAM SE SMÍ PŘISOUDIT (pravidlo P29, /penize). Dozorčí či
 *    správní funkce ve veřejné instituci (`steward`) není poslancův byznys:
 *    zakázky té nemocnice nebo univerzity jsou její vlastní veřejná činnost.
 *    Sdílený loader tu částku načte (a /penize ji tiskne jako peníze
 *    instituce), spis ji ale poslanci NEPŘISUZUJE — místo čísla stojí u řádku
 *    věta, proč tam číslo není, a odkaz na spis peněz, kde ta část je.
 * 3. DATUM, KTERÉ NEMOHLO NASTAT, SE NEUKÁŽE A NEOPRAVÍ. Korpus nese podpisy
 *    v letech 0002, 1970, 2027 i 3062. Řádek zůstane (smlouva a částka jsou
 *    skutečné), datum se potlačí a sekce ten počet přizná.
 * 4. KAŽDÉ ČÍSLO CITUJE ZDROJ a prochází `lib/format.ts`. Součet navíc nese
 *    vlastní ADRESU (`mpBucketClaim`) a každá vazba účtenku (`receiptRef`),
 *    takže se dá ověřit na /overeni a otevřít na /zdroj — a hodnota přichází
 *    ze `reachableMoney()`, jediné definice dosažitelných peněz.
 *
 * Sekce se vykresluje VŽDY, i bez jediné vazby — nepřítomnost nálezu je taky
 * nález a tiché vynechání by se od skrytého nálezu nedalo odlišit.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLocale } from "next-intl/server";
import { profileIntl } from "../serverIntl";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { temporalBadge, tieClassInfo } from "@/features/money/moneyTypes";
import { BASIS_TAG_KEYS, basisSentences } from "@/features/money/amountBasis";
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import CitableNumber from "@/lib/claims/CitableNumber";
import type { Locale } from "@/lib/i18n/config";
import type { ProfileMoney, ProfileMoneyTie } from "../profileMoney";

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

export default async function MoneySection({
  index,
  money,
  pspId,
}: {
  index: number;
  money: ProfileMoney;
  pspId: number;
}) {
  const { t, f } = await profileIntl();
  const locale = await getLocale();
  const en = locale === "en";

  // Žádná aritmetika na ploše: hodnota i popisky jdou z `reachableMoney()`,
  // které spočítal loader /penize, a figura z něj nese vlastní claim.
  const figure = money.attributableFigure;
  const bucket = money.reach?.attributable ?? null;
  const floor = money.reach?.coverage.isFloor ?? false;

  return (
    <section id="penize" className="mt-16 border-t-4 border-ink pt-10">
      <SectionHeading
        index={index}
        title={t("moneyHeading")}
        aside={<SourceNote>{t("moneyAside")}</SourceNote>}
      />

      {money.unavailable ? (
        /* Vazby poslanec MÁ, ale peněžní vrstvu se nepodařilo přečíst. Vykreslit
           tady „žádné vazby" by z našeho výpadku udělalo tvrzení o člověku. */
        <div className="mt-8 border-2 border-dashed border-ochre p-8">
          <p className="text-lg font-black uppercase tracking-tight">{t("moneyUnavailableTitle")}</p>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-steel">{t("moneyUnavailableBody")}</p>
        </div>
      ) : money.ties.length === 0 ? (
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
              {figure === null || bucket === null || bucket.companies === 0 ? (
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-steel">
                  {t("moneyNoAttributable")}
                </p>
              ) : (
                <>
                  {/* Číslo, které se opisuje do článku, nese vlastní adresu:
                      `mpBucketClaim` razí týž claim, jaký nad TOUTÉŽ hodnotou
                      vydává /penize/[pspId], takže ho /overeni znovu odvodí
                      stejnou cestou. Předpona „nejméně" zůstává MIMO claim —
                      dolní mez je vlastnost korpusu, ne strojové hodnoty. */}
                  <p className="mt-2 text-4xl font-black tabular-nums text-signal">
                    {floor ? `${t("moneyAtLeast")} ` : ""}
                    <CitableNumber
                      value={figure.value}
                      claim={figure.claim}
                      locale={locale as Locale}
                      kind="czk"
                    />
                  </p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel">
                    {t("moneyContractsOf", {
                      contracts: bucket.contractCount,
                      contractsFmt: f.int(bucket.contractCount),
                      firms: bucket.companies,
                      firmsFmt: f.int(bucket.companies),
                    })}
                  </p>
                  <p className="mt-2">
                    <Link
                      href={`/overeni?ref=${encodeURIComponent(figure.claim.ref)}`}
                      className="font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt hover:underline"
                    >
                      {t("moneyVerifyFigure")}
                    </Link>
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
          {floor && (
            <p className="mt-4 max-w-3xl border-l-4 border-ochre pl-4 text-[13px] leading-relaxed text-steel">
              {t("moneyTruncated", {
                cap: f.int(money.reach?.coverage.perCompanyCap ?? 0),
                firms: f.int(money.reach?.coverage.companiesAtCap ?? 0),
              })}
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

async function TieRow({ tie, en }: { tie: ProfileMoneyTie; en: boolean }) {
  const { t, f } = await profileIntl();
  /* Daňová základna se sází NA SERVERU, jako celý zbytek spisu: klientská
     `BasisDisclosure` by kvůli jedné větě otevřela klientskou hranici na ploše,
     kterou commit „spis ships what renders" schválně celou přesunul na server.
     Kopie věty tím nevzniká — klíče i pořadí vydává TÝŽ čistý modul
     (`amountBasis.ts::basisSentences`), který čte i klientská sazba. */
  const tb = await profileIntl("money.basis");
  const info = tieClassInfo(tie.tieClass);
  const temporal = temporalBadge(tie);

  return (
    <article className="border-2 border-ink">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink bg-paper-strong px-5 py-4">
        <div className="min-w-0">
          {/* Firma je uzel s vlastní adresou (14 firem je navázaných na víc než
              jednoho poslance — spis osoby to ukázat neumí, spis firmy ano).
              Bez platného IČO se odkaz nedomýšlí a zůstane holý nadpis. */}
          <h3 className="text-lg font-black uppercase leading-tight tracking-tight">
            {tie.companyHref ? (
              <Link href={tie.companyHref} className="hover:text-signal">
                {tie.company}
              </Link>
            ) : (
              tie.company
            )}
          </h3>
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
                  {tie.contractCzk != null && tie.contractCzk > 0 ? f.czk(tie.contractCzk) : "—"}
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
                    {/* Základna U ŘÁDKU — registr publikuje hodnotu bez DPH i
                        včetně DPH a jako sčitatelné je neuvádí; dvě částky pod
                        sebou tedy nemusí být srovnatelné. */}
                    <span className="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-steel">
                      <span className="sr-only">{tb.t("tagLabel")}: </span>
                      {tb.t(BASIS_TAG_KEYS[c.amountBasis])}
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
            {/* Složení daňových základen za `contractCzk` téhle vazby — přes VŠECHNY
                smlouvy firmy, přebrané hotové z peněžní vrstvy. Spis nic nepočítá,
                a přepočítávat základny nesmí nikdo: sazba DPH v grafu není. */}
            {tie.contractBasis && basisSentences(tie.contractBasis).length > 0 && (
              <SourceNote className="mt-2 !text-[10px]">
                {basisSentences(tie.contractBasis).map((s, i) => (
                  <span key={s.key}>
                    {i > 0 ? " " : ""}
                    {s.key === "mixed"
                      ? tb.t(s.key, {
                          bez: s.bez,
                          bezFmt: f.int(s.bez),
                          vcetne: s.vcetne,
                          vcetneFmt: f.int(s.vcetne),
                        })
                      : tb.t(s.key, { count: s.count, countFmt: f.int(s.count) })}
                  </span>
                ))}
              </SourceNote>
            )}
          </>
        )}

        {/* Doslovná provenience hrany — necituje se přeformulovaně. */}
        {tie.source && (
          <p className="mt-4 break-words font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
            {t("moneyTieSource", { source: tie.source })}
          </p>
        )}

        {/* Trvalá adresa TVRZENÍ: účtenka téže hrany, jakou vydává kniha vazeb
            (`receiptRef` razí `mapLinkedToTie`, jediný stavitel refů v repu) —
            plus spis firmy, kde je celý dosažitelný řetězec včetně peněz, které
            spis osoby vědomě nepřisuzuje. */}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href={claimRefPath(tie.receiptRef)}
            className="font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt hover:underline"
          >
            {t("moneyReceiptLink")}
          </Link>
          {tie.companyHref && (
            <Link
              href={tie.companyHref}
              className="font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt hover:underline"
            >
              {t("moneyCompanyLink")}
            </Link>
          )}
        </p>
      </div>
    </article>
  );
}
