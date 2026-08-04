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
 *
 * D7 (batch 004): a "reject" decision sets a terminal review_state "rejected"
 * (lib/db/pglite/repositories/review.ts), and getVerificationQueue() excludes both
 * rejected and verified ties from the PENDING queue.
 *
 * ROZHODNUTÍ JDE VRÁTIT (2026-08-04). Rozhodnutá vazba se dřív z produktu ztratila
 * úplně — fronta filtruje na `pending_review`, takže potvrzenou ani zamítnutou vazbu
 * nešlo znovu vidět, natož opravit. Brána, kterou člověk nemůže opravit, je jednosměrný
 * zápis, ne brána. Loader teď vrací i `decided` (rozhodnuté vazby s celou historií,
 * kterou sestavuje `gateFromEdge` — TENTÝŽ kód jako kapsle původu na /zdroj), konzole je
 * sází do vlastní sekce a nabízí „vrátit ke kontrole": rozhodnutí `needs-more` vrátí
 * vazbu do fronty a PŘIPÍŠE další záznam do hash-řetězce. Historie se nikdy nepřepisuje
 * ani nemaže, takže `verifyAuditChain` platí i po vrácení; vrácení proto vyžaduje důvod,
 * který v řetězci zůstane (poznámka na hraně se dalším rozhodnutím přepíše).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { useLocale } from "next-intl";
import FlagList from "@/features/shared/components/FlagList";
import { compactCzk, temporalBadge, tieClassOriginInfo } from "../moneyTypes";
import { hasStaleOngoingFlag, tieFlagInfos } from "../tieFlags";
import { submitReviewDecision } from "../reviewActions";
import AnalystNote from "./AnalystNote";

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

// Batch-005 review-order tiers (features/money/reviewTypes.ts::reviewTier) — the order
// the queue is now PRIMARILY sorted by (reviewRank asc), distinct from signalScore.
const TIER_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "potvrzeno OR · vlastník",
  1: "potvrzeno OR · představenstvo",
  2: "potvrzeno OR · dozorčí",
  3: "nepotvrzeno",
};
const TIER_ORDER: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

const DECISION_KEYS: Record<string, ReviewDecision> = { "1": "confirm", "2": "needs-more", "3": "reject" };

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

/** How a PAST decision reads in the audit history. `needs-more` on an already-decided
 *  tie is the reversal path (it returns the tie to `pending_review`), so the history
 *  names it for what it did rather than repeating the raw enum. */
const DECISION_HISTORY_LABEL: Record<string, string> = {
  confirm: "potvrzeno",
  reject: "zamítnuto",
  "needs-more": "vráceno ke kontrole / vyžádáno doplnění",
};

/** Per-tie write status — drives the optimistic-then-reconciled UI on each card. */
type WritePhase =
  | "idle"
  | "pending"
  | "done"
  | "not-configured"
  | "unauthorized"
  /** REVIEWER_TOKEN is set but REVIEWER_NAME is not — the server refuses to stamp an
   *  anonymous row into the audit chain. A misconfiguration, not a failure of the write. */
  | "misconfigured"
  /** A reversal of an already-decided tie arrived without a stated reason. */
  | "reason-required"
  | "error";
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
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // data.ties already arrives sorted by reviewRank ASC (batch-005 review order) — the
  // filter narrows the CLASS but never re-sorts, so tier blocks stay contiguous.
  const shown = useMemo(
    () => (data ? (filter === "all" ? data.ties : data.ties.filter((t) => t.tieClass === filter)) : []),
    [data, filter],
  );

  const handleDecide = useCallback(async (tie: ReviewTie, decision: ReviewDecision, note: string | null) => {
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

    // Real invariant, not just a UI decoration: a write already in flight or already
    // landed for this tie must never be raced or silently overwritten by a second
    // decision. The mouse buttons additionally disable via JSX during "pending", but
    // the keyboard shortcut path (1/2/3) calls handleDecide directly with no such
    // check — this guard is the one place both paths actually enforce it.
    const currentPhase = writeStatus[tie.id]?.phase;
    if (currentPhase === "pending" || currentPhase === "done") return;

    // optimistic: show the decision immediately, reconcile with the real result after.
    setDecisions((prev) => ({ ...prev, [tie.id]: decision }));
    setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "pending" } }));

    const result = await submitReviewDecision({ src: tie.src, dst: tie.dst, decision, note, token });

    if (result.status === "ok") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "done", message: result.reviewState } }));
    } else if (result.status === "not-configured") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "not-configured" } }));
    } else if (result.status === "unauthorized") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "unauthorized" } }));
    } else if (result.status === "not-found") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "error", message: "vazba v grafu nenalezena" } }));
    } else if (result.status === "misconfigured") {
      // The write path is wired but the operator has no name — the server refused BEFORE
      // touching the chain. Its own phase, so it never reads as a network hiccup.
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "misconfigured", message: result.message } }));
    } else if (result.status === "reason-required") {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "reason-required" } }));
    } else {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "error", message: result.message } }));
    }
  }, [writeConfigured, token, writeStatus]);

  // Keyboard flow for a humane 211-tie review session: ↓/↑ (or j/k) move the focused
  // card, 1/2/3 apply confirm/doplnit/zamítnout to the focused card. Disabled while
  // typing in the reviewer-token field so it never steals a keystroke there.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (!shown.length) return;
      const idx = focusedId ? shown.findIndex((t) => t.id === focusedId) : -1;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const next = shown[Math.min(idx + 1, shown.length - 1)] ?? shown[0];
        setFocusedId(next.id);
        document.getElementById(`tie-${next.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prev = shown[Math.max(idx - 1, 0)] ?? shown[0];
        setFocusedId(prev.id);
        document.getElementById(`tie-${prev.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (idx >= 0 && DECISION_KEYS[e.key]) {
        e.preventDefault();
        void handleDecide(shown[idx], DECISION_KEYS[e.key], null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shown, focusedId, handleDecide]);

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

  // D3 (batch 004): "zapsáno" must only count writes that actually landed. When the
  // write path is configured, `decisions` is set OPTIMISTICALLY before the server
  // action resolves (see handleDecide) — counting it directly would report writes
  // that never happened (e.g. a wrong-token confirm on N ties showing "zapsáno: N"
  // with zero rows actually written). Count only ties whose real write result came
  // back "done" (submitReviewDecision returned status "ok"). In the unconfigured
  // local-scratch mode there is no server result to reconcile against, so the
  // optimistic toggle count is already honest.
  const decidedCount = writeConfigured
    ? Object.values(writeStatus).filter((s) => s.phase === "done").length
    : Object.keys(decisions).length;

  // Same honest-counting rule as decidedCount above, broken out per batch-005 review
  // tier — "registry-confirmed owner-operator: X/Y" etc., not just one aggregate number.
  const isTieDecided = (id: string) =>
    writeConfigured ? writeStatus[id]?.phase === "done" : decisions[id] != null;
  const decidedByTier: [number, number, number, number] = [0, 0, 0, 0];
  for (const t of data.ties) if (isTieDecided(t.id)) decidedByTier[t.reviewTier] += 1;

  const TILES = [
    { label: "nepotvrzené vazby", value: int(data.stats.pending), sub: "čekají na lidskou kontrolu", src: "kg_edge linked_to · pending_review" },
    {
      label: "vlastník / jednatel",
      value: int(data.stats.ownerOperator),
      sub: "soukromá firma dodávající státu",
      // The class is no longer always a heuristic: it is read off the edge where a
      // reviewer/analysis batch recorded one. Cite the real mix, not one of the two.
      src: `kg_edge props.tie_class ${int(data.stats.classOrigin.stored)}× · heuristika role × název ${int(data.stats.classOrigin.derived)}×`,
    },
    { label: "úplný trojúhelník", value: int(data.stats.triangles), sub: "zakázky + dotace + dar straně", src: "props firmy v kg_node" },
    {
      // Split, never merged. This tile used to sum per TIE across every class, so the
      // companies tied to more than one MP were counted twice and a hospital's own
      // contracting sat in the same number as a firm an MP owns.
      label: "peníze u firem poslanců",
      value: compactCzk(data.stats.reachable.attributable.contractCzk, locale),
      sub: `${int(data.stats.reachable.attributable.companies)} firem, které poslanci vlastní nebo řídí · dalších ${compactCzk(data.stats.reachable.steward.contractCzk, locale)} u ${int(data.stats.reachable.steward.companies)} institucí, kde poslanec jen zasedá v orgánu — to nejsou jeho peníze`,
      src: "registr smluv · kg_edge supplies.weight, jedna firma jednou",
    },
  ];

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <Shell>
        {/* MISCONFIGURATION, said out loud before a write is attempted. The token is set,
            so the console offers the buttons — but the server will refuse every one of
            them rather than stamp an anonymous row into the tamper-evident chain. The
            banner used to be silent about this: the reviewer sentence was simply omitted. */}
        {writeConfigured && !reviewerName ? (
          <div className="mb-4 border-l-4 border-signal bg-signal/10 px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
              zápis zablokovaný — chybí jméno recenzenta
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-steel">
              <span className="font-mono">REVIEWER_TOKEN</span> je nastavený, ale{" "}
              <span className="font-mono">REVIEWER_NAME</span> ne. Rozhodnutí by do auditní
              stopy vstoupilo bez identifikovatelného člověka — a řetězec, který neumí říct,
              KDO rozhodl, není audit, jen log. Server proto každý zápis odmítne dřív, než se
              cokoli zapíše. Doplňte <span className="font-mono">REVIEWER_NAME</span> do prostředí.
            </p>
          </div>
        ) : null}

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

        {/* filter + progress — sticky so it stays visible while scrolling a 211-card queue */}
        <div className="sticky top-0 z-10 mt-10 space-y-3 border-b-2 border-ink bg-paper/95 pb-3 pt-2 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
              <span className="ml-2 hidden text-steel sm:inline">· ↑↓ pohyb · 1/2/3 potvrdit/doplnit/zamítnout</span>
            </p>
          </div>
          {/* per-tier progress (batch-005): the review-order axis, not just one aggregate */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-steel">
            {TIER_ORDER.map((tier) => (
              <span key={tier}>
                {TIER_LABEL[tier]}: <span className="font-bold text-ink">{int(decidedByTier[tier])}</span> / {int(data.stats.tierCounts[tier])}
              </span>
            ))}
          </div>
        </div>

        {/* review cards — batch-005 review order (tier asc, reachable CZK desc within tier) */}
        <div className="mt-8 space-y-6">
          {shown.map((tie, i) => {
            const showTierHeader = i === 0 || shown[i - 1].reviewTier !== tie.reviewTier;
            return (
              <div key={tie.id}>
                {showTierHeader && (
                  <p className="mb-3 border-l-4 border-signal pl-3 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                    {TIER_LABEL[tie.reviewTier]} <span className="font-normal">({int(data.stats.tierCounts[tie.reviewTier])})</span>
                  </p>
                )}
                <ReviewCard
                  tie={tie}
                  locale={locale}
                  int={int}
                  decision={decisions[tie.id] ?? null}
                  writeConfigured={writeConfigured}
                  writeStatus={writeStatus[tie.id] ?? { phase: "idle" }}
                  focused={focusedId === tie.id}
                  onFocus={() => setFocusedId(tie.id)}
                  onDecide={(d, note) => handleDecide(tie, d, note)}
                />
              </div>
            );
          })}
        </div>

        {/* ROZHODNUTÉ VAZBY. Do 2026-08-04 vazba po rozhodnutí z produktu zmizela: fronta
            filtruje na `pending_review`, takže potvrzenou ani zamítnutou vazbu nešlo
            znovu vidět, natož opravit. Brána, kterou člověk nemůže opravit, není brána,
            ale jednosměrný zápis. Historii sestavuje `gateFromEdge` — tentýž kód, který
            ji sází na /zdroj, ne druhá kopie. */}
        <section className="mt-14 border-t-4 border-ink pt-8">
          <h2 className="text-2xl font-black uppercase tracking-tight">
            Rozhodnuté vazby<span className="text-signal">.</span>
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-steel">
            Vazby, o kterých už člověk rozhodl — potvrzené i zamítnuté. Rozhodnutí jde{" "}
            <span className="font-bold text-ink">vrátit ke kontrole</span>: vazba se vrátí do
            fronty a vrácení se PŘIPÍŠE do auditní stopy jako další záznam. Historie se
            nikdy nepřepisuje ani nemaže — proto vrácení vyžaduje důvod, který v řetězci
            zůstane (poznámka na hraně se dalším rozhodnutím přepíše, záznam v řetězci ne).
            Řazeno od nejnovějšího rozhodnutí; v historii je nejnovější záznam nahoře.
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel">
            zdroj: kg_edge linked_to props.review_state · review_audit (hash-řetězec)
          </p>
          {data.decided.length === 0 ? (
            <p className="mt-6 border-2 border-dashed border-hairline p-6 text-sm leading-relaxed text-steel">
              Zatím žádná vazba není rozhodnutá — všech {int(data.stats.pending)} čeká na
              lidskou kontrolu. Až první rozhodnutí padne, vazba se objeví tady i s celou
              svojí historií.
            </p>
          ) : (
            <div className="mt-6 space-y-6">
              {data.decided.map((tie) => (
                <DecidedCard
                  key={tie.id}
                  tie={tie}
                  writeConfigured={writeConfigured}
                  writeStatus={writeStatus[tie.id] ?? { phase: "idle" }}
                  onRevert={(note) => handleDecide(tie, "needs-more", note)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Odkud se bere třída a odkud pořadí — obojí je zapsané v grafu a obojí se tady
            čte, ne přepočítává. Kde přepočet nutný byl, říkáme kolikrát a proč. */}
        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-steel">
          <span className="font-bold text-ink">Třída vazby:</span> u{" "}
          <span className="font-bold text-ink">{int(data.stats.classOrigin.stored)}</span> z{" "}
          {int(data.stats.pending)} nepotvrzených vazeb ji nese hrana v grafu
          (<span className="font-mono">kg_edge.props.tie_class</span>) — zapsal ji analytický průchod
          nebo lidská kontrola a má přednost. U {int(data.stats.classOrigin.derived)} zapsaná není a
          program ji odhadl z názvu firmy a textu role; taková je na kartě označená jako{" "}
          <span className="text-ochre">odvozená</span>.{" "}
          {data.stats.classDisagreements > 0 ? (
            <>
              U <span className="font-bold text-ink">{int(data.stats.classDisagreements)}</span> vazeb
              se zapsaná třída s odhadem rozchází — karta ukazuje obě.{" "}
            </>
          ) : null}
          <span className="font-bold text-ink">Pořadí kontroly</span> (tier + rank) je v grafu také
          zapsané, ale je to jen mezivýsledek funkce třída × korroborace × dosažitelné peníze. U{" "}
          <span className="font-bold text-ink">{int(data.stats.staleReviewOrder)}</span> z{" "}
          {int(data.stats.pending)} vazeb už zapsaná hodnota neodpovídá vazbě, kterou máte před sebou
          (byla spočítaná před doplněním korroborace a před opětovným načtením smluv), a je proto
          přepočítaná — jedna fronta nesmí míchat dvě vintage jednoho třídicího klíče.
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel">
          zdroj: kg_edge linked_to · props.tie_class / review_tier / review_rank vs. přepočet
        </p>

        {/* Kolik důkazu fronta vlastně nese. Do 2026-08-04 tenhle materiál konzole
            nečetla vůbec — viděl ho jen čtenář veřejného spisu poslance. */}
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-steel">
          <span className="font-bold text-ink">Důkaz u karty:</span> poznámku analytického
          průchodu nese <span className="font-bold text-ink">{int(data.stats.withAnalystNote)}</span> z{" "}
          {int(data.stats.pending)} vazeb, alespoň jeden příznak{" "}
          <span className="font-bold text-ink">{int(data.stats.flagged)}</span>, a u{" "}
          <span className="font-bold text-ink">{int(data.stats.staleOngoing)}</span> z nich příznak
          říká, že období „trvá“ je proti obchodnímu rejstříku zastaralé. Poznámky píšou
          analytické průchody (ARES VR, dataor.justice.cz), ne lidská kontrola — jsou to
          vodítka, ne zjištění, a stav vazby nemění. Karta zároveň říká, co graf u vazby
          nevede, místo aby prázdné místo vydávala za čistý štít.
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-steel">
          zdroj: kg_edge linked_to · props.reviewer_note / flags / corroboration_source
        </p>

        <p className="mt-6 max-w-3xl text-sm italic leading-relaxed text-steel">
          Fronta je řazená podle pořadí kontroly (batch 005): nejdřív vazby s vlastníkem/jednatelem
          potvrzené v obchodním rejstříku, pak představenstvo, pak dozorčí funkce, nakonec nepotvrzené.
          V rámci každé skupiny podle dosažitelných veřejných peněz sestupně. Skóre signálu na kartě je
          samostatná míra „jak zajímavý je příběh“, ne pořadí kontroly. Korroborace v primárním rejstříku
          pouze zvyšuje důvěru recenzenta — potvrdit vazbu může jedině člověk. Řazení ani skóre nejsou
          obvinění.
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
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ penize / kontrola</span>
          </div>
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
  focused,
  onFocus,
  onDecide,
}: {
  tie: ReviewTie;
  locale: string;
  int: (n: number) => string;
  decision: ReviewDecision | null;
  writeConfigured: boolean;
  writeStatus: WriteStatus;
  focused: boolean;
  onFocus: () => void;
  onDecide: (d: ReviewDecision, note: string | null) => void;
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
  const flags = tieFlagInfos(tie.flags);
  const stale = hasStaleOngoingFlag(tie.flags);
  // Evidence the edge does NOT carry, named out loud (see the block below).
  const missing = [
    tie.reviewerNote?.trim() ? null : "poznámku analýzy",
    tie.corroborationSource ? null : "rejstříkový doklad korroborace",
    flags.length ? null : "žádné příznaky z průchodů",
    tie.lastDecision ? null : "žádné dřívější rozhodnutí",
  ].filter((x): x is string => x != null);
  // "Doplnit" (needs-more) exists specifically to record what additional
  // evidence is needed — without a note it persists no information beyond the
  // bare decision, making the whole workflow functionally a no-op beyond
  // "not yet decided". Held locally per-card; sent through onDecide instead of
  // the previously hardcoded `note: null`.
  const [noteDraft, setNoteDraft] = useState("");

  return (
    <article
      id={`tie-${tie.id}`}
      tabIndex={0}
      onFocus={onFocus}
      onClick={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onFocus();
      }}
      className={`border-2 bg-paper outline-none ${focused ? "border-signal ring-2 ring-signal ring-offset-2 ring-offset-paper" : decision ? "border-ink" : "border-hairline"}`}
    >
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
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
            třída: {CLASS_LABEL[tie.tieClass]}{" "}
            <span className={tie.tieClassOrigin === "stored" ? "text-steel" : "text-ochre"}>
              ({tieClassOriginInfo(tie.tieClassOrigin).labelCs})
            </span>
          </span>
          {tie.tieClassOrigin === "stored" && tie.tieClassHeuristic !== tie.tieClass && (
            <span className="max-w-[16rem] text-right font-mono text-[10px] leading-relaxed uppercase tracking-widest text-steel">
              heuristika by uvedla: {CLASS_LABEL[tie.tieClassHeuristic]} — přednost má zapsaná třída
            </span>
          )}
          <span className="border border-hairline px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-steel">
            pořadí: {TIER_LABEL[tie.reviewTier]}
          </span>
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
            {/* Zastaralé „trvá“ pozná hrana sama (příznak `stale-ongoing-in-graph`, 42 z
                211 vazeb). Podmínka, která tady stála do 2026-08-04
                (`periodTo === null && !corroboration`), neplatila ANI JEDNOU: korroboraci
                nese všech 211 vazeb, takže výzva mlčela právě u vazeb, pro které vznikla. */}
            {stale && <Flag>období „trvá“ je proti rejstříku zastaralé — řiďte se daty z ARES VR</Flag>}
            {tie.periodTo === null && !tie.corroboration && (
              <Flag>období „trvá“ (dle Hlídače) — vazba ještě neprošla rekonciliací, ověřit v ARES VR</Flag>
            )}
            {tie.corroboration && tie.roleValidFrom && (
              <Flag>
                ARES VR: {tie.roleValidFrom} – {tie.roleValidTo ?? "trvá"}
              </Flag>
            )}
            {tie.deMinimis && <Flag>bagatelní objem</Flag>}
            {tie.absenteeManagerLead && <Flag>křížení s Case ② (manažer)</Flag>}
            {tie.falseEdgeSuspected && <Flag>podezření na chybnou vazbu</Flag>}
            {tie.ownerStakePct != null && <Flag>podíl {tie.ownerStakePct} %</Flag>}
            {tie.priorTerm && <Flag>předchozí období: {tie.priorTerm}</Flag>}
          </div>

          {/* Důkaz, který hrana nese — do 2026-08-04 ho viděl čtenář veřejného spisu, ale
              NE člověk, který o vazbě rozhoduje. Slovník příznaků je sdílený
              (features/money/tieFlags.ts), nepřeložený token se ukáže doslova. */}
          <FlagList
            className="mt-4"
            heading="příznaky z analytických průchodů"
            items={flags.map((f) => ({ key: f.token, label: f.labelCs, note: f.noteCs, tone: f.tone }))}
          />

          {/* Analytická próza jako analytická próza — datovaná, přiřazená k průchodu,
              s dokladem, a s připomenutím, že vazba pořád čeká na lidskou bránu. */}
          <AnalystNote tie={tie} en={false} className="mt-4" />

          {/* Dřívější LIDSKÉ rozhodnutí o téhle vazbě (jiné pole než poznámka analýzy —
              tohle píše jedině ReviewRepository). U „doplnit“ vazba zůstává ve frontě, a
              recenzent musí vidět, co si o ní minule poznamenal. */}
          {(tie.reviewNote || tie.lastDecision) && (
            <div className="mt-4 border-l-2 border-cobalt pl-3">
              {tie.reviewNote && (
                <p className="text-sm leading-relaxed text-steel-aa">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                    poznámka z předchozí kontroly:{" "}
                  </span>
                  {tie.reviewNote}
                </p>
              )}
              {tie.lastDecision && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel-aa">
                  poslední rozhodnutí: {tie.lastDecision}
                  {tie.lastReviewer ? ` · ${tie.lastReviewer}` : ""}
                  {tie.lastReviewedAt ? ` · ${tie.lastReviewedAt}` : ""}
                </p>
              )}
            </div>
          )}

          {/* Co graf u téhle vazby NEVEDE. Prázdný blok by se četl jako „nic tu není
              k vidění“; tohle říká, které důkazy chybí. */}
          {missing.length > 0 && (
            <p className="mt-4 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel-aa">
              graf u vazby nevede: {missing.join(" · ")}
            </p>
          )}

          <p className="mt-4 font-mono text-[10px] leading-relaxed uppercase tracking-wider text-steel">
            zdroj: {tie.source || "—"}
          </p>
        </div>

        {/* registry deep-links + reachable total */}
        <div className="border-l-2 border-hairline pl-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-steel">dosažitelné veřejné peníze</p>
          <p
            className={`mt-1 text-2xl font-black tabular-nums ${tie.tieClass === "steward" ? "text-steel" : "text-signal"}`}
          >
            {reach > 0 ? compactCzk(reach, locale) : "—"}
          </p>
          {/* Pravidlo u čísla, ne o obrazovku níž: u dozorčí funkce je to peníze
              instituce, ne poslance, a bez téhle věty se to čte úplně stejně. */}
          <p className="mt-1 text-xs leading-relaxed text-steel">
            {tie.tieClass === "steward"
              ? "peníze té instituce, ne poslance — dozorčí/správní funkce ve veřejné nebo neziskové organizaci"
              : tie.tieClass === "manager"
                ? "firma, v jejímž statutárním orgánu poslanec sedí"
                : "firma, kterou poslanec vlastní nebo řídí"}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-steel">
            zdroj: registr smluv Σ supplies.weight + subsidies_total_czk
          </p>
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
      <div className="flex flex-col gap-2 border-t-2 border-hairline px-5 py-3">
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          disabled={writeStatus.phase === "pending" || writeStatus.phase === "done"}
          placeholder="poznámka k rozhodnutí (co je třeba doplnit, na co si dát pozor…) — nepovinné"
          rows={2}
          className="w-full resize-y border-2 border-hairline bg-paper px-2 py-1.5 font-mono text-xs text-ink outline-none placeholder:text-steel focus:border-cobalt disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center gap-2">
          {DECISIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={writeStatus.phase === "pending" || writeStatus.phase === "done"}
              onClick={() => onDecide(d.key, noteDraft.trim() || null)}
              className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                decision === d.key ? "bg-ink text-paper border-ink" : d.cls
              }`}
            >
              {d.label}
            </button>
          ))}
          {decision && <WriteStatusNote decision={decision} writeConfigured={writeConfigured} status={writeStatus} />}
        </div>
      </div>
    </article>
  );
}

/**
 * One ALREADY-DECIDED tie: its current gate state, its full decision history (newest
 * first, straight from the audit chain via `gateFromEdge`) and the path back into the
 * queue. Reversal is an APPEND — it writes a new audit row; nothing in the history is
 * edited or removed, which is what keeps `verifyAuditChain` valid across it.
 */
function DecidedCard({
  tie,
  writeConfigured,
  writeStatus,
  onRevert,
}: {
  tie: ReviewTie;
  writeConfigured: boolean;
  writeStatus: WriteStatus;
  onRevert: (note: string) => void;
}) {
  const [reason, setReason] = useState("");
  const busy = writeStatus.phase === "pending" || writeStatus.phase === "done";
  const history = tie.gate?.audit ?? [];
  const state = tie.reviewState;

  return (
    <article className="border-2 border-hairline bg-paper">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-hairline px-5 py-4">
        <div>
          <Link
            href={`/poslanec/${tie.pspId}`}
            className="text-lg font-black uppercase tracking-tight transition-colors hover:text-signal"
          >
            {tie.mpName}
          </Link>
          <span className="ml-2 font-mono text-xs text-steel">{tie.club ? `· ${tie.club}` : ""}</span>
          <p className="mt-1 text-base font-black uppercase tracking-tight text-ink">{tie.company}</p>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-steel">
            IČO {tie.ico}
            {tie.role ? ` · ${tie.role}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
              state === "verified" ? "border-cobalt text-cobalt" : "border-steel text-steel"
            }`}
          >
            {state === "verified" ? "ověřeno" : "zamítnuto"}
          </span>
          {tie.gate?.reviewer ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
              rozhodl {tie.gate.reviewer}
              {tie.gate.reviewedAt ? ` · ${tie.gate.reviewedAt.slice(0, 10)}` : ""}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
              hrana neuvádí, kdo rozhodl
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel">
          historie rozhodnutí (nejnovější první)
        </p>
        {history.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-steel">
            Auditní stopa k téhle vazbě žádný záznam nevede — stav na hraně vznikl mimo
            konzoli (import nebo dřívější dávka). Nedopočítáváme ho.
          </p>
        ) : (
          <ol className="mt-2 divide-y divide-hairline">
            {history.map((h, i) => (
              <li key={`${h.decidedAt}-${i}`} className="py-2">
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink">
                  {DECISION_HISTORY_LABEL[h.decision] ?? h.decision} · {h.reviewer} ·{" "}
                  {h.decidedAt.slice(0, 19).replace("T", " ")}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-steel">
                  předchozí stav: {h.priorState ?? "žádný (první rozhodnutí)"}
                </p>
                {h.note ? <p className="mt-1 text-sm leading-relaxed text-steel">{h.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t-2 border-hairline px-5 py-3">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
          placeholder="důvod vrácení ke kontrole — povinný, zůstane v auditní stopě"
          rows={2}
          className="w-full resize-y border-2 border-hairline bg-paper px-2 py-1.5 font-mono text-xs text-ink outline-none placeholder:text-steel focus:border-cobalt disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || reason.trim().length === 0}
            onClick={() => onRevert(reason.trim())}
            className="border-2 border-ochre px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-ochre disabled:cursor-not-allowed disabled:opacity-50"
          >
            Vrátit ke kontrole
          </button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel">
            vazba se vrátí do fronty · vrácení se připíše do auditní stopy
          </span>
          <WriteStatusNote decision="needs-more" writeConfigured={writeConfigured} status={writeStatus} />
        </div>
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
    case "misconfigured":
      return (
        <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-widest text-signal">
          nezapsáno — chybí REVIEWER_NAME{status.message ? `: ${status.message}` : ""}
        </span>
      );
    case "reason-required":
      return (
        <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-widest text-signal">
          nezapsáno — vrácení rozhodnutí musí mít důvod v poznámce
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
