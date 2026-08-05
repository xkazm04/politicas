"use client";

/*
 * MoneyTrailSection — peněžní stopa obce (moonshot 4D „Municipal Money Trail").
 *
 * Sekce 04 plochy /rozpocty: smlouvy obce s firmami peněžního grafu, spojené
 * přes IČO (zveřejněné pravidlo v supplierTrail.ts se tiskne přímo na ploše).
 * Tři vrstvy poctivosti:
 *   – směr platby se rozlišuje jen tam, kde ho registr DOKLÁDÁ (příznak
 *     příjemce + dvoustranná smlouva); zbytek je „směr neuveden", nikdy odhad;
 *   – obec mimo záznam dostane přiznanou absenci, nikdy prázdný graf;
 *   – vazby protistran na poslance se čtou ŽIVĚ (getSupplierTies) a neověřená
 *     vazba nese výslovné „vyžaduje lidské ověření" (paritní pravidlo /penize).
 *
 * Vrstevnické srovnání znovu-používá zveřejněné pravidlo skupin z peerGroups
 * (pásmo × kraj), jen „v záznamu" tu znamená „má smlouvy v grafu".
 *
 * Copy přes next-intl (messages/*.json, sekce "budget"); čísla přes useFormat.
 */

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useFormat } from "@/lib/i18n/useFormat";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import { citeViewAction } from "@/features/graph/graphActions";
import type { Municipality } from "./mirrorData";
import { getRegistry } from "./mirrorData";
import { MIN_PEERS, peerGroupFor } from "./peerGroups";
import {
  getSupplierTable,
  peerSupplierTotals,
  rowTotalCount,
  rowTotalCzk,
  supplierCoverage,
  supplierPeerStats,
  townSupplierSummary,
} from "./supplierTrail";
import {
  SUPPLIERS_CONTRACTS_SCANNED,
  SUPPLIERS_MUNICIPAL_CONTRACTS,
} from "./data/municipalSuppliers.generated";
import type { SupplierTiesResult } from "./getSupplierTies";

/** Kolik protistran se vypisuje; zbytek se přizná souhrnným řádkem. */
const TOP_SUPPLIERS = 12;

/** Tlačítko „v grafu": vydá trvalou citaci uzlu firmy (citeViewAction — týž
 *  mechanismus jako na /graf) a přejde na ni; když graf neběží, přizná to. */
function GraphLinkButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const t = useTranslations("budget");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-steel-aa">{t("graphUnavailable")}</span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t("graphLinkAria", { company: companyName })}
      onClick={() =>
        startTransition(async () => {
          const cite = await citeViewAction({ kind: "uzel", variant: "mapa", node: companyId });
          if (cite) router.push(cite.path);
          else setFailed(true);
        })
      }
      className="border border-hairline px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-steel-aa transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
    >
      {pending ? "…" : t("viewInGraph")}
    </button>
  );
}

export default function MoneyTrailSection({
  town,
  ties,
}: {
  town: Municipality;
  /** null = plocha renderovaná bez serverové vrstvy vazeb (přizná se). */
  ties: SupplierTiesResult | null;
}) {
  const t = useTranslations("budget");
  const reduceMotion = useReducedMotion();
  const f = useFormat();

  const table = useMemo(() => getSupplierTable(), []);
  const coverage = useMemo(() => supplierCoverage(table), [table]);
  const registry = useMemo(() => getRegistry(), []);

  const summary = useMemo(() => townSupplierSummary(town.ic, table), [town, table]);

  /** Vrstevníci týmž zveřejněným pravidlem (pásmo × kraj), jen „v záznamu"
   *  tu znamená „obec má smlouvy v grafu". */
  const trailCovered = useMemo(() => new Set(table.keys()), [table]);
  const group = useMemo(() => peerGroupFor(town, registry, trailCovered), [town, registry, trailCovered]);
  const peerIcs = useMemo(() => group.peers.map((p) => p.ic), [group]);
  const peerTotals = useMemo(() => peerSupplierTotals(peerIcs, table), [peerIcs, table]);

  const topRows = useMemo(() => summary?.rows.slice(0, TOP_SUPPLIERS) ?? [], [summary]);
  const restRows = useMemo(() => summary?.rows.slice(TOP_SUPPLIERS) ?? [], [summary]);
  const restCzk = useMemo(() => restRows.reduce((a, r) => a + rowTotalCzk(r), 0), [restRows]);
  const maxRowCzk = useMemo(
    () => Math.max(1, ...topRows.map(rowTotalCzk)),
    [topRows],
  );

  const scopeLabel =
    group.scope === "kraj" ? t("scopeKraj", { kraj: town.krajName }) : t("scopeNationwide");
  const bandLabel = t(`band${group.bandIndex}`);
  const sourceLine = t("trailSource", { pass: coverage.pass, date: coverage.retrievedOn });

  return (
    <section id="penize" className="mt-14 border-t-4 border-ink pt-10">
      <SectionHeading index={4} title={t("trailTitle")} aside={<SourceNote>{sourceLine}</SourceNote>} />

      {/* Zveřejněné pravidlo spojení — tiskne se, netvrdí. */}
      <div className="mt-6 max-w-3xl border-2 border-ink bg-paper-strong px-5 py-4">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">{t("linkRuleTitle")}</p>
        <p className="mt-2 text-sm leading-relaxed text-steel-aa">
          {t.rich("linkRuleBody", {
            ico: town.ic,
            scanned: f.int(SUPPLIERS_CONTRACTS_SCANNED),
            assigned: f.int(SUPPLIERS_MUNICIPAL_CONTRACTS),
            strong: (chunks) => <strong className="font-bold text-ink">{chunks}</strong>,
          })}
        </p>
        <p className="mt-2 font-mono text-xs tabular-nums text-steel-aa">
          {t("linkRuleStats", {
            towns: f.int(coverage.townsInRecord),
            pairs: f.int(coverage.supplierPairs),
          })}
        </p>
      </div>

      {summary === null ? (
        <div className="mt-8 max-w-3xl border-2 border-hairline bg-paper-strong px-5 py-6">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep">
            {t("notInRecordTitle")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-steel-aa">
            {t("notInRecordBody", {
              town: town.name,
              municipal: f.int(SUPPLIERS_MUNICIPAL_CONTRACTS),
              towns: f.int(coverage.townsInRecord),
            })}
          </p>
        </div>
      ) : (
        <motion.div
          key={town.ic}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-8"
        >
          {/* Souhrnná dvojice: celkový objem + doložené platby, proti vrstevníkům. */}
          <div className="grid gap-px border border-ink bg-ink sm:grid-cols-3">
            <div className="bg-paper p-5">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                {t("cardContracts")}
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums">{f.czk(summary.totalCzk)}</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-steel-aa">
                {t("cardContractsMeta", {
                  contracts: f.int(summary.contractCount),
                  suppliers: f.int(summary.supplierCount),
                })}
              </p>
            </div>
            <div className="bg-paper p-5">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                {t("cardPaid")}
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums">{f.czk(summary.paidCzk)}</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-steel-aa">
                {t("cardPaidMeta", { count: f.int(summary.paidContractCount) })}
              </p>
            </div>
            <div className="bg-paper p-5">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                {t("cardPeerMedian")}
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums">
                {peerTotals.medianCzk === null ? "—" : f.czk(peerTotals.medianCzk)}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-steel-aa">
                {t("cardPeerMeta", { band: bandLabel, scope: scopeLabel, count: f.int(peerTotals.sampleSize) })}
                {group.scope === "celostátní" ? ` ${t("cardPeerNationwide", { min: MIN_PEERS })}` : ""}
              </p>
            </div>
          </div>

          {/* Vrstva vazeb na poslance — živá, nebo přiznaně nedostupná. */}
          {ties === null || !ties.available ? (
            <p className="mt-3 max-w-3xl font-mono text-xs leading-relaxed text-steel-aa">
              {t("tiesUnavailable")}
            </p>
          ) : (
            <p className="mt-3 max-w-3xl font-mono text-xs leading-relaxed text-steel-aa">
              {t("tiesLive", { pass: f.int(ties.pass) })}
            </p>
          )}

          {/* Protistrany. */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left">
              <thead>
                <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel-aa">
                  <th className="py-3 pr-4 font-bold">{t("thSupplier")}</th>
                  <th className="py-3 pr-4 font-bold">{t("thVolume")}</th>
                  <th className="py-3 pr-4 text-right font-bold">{t("thContracts")}</th>
                  <th className="py-3 pr-4 text-right font-bold">{t("thPaid")}</th>
                  <th className="py-3 pr-4 text-right font-bold">{t("thPeerMedian")}</th>
                  <th className="py-3 text-right font-bold">{t("thYears")}</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((r) => {
                  const peer = supplierPeerStats(r.supplierIco, peerIcs, table);
                  const rowTies = ties?.available ? (ties.ties[r.supplierIco] ?? []) : [];
                  return (
                    <tr key={r.supplierIco} className="border-b border-hairline align-top transition-colors hover:bg-paper-strong">
                      <td className="py-3.5 pr-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-black uppercase tracking-tight">{r.supplierName}</span>
                          <GraphLinkButton companyId={r.companyId} companyName={r.supplierName} />
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                          {t("supplierIco", { ico: r.supplierIco })}
                        </p>
                        {rowTies.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {rowTies.map((tie) => (
                              <li key={`${tie.pspId}`} className="font-mono text-[11px] leading-snug">
                                <Link
                                  href={`/penize/${tie.pspId}`}
                                  className={`font-bold underline decoration-hairline underline-offset-2 transition-colors hover:decoration-ink ${
                                    tie.reviewState === "verified" ? "text-ink" : "text-steel-aa"
                                  }`}
                                >
                                  {tie.personName}
                                </Link>
                                <span className="text-steel-aa">
                                  {" "}
                                  · {tie.role || t("roleUnknown")} ·{" "}
                                  {tie.reviewState === "verified" ? (
                                    <span className="font-bold text-ink">{t("tieVerified")}</span>
                                  ) : (
                                    <span className="font-bold text-signal-deep">{t("tieNeedsReview")}</span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="flex items-center gap-3">
                          <span className="h-3 w-36 bg-hairline">
                            <span
                              className="block h-full bg-ink"
                              style={{ width: `${Math.min(100, Math.max(2, (rowTotalCzk(r) / maxRowCzk) * 100))}%` }}
                            />
                          </span>
                          <span className="font-mono text-sm font-bold tabular-nums">{f.czk(rowTotalCzk(r))}</span>
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums text-steel-aa">
                        {f.int(rowTotalCount(r))}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums">
                        {r.paidCzk > 0 ? (
                          f.czk(r.paidCzk)
                        ) : (
                          <span className="text-steel-aa">{t("directionUnknown")}</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono text-sm tabular-nums text-steel-aa">
                        {peer.medianCzk === null ? (
                          <span>{t("noPeerRecord")}</span>
                        ) : (
                          <>
                            {f.czk(peer.medianCzk)}
                            <span className="ml-1 text-[10px]">
                              {t("peerTownCount", { count: f.int(peer.peerTownCount) })}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 text-right font-mono text-sm tabular-nums text-steel-aa">
                        {r.firstYear === null ? "—" : r.firstYear === r.lastYear ? r.firstYear : `${r.firstYear}–${r.lastYear}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {restRows.length > 0 && (
            <p className="mt-3 font-mono text-xs tabular-nums text-steel-aa">
              {t("restRow", { count: f.int(restRows.length), sum: f.czk(restCzk), top: TOP_SUPPLIERS })}
            </p>
          )}
          <div className="mt-4">
            <SourceNote>{sourceLine}</SourceNote>
          </div>
          <p className="mt-4 max-w-3xl text-sm italic leading-relaxed text-steel-aa">
            {t("trailFootnote")}
          </p>
        </motion.div>
      )}
    </section>
  );
}
