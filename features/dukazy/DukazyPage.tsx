/**
 * Deník důkazů (/dukazy) — the review console's public face: every rozhodnutí,
 * které prošlo lidskou branou, jako datovaný, kotvený, citovatelný záznam.
 * Sází se jako soudní věstník: strohé řádky, datum vlevo, výrok, subjekt,
 * odkazy na primární registry, citace zdroje na každém záznamu.
 *
 * Serverová komponenta — žádná interaktivita kromě odkazů; zvýraznění cílové
 * kotvy (`#z-<id>`) řeší CSS `:target` varianta, ne JavaScript.
 *
 * COPY JE V KATALOGU (2026-08-05): čtenářská věta žije v messages/{cs,en}.json
 * pod `dukazy.*` a sází se přes next-intl; čistý modul (deriveFeed.ts) vrací
 * KLÍČE (decisionKey, sourceKey), ne text — vzor features/overeni. Strojové
 * podoby (RSS/JSON) zůstávají jednojazyčné (`decisionCs`, `sourceCs`).
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { formatDate, formatInt } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { entityDayHref, mpEntityKey } from "@/features/denik/deriveDenik";
import type { EvidenceEntry } from "./deriveFeed";
import type { DukazyData } from "./getDukazyData";
import { dukazyLimitNotes } from "./limitNotes";

/** Překladač namespace `dukazy` — jediný typ, který si komponenty předávají. */
type T = ReturnType<typeof useTranslations<"dukazy">>;

/** Otisk řádku zkrácený pro oči; celý zůstává v `title` a ve strojových
 *  podobách věstníku — nikdy se nezaokrouhluje ani nepřepisuje. */
const shortHash = (h: string): string => (h.length > 16 ? `${h.slice(0, 16)}…` : h);

/** Výrok nese barvu stavu: ověřeno = inkoust (pravomocné), zamítnuto =
 *  signal-deep (AA na textu i ploše), doplnění = obrys (neuzavřené),
 *  forenzní podpis = okr. */
const DECISION_TONE: Record<EvidenceEntry["decision"], string> = {
  confirm: "bg-ink text-paper",
  reject: "bg-signal-deep text-paper",
  "needs-more": "border border-ink text-ink",
  "forensic-verified": "bg-ochre text-ink",
};

function EntryRow({ e, locale, t }: { e: EvidenceEntry; locale: Locale; t: T }) {
  /*
   * Den, ve kterém TOTÉŽ rozhodnutí nese Deník republiky. Oba deníky klíčují
   * poslance stejným veřejným klíčem, ale jen /denik umí odpovědět „ten den,
   * ten poslanec" — adresu proto skládá kodek deníku (`mpEntityKey` +
   * `entityDayHref`), importovaný, nikdy přepsaný do šablony u sebe. Vrátí-li
   * skladač null (okamžik, ze kterého se den přečíst nedá), odkaz se
   * nezobrazí; forenzní záznam pspId nemá vůbec — podepsaný posudek není
   * řádkem deníku, takže žádný jeho den neexistuje.
   */
  const denikHref =
    e.mpPspId == null ? null : entityDayHref(mpEntityKey(e.mpPspId), e.decidedAt);
  return (
    <article
      id={e.anchor}
      className="grid scroll-mt-24 gap-x-6 gap-y-2 border-b border-hairline py-5 target:bg-paper-strong sm:grid-cols-[7rem_1fr]"
    >
      <div className="flex flex-col gap-1">
        <time dateTime={e.decidedAt} className="font-mono text-sm font-bold tabular-nums">
          {formatDate(e.decidedAt, locale)}
        </time>
        {/* Kotva záznamu — stabilní veřejná adresa rozhodnutí. */}
        <a
          href={`#${e.anchor}`}
          className="font-mono text-xs uppercase tracking-widest text-steel-aa hover:text-signal-deep hover:underline"
          aria-label={t("entry.permalinkAria", { id: e.id })}
        >
          #{e.anchor.length > 14 ? `${e.anchor.slice(0, 13)}…` : e.anchor}
        </a>
        {/* MÍSTO V ŘETĚZU BRÁNY. `review_audit` je připojený append-only řetěz
            (chain_pos + prev_hash + row_hash) a věstník, který ho publikuje,
            z něj do 2026-08-13 neukazoval nic — čtenář neměl jak si rozhodnutí
            ověřit. Řádek bez pozice ji nedostane vymyšlenou; řekne se to. */}
        {e.kind === "tie" &&
          (e.chainPos != null && e.rowHash ? (
            <span className="flex flex-col gap-0.5 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
              <span className="tabular-nums">{t("chain.pos", { pos: formatInt(e.chainPos, locale) })}</span>
              <span className="break-all normal-case tracking-normal" title={e.rowHash}>
                {shortHash(e.rowHash)}
              </span>
            </span>
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-widest text-steel-aa">
              {t("chain.unchained")}
            </span>
          ))}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className={`px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest ${DECISION_TONE[e.decision]}`}>
            {e.decisionKey ? t(e.decisionKey) : e.decisionCs}
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
            {/* U forenzního posudku není revizor, jen podpis — a ten jde
                katalogem, ne polem `reviewer` (to nese feed doslova). */}
            {e.kind === "forensic" ? t("entry.signedOff") : t("entry.decidedBy", { reviewer: e.reviewer })}
          </span>
          {e.priorState && (
            <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
              {t("entry.priorState", { state: e.priorState })}
            </span>
          )}
        </div>
        <p className="text-base font-bold leading-snug">
          {e.internalHref ? (
            <Link href={e.internalHref} className="hover:text-signal-deep hover:underline">
              {e.subjectCs}
            </Link>
          ) : (
            e.subjectCs
          )}
        </p>
        {/* Kam se z rozhodnutí dá jít UVNITŘ platformy: trvalá účtenka (tam se
            záznam znovu odvodí a ukáže se stav brány), spis firmy, které se
            vazba týká, a den druhého deníku. Účtenka se skládá JEDINOU gramatikou
            (`edgeClaimRef` v deriveFeed.ts) a řádek, jehož konce kanonickou
            adresu neunesou, ji nedostane vůbec. */}
        {(e.receiptHref || e.companyHref || denikHref) && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {e.receiptHref && (
              <li>
                <Link
                  href={e.receiptHref}
                  className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-signal-deep hover:underline"
                  aria-label={t("entry.receiptAria", { subject: e.subjectCs })}
                >
                  {t("entry.receipt")} <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </li>
            )}
            {e.companyHref && (
              <li>
                <Link
                  href={e.companyHref}
                  className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-signal-deep hover:underline"
                  aria-label={t("entry.companyFileAria", { subject: e.subjectCs })}
                >
                  {t("entry.companyFile")} <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </li>
            )}
            {denikHref && (
              <li>
                <Link
                  href={denikHref}
                  className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-signal-deep hover:underline"
                  aria-label={t("entry.denikDayAria", { subject: e.subjectCs })}
                >
                  {t("entry.denikDay")} <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </li>
            )}
          </ul>
        )}
        {e.links.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {e.links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-cobalt hover:underline"
                >
                  {l.label} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
        <SourceNote>
          {e.sourceKey === undefined
            ? e.sourceCs
            : e.sourceDetail == null
              ? t(e.sourceKey)
              : t(e.sourceKey, { detail: e.sourceDetail })}
        </SourceNote>
      </div>
    </article>
  );
}

/** Přiznané meze čtení — táž sada v prázdném i plném stavu, protože „co tenhle
 *  věstník nenese" je vlastnost ODEČTU, ne počtu vypsaných řádků. */
function LimitNotes({ data, locale, t }: { data: DukazyData; locale: Locale; t: T }) {
  const notes = dukazyLimitNotes(data.limits, locale);
  if (notes.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1">
      {notes.map((n) => (
        <li key={n.key}>
          <SourceNote>{t(n.key, n.values)}</SourceNote>
        </li>
      ))}
    </ul>
  );
}

export default function DukazyPage({ data, locale }: { data: DukazyData | null; locale: Locale }) {
  const t = useTranslations("dukazy");
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          {/* Kde jsem — a kde je druhý deník platformy. /denik nese táž
              rozhodnutí jako jednu skupinu svého dne a sem odkazoval; zpátky
              nevedlo nic. */}
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ dukazy</span>
            <Link
              href="/denik"
              className="font-mono text-xs uppercase tracking-widest text-cobalt hover:underline"
            >
              {t("denikLink")}
            </Link>
          </div>
          {/* Strojově čitelné podoby věstníku — veřejné API deníku. */}
          <div className="flex items-center gap-4">
            <a
              href="/dukazy/feed.xml"
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              RSS
            </a>
            <a
              href="/dukazy/feed.json"
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              JSON
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">{t("kicker")}</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("title")}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">{t("lead")}</p>

        {/* Metodika zveřejnění — co deník říká a co záměrně neříká. */}
        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">{t("method.kicker")}</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            {/* Ověřitelnost vedla do /admin — konzole za tokenem, kterou robots.ts
                navíc zakazuje procházet. Veřejný čtenář tam nemá jak dojít, takže
                to nebyla cesta k ověření, ale slepá ulička. Hlava řetězu je
                VEŘEJNÁ na /data (a strojově na /data/manifest.json). */}
            {t.rich("method.body", {
              data: (chunks) => (
                <Link
                  href="/data"
                  className="font-mono text-xs uppercase tracking-widest text-cobalt hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
          {/* Co otisk dokazuje a co NE — pořadí a nedotčenost, ne správnost. */}
          <p className="mt-2 text-sm leading-relaxed text-steel-aa">
            {t.rich("chain.note", {
              manifest: (chunks) => (
                <a
                  href="/data/manifest.json"
                  className="font-mono text-xs uppercase tracking-widest text-cobalt hover:underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>

        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={1}
            title={t("section.title")}
            aside={
              data && (
                <SourceNote>
                  {/* Citace jmenuje jen to, co se OPRAVDU přečetlo: selhal-li
                      odečet uzlů tisků, věstník se na `kg_node bill.forensic_*`
                      odvolávat nesmí — zdroj, ke kterému se nedostal, není zdroj. */}
                  {data.limits.forensicRead
                    ? t("section.source", { rows: formatInt(data.auditRows, locale) })
                    : t("section.sourceNoForensic", { rows: formatInt(data.auditRows, locale) })}
                  {/* Useknuté čtení JE tvrzení o počtu — a repozitář u tohohle
                      stropu sám varuje, že pak „publikuje špatné číslo". Věta
                      se přidává jen tehdy, když se na strop skutečně narazilo. */}
                  {data.limits.auditTruncated
                    ? ` · ${t("section.sourceFloor", { cap: formatInt(data.limits.auditCap, locale) })}`
                    : ""}
                </SourceNote>
              )
            }
          />

          {data == null ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-lg">{t("unreadable")}</p>
            </div>
          ) : data.entries.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-lg">
                {t("empty.lead")}
                <span className="text-signal">.</span>{" "}
                {t.rich("empty.body", {
                  kontrola: (chunks) => (
                    <Link
                      href="/penize/kontrola"
                      className="font-mono text-sm uppercase tracking-widest text-cobalt hover:underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
              <div className="mt-3">
                {/* Věta „žádný záznam není zamlčen" tu stála jako LITERÁL —
                    a týž požadavek ji vyvracel: loader čte všechny uzly tisků
                    a publikuje jen podepsané. Zbyla holá citace zdroje; závěr
                    o zamlčování se ODVOZUJE v `limitNotes.ts` a vysloví se jen
                    tehdy, když ho měřidla unesou. */}
                <SourceNote>{t("empty.note", { rows: formatInt(data.auditRows, locale) })}</SourceNote>
                <LimitNotes data={data} locale={locale} t={t} />
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8 border-t-2 border-ink">
                {data.entries.map((e) => (
                  <EntryRow key={e.id} e={e} locale={locale} t={t} />
                ))}
              </div>
              <LimitNotes data={data} locale={locale} t={t} />
            </>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/penize/kontrola"
              className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              {t("console")}{" "}
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </Link>
            <SourceNote>{t("anchorsNote")}</SourceNote>
          </div>
        </section>
      </div>
    </main>
  );
}
