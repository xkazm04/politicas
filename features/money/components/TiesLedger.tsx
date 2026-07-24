"use client";

/**
 * Kniha doložených vazeb — vazby seskupené po poslancích, se stavem kontroly.
 * S reálnými daty ze znalostního grafu (person --linked_to--> company
 * --supplies--> contract) čte pořadí podle dosažitelných veřejných peněz;
 * KAŽDÁ vazba je human-gated (review_state) — dokud ji neschválí člověk, nese
 * okrový štítek „čeká na kontrolu" a do skóre se nepropisuje. Bez store se
 * vykreslí původní, výslovně označený mock (graceful degradation).
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MONEY_TIES, MPS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { compactCzk, type MoneyData, type MoneyMp } from "../moneyTypes";

const CHIP_CAP = 36; // MPs without ties rendered as chips before "+ N more"

export default function TiesLedger({ data }: { data: MoneyData | null }) {
  if (data) return <RealLedger data={data} />;
  return <MockLedger />;
}

// ── Real: knowledge-graph money layer ───────────────────────────────────────

function RealLedger({ data }: { data: MoneyData }) {
  const t = useTranslations("money");
  const tcom = useTranslations("common");
  const f = useFormat();
  const locale = useLocale();

  const shownChips = data.mpsWithoutTies.slice(0, CHIP_CAP);
  const restChips = data.mpsWithoutTies.length - shownChips.length;

  return (
    <div>
      {data.mps.map((mp) => (
        <MpCase key={mp.pspId} mp={mp} t={t} tcom={tcom} f={f} locale={locale} />
      ))}

      <div className="border-2 border-dashed border-hairline p-5">
        <SourceNote>{t("real.ledger.noTiesNote")}</SourceNote>
        <div className="mt-2 flex flex-wrap gap-2">
          {shownChips.map((mp) => (
            <Link
              key={mp.pspId}
              href={`/poslanec/${mp.pspId}`}
              className="border-2 border-hairline px-3 py-1.5 text-sm font-bold transition-colors hover:border-ink hover:bg-paper-strong"
            >
              {mp.name}
              {mp.club ? (
                <span className="ml-1.5 font-mono text-[10px] font-normal text-steel">{mp.club}</span>
              ) : null}
            </Link>
          ))}
          {restChips > 0 && (
            <span className="px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-steel">
              {t("real.ledger.moreCount", { count: restChips })}
            </span>
          )}
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        {t("real.ledger.disclaimer", { pendingLabel: tcom("pendingReview") })}
      </p>
    </div>
  );
}

function MpCase({
  mp,
  t,
  tcom,
  f,
  locale,
}: {
  mp: MoneyMp;
  t: ReturnType<typeof useTranslations>;
  tcom: ReturnType<typeof useTranslations>;
  f: ReturnType<typeof useFormat>;
  locale: string;
}) {
  return (
    <div className="mb-8">
      <Link
        href={`/poslanec/${mp.pspId}`}
        className="group flex items-center justify-between gap-3 border-b-2 border-ink pb-2 transition-colors hover:text-signal"
      >
        <span className="text-xl font-black uppercase tracking-tight">
          {mp.name}
          <span className="ml-2 font-mono text-xs font-normal normal-case tracking-normal text-steel">
            {mp.club ? `· ${mp.club} ` : ""}· {t("real.ledger.tiesCount", { count: mp.ties.length })}
            {mp.absenteeManagerLead ? ` · ${t("real.ledger.managerFlag")}` : ""}
          </span>
        </span>
        <ArrowUpRight className="h-5 w-5 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>

      {mp.ties.map((tie) => {
        const hasReach = tie.contractCzk > 0 || tie.subsidiesCzk > 0 || tie.donatedToPartyCzk != null;
        return (
          <div
            key={tie.companyId}
            className="grid gap-3 border-b border-hairline px-1 py-4 sm:grid-cols-[1.2fr_1fr_auto]"
          >
            <span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-black uppercase tracking-tight">{tie.company}</span>
                {/* Every tie is human-gated; verified only if review passed. */}
                {tie.reviewState === "verified" ? (
                  <span className="border-2 border-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
                    {tcom("verified")}
                  </span>
                ) : (
                  <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                    {tcom("pendingReview")}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                IČO {tie.ico}
                {tie.role ? ` · ${tie.role}` : ""}
              </span>
            </span>

            <span className="text-[15px] leading-relaxed text-steel">
              {hasReach ? (
                <span className="flex flex-col gap-0.5">
                  {tie.contractCzk > 0 && (
                    <span>
                      {t("real.ledger.contractsLabel")}: {compactCzk(tie.contractCzk, locale)}
                      <span className="text-steel"> ({f.int(tie.contractCount)})</span>
                    </span>
                  )}
                  {tie.subsidiesCzk > 0 && (
                    <span>
                      {t("real.ledger.subsidiesLabel")}: {compactCzk(tie.subsidiesCzk, locale)}
                    </span>
                  )}
                  {tie.donatedToPartyCzk != null && (
                    <span>
                      {t("real.ledger.donationLabel")}: {compactCzk(tie.donatedToPartyCzk, locale)}
                      {tie.donationRecipientParty ? ` → ${tie.donationRecipientParty}` : ""}
                    </span>
                  )}
                </span>
              ) : (
                <span className="italic">{t("real.ledger.noReach")}</span>
              )}
            </span>

            <span className="text-right">
              <span
                className={`block text-xl font-black tabular-nums ${hasReach ? "text-signal" : "text-steel"}`}
              >
                {hasReach ? compactCzk(tie.contractCzk + tie.subsidiesCzk, locale) : "—"}
              </span>
              <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                {tie.source || t("real.ledger.reachLabel")}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Mock fallback (unchanged behaviour, kept for graceful degradation) ───────

const WITH_TIES = MPS.filter((m) => MONEY_TIES.some((tie) => tie.mpId === m.id));
const WITHOUT_TIES = MPS.filter((m) => !MONEY_TIES.some((tie) => tie.mpId === m.id));

function MockLedger() {
  const t = useTranslations("money");
  const tc = useTranslations("content");
  const tcom = useTranslations("common");
  const f = useFormat();

  return (
    <div>
      {WITH_TIES.map((mp) => {
        const ties = MONEY_TIES.filter((tie) => tie.mpId === mp.id);
        return (
          <div key={mp.id} className="mb-8">
            <Link
              href={`/poslanec/${mp.id}`}
              className="group flex items-center justify-between gap-3 border-b-2 border-ink pb-2 transition-colors hover:text-signal"
            >
              <span className="text-xl font-black uppercase tracking-tight">
                {mp.name}
                <span className="ml-2 font-mono text-xs font-normal normal-case tracking-normal text-steel">
                  · {mp.party} · {t("ledger.caseFile", { rank: f.int(mp.rank) })}
                </span>
              </span>
              <ArrowUpRight className="h-5 w-5 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            {ties.map((tie) => {
              const i = MONEY_TIES.indexOf(tie);
              return (
                <div
                  key={`${tie.mpId}-${tie.company}`}
                  className="grid gap-3 border-b border-hairline px-1 py-4 sm:grid-cols-[1.2fr_1fr_auto]"
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black uppercase tracking-tight">{tc(`moneyTies.${i}.company`)}</span>
                      {tie.verified ? (
                        <span className="border-2 border-cobalt px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
                          {tcom("verified")}
                        </span>
                      ) : (
                        <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                          {tcom("pendingReview")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                      IČO {tie.ico} · {tc(`moneyTies.${i}.kind`)}
                    </span>
                  </span>
                  <span className="text-[15px] leading-relaxed text-steel">{tc(`moneyTies.${i}.note`)}</span>
                  <span className="text-right">
                    <span className={`block text-xl font-black tabular-nums ${tie.amount === "—" ? "text-steel" : "text-signal"}`}>
                      {tc(`moneyTies.${i}.amount`)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                      {tie.year} · {tc(`moneyTies.${i}.source`)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="border-2 border-dashed border-hairline p-5">
        <SourceNote>{t("ledger.noTiesNote")}</SourceNote>
        <div className="mt-2 flex flex-wrap gap-2">
          {WITHOUT_TIES.map((mp) => (
            <Link
              key={mp.id}
              href={`/poslanec/${mp.id}`}
              className="border-2 border-hairline px-3 py-1.5 text-sm font-bold transition-colors hover:border-ink hover:bg-paper-strong"
            >
              {mp.name}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel">
        {t("ledger.disclaimer", { pendingLabel: tcom("pendingReview") })}
      </p>
    </div>
  );
}
