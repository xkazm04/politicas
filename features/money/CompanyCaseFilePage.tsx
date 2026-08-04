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
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useLocale } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import FlagList from "@/features/shared/components/FlagList";
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import { buildRegistryLinks } from "./reviewTypes";
import { tieFlagInfos } from "./tieFlags";
import AnalystNote from "./components/AnalystNote";
import TieClassExplainer from "./components/TieClassExplainer";
import FollowButton from "@/features/schranka/FollowButton";
import CitableNumber from "@/lib/claims/CitableNumber";
import type { Locale } from "@/lib/i18n/config";
import { companyReachClaim } from "./moneyClaims";
import { bucketReachCzk, isAttributable } from "./reachableMoney";
import {
  compactCzk,
  temporalBadge,
  tieClassInfo,
  tieClassOriginInfo,
  type CompanyTie,
  type MoneyCompanyDetail,
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

export default function CompanyCaseFilePage({ data }: { data: MoneyCompanyDetail | null }) {
  const locale = useLocale();
  const en = locale === "en";

  if (!data) {
    return (
      <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="border-2 border-dashed border-hairline p-8">
            <SourceNote>{en ? "source: knowledge graph" : "zdroj: znalostní graf"}</SourceNote>
            <p className="mt-3 text-lg">
              {en
                ? "The knowledge graph holds no MP tie for this company id."
                : "Znalostní graf nevede pro tohle IČO žádnou vazbu na poslance."}
            </p>
            <Link
              href="/penize"
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
            >
              ← {en ? "back to the ledger" : "zpět do knihy vazeb"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Which side of the attribution split this firm falls on — from the SHARED definition,
  // not a local class test. Exactly one bucket carries a one-company population.
  const attributable = data.money.attributable.companies > 0;
  const bucket = attributable ? data.money.attributable : data.money.steward;
  const reachCzk = bucketReachCzk(bucket);
  // Gate states of the ties the figure rests on — an aggregate is confirmed only when
  // all of them are (moneyClaims.ts rule 4), and all 211 in the graph are pending today.
  const tieStates = data.ties.map((t) => t.reviewState);
  const links = buildRegistryLinks(data.ico, "");
  const mpCount = new Set(data.ties.map((t) => t.pspId)).size;

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ penize / firma</span>
          <Link
            href="/penize"
            className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            ← {en ? "ledger" : "kniha vazeb"}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">
          {en ? `company file · pass ${data.pass}` : `spis firmy · pass ${data.pass}`}
        </SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {data.name}
          <span className="text-signal">.</span>
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-steel">
          IČO {data.ico} ·{" "}
          {en
            ? `${data.ties.length} ties · ${mpCount} MPs`
            : `${data.ties.length} vazeb · ${mpCount} poslanců`}
        </p>
        {/* Sledování se razí tam, kde entita je. Klíč je týž veřejný klíč, kterým
            deník adresuje `?entita=` — jedna adresa odběru pro celou aplikaci. */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <FollowButton
            entityKey={`firma:${data.ico}`}
            label={data.name}
            subject={en ? `company ${data.name}` : `firma ${data.name}`}
            words={{
              follow: en ? "follow" : "sledovat",
              following: en ? "following" : "sledujete",
            }}
          />
          <Link
            href="/schranka"
            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            {en ? "overview in your inbox" : "přehled ve schránce"}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
        {/* The cross-MP fact, stated as a fact and immediately qualified. Sitting on the
            same board is not a finding about either person — it is why this page exists,
            and why it is not a ranking. */}
        {mpCount > 1 && (
          <p className="mt-4 max-w-2xl border-l-4 border-cobalt bg-cobalt/10 px-4 py-3 text-sm leading-relaxed text-ink">
            {en
              ? `${mpCount} MPs are tied to this single company. That is a fact about the registry record, not a claim about any of them — each tie below carries its own class, its own review state and its own source.`
              : `K téhle jediné firmě vede vazba ${mpCount} poslanců. Je to údaj z rejstříku, ne tvrzení o kterémkoli z nich — každá vazba níž nese vlastní třídu, vlastní stav kontroly a vlastní zdroj.`}
          </p>
        )}

        {/* ── money ───────────────────────────────────────────── */}
        <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-3">
          <div className="bg-paper p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {en ? "public money reachable through this company" : "veřejné peníze dosažitelné přes tuhle firmu"}
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
                <CitableNumber
                  value={reachCzk}
                  claim={companyReachClaim(data.ico, bucket, tieStates, data.pass).claim}
                  locale={locale as Locale}
                  kind="czkCompact"
                />
              ) : (
                "—"
              )}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {bucket.contractCount} {en ? "contracts" : "smluv"}
              {data.subsidiesCzk > 0
                ? ` · ${en ? "subsidies" : "dotace"} ${compactCzk(data.subsidiesCzk, locale)}`
                : ""}
            </p>
            {/* The P29 rule AT the number: a steward institution's billions must never be
                read like a firm an MP owns. */}
            <p className="mt-2 text-sm leading-relaxed text-steel">
              {attributable
                ? en
                  ? "At least one MP owns or runs this company, so the attribution rule permits reading this money as reaching a politician's own firm."
                  : "Aspoň jeden poslanec tuhle firmu vlastní nebo řídí — pravidlo přiřazení proto dovoluje číst tyhle peníze jako peníze, které tečou do firmy politika."
                : en
                  ? "NOT an MP's money: every tie here is a supervisory or board seat in a public or nonprofit body. The figure is that body's OWN public activity."
                  : "Nejsou to peníze poslance: všechny zdejší vazby jsou dozorčí nebo správní funkce ve veřejné či neziskové instituci. Číslo je vlastní veřejnou činností té instituce."}
            </p>
            <SourceNote className="mt-3 !text-[10px]">
              {en ? "source" : "zdroj"}: registr smluv · Σ kg_edge supplies.weight + subsidies_total_czk
            </SourceNote>
          </div>
          <div className="bg-paper p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {en ? "subsidies drawn" : "čerpané dotace"}
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums tracking-tight">
              {data.subsidiesCzk > 0 ? compactCzk(data.subsidiesCzk, locale) : "—"}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {data.subsidiesCount} {en ? "titles" : "titulů"}
            </p>
            <SourceNote className="mt-3 !text-[10px]">
              {en ? "source" : "zdroj"}: kg_node company.props.subsidies_total_czk (hlídač státu)
            </SourceNote>
          </div>
          <div className="bg-paper p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
              {en ? "donated to a party" : "dary politické straně"}
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums tracking-tight">
              {data.donatedToPartyCzk != null && data.donatedToPartyCzk > 0
                ? compactCzk(data.donatedToPartyCzk, locale)
                : "—"}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
              {data.donationRecipientParty ?? (en ? "no donation in the graph" : "graf nevede žádný dar")}
            </p>
            <SourceNote className="mt-3 !text-[10px]">
              {en ? "source" : "zdroj"}: kg_node company.props.donated_to_party_czk (hlídač státu)
            </SourceNote>
          </div>
        </div>

        {/* ── registry ────────────────────────────────────────── */}
        <div className="mt-8 border-2 border-hairline p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">
            {en ? "verify in the registries" : "ověřit v rejstřících"}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
            {[
              { label: en ? "ARES subject" : "ARES subjekt", href: links.aresSubject },
              { label: "ARES VR", href: links.aresVr },
              { label: en ? "commercial register" : "obchodní rejstřík", href: links.justiceVr },
              { label: en ? "contracts register" : "registr smluv", href: links.registrSmluv },
              { label: en ? "Hlídač company" : "Hlídač firma", href: links.hlidacSubjekt },
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
          <SourceNote className="mt-3 !text-[10px]">
            {en
              ? "deep links built from the node's own IČO (company:ico:<8-digit>) — nothing here is a claim, they are the primary records"
              : "odkazy sestavené z IČO samotného uzlu (company:ico:<8 číslic>) — nic z toho není tvrzení, jsou to primární záznamy"}
          </SourceNote>
        </div>

        {/* ── ties ────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-2xl font-black uppercase tracking-tight">
            {en ? "MPs tied to this company" : "poslanci s vazbou na tuhle firmu"}
          </h2>
          <SourceNote className="mt-2">
            {en
              ? "kg_edge linked_to · strongest evidence first (registry-confirmed owner-operator, then manager, then steward, unconfirmed last) — never by money"
              : "kg_edge linked_to · nejsilnější důkaz první (rejstříkem potvrzený vlastník, pak představenstvo, pak dozorčí, nepotvrzené naposled) — nikdy podle peněz"}
          </SourceNote>
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
              {en ? "contracts with the state" : "smlouvy se státem"}
            </h2>
            <SourceNote className="mt-2">
              {en
                ? `registr smluv · amount from kg_edge supplies.weight, ${data.contracts.length} of ${data.contracts.length + data.contractsMoreCount} rows, largest first`
                : `registr smluv · částka z kg_edge supplies.weight, ${data.contracts.length} z ${data.contracts.length + data.contractsMoreCount} řádků, od největší`}
            </SourceNote>
            <ul className="mt-4 divide-y divide-hairline border-t-2 border-ink">
              {data.contracts.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-steel">{c.label}</span>
                  <span className="shrink-0 font-mono text-xs font-bold tabular-nums">
                    {c.amountCzk != null ? compactCzk(c.amountCzk, locale) : "—"}
                  </span>
                  <span className="w-24 shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-steel">
                    {c.signedOn ?? (en ? "no usable date" : "datum nepoužitelné")}
                  </span>
                </li>
              ))}
            </ul>
            {data.contractsMoreCount > 0 && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel">
                + {data.contractsMoreCount} {en ? "more contracts in the graph" : "dalších smluv v grafu"}
              </p>
            )}
            {/* An impossible signature is not a date. The row and its amount stay, the
                date goes, and the count is disclosed — the date is never repaired. */}
            {data.implausibleDateCount > 0 && (
              <p className="mt-3 max-w-2xl border-l-2 border-ochre pl-3 text-sm leading-relaxed text-steel">
                {en
                  ? `${data.implausibleDateCount} of the rows above carry a signature date that could not have happened (before 1993-01-01 or after ${data.asOf}). The row and its amount stay, the date is withheld, and it is never corrected — a corrected date would be an invented one.`
                  : `${data.implausibleDateCount} z řádků výše nese datum podpisu, které nemohlo nastat (před 1. 1. 1993 nebo po ${data.asOf}). Řádek i částka zůstávají, datum zamlčujeme a nikdy ho neopravujeme — opravou bychom si ho vymysleli.`}
              </p>
            )}
          </section>
        )}

        <div className="mt-14 border-t-4 border-ink pt-8">
          <SourceNote>{en ? "how to read the tie class" : "jak číst třídu vazby"}</SourceNote>
          <div className="mt-4">
            <TieClassExplainer compact />
          </div>
        </div>

        <p className="mt-10 max-w-2xl text-sm italic leading-relaxed text-steel">
          {en
            ? "This page is a register record, not a case against anyone. Ties not yet human-confirmed carry a “pending review” label and do not feed the Integrity pillar; a company appearing here means the graph found an IČO join, nothing more."
            : "Tahle stránka je výpis z rejstříku, ne spis proti komukoli. Vazby bez lidského schválení nesou štítek „čeká na kontrolu“ a do pilíře Integrita se nepropisují; že tu firma je, znamená jen to, že graf našel shodu přes IČO — nic víc."}
        </p>
      </div>
    </main>
  );
}

function TieCard({ tie, en }: { tie: CompanyTie; en: boolean }) {
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
            {tie.role || (en ? "role not recorded" : "role nezaznamenána")}
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
              {en ? "verified" : "ověřeno"}
            </span>
          ) : tie.reviewState === "rejected" ? (
            <span className="border-2 border-steel px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-steel">
              {en ? "rejected" : "zamítnuto"}
            </span>
          ) : (
            <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
              {en ? "pending review" : "čeká na kontrolu"}
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
              {en
                ? `The heuristic alone would have said “${tieClassInfo(tie.tieClassHeuristic).labelEn}” — the recorded class wins.`
                : `Sama heuristika by uvedla „${tieClassInfo(tie.tieClassHeuristic).labelCs}“ — přednost má zapsaná třída.`}
            </span>
          ) : null}
        </p>

        <FlagList
          className="mt-4"
          heading={en ? "flags from analysis passes" : "příznaky z analytických průchodů"}
          items={tieFlagInfos(tie.flags).map((f) => ({
            key: f.token,
            label: en ? f.labelEn : f.labelCs,
            note: en ? f.noteEn : f.noteCs,
            tone: f.tone,
          }))}
        />

        <AnalystNote tie={tie} en={en} className="mt-4" />

        <p className="mt-4 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
          {en ? "source" : "zdroj"}: {tie.source || "—"}
          {" · "}
          {en ? "attribution" : "přiřazení"}:{" "}
          {isAttributable(tie.tieClass)
            ? en
              ? "money may be read as the MP's firm"
              : "peníze lze číst jako firmu poslance"
            : en
              ? "institution's own money, never the MP's"
              : "vlastní peníze instituce, nikdy poslancovy"}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href={`/penize/${tie.pspId}`}
            className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            {en ? "the MP's money file" : "peněžní spis poslance"} →
          </Link>
          <Link
            href={`/poslanec/${tie.pspId}`}
            className="font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            {en ? "full MP profile" : "celý profil poslance"} →
          </Link>
          <Link
            href={claimRefPath(tie.receiptRef)}
            className="inline-flex items-center gap-1.5 border-2 border-cobalt px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:border-signal hover:text-signal"
          >
            {en ? "provenance receipt" : "účtenka původu"} →
          </Link>
        </div>
      </div>
    </article>
  );
}
