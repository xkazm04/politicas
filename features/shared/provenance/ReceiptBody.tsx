"use client";

/*
 * TĚLO ÚČTENKY — jeden sazeč pro kapsli i stránku /zdroj.
 *
 * Muzejní účtenka v řeči Konstruktu: tvrzení jako plakátový řádek, stav lidské
 * brány jako štítek, provenience a registry jako mono metadata. Kapsle
 * (ProvenanceCapsule) i stránka (ReceiptPage) sázejí TENTÝŽ komponent, takže
 * popover a trvalá adresa nikdy neukazují dvě různé účtenky téhož tvrzení.
 *
 * Copy je záměrně česky přímo v komponentě (vzor ExhibitPage.tsx):
 * messages/*.json je sdílený soubor napříč paralelně stavěnými plochami
 * a tahle plocha do něj proto nezapisuje.
 */

import { ArrowUpRight } from "lucide-react";
import { czechDate } from "@/lib/format";
import type { ReceiptEndpoint, ProvenanceReceipt, ReviewStatus } from "./receipt";
import { formatWeightCs } from "./receipt";

const GATE_BADGE: Record<ReviewStatus, { label: string; cls: string }> = {
  verified: { label: "ověřeno člověkem", cls: "border-cobalt text-cobalt" },
  pending_review: { label: "čeká na kontrolu", cls: "border-ochre bg-ochre/15 text-ink" },
  rejected: { label: "zamítnuto při kontrole", cls: "border-steel text-steel-aa" },
};

const TIER_LABEL: Record<string, string> = {
  detail: "detail",
  search: "vyhledávání",
};

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-hairline py-1.5 last:border-b-0">
      <dt className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">{label}</dt>
      <dd className="text-right font-mono text-xs text-ink">{children}</dd>
    </div>
  );
}

/** Registry jednoho koncového bodu — jen uložené identifikátory, nic hádaného. */
function EndpointSources({ endpoint }: { endpoint: ReceiptEndpoint }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
        {endpoint.label}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-steel-aa">
        {endpoint.citable ?? "zdroj není v záznamu"}
      </p>
      {endpoint.links.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {endpoint.links.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
              >
                {l.registry}
                <span className="text-steel-aa no-underline">· {TIER_LABEL[l.tier] ?? l.tier}</span>
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReceiptBody({ receipt }: { receipt: ProvenanceReceipt }) {
  const gate = receipt.kind === "edge" ? receipt.gate : null;
  const badge = gate ? GATE_BADGE[gate.status] : null;

  return (
    <div>
      {/* ── tvrzení ────────────────────────────────────────────── */}
      <p className="text-lg font-black uppercase leading-snug tracking-tight text-ink">
        {receipt.subject.label}
        {receipt.kind === "edge" && (
          <>
            {" "}
            <span className="font-mono text-xs font-normal normal-case tracking-normal text-steel-aa">
              — {receipt.relLabel} —
            </span>{" "}
            {receipt.object.label}
          </>
        )}
        <span className="text-signal">.</span>
      </p>

      {/* ── stav lidské brány — nezaměnitelný, ale klidný ─────── */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {badge && gate ? (
          <>
            <span
              className={`border-2 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${badge.cls}`}
            >
              {badge.label}
            </span>
            {gate.reviewer && (
              <span className="font-mono text-[11px] text-steel-aa">
                {gate.reviewer}
                {gate.reviewedAt ? ` · ${czechDate(gate.reviewedAt)}` : ""}
              </span>
            )}
          </>
        ) : (
          <span className="border-2 border-hairline px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
            deterministické odvození — bez lidské brány
          </span>
        )}
      </div>
      {gate?.note && (
        <p className="mt-2 border-l-4 border-hairline pl-3 font-mono text-xs leading-relaxed text-steel-aa">
          poznámka kontroly: {gate.note}
        </p>
      )}

      {/* ── záznam grafu ──────────────────────────────────────── */}
      <dl className="mt-4 border-t-2 border-ink">
        {receipt.kind === "edge" && (
          <MetaRow label="relace">{receipt.rel}</MetaRow>
        )}
        {receipt.kind === "edge" && receipt.weight !== null && (
          <MetaRow label="váha záznamu">{formatWeightCs(receipt.weight)}</MetaRow>
        )}
        {receipt.provenance.method && <MetaRow label="metoda">{receipt.provenance.method}</MetaRow>}
        {receipt.provenance.pass !== null && (
          <MetaRow label="průchod grafu">č. {receipt.provenance.pass}</MetaRow>
        )}
        {receipt.provenance.computedAt && (
          <MetaRow label="odvozeno">{czechDate(receipt.provenance.computedAt)}</MetaRow>
        )}
        {receipt.provenance.ref && <MetaRow label="podklad">{receipt.provenance.ref}</MetaRow>}
      </dl>

      {/* ── kde si to ověříte sami ────────────────────────────── */}
      <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
        veřejné registry
      </p>
      <div className={`mt-2 grid gap-4 ${receipt.kind === "edge" ? "sm:grid-cols-2" : ""}`}>
        <EndpointSources endpoint={receipt.subject} />
        {receipt.kind === "edge" && <EndpointSources endpoint={receipt.object} />}
      </div>

      {/* ── auditní stopa rozhodnutí ──────────────────────────── */}
      {gate && gate.audit.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
            auditní stopa
          </p>
          <ul className="mt-1.5 space-y-1">
            {gate.audit.map((a, i) => (
              <li key={`${a.decidedAt}-${i}`} className="font-mono text-xs text-steel-aa">
                <span className="font-bold text-ink">{czechDate(a.decidedAt)}</span>{" "}
                {a.decision === "confirm"
                  ? "potvrzeno"
                  : a.decision === "reject"
                    ? "zamítnuto"
                    : "vráceno k doplnění"}{" "}
                · {a.reviewer}
                {a.note ? ` · ${a.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
