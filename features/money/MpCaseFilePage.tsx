"use client";

/**
 * Spis poslance (/penize/[pspId]) — plný důkazní řetězec pro jednoho poslance:
 * každá vazba na firmu, u ní třída (P29 pravidlo), stav kontroly, korroborace v
 * ARES VR, časový štítek, a rozpad dosažitelných veřejných peněz na smlouvy
 * (top-N položek + zbytek), dotace a dary straně. Nic tu nepřepisuje
 * review_state — je to čtecí spis, ne konzole.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useLocale } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import FlagList from "@/features/shared/components/FlagList";
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import CitableNumber from "@/lib/claims/CitableNumber";
import type { Locale } from "@/lib/i18n/config";
import { mpEntityKey } from "@/features/denik/deriveDenik";
import { entityDenikHref } from "@/features/schranka/followCodec";
import { mpBucketClaim } from "./moneyClaims";
import { buildRegistryLinks, type ReviewState } from "./reviewTypes";
import { tieFlagInfos } from "./tieFlags";
import AnalystNote from "./components/AnalystNote";
import type { ContractCoverage } from "./moneyTypes";
import { isAttributable, tieReach, type MoneyBucket } from "./reachableMoney";
import {
  compactCzk,
  temporalBadge,
  tieClassInfo,
  tieClassOriginInfo,
  type MoneyMpDetail,
  type MoneyTieDetail,
} from "./moneyTypes";
import TieClassExplainer from "./components/TieClassExplainer";

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

export default function MpCaseFilePage({ data }: { data: MoneyMpDetail | null }) {
  const locale = useLocale();
  const en = locale === "en";

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ penize / spis</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {!data ? (
          <div className="border-2 border-dashed border-hairline p-8">
            <SourceNote>{en ? "source: knowledge graph" : "zdroj: znalostní graf"}</SourceNote>
            <p className="mt-3 text-lg">
              {en
                ? "No materialized money ties found for this MP."
                : "Pro tohoto poslance nemá znalostní graf žádnou materializovanou vazbu."}
            </p>
          </div>
        ) : (
          <>
            <SourceNote tone="signal">{en ? `case file · pass ${data.pass}` : `spis · pass ${data.pass}`}</SourceNote>
            <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
              {data.name}
              <span className="text-signal">.</span>
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-steel">
              {data.club ? `${data.club} · ` : ""}
              {en ? `${data.ties.length} evidenced ties` : `${data.ties.length} evidovaných vazeb`}
              {data.absenteeManagerLead ? ` · ${en ? "low chamber work (Case ②)" : "málo práce v sále (Case ②)"}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href={`/poslanec/${data.pspId}`}
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                {en ? "full MP profile" : "celý profil poslance"} →
              </Link>
              {/* 4E: jedno kliknutí → citovatelný paket. Kompiluje se z tohoto
                  spisu, ale projde jen lidsky ověřený materiál — vyloučení
                  paket přizná sám. */}
              <Link
                href={`/penize/${data.pspId}/paket`}
                className="inline-flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:border-signal hover:text-signal"
              >
                {en ? "compile evidence packet" : "sestavit důkazní paket"} →
              </Link>
              {/* The packet compiles ONLY verified ties, so the reader needs one hop to
                  the log that says what the gate has actually ruled — otherwise an empty
                  packet reads as "no evidence" rather than "nothing decided yet". */}
              <Link
                href="/dukazy"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                {en ? "gate decision log" : "deník důkazů (brána)"} →
              </Link>
              {/* Spis je průřez STAVEM: všechny vazby poslance najednou. Deník je
                  týž materiál v čase — podpisy smluv, zápisy a výmazy rolí,
                  rozhodnutí brány, den po dni. Klíč staví builder deníku
                  (`mpEntityKey`), adresu kodek schránky — dva importy, žádná
                  třetí kopie adresy `?entita=`. */}
              <Link
                href={entityDenikHref(mpEntityKey(data.pspId))}
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
              >
                {en ? "this MP's daily record" : "deník tohoto poslance"} →
              </Link>
              <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
                {en ? "verified material only, exclusions stated" : "jen ověřený materiál, vyloučení přiznána"}
              </span>
            </div>

            {/* Totals. SPLIT BY CLASS, never merged: a supervisory seat in a hospital and
                a firm the MP owns are two different statements about the same person, and
                the qualifying rule belongs AT the number — it used to live ~800 px below
                it, under three uncited tiles that summed both together. */}
            <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2">
              <MoneyTile
                tone="signal"
                label={en ? "contracts of firms the MP owns or runs" : "zakázky firem, které poslanec vlastní nebo řídí"}
                bucket={data.money.attributable}
                coverage={data.money.coverage}
                rule={
                  en
                    ? "The real FollowTheMoney tie: money the state paid to a company this MP owns or is a statutory officer of."
                    : "Skutečná vazba FollowTheMoney: peníze, které stát zaplatil firmě, kterou poslanec vlastní nebo je jejím statutárem."
                }
                emptyNote={
                  en
                    ? "no company in the graph is owned or run by this MP"
                    : "graf nevede žádnou firmu, kterou by poslanec vlastnil nebo řídil"
                }
                locale={locale}
                en={en}
                pspId={data.pspId}
                side="owned"
                tieStates={data.ties.filter((t) => isAttributable(t.tieClass)).map((t) => t.reviewState)}
                pass={data.pass}
              />
              <MoneyTile
                tone="steel"
                label={
                  en
                    ? "contracts of bodies where the MP only holds a seat"
                    : "zakázky institucí, kde poslanec jen zasedá v orgánu"
                }
                bucket={data.money.steward}
                coverage={data.money.coverage}
                rule={
                  en
                    ? "NOT the MP's money: a supervisory or board seat in a public or nonprofit body — a hospital, a waterworks, a state fund. The figure is that body's OWN public activity and must never be read like the one on the left."
                    : "Nejsou to peníze poslance: dozorčí nebo správní funkce ve veřejné či neziskové instituci — nemocnice, vodárna, státní fond. Číslo je vlastní veřejnou činností té instituce a NIKDY se nesmí číst jako to vlevo."
                }
                emptyNote={
                  en ? "no such seat in the graph" : "graf nevede žádnou takovou funkci"
                }
                locale={locale}
                en={en}
                pspId={data.pspId}
                side="steward"
                tieStates={data.ties.filter((t) => !isAttributable(t.tieClass)).map((t) => t.reviewState)}
                pass={data.pass}
              />
            </div>

            {/* ties */}
            <div className="mt-12 space-y-8">
              {data.ties.map((tie) => (
                <TieCard key={tie.companyId} tie={tie} locale={locale} en={en} />
              ))}
            </div>

            <div className="mt-14 border-t-4 border-ink pt-8">
              <SourceNote>{en ? "how to read the tie class" : "jak číst třídu vazby"}</SourceNote>
              <div className="mt-4">
                <TieClassExplainer compact />
              </div>
            </div>

            <p className="mt-10 max-w-2xl text-sm italic leading-relaxed text-steel">
              {en
                ? "Every tie is published as a dated, sourced fact, never an accusation. Ties not yet human-confirmed carry a \"pending review\" label and do not feed the Integrity pillar."
                : "Vazby zveřejňujeme jako datovaná, doložená fakta, nikdy jako obvinění. Vazby bez lidského schválení nesou štítek „čeká na kontrolu“ a do pilíře Integrita se nepropisují."}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

/** One side of the steward/attributable split, with its own source line and — when the
 *  contract corpus is a capped per-company sample — the "nejméně" treatment a lower bound
 *  requires. A capped sum rendered as a total is exactly what the brand rule forbids. */
function MoneyTile({
  tone,
  label,
  bucket,
  coverage,
  rule,
  emptyNote,
  locale,
  en,
  pspId,
  side,
  tieStates,
  pass,
}: {
  tone: "signal" | "steel";
  label: string;
  bucket: MoneyBucket;
  coverage: ContractCoverage;
  rule: string;
  emptyNote: string;
  locale: string;
  en: boolean;
  /** Subject of the claim minted on this tile's figure. */
  pspId: number;
  /** Which side of the attribution split — it is part of the claim's metric, because
   *  a steward total and an owned total are two different statements. */
  side: "owned" | "steward";
  /** Gate states of the ties behind THIS bucket (moneyClaims.ts rule 4). */
  tieStates: readonly ReviewState[];
  /** kg pass that materialized the money layer — the claim's derivation. */
  pass: number;
}) {
  const empty = bucket.companies === 0;
  // The tile's own figure is a citable claim: the number a journalist quotes carries the
  // `data-claim-*` payload /overeni re-derives through `getMoneyMpDetail` — the same
  // loader, the same shared arithmetic. The „nejméně" prefix stays OUTSIDE the claim: a
  // floor is a property of the corpus, and `data-claim-value` is the machine figure.
  const amount = (
    <CitableNumber
      value={bucket.contractCzk}
      claim={mpBucketClaim(pspId, side, bucket, tieStates, pass).claim}
      locale={locale as Locale}
      kind="czkCompact"
    />
  );
  return (
    <div className="bg-paper p-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{label}</p>
      <p className={`mt-2 text-3xl font-black tabular-nums tracking-tight ${tone === "signal" ? "text-signal" : "text-ink"}`}>
        {empty ? "—" : coverage.isFloor ? <>{en ? "at least " : "nejméně "}{amount}</> : amount}
      </p>
      {empty ? (
        <p className="mt-2 text-sm leading-relaxed text-steel">{emptyNote}</p>
      ) : (
        <>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel">
            {bucket.companies} {en ? "companies" : "firem"} · {bucket.contractCount}{" "}
            {en ? "contracts" : "smluv"}
            {bucket.subsidiesCzk > 0 ? ` · ${en ? "subsidies" : "dotace"} ${compactCzk(bucket.subsidiesCzk, locale)}` : ""}
            {bucket.donatedToPartyCzk > 0
              ? ` · ${en ? "party donations" : "dary straně"} ${compactCzk(bucket.donatedToPartyCzk, locale)}`
              : ""}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-steel">{rule}</p>
        </>
      )}
      <SourceNote className="mt-3 !text-[10px]">
        {en ? "source" : "zdroj"}: registr smluv · kg_edge supplies.weight, {en ? "one row per company" : "jedna firma jednou"}
        {coverage.isFloor
          ? en
            ? ` · lower bound: the ingest pulled at most ${coverage.perCompanyCap} contracts per company (${coverage.companiesAtCap} at that ceiling)`
            : ` · dolní odhad: sběr stáhl u firmy nejvýše ${coverage.perCompanyCap} smluv (${coverage.companiesAtCap} firem na stropu)`
          : ""}
      </SourceNote>
    </div>
  );
}

function TieCard({ tie, locale, en }: { tie: MoneyTieDetail; locale: string; en: boolean }) {
  // Shared definition, not a fifth local sum (`reachableMoney.ts::tieReach`).
  const reach = tieReach(tie);
  const temporal = temporalBadge(tie);
  const info = tieClassInfo(tie.tieClass);
  const origin = tieClassOriginInfo(tie.tieClassOrigin);
  // A stored class that contradicts the heuristic is the whole point of the precedence
  // rule — say which value lost, rather than presenting one silently.
  const overrides = tie.tieClassOrigin === "stored" && tie.tieClassHeuristic !== tie.tieClass;
  const links = buildRegistryLinks(tie.ico, tie.source);

  return (
    <article className="border-2 border-ink">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink bg-paper-strong px-5 py-4">
        <div>
          {/* The firm has its own file — the cross-MP view this page cannot show
              (14 companies in the graph are tied to more than one MP). */}
          <h2 className="text-xl font-black uppercase tracking-tight">
            <Link href={`/penize/firma/${tie.ico}`} className="transition-colors hover:text-signal">
              {tie.company}
            </Link>
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel">
            IČO {tie.ico}
            {tie.role ? ` · ${tie.role}` : ""}
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

      <div className="grid gap-6 px-5 py-5 sm:grid-cols-[1.3fr_1fr]">
        <div>
          {/* reach */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Metric label={en ? "contracts" : "zakázky"} value={tie.contractCzk > 0 ? compactCzk(tie.contractCzk, locale) : "—"} sub={`${tie.contractCount} ${en ? "contracts" : "smluv"}`} />
            <Metric label={en ? "subsidies" : "dotace"} value={tie.subsidiesCzk > 0 ? compactCzk(tie.subsidiesCzk, locale) : "—"} sub={tie.subsidiesCount ? `${tie.subsidiesCount} ${en ? "titles" : "titulů"}` : "—"} />
            <Metric
              label={en ? "party donation" : "dar straně"}
              value={tie.donatedToPartyCzk != null ? compactCzk(tie.donatedToPartyCzk, locale) : "—"}
              sub={tie.donationRecipientParty ?? "—"}
            />
          </div>

          {/* where the class came from — a guess and a recorded judgement must not read
              the same, and a stored class that overrode the heuristic says so here. */}
          <p
            className={`mt-4 border-l-2 pl-3 text-sm leading-relaxed ${tie.tieClassOrigin === "stored" ? "border-hairline text-steel" : "border-ochre text-steel"}`}
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

          {/* flags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {tie.triangle && <Flag>{en ? "full triangle" : "úplný trojúhelník"}</Flag>}
            {tie.nearThresholdCount > 0 && <Flag>{tie.nearThresholdCount}× {en ? "near limit" : "u limitu"}</Flag>}
            {tie.deMinimis && <Flag>{en ? "de minimis" : "bagatelní objem"}</Flag>}
            {tie.falseEdgeSuspected && <Flag>{en ? "suspected false edge" : "podezření na chybnou vazbu"}</Flag>}
            {tie.ownerStakePct != null && <Flag>{tie.ownerStakePct}% {en ? "stake" : "podíl"}</Flag>}
            {tie.priorTerm && <Flag>{en ? "prior term" : "předchozí období"}: {tie.priorTerm}</Flag>}
          </div>

          {/* Příznaky z analytických průchodů. Do 2026-08-04 se tady sázel doslovný
              strojový token (`stale-ongoing-in-graph`) — pro čtenáře nečitelný šum.
              Slovník je jeden pro tuhle stránku i pro ověřovací konzoli (tieFlags.ts) a
              nepřeložený token se ukáže doslova, označený, nikdy se neschová. */}
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

          {/* Analytická próza není zjištěný fakt: kdo ji napsal, kdy a z jakého dokladu
              patří K NÍ. Táž komponenta sází totéž v ověřovací konzoli. */}
          <AnalystNote tie={tie} en={en} className="mt-4" />

          {/* review provenance — poznámka a rozhodnutí LIDSKÉ kontroly (jiné pole než
              poznámka analýzy výše: tohle píše jedině ReviewRepository) */}
          {(tie.reviewNote || tie.lastDecision) && (
            <div className="mt-4 border-l-2 border-cobalt pl-3">
              {tie.reviewNote && (
                <p className="text-sm leading-relaxed text-steel">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                    {en ? "review note" : "poznámka kontroly"}:{" "}
                  </span>
                  {tie.reviewNote}
                </p>
              )}
              {tie.lastDecision && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel">
                  {en ? "last decision" : "poslední rozhodnutí"}: {tie.lastDecision}
                  {tie.lastReviewer ? ` · ${tie.lastReviewer}` : ""}
                  {tie.lastReviewedAt ? ` · ${tie.lastReviewedAt}` : ""}
                </p>
              )}
            </div>
          )}

          <p className="mt-4 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
            {en ? "source" : "zdroj"}: {tie.source || "—"}
          </p>
        </div>

        <div className="border-l-2 border-hairline pl-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel">
            {en ? "reachable public money" : "dosažitelné veřejné peníze"}
          </p>
          <p
            className={`mt-1 text-2xl font-black tabular-nums ${reach.attributable ? "text-signal" : "text-steel"}`}
          >
            {reach.czk > 0 ? compactCzk(reach.czk, locale) : "—"}
          </p>
          {/* The P29 rule AT the number. Without it a supervisory seat's billions read
              exactly like a supplier an MP owns. */}
          <p className="mt-1 text-xs leading-relaxed text-steel">
            {en ? info.descEn : info.descCs}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel">
            {en ? "source" : "zdroj"}: registr smluv Σ supplies.weight + subsidies_total_czk
          </p>
          {/* The tie's PERMANENT address. /overeni (the citation verifier) had nothing on
              /penize to resolve, because this feature contained no claim-ref at all —
              211 published money claims, none of them citable. A receipt is a citation of
              a CLAIM, so the link says which gate state the claim is in. */}
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel">
            {en ? "cite this tie" : "citovat tuto vazbu"}
          </p>
          <Link
            href={claimRefPath(tie.receiptRef)}
            className="mt-1 inline-flex items-center gap-1.5 border-2 border-cobalt px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:border-signal hover:text-signal"
          >
            {en ? "provenance receipt" : "účtenka původu"} →
          </Link>
          <p className="mt-1 text-xs leading-relaxed text-steel">
            {tie.reviewState === "pending_review"
              ? en
                ? "A permanent address for this claim. It cites the tie AND its gate state — this one is still awaiting human review, so the receipt records a claim, not a verdict."
                : "Trvalá adresa tohoto tvrzení. Cituje vazbu I stav brány — tahle stále čeká na lidskou kontrolu, takže účtenka zaznamenává tvrzení, ne verdikt."
              : en
                ? "A permanent address for this claim, carrying the human gate's decision and its audit trail."
                : "Trvalá adresa tohoto tvrzení; nese rozhodnutí lidské brány i jeho auditní stopu."}
          </p>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel">
            {en ? "verify in registry" : "ověřit v rejstříku"}
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {[
              { label: en ? "ARES subject" : "ARES subjekt", href: links.aresSubject },
              { label: "ARES VR", href: links.aresVr },
              { label: en ? "commercial register" : "obchodní rejstřík", href: links.justiceVr },
              { label: en ? "contracts register" : "registr smluv", href: links.registrSmluv },
              { label: en ? "Hlídač company" : "Hlídač firma", href: links.hlidacSubjekt },
              ...(links.hlidacPerson ? [{ label: en ? "Hlídač person" : "Hlídač osoba", href: links.hlidacPerson }] : []),
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
        </div>
      </div>

      {/* contracts list */}
      {tie.contracts.length > 0 && (
        <div className="border-t-2 border-hairline px-5 py-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">
            {en ? "contracts via" : "smlouvy přes"} {tie.company}
          </p>
          <ul className="mt-2 divide-y divide-hairline">
            {tie.contracts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate text-steel">{c.label}</span>
                <span className="shrink-0 font-mono text-xs font-bold tabular-nums">
                  {c.amountCzk != null ? compactCzk(c.amountCzk, locale) : "—"}
                  {c.signedOn ? <span className="ml-2 text-steel">{c.signedOn}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {tie.contractsMoreCount > 0 && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel">
              + {tie.contractsMoreCount} {en ? "more contracts" : "dalších smluv"}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-steel">{label}</p>
      <p className="mt-0.5 text-lg font-black tabular-nums">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-steel">{sub}</p>
    </div>
  );
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
      {children}
    </span>
  );
}
