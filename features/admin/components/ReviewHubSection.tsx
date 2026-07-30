"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { czech, czechInt } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import type { ReviewHubData } from "../adminTypes";

const SEVERITY_TONE: Record<string, string> = {
  high: "bg-signal text-paper",
  medium: "bg-ochre text-ink",
  low: "bg-hairline text-ink",
};

function TierRow({ label, n, of }: { label: string; n: number; of: number }) {
  const w = of > 0 ? Math.round((n / of) * 1000) / 10 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-widest text-steel">{label}</span>
      <div className="h-2 flex-1 border border-ink bg-paper">
        <div className="h-full bg-cobalt" style={{ width: `${w}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums">{czechInt(n)}</span>
    </div>
  );
}

/** Everything `pending_review` in one place: the 211 MP↔company ties by tier,
 *  the gated forensic bill verdicts, the two web-lead dossiers, and the
 *  human-gate audit trail — the operator's review session cockpit. */
export default function ReviewHubSection({ data }: { data: ReviewHubData }) {
  const { ties, forensic, leads, audit } = data;

  return (
    <div className="grid gap-px border border-ink bg-ink lg:grid-cols-2">
      {/* ── Ties (Case ① kniha vazeb) ─────────────────────────────── */}
      <div className="flex flex-col gap-4 bg-paper p-6">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-black uppercase tracking-tight">Vazby MP ↔ firma</h3>
          {ties && (
            <Link
              href={ties.kontrolaHref}
              className="group flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-signal hover:underline"
            >
              kontrola <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )}
        </div>
        {ties ? (
          <>
            <div className="grid grid-cols-3 gap-4 border-b border-hairline pb-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-steel">ověřeno</p>
                <p className="font-mono text-lg tabular-nums">{czechInt(ties.verified)}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-steel">čeká</p>
                <p className="font-mono text-lg tabular-nums text-signal">{czechInt(ties.pending)}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-steel">zamítnuto</p>
                <p className="font-mono text-lg tabular-nums">{czechInt(ties.rejected)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[11px] uppercase tracking-widest text-steel">pořadí revize (tier)</p>
              <TierRow label="tier 0 — vlastník" n={ties.tiers.tier0} of={ties.total} />
              <TierRow label="tier 1 — manažer" n={ties.tiers.tier1} of={ties.total} />
              <TierRow label="tier 2 — dozor" n={ties.tiers.tier2} of={ties.total} />
              <TierRow label="tier 3 — nepotvrzeno" n={ties.tiers.tier3} of={ties.total} />
            </div>
            <SourceNote>zdroj: kg_edge linked_to, {czechInt(ties.total)} vazeb</SourceNote>
          </>
        ) : (
          <p className="text-sm text-steel">Vazby se nepodařilo načíst z grafu.</p>
        )}
      </div>

      {/* ── Forensic bill verdicts (Case ③) ───────────────────────── */}
      <div className="flex flex-col gap-4 bg-paper p-6">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-black uppercase tracking-tight">Forenzní posudky (zákony)</h3>
          {forensic && (
            <Link
              href={forensic.zakonyHref}
              className="group flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-signal hover:underline"
            >
              /zakony <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )}
        </div>
        {forensic ? (
          <>
            <p className="font-mono text-lg tabular-nums">{czechInt(forensic.total)} tisků s posudkem</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(forensic.bySeverity).map(([sev, n]) => (
                <span key={sev} className={`px-2 py-1 font-mono text-[11px] uppercase tracking-widest ${SEVERITY_TONE[sev] ?? "bg-hairline text-ink"}`}>
                  {sev} · {n}
                </span>
              ))}
            </div>
            <ul className="flex flex-col divide-y divide-hairline border-t-2 border-ink">
              {forensic.items.slice(0, 8).map((it) => (
                <li key={it.tiskId} className="flex items-center justify-between gap-2 py-2">
                  {/* Deep-link by the PUBLIC print number (cislo) — the /zakony/[cislo]
                      dossier route; never the internal tiskId (a documented trap). */}
                  {it.cislo != null ? (
                    <Link href={`/zakony/${it.cislo}`} className="truncate text-sm hover:text-signal hover:underline">
                      {it.title}
                    </Link>
                  ) : (
                    <span className="truncate text-sm">{it.title}</span>
                  )}
                  <span className={`shrink-0 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${SEVERITY_TONE[it.severity] ?? "bg-hairline text-ink"}`}>
                    {it.severity}
                  </span>
                </li>
              ))}
            </ul>
            <SourceNote>zdroj: kg_node bill.forensic_*, {czechInt(forensic.total)} posudků</SourceNote>
          </>
        ) : (
          <p className="text-sm text-steel">Žádný forenzní posudek zatím nebyl materializován.</p>
        )}
      </div>

      {/* ── Money leads (Q-money-5/6 class) ───────────────────────── */}
      <div className="flex flex-col gap-4 bg-paper p-6">
        <h3 className="text-lg font-black uppercase tracking-tight">Vedoucí stopy (leads)</h3>
        {leads.length > 0 ? (
          <ul className="flex flex-col divide-y divide-hairline border-t-2 border-ink">
            {leads.map((l) => (
              <li key={l.leadId} className="flex flex-col gap-1 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal">{l.leadId}</span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-steel">
                    {l.confidence ?? "?"} důvěra{l.signalScore != null ? ` · signál ${czech(l.signalScore)}` : ""}
                  </span>
                </div>
                <p className="text-sm font-bold">{l.subjectName}</p>
                {l.note && <p className="text-sm leading-relaxed text-steel">{l.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-steel">Žádná stopa zatím nedosáhla stavu pending_review.</p>
        )}
        <SourceNote>zdroj: case-money/payloads/batch-NNN-lead-*.json (dosud NEaplikováno do grafu)</SourceNote>
      </div>

      {/* ── Review audit trail ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 bg-paper p-6">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-lg font-black uppercase tracking-tight">Audit revizí</h3>
          {/* Batch 2C: každé rozhodnutí zapsané sem je zároveň veřejný záznam. */}
          <Link
            href="/dukazy"
            className="group flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-signal hover:underline"
          >
            zveřejněno v Deníku důkazů <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
        {audit ? (
          <>
            <p className="font-mono text-lg tabular-nums">{czechInt(audit.totalDecisions)} rozhodnutí</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(audit.byDecision).map(([d, n]) => (
                <span key={d} className="bg-hairline px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-ink">
                  {d} · {n}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(audit.byReviewer).map(([r, n]) => (
                <span key={r} className="border border-ink px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-ink">
                  {r} · {n}
                </span>
              ))}
            </div>
            <SourceNote>{audit.lastDecidedAt ? `poslední rozhodnutí: ${audit.lastDecidedAt}` : "zdroj: review_audit"}</SourceNote>
          </>
        ) : (
          <p className="text-sm text-steel">Zatím žádné rozhodnutí zapsáno do review_audit.</p>
        )}
      </div>
    </div>
  );
}
