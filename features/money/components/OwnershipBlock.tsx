"use client";

/*
 * VLASTNICKÁ STRUKTURA na spisu firmy — sazba zapsaného vlastnictví, nic víc.
 *
 * Data přicházejí hotová z čisté projekce (`features/money/ownership.ts`); tenhle
 * soubor nedělá žádné odvození ani aritmetiku. Co drží sazba:
 *
 *  • ČAS JE PRVNÍ TŘÍDA. Otevřený zápis („podle rejstříku trvá") a ukončený
 *    zápis mají jiný štítek i jiný tón — u AGROFERTu jsou VŠECHNY čtyři zápisy
 *    ukončené, takže blok se musí číst jako historie, ne jako dnešní vlastnictví.
 *  • ZANIKLÉ IČO nedostane odkaz na spis firmy ani do rejstříků: uzel, který
 *    ARES nezná, se nesmí sázet jako doložený subjekt. Místo odkazu se vykreslí
 *    uložená anotace — doslova, datovaná, označená jako pracovní materiál.
 *  • KAŽDÝ ŘÁDEK NESE SVŮJ ZDROJ (výpis ISVR, ze kterého pochází), blok nese
 *    citaci celé vrstvy. Bez citace se tu nesází ani jedno číslo.
 *  • ŽÁDNÁ EXPOZICE. Blok neříká, že přes vlastnictví „tečou" peníze ani vliv;
 *    dvoukrokové sousedství se tu nepočítá a copy to říká nahlas.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import type { OwnershipAnnotation, OwnershipRow, OwnershipStructure } from "../ownership";

export default function OwnershipBlock({ ownership }: { ownership: OwnershipStructure }) {
  const t = useTranslations("money.ownership");
  const { owners, subsidiaries, droppedUnresolved, subjectNameHistoryCs, pass } = ownership;

  return (
    <section id="vlastnictvi" className="mt-8 border-2 border-hairline p-5">
      <h2 className="text-xl font-black uppercase tracking-tight">{t("title")}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-steel-aa">{t("rule")}</p>

      {owners.length > 0 && (
        <OwnershipList heading={t("ownersHeading")} rows={owners} />
      )}
      {subsidiaries.length > 0 && (
        <OwnershipList heading={t("subsidiariesHeading")} rows={subsidiaries} />
      )}

      {droppedUnresolved > 0 && (
        <p className="mt-4 border-l-2 border-ochre pl-3 text-sm leading-relaxed text-steel-aa">
          {t("droppedUnresolved", { count: droppedUnresolved })}
        </p>
      )}

      {subjectNameHistoryCs && (
        <div className="mt-5 border-l-2 border-hairline pl-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">
            {t("nameHistoryHeading")}
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink">{subjectNameHistoryCs}</p>
          <p className="mt-1 text-xs leading-relaxed text-steel-aa">{t("verbatimNote")}</p>
        </div>
      )}

      <SourceNote className="mt-4">
        {pass != null ? t("sourceWithPass", { pass }) : t("source")}
      </SourceNote>
    </section>
  );
}

function OwnershipList({ heading, rows }: { heading: string; rows: OwnershipRow[] }) {
  return (
    <div className="mt-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">{heading}</p>
      <ul className="mt-2 divide-y divide-hairline border-t-2 border-ink">
        {rows.map((row) => (
          <OwnershipRowItem key={`${row.direction}-${row.counterpartId}-${row.from ?? ""}`} row={row} />
        ))}
      </ul>
    </div>
  );
}

function OwnershipRowItem({ row }: { row: OwnershipRow }) {
  const t = useTranslations("money.ownership");
  const f = useFormat();
  // Zaniklý / v registru nedohledatelný uzel nedostane odkaz na spis firmy: ten by
  // ho postavil vedle doložených subjektů, a spis by navíc odpověděl jen „žádná
  // vazba" — o jeho zániku by čtenář nezjistil nic.
  const registryUnverifiable = row.annotation?.unresolvableInAres === true;
  const linkable = row.counterpartIco !== null && !registryUnverifiable;
  const stateKey = row.open
    ? row.direction === "owner"
      ? "stateOwnerCurrent"
      : "stateSubsidiaryCurrent"
    : row.direction === "owner"
      ? "stateOwnerFormer"
      : "stateSubsidiaryFormer";

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-base font-bold">
          {linkable ? (
            <Link
              href={`/penize/firma/${row.counterpartIco}`}
              className="transition-colors hover:text-signal"
            >
              {row.counterpartName}
            </Link>
          ) : (
            <span>{row.counterpartName}</span>
          )}
          {row.counterpartIco && (
            <span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-wider text-steel-aa">
              IČO {row.counterpartIco}
            </span>
          )}
        </p>
        <span
          className={`shrink-0 border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
            row.open ? "border-cobalt text-cobalt" : "border-hairline text-steel-aa"
          }`}
        >
          {t(stateKey)}
        </span>
      </div>

      <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
        {row.sharePct != null
          ? t("sharePeriodPrefix", {
              share: Number.isInteger(row.sharePct) ? f.int(row.sharePct) : f.dec(row.sharePct),
            })
          : t("shareUnknown")}
        {" · "}
        {row.open
          ? row.from
            ? t("periodOpen", { from: f.date(row.from) })
            : t("periodOpenNoStart")
          : row.from && row.to
            ? t("periodClosed", { from: f.date(row.from), to: f.date(row.to) })
            : row.to
              ? t("periodClosedNoStart", { to: f.date(row.to) })
              : t("periodUnknown")}
      </p>

      {row.role && (
        <p className="mt-1 text-sm leading-relaxed text-steel-aa">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
            {t("roleLabel")}:{" "}
          </span>
          {row.role}
        </p>
      )}

      {row.periodCount > 1 && (
        <p className="mt-1 text-xs leading-relaxed text-steel-aa">
          {t("multiPeriod", { count: row.periodCount })}
        </p>
      )}

      {row.annotation && <AnnotationCapsule annotation={row.annotation} />}

      <p className="mt-1.5 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel-aa">
        {t("rowSourceLabel")}:{" "}
        {row.source ? (
          row.sourceLabel ? (
            <a
              href={row.source}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-cobalt transition-colors hover:text-signal"
            >
              <ExternalLink className="h-3 w-3" aria-hidden /> {row.sourceLabel}
            </a>
          ) : (
            row.source
          )
        ) : (
          t("rowSourceMissing")
        )}
        {row.recordedAt ? ` · ${t("recorded", { date: f.date(row.recordedAt) })}` : ""}
      </p>
    </li>
  );
}

/** Uložená pravda o zaniklém / v ARES nedohledatelném uzlu. Vše doslova. */
function AnnotationCapsule({ annotation: a }: { annotation: OwnershipAnnotation }) {
  const t = useTranslations("money.ownership");
  const f = useFormat();

  return (
    <div className="mt-2 border-l-4 border-ochre bg-ochre/10 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {a.unresolvableInAres && (
          <span className="border-2 border-ochre px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
            {t("unresolvableBadge")}
          </span>
        )}
        <span className="font-mono text-[10px] uppercase tracking-widest text-steel-aa">
          {t("notRegistryVerified")}
        </span>
      </div>

      {/* Věta o doslovnosti stojí NAD poli, ne až pod prózou: doslovně je uložený
          i „fúze" nebo „NENALEZENO on both ARES endpoints" — anglický čtenář jinak
          čte českou hodnotu jako naši nepřeloženou copy. */}
      <p className="mt-1.5 text-xs leading-relaxed text-steel-aa">{t("verbatimNote")}</p>

      <dl className="mt-2 space-y-1 text-sm leading-relaxed text-ink">
        {a.extinctionReason && (
          <Field label={t("extinctionReasonLabel")} value={a.extinctionReason} />
        )}
        {a.mergedInto && (
          <Field
            label={t("mergedIntoLabel")}
            value={a.mergedInto}
            href={a.mergedIntoIco ? `/penize/firma/${a.mergedIntoIco}` : null}
          />
        )}
        {a.mergedOn && <Field label={t("mergedOnLabel")} value={f.date(a.mergedOn)} />}
        {a.successorCandidate && (
          <Field label={t("successorLabel")} value={a.successorCandidate} />
        )}
        {a.checkResult && <Field label={t("checkResultLabel")} value={a.checkResult} />}
      </dl>

      {a.checkedEndpoints.length > 0 && (
        <p className="mt-2 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel-aa">
          {t("checkedEndpointsLabel")}:{" "}
          {a.checkedEndpoints.map((url, i) => (
            <span key={url}>
              {i > 0 ? " · " : ""}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-cobalt transition-colors hover:text-signal"
              >
                {t("endpointOrdinal", { n: i + 1 })}
              </a>
            </span>
          ))}
        </p>
      )}

      {a.notAnomaly && <p className="mt-2 text-sm leading-relaxed text-steel-aa">{t("notAnomaly")}</p>}

      {a.analystNoteCs && (
        <div className="mt-2 border-l-2 border-hairline pl-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">
            {t("analystNoteHeading")}
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink">{a.analystNoteCs}</p>
        </div>
      )}

      <SourceNote className="mt-2 !text-[10px]">
        {a.recordedAt && a.pass != null
          ? t("annotationSourceDated", { date: f.date(a.recordedAt), pass: a.pass })
          : t("annotationSource")}
      </SourceNote>
    </div>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">
        {label}
      </dt>
      <dd className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="text-cobalt transition-colors hover:text-signal">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
