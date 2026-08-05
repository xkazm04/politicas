"use client";

/*
 * TĚLO ÚČTENKY — jeden sazeč pro kapsli i stránku /zdroj.
 *
 * Muzejní účtenka v řeči Konstruktu: tvrzení jako plakátový řádek, stav lidské
 * brány jako štítek, provenience a registry jako mono metadata. Kapsle
 * (ProvenanceCapsule) i stránka (ReceiptPage) sázejí TENTÝŽ komponent, takže
 * popover a trvalá adresa nikdy neukazují dvě různé účtenky téhož tvrzení.
 *
 * COPY JE V KATALOGU (2026-08-05): čtenářské věty žijí v messages/{cs,en}.json
 * pod `shared.receipt.*` a komponenta je sází přes next-intl — čisté odvození
 * (receipt.ts) vrací data a klíče, ne text.
 */

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useFormat } from "@/lib/i18n/useFormat";
import { caseFileLinkFor } from "./caseFileLink";
import type { ReceiptEndpoint, ProvenanceReceipt, ReviewStatus } from "./receipt";
import { formatWeight, relLabelKey } from "./receipt";

/** Překladač namespace `shared` — jediný typ, který si dílčí sazba předává. */
type T = ReturnType<typeof useTranslations<"shared">>;

const CASE_FILE_LABEL_KEY: Record<"poslanec" | "firma", string> = {
  poslanec: "receipt.caseFile.poslanec",
  firma: "receipt.caseFile.firma",
};

const GATE_BADGE: Record<ReviewStatus, { labelKey: string; cls: string }> = {
  verified: { labelKey: "receipt.gate.verified", cls: "border-cobalt text-cobalt" },
  pending_review: { labelKey: "receipt.gate.pending", cls: "border-ochre bg-ochre/15 text-ink" },
  rejected: { labelKey: "receipt.gate.rejected", cls: "border-steel text-steel-aa" },
};

/** Známé úrovně odkazů do registrů; neznámá úroveň se vypíše doslova. */
const TIER_LABEL_KEY: Record<string, string> = {
  detail: "receipt.tier.detail",
  search: "receipt.tier.search",
};

const AUDIT_DECISION_KEY: Record<string, string> = {
  confirm: "receipt.audit.confirm",
  reject: "receipt.audit.reject",
};

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-hairline py-1.5 last:border-b-0">
      <dt className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">{label}</dt>
      <dd className="text-right font-mono text-xs text-ink">{children}</dd>
    </div>
  );
}

/** Registry jednoho koncového bodu — jen uložené identifikátory, nic hádaného.
 *  Plus spis na NAŠÍ ploše, existuje-li pro tenhle tvar id (caseFileLink). */
function EndpointSources({ endpoint, t }: { endpoint: ReceiptEndpoint; t: T }) {
  const caseFile = caseFileLinkFor(endpoint);
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
        {endpoint.label}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-steel-aa">
        {endpoint.citable ?? t("receipt.noCitable")}
      </p>
      {caseFile && (
        <p className="mt-1">
          <Link
            href={caseFile.href}
            className="inline-flex items-center gap-1 font-mono text-xs text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
          >
            {t(CASE_FILE_LABEL_KEY[caseFile.target])}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </p>
      )}
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
                <span className="text-steel-aa no-underline">
                  · {TIER_LABEL_KEY[l.tier] ? t(TIER_LABEL_KEY[l.tier]) : l.tier}
                </span>
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
  const t = useTranslations("shared");
  const locale = useLocale();
  const f = useFormat();
  const gate = receipt.kind === "edge" ? receipt.gate : null;
  const badge = gate ? GATE_BADGE[gate.status] : null;
  // Relace jde katalogem (relLabelKey); neznámá relace se vypíše doslova —
  // strojový token se nikdy nepovyšuje na větu.
  const relKey = receipt.kind === "edge" ? relLabelKey(receipt.rel) : null;

  return (
    <div>
      {/* ── tvrzení ────────────────────────────────────────────── */}
      <p className="text-lg font-black uppercase leading-snug tracking-tight text-ink">
        {receipt.subject.label}
        {receipt.kind === "edge" && (
          <>
            {" "}
            <span className="font-mono text-xs font-normal normal-case tracking-normal text-steel-aa">
              — {relKey ? t(relKey) : receipt.rel} —
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
              {t(badge.labelKey)}
            </span>
            {gate.reviewer && (
              <span className="font-mono text-[11px] text-steel-aa">
                {gate.reviewer}
                {gate.reviewedAt ? ` · ${f.date(gate.reviewedAt)}` : ""}
              </span>
            )}
          </>
        ) : (
          <span className="border-2 border-hairline px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">
            {t("receipt.gate.ungated")}
          </span>
        )}
      </div>
      {gate?.note && (
        <p className="mt-2 border-l-4 border-hairline pl-3 font-mono text-xs leading-relaxed text-steel-aa">
          {t("receipt.gate.note", { note: gate.note })}
        </p>
      )}

      {/* ── záznam grafu ──────────────────────────────────────── */}
      <dl className="mt-4 border-t-2 border-ink">
        {receipt.kind === "edge" && (
          <MetaRow label={t("receipt.row.relation")}>{receipt.rel}</MetaRow>
        )}
        {receipt.kind === "edge" && receipt.weight !== null && (
          <MetaRow label={t("receipt.row.weight")}>{formatWeight(receipt.weight, locale)}</MetaRow>
        )}
        {receipt.provenance.method && (
          <MetaRow label={t("receipt.row.method")}>{receipt.provenance.method}</MetaRow>
        )}
        {receipt.provenance.pass !== null && (
          <MetaRow label={t("receipt.row.pass")}>
            {t("receipt.row.passValue", { n: String(receipt.provenance.pass) })}
          </MetaRow>
        )}
        {receipt.provenance.computedAt && (
          <MetaRow label={t("receipt.row.computedAt")}>{f.date(receipt.provenance.computedAt)}</MetaRow>
        )}
        {receipt.provenance.ref && (
          <MetaRow label={t("receipt.row.ref")}>{receipt.provenance.ref}</MetaRow>
        )}
      </dl>

      {/* ── kde si to ověříte sami ────────────────────────────── */}
      <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
        {t("receipt.sourcesKicker")}
      </p>
      <div className={`mt-2 grid gap-4 ${receipt.kind === "edge" ? "sm:grid-cols-2" : ""}`}>
        <EndpointSources endpoint={receipt.subject} t={t} />
        {receipt.kind === "edge" && <EndpointSources endpoint={receipt.object} t={t} />}
      </div>

      {/* ── auditní stopa rozhodnutí ──────────────────────────── */}
      {gate && gate.audit.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
            {t("receipt.auditKicker")}
          </p>
          <ul className="mt-1.5 space-y-1">
            {gate.audit.map((a, i) => (
              <li key={`${a.decidedAt}-${i}`} className="font-mono text-xs text-steel-aa">
                <span className="font-bold text-ink">{f.date(a.decidedAt)}</span>{" "}
                {t(AUDIT_DECISION_KEY[a.decision] ?? "receipt.audit.return")}{" "}
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
