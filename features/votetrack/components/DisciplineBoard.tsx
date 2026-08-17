"use client";

/**
 * Linie klubů — žebříček disciplíny a matice linií (analytická část fúze).
 * Disciplína = podíl přítomných poslanců klubu hlasujících s většinovým
 * směrem; počítá se z dat (lib/civic/votes), nehardcoduje.
 */

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ROLL_CALLS } from "@/lib/civic/data";
import { useFormat } from "@/lib/i18n/useFormat";
import { disciplineByParty, partyLine } from "@/lib/civic/votes";
import SourceNote from "@/features/shared/components/SourceNote";

const DISCIPLINE = disciplineByParty();

export default function DisciplineBoard() {
  const t = useTranslations("votetrack");
  const tc = useTranslations("content");
  const f = useFormat();
  return (
    <div className="grid gap-12 lg:grid-cols-[5fr_7fr]">
      {/* Žebříček disciplíny */}
      <div className="min-w-0">
        <SourceNote>{t("disciplineNote", { count: ROLL_CALLS.length })}</SourceNote>
        <div className="mt-3 border-t-2 border-ink">
          {DISCIPLINE.map((d, i) => (
            <motion.div
              key={d.code}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: i * 0.04 }}
              className="grid grid-cols-[2rem_6.5rem_1fr_4.5rem] items-center gap-3 border-b border-hairline px-1 py-3.5"
            >
              <span className={`font-mono text-lg font-bold ${i === 0 ? "text-signal" : "text-steel"}`}>{i + 1}</span>
              <span className="flex items-center gap-1.5 text-sm font-black uppercase tracking-tight">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                {d.name}
                <span className="font-mono text-[10px] font-normal text-steel">{d.seats}</span>
              </span>
              <span className="h-4 w-full bg-hairline">
                <motion.span
                  className="block h-full bg-cobalt"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${d.avg ?? 0}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.04 }}
                />
              </span>
              <span className="text-right text-lg font-black tabular-nums">
                {d.avg === null ? <span className="text-steel">—</span> : `${f.dec(d.avg)} %`}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Matice linií */}
      <div className="min-w-0">
        <SourceNote>{t("matrixNote")}</SourceNote>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-center">
            <thead>
              <tr>
                <th className="border-b-2 border-ink py-2 pr-3 text-left font-mono text-[11px] uppercase tracking-widest text-steel">
                  {t("partyHeader")}
                </th>
                {ROLL_CALLS.map((rc) => (
                  <th key={rc.id} className="border-b-2 border-ink px-1.5 py-2 font-mono text-[10px] uppercase tracking-wider text-steel">
                    <span className="block" title={tc(`rollCalls.${rc.id}.title`)}>
                      {f.date(rc.date)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISCIPLINE.map((d) => (
                <tr key={d.code} className="border-b border-hairline">
                  <td className="py-2.5 pr-3 text-left">
                    <span className="flex items-center gap-1.5 text-sm font-black uppercase">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </span>
                  </td>
                  {ROLL_CALLS.map((rc, rcIdx) => {
                    const line = partyLine(rc.byParty[d.code]);
                    const disc = d.perRc[rcIdx];
                    if (line === null || disc === null) {
                      // No party member was present for this vote — a
                      // distinct "no data" cell, never a fabricated
                      // unanimous-"pro" arrow (the old present===0 -> 1
                      // sentinel used to render exactly that).
                      return (
                        <td key={rc.id} className="px-1.5 py-2.5">
                          <span className="inline-flex min-w-[3.75rem] items-center justify-center border-2 border-dashed border-hairline px-1.5 py-1 font-mono text-xs text-steel">
                            —
                          </span>
                        </td>
                      );
                    }
                    const strong = disc >= 90;
                    return (
                      <td key={rc.id} className="px-1.5 py-2.5">
                        <span
                          className={`inline-flex min-w-[3.75rem] items-center justify-center gap-1 border-2 px-1.5 py-1 font-mono text-xs font-bold tabular-nums ${
                            line === "pro"
                              ? strong
                                ? "border-cobalt bg-cobalt text-paper"
                                : "border-cobalt text-cobalt"
                              : strong
                                ? "border-signal bg-signal text-paper"
                                : "border-signal text-signal"
                          }`}
                        >
                          {line === "pro" ? "▲" : "▼"} {f.int(Math.round(disc))}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-md text-sm italic leading-relaxed text-steel">{t("matrixFootnote")}</p>
      </div>
    </div>
  );
}
