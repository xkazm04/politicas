"use client";

/*
 * Ověřovací konzole (/penize/kontrola) — lidská kontrola 260 nepotvrzených vazeb
 * poslanec↔firma (Case ① FollowTheMoney). KAŽDÁ vazba je human-gated: konzole
 * NIKDY nepřepíná review_state sama od sebe — volá jediný zápisový vstup na
 * platformě, `submitReviewDecision` (server action), který stojí PŘED
 * `ReviewRepository.setTieReviewState` (jediný kód, co kdy smí zapsat
 * `review_state`). Rozhodnutí se zobrazí OPTIMISTICKY hned po kliknutí a pak se
 * sesouhlasí se skutečným výsledkem zápisu — chybové stavy (zápis nenastaven /
 * neautorizováno / síťová chyba) jsou zřetelně odlišené, nikdy tiché.
 *
 * Když REVIEWER_TOKEN není v env nastavený vůbec, server to řekne narovinu
 * (`not-configured`) a konzole se drží čestného read-only stavu — banner
 * „zápis čeká na backend" se ukazuje JEN v tomto případě, ne jako výchozí.
 *
 * Značka Politicas: důkaz na prvním místě (SourceNote u každého čísla), čeština
 * napřed, barvy jen z tokenů. Data čte server-only getVerificationQueue().
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { useLocale } from "next-intl";
import { compactCzk, temporalBadge } from "../moneyTypes";
import { submitReviewDecision } from "../reviewActions";

const BADGE_TONE_CLS: Record<string, string> = {
  current: "border-cobalt text-cobalt",
  ended: "border-hairline text-steel",
  warn: "border-ochre bg-ochre/15 text-ink",
  unknown: "border-dashed border-hairline text-steel",
};
import type { ReviewDecision, ReviewQueue, ReviewTie, TieClass } from "../reviewTypes";

const CLASS_LABEL: Record<TieClass, string> = {
  "owner-operator": "vlastník / jednatel",
  manager: "představenstvo",
  steward: "dozorčí / správní",
};

const DECISIONS: { key: ReviewDecision; label: string; cls: string }[] = [
  { key: "confirm", label: "Potvrdit", cls: "border-cobalt text-cobalt hover:bg-cobalt hover:text-paper" },
  { key: "needs-more", label: "Doplnit", cls: "border-ochre text-ink hover:bg-ochre" },
  { key: "reject", label: "Zamítnout", cls: "border-signal text-signal hover:bg-signal hover:text-paper" },
];
const DECISION_LABEL: Record<ReviewDecision, string> = {
  confirm: "navrženo potvrdit",
  "needs-more": "vyžádáno doplnění",
  reject: "navrženo zamítnout",
};

/** Per-tie write status — drives the optimistic-then-reconciled UI on each card. */
type WritePhase = "idle" | "pending" | "done" | "not-configured" | "unauthorized" | "error";
interface WriteStatus {
  phase: WritePhase;
  message?: string;
}

type ClassFilter = TieClass | "all";

export default function VerificationConsole({
  data,
  writeConfigured,
  reviewerName,
}: {
  data: ReviewQueue | null;
  /** Whether REVIEWER_TOKEN is set server-side — gates the live-write UI vs. the honest stub. */
  writeConfigured: boolean;
  /** process.env.REVIEWER_NAME, display-only (not a secret) — null if unset. */
  reviewerName: string | null;
}) {
  const locale = useLocale();
  const int = (n: number) => n.toLocaleString(locale === "en" ? "en-US" : "cs-CZ");
  const [filter, setFilter] = useState<ClassFilter>("all");
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [writeStatus, setWriteStatus] = useState<Record<string, WriteStatus>>({});
  const [token, setToken] = useState("");

  const shown = useMemo(
    () => (data ? (filter === "all" ? data.ties : data.ties.filter((t) => t.tieClass === filter)) : []),
    [data, filter],
  );

  async function handleDecide(tie: ReviewTie, decision: ReviewDecision) {
    if (!writeConfigured) {
      // No write path configured server-side — keep the old local-scratch behavior
      // (toggle a decision on/off) so the console stays USABLE for prep work
      // even without a wired backend, but never pretends anything was written.
      setDecisions((prev) => {
        const next = { ...prev };
        if (prev[tie.id] === decision) delete next[tie.id];
        else next[tie.id] = decision;
        return next;
      });
      return;
    }

    // optimistic: show the decision immediately, reconcile with the real result after.
    setDecisions((prev) => ({ ...prev, [tie.id]: decision }));
    setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "pending" } }));

    const result = await submitReviewDecision({ src: tie.src, dst: tie.dst, decision, note: null, token });

    if (result.status === "ok") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "done", message: result.reviewState } }));
    } else if (result.status === "not-configured") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "not-configured" } }));
    } else if (result.status === "unauthorized") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "unauthorized" } }));
    } else if (result.status === "not-found") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "error", message: "vazba v grafu nenalezena" } }));
    } else {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "error", message: result.message } }));
    }
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-paper font-sans text-ink">
        <Shell>
          <div className="border-2 border-dashed border-hairline p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-steel">zdroj: znalostní graf</p>
            <p className="mt-3 text-lg">
              Peněžní vrstva grafu není v tomto prostředí materializovaná — konzole nemá co kontrolovat.
            </p>
          </div>
        </Shell>
      </main>
    );
  }

  const decidedCount = Object.keys(decisions).length;

  const TILES = [
    { label: "nepotvrzené vazby", value: int(data.stats.pending), sub: "čekají na lidskou kontrolu", src: "kg_edge linked_to · pending_review" },
    { label: "vlastník / jednatel", value: int(data.stats.ownerOperator), sub: "soukromá firma dodávající státu", src: "role × právní forma (heuristika)" },
    { label: "úplný trojúhelník", value: int(data.stats.triangles), sub: "zakázky + dotace + dar straně", src: "props firmy v kg_node" },
    { label: "dosažitelné veřejné peníze", value: compactCzk(data.stats.totalReachableCzk, locale), sub: "napříč nepotvrzenými vazbami", src: "Σ supplies + subsidies_total_czk" },
  ];

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <Shell>
        {writeConfigured ? (
          // live-write banner — the write path IS wired; reviewer identifies with a shared token.
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-l-4 border-cobalt bg-cobalt/10 px-4 py-3">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">zápis aktivní</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-steel">
                Rozhodnutí se zapisují do <span className="font-mono">review_audit</span> a teprve poté do{" "}
                <span className="font-mono">review_state</span> vazby — každý zápis je auditovaný.
                {reviewerName ? (
                  <>
                    {" "}Recenzent: <span className="font-bold text-ink">{reviewerName}</span>.
                  </>
                ) : null}
              </p>
            </div>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-steel">token recenzenta</span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="REVIEWER_TOKEN"
                autoComplete="off"
                className="border-2 border-hairline bg-paper px-2 py-1 font-mono text-xs text-ink outline-none focus:border-cobalt"
              />
            </label>
          </div>
        ) : (
          // stub-write banner — the honest not-configured state, ONLY when actually not-configured.
          <div className="mb-8 border-l-4 border-ochre bg-ochre/10 px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">zápis čeká na backend</p>
            <p className="mt-1 text-sm leading-relaxed text-steel">
              Rozhodnutí se zatím zaznamenávají jen lokálně v prohlížeči. Zápisové API pro schválení
              vazby (změnu <span className="font-mono">review_state</span>) není v tomto prostředí nastavené
              (chybí <span className="font-mono">REVIEWER_TOKEN</span>) — lidská brána zůstává nedotčená. Konzole
              slouží k přípravě rozhodnutí a k prokliku do primárních rejstříků.
            </p>
          </div>
        )}

        {/* summary tiles */}
        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map((tile) => (
            <div key={tile.label} className="bg-paper p-6">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel">{tile.label}</p>
              <p className="mt-3 text-4xl font-black tabular-nums tracking-tight">{tile.value}</p>
              <p className="mt-2 text-sm text-steel">{tile.sub}</p>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel">zdroj: {tile.src}</div>
            </div>
          ))}
        </div>

        {/* filter + progress */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink pb-3">
          <div className="flex flex-wrap gap-2">
            {(["all", "owner-operator", "manager", "steward"] as ClassFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  filter === c ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:border-ink hover:text-ink"
                }`}
              >
                {c === "all" ? "vše" : CLASS_LABEL[c]}
                <span className="ml-1.5 font-normal">
                  {c === "all"
                    ? int(data.stats.pending)
                    : int(c === "owner-operator" ? data.stats.ownerOperator : c === "manager" ? data.stats.manager : data.stats.steward)}
                </span>
              </button>
            ))}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-steel">
            {writeConfigured ? "zapsáno" : "rozhodnuto lokálně"}: <span className="font-bold text-ink">{int(decidedCount)}</span> / {int(data.stats.pending)}
          </p>
        </div>

        {/* review cards — value order (deterministic signal) */}
        <div className="mt-8 space-y-6">
          {shown.map((tie) => (
            <ReviewCard
              key={tie.id}
              tie={tie}
              locale={locale}
              int={int}
              decision={decisions[tie.id] ?? null}
              writeConfigured={writeConfigured}
              writeStatus={writeStatus[tie.id] ?? { phase: "idle" }}
              onDecide={(d) => handleDecide(tie, d)}
            />
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-sm italic leading-relaxed text-steel">
          Pořadí je dané deterministickým skóre signálu (peněžní objem × třída vazby × trojúhelník ×
          blízkost limitu). Korroborace v primárním rejstříku pouze zvyšuje důvěru recenzenta — potvrdit
          vazbu může jedině člověk. Řazení ani skóre nejsou obvinění.
        </p>
      </Shell>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/penize" className="flex items-center gap-3 transition-colors hover:text-signal">
              <span className="text-xl font-black uppercase tracking-tight">Politicas</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ penize / kontrola</span>
          </div>
          <Link
            href="/penize"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> síť peněz
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-widest text-signal">ověřovací konzole · pilíř integrita</p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Kontrola vazeb<span className="text-signal">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
          Každá vazba poslanec↔firma je automaticky nalezený <em>vodítko</em>, ne fakt. Tady ji člověk
          ověří proti primárním rejstříkům — obchodní rejstřík (ARES VR), Registr smluv, Hlídač státu —
          a teprve pak se z ní může stát potvrzená vazba.
        </p>
        <div className="mt-8">{children}</div>
      </div>
    </>
  );
}

function ReviewCard({
  tie,
  locale,
  int,
  decision,
  writeConfigured,
  writeStatus,
  onDecide,
}: {
  tie: ReviewTie;
  locale: string;
  int: (n: number) => string;
  decision: ReviewDecision | null;
  writeConfigured: boolean;
  writeStatus: WriteStatus;
  onDecide: (d: ReviewDecision) => void;
}) {
  const reach = tie.contractCzk + tie.subsidiesCzk;
  const period = `${tie.periodFrom ?? "?"} – ${tie.periodTo ?? "„trvá“"}`;
  const links: { label: string; href: string }[] = [
    { label: "ARES subjekt", href: tie.links.aresSubject },
    { label: "ARES VR (statutáři)", href: tie.links.aresVr },
    { label: "obchodní rejstřík", href: tie.links.justiceVr },
    { label: "Registr smluv", href: tie.links.registrSmluv },
    { label: "Hlídač firma", href: tie.links.hlidacSubjekt },
    ...(tie.links.hlidacPerson ? [{ label: "Hlídač osoba", href: tie.links.hlidacPerson }] : []),
  ];

  return (
    <article className={`border-2 ${decision ? "border-ink" : "border-hairline"} bg-paper`}>
      {/* head */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink px-5 py-4">
        <div>
          <Link
            href={`/poslanec/${tie.pspId}`}
            className="group inline-flex items-center gap-1.5 text-lg font-black uppercase tracking-tight transition-colors hover:text-signal"
          >
            {tie.mpName}
            <ArrowUpRight className="h-4 w-4 text-signal transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <span className="ml-2 font-mono text-xs text-steel">{tie.club ? `· ${tie.club}` : ""}</span>
          <p className="mt-1 text-base font-black uppercase tracking-tight text-ink">{tie.company}</p>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">
            IČO {tie.ico}
            {tie.role ? ` · ${tie.role}` : ""} · {period}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
            čeká na kontrolu
          </span>
          {/* ARES-VR temporal-status badge (O-money-2) — replaces a generic "go check
              ARES VR" nudge with the actual registry-confirmed verdict once reconciled. */}
          <span
            className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${BADGE_TONE_CLS[temporalBadge(tie).tone]}`}
          >
            {temporalBadge(tie).labelCs}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel">třída: {CLASS_LABEL[tie.tieClass]}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel">signál {tie.signalScore.toFixed(1)}</span>
        </div>
      </div>

      {/* body: money + flags */}
      <div className="grid gap-5 px-5 py-4 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Metric label="zakázky" value={tie.contractCzk > 0 ? compactCzk(tie.contractCzk, locale) : "—"} sub={`${int(tie.contractCount)} smluv`} />
            <Metric label="dotace" value={tie.subsidiesCzk > 0 ? compactCzk(tie.subsidiesCzk, locale) : "—"} sub={tie.subsidiesCount ? `${int(tie.subsidiesCount)} titulů` : "—"} />
            <Metric
              label="dar straně"
              value={tie.donatedToPartyCzk != null ? compactCzk(tie.donatedToPartyCzk, locale) : "—"}
              sub={tie.donationRecipientParty ?? "—"}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tie.triangle && <Flag>úplný trojúhelník</Flag>}
            {tie.nearThresholdCount > 0 && <Flag>{int(tie.nearThresholdCount)}× u limitu</Flag>}
            {tie.periodTo === null && !tie.corroboration && (
              <Flag>období „trvá“ (dle Hlídače) — ověřit v ARES VR</Flag>
            )}
            {tie.corroboration && tie.roleValidFrom && (
              <Flag>
                ARES VR: {tie.roleValidFrom} – {tie.roleValidTo ?? "trvá"}
              </Flag>
            )}
            {tie.deMinimis && <Flag>bagatelní objem</Flag>}
            {tie.absenteeManagerLead && <Flag>křížení s Case ② (manažer)</Flag>}
          </div>
          <p className="mt-4 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
            zdroj: {tie.source || "—"}
          </p>
        </div>

        {/* registry deep-links + reachable total */}
        <div className="border-l-2 border-hairline pl-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel">dosažitelné veřejné peníze</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-signal">{reach > 0 ? compactCzk(reach, locale) : "—"}</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel">ověřit v rejstříku</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {links.map((l) => (
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

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2 border-t-2 border-hairline px-5 py-3">
        {DECISIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            disabled={writeStatus.phase === "pending"}
            onClick={() => onDecide(d.key)}
            className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              decision === d.key ? "bg-ink text-paper border-ink" : d.cls
            }`}
          >
            {d.label}
          </button>
        ))}
        {decision && <WriteStatusNote decision={decision} writeConfigured={writeConfigured} status={writeStatus} />}
      </div>
    </article>
  );
}

/** Honest, clearly-visible reconciliation of the optimistic decision with the real
 *  write result — a not-configured state and a network/validation error must never
 *  look the same, and neither may look like a successful write. */
function WriteStatusNote({
  decision,
  writeConfigured,
  status,
}: {
  decision: ReviewDecision;
  writeConfigured: boolean;
  status: WriteStatus;
}) {
  if (!writeConfigured) {
    return (
      <span className="ml-1 font-mono text-[10px] uppercase tracking-widest text-steel">
        {DECISION_LABEL[decision]} · zápis čeká na backend
      </span>
    );
  }
  switch (status.phase) {
    case "pending":
      return (
        <span className="ml-1 font-mono text-[10px] uppercase tracking-widest text-steel">zapisuje se…</span>
      );
    case "done":
      return (
        <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-widest text-cobalt">
          zapsáno · review_state = {status.message}
        </span>
      );
    case "not-configured":
      return (
        <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-widest text-ochre">
          zápis není nastavený (chybí REVIEWER_TOKEN)
        </span>
      );
    case "unauthorized":
      return (
        <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-widest text-signal">
          neplatný token recenzenta
        </span>
      );
    case "error":
      return (
        <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-widest text-signal">
          chyba zápisu{status.message ? `: ${status.message}` : ""}
        </span>
      );
    default:
      return (
        <span className="ml-1 font-mono text-[10px] uppercase tracking-widest text-steel">
          {DECISION_LABEL[decision]}
        </span>
      );
  }
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
