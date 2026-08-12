/*
 * OMLUVY — míra docházky dostává své řádky.
 *
 * Spis o docházce tiskl jediné číslo (`absence_rate`) s citací „omluvené dny /
 * jednací dny", tedy poměr dvou veličin, které nikde nestály. Evidence pod ním
 * je přitom datovaná a časovaná — 6 425 podání za 10. období — a nikam se
 * nedostala. Tady jsou.
 *
 * TŘI STAVY (vzor RebellionInstances):
 *   null           evidenci se nepodařilo přečíst → věta o TOM, nikdy prázdný
 *                  seznam, který by tvrdil, že poslanec nechyběl ani jednou
 *   totalDays = 0  poslanec nemá ani jednu omluvu → to je odpověď
 *   řádky          dny od nejnovějšího, strop přiznaný
 *
 * CO SE TU NEŘÍKÁ
 *  • DŮVOD. `omluvy.unl` má sloupce (id_organ, id_poslanec, den, od, do) a nic
 *    víc — proč poslanec chyběl, zdroj nezveřejňuje.
 *  • „Omluven" u pultu při konkrétním hlasování. To je jiný fakt z jiné datové
 *    sady (jmenovité hlasy) a plete se s tímhle až příliš snadno.
 *  • Že by míra docházky byla z těchto řádků spočítaná TEĎ. Míra je uložená
 *    hodnota z průchodu indexem; tenhle výpis je živá evidence. Když přibude
 *    podání po přepočtu, je vidět tady a v míře ještě ne.
 */

import { profileIntl } from "../serverIntl";
import SourceNote from "@/features/shared/components/SourceNote";
import type { AbsenceDay, ProfileAbsenceRecord } from "../absenceRecord";

export default async function OmluvyTable({ record }: { record: ProfileAbsenceRecord | null }) {
  const { t, f } = await profileIntl();

  if (record === null) {
    return (
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
          {t("dossierAbsenceRowsHeading")}
        </p>
        <p className="mt-2 max-w-3xl border-l-4 border-ochre pl-4 text-[13px] leading-relaxed text-steel">
          {t("dossierAbsenceRowsUnavailable")}
        </p>
      </div>
    );
  }

  if (record.totalDays === 0) {
    return (
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
          {t("dossierAbsenceRowsHeading")}
        </p>
        <p className="mt-2 max-w-3xl border-l-4 border-hairline pl-4 text-[13px] leading-relaxed text-steel">
          {t("dossierAbsenceRowsNone")}
        </p>
        <SourceNote className="mt-2 !text-[10px]">{t("dossierAbsenceRowsSourceEmpty")}</SourceNote>
      </div>
    );
  }

  const windowsOf = (d: AbsenceDay): string =>
    d.windows
      .map((w) =>
        w.wholeDay || (w.from === null && w.to === null)
          ? t("dossierAbsenceRowsWholeDay")
          : `${w.from ?? "—"}–${w.to ?? "—"}`,
      )
      .join(" · ");

  return (
    <div>
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
        {t("dossierAbsenceRowsHeading")}
      </p>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">
        {t("dossierAbsenceRowsLead", {
          days: record.totalDays,
          daysFmt: f.int(record.totalDays),
          filings: record.filings,
          filingsFmt: f.int(record.filings),
        })}
      </p>

      <div className="mt-3 border-t-2 border-ink">
        {record.days.map((d) => (
          <div key={d.day} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-2 py-2.5">
            <span className="font-mono text-xs uppercase tracking-wider text-steel">
              <time dateTime={d.day}>{f.date(d.day)}</time>
              {d.future && (
                <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-ochre">
                  {t("dossierAbsenceRowsFutureTag")}
                </span>
              )}
            </span>
            <span className="font-mono text-[13px] text-ink">{windowsOf(d)}</span>
          </div>
        ))}
      </div>

      {record.totalDays > record.days.length && (
        <p className="mt-2.5 font-mono text-[10px] uppercase tracking-widest text-steel">
          {t("dossierAbsenceRowsMore", {
            shown: f.int(record.days.length),
            total: f.int(record.totalDays),
          })}
        </p>
      )}

      {record.futureDays > 0 && (
        <p className="mt-2.5 max-w-3xl text-[13px] leading-relaxed text-steel">
          {t("dossierAbsenceRowsFuture", {
            count: record.futureDays,
            countFmt: f.int(record.futureDays),
          })}
        </p>
      )}

      {record.droppedUndated > 0 && (
        <p className="mt-2.5 max-w-3xl text-[13px] leading-relaxed text-steel">
          {t("dossierAbsenceRowsUndated", {
            count: record.droppedUndated,
            countFmt: f.int(record.droppedUndated),
          })}
        </p>
      )}

      <p className="mt-2.5 max-w-3xl text-[13px] leading-relaxed text-steel">{t("dossierAbsenceRowsNoReason")}</p>
      <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-steel">{t("dossierAbsenceRowsRate")}</p>
      <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-steel">{t("dossierAbsenceRowsNotBallot")}</p>

      <SourceNote className="mt-2.5 !text-[10px]">
        {t("dossierAbsenceRowsSource", {
          filings: f.int(record.filings),
          days: f.int(record.totalDays),
          from: record.from ? f.date(record.from) : "—",
          to: record.to ? f.date(record.to) : "—",
        })}
      </SourceNote>
    </div>
  );
}
