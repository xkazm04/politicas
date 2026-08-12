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
 *
 * ── POZNÁMKA RECENZENTA SE UŽ NEZTRATÍ (2026-08-12) ─────────────────────────
 * Koncept „draft poznámky" žil UVNITŘ karty (`ReviewCard`), zatímco klávesové
 * zkratky 1/2/3 — inzerovaná cesta, jak se frontou pracuje — visely na `window`
 * v RODIČI, který se k němu nedostal, a posílaly proto `note: null`. Poznámka je
 * přitom JEDINÁ věc, která z rozhodnutí přežije do hash-řetězce (`props.review_note`
 * přepíše další rozhodnutí), a obsluha navíc zkratky ignoruje, dokud je fokus
 * v `TEXTAREA` — tedy přesně v okamžiku, kdy se draft zahazoval. Recenzent napsal
 * důvod, opustil pole, zmáčkl 2 a byl přesvědčený, že vazbu označil.
 *
 * Draft se proto ZVEDL DO RODIČE (`noteDrafts`, klíčované id vazby) — a ne obráceně,
 * tj. klávesnice se do karty nestěhovala, protože 211 posluchačů `keydown` místo
 * jednoho je horší cena než jeden `Record<string, string>`. Rodič je zároveň
 * JEDINÉ místo, kde se poznámka k rozhodnutí rozhoduje: `handleDecide` si ji vezme
 * sám, žádné volání jí neposílá `null` a i „vrátit ke kontrole" píše do TÉHOŽ
 * draftu. Aktuální hodnotu drží ref, takže psaní v poli nepřepisuje posluchače.
 *
 * A „doplnit" bez poznámky se už netváří jako zápis: `needs-more` bez důvodu
 * nezaznamená nad rámec „ještě nerozhodnuto" nic (a nad ROZHODNUTOU vazbou server
 * nezapíše ani řádek řetězce — `reversal requires a note`), takže se na zápisové
 * cestě vůbec neodešle a konzole to řekne (`note-required`). V lokálním režimu bez
 * backendu guard neběží: tam se nezapisuje nic z principu a banner to říká, takže
 * není jaký falešný úspěch předcházet.
 *
 * ── OBSLUHA A OHLÁŠENÍ (2026-08-12) ─────────────────────────────────────────
 * Šipky hýbou SKUTEČNÝM fokusem (dřív jen přebarvovaly rámeček, takže odečítačka
 * stála jinde, než kam mířilo 1/2/3) a seznam karet má JEDEN tabstop — roving
 * tabindex, týž vzor jako plátno velína a graf peněz. Výsledek zápisu, počet
 * zapsaných i selhání mají po JEDNÉ živé oblasti na celou stránku, ne jednu na
 * kartu: `role="status"` pro průběh a úspěch, `role="alert"` pro selhání.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useLocale } from "next-intl";
import FlagList from "@/features/shared/components/FlagList";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
// Jediný kodek trvalé adresy tvrzení v repu — konzole cituje TUTÉŽ účtenku,
// kterou u té vazby publikuje /penize.
import { claimRefPath } from "@/features/shared/provenance/claimRef";
import { canonicalIco } from "../companyId";
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

/**
 * POHYB PO FRONTĚ — čisté pravidlo, žádný DOM.
 *
 * Proč se NEIMPORTUJE `features/dashboard/graphTraversal.ts`, přestože roving
 * tabindex i „šipky místo tabulátoru" jsou tentýž vzor: `neighbourStep` je
 * pravidlo v ROVINĚ. Ptá se „který z mých SOUSEDŮ leží tím směrem", a k tomu
 * potřebuje souřadnice uzlů a seznam hran. Fronta kontroly ani jedno nemá:
 * je to JEDNOROZMĚRNÝ SEŘAZENÝ seznam, jehož krok zní „předchozí / další
 * v pořadí, ve kterém se karty sázejí". Vyrobit mu x/y (třeba samé nuly) jen
 * proto, aby se dal zavolat sdílený modul, by z importu udělalo kulisu —
 * `neighbourStep` by nad takovým vstupem vracel vždycky null. Sdílené pravidlo
 * se proto nepřejímá a fronta si drží vlastní tři řádky, které nic jiného
 * neumějí (Home/End mají naopak přesně tentýž význam jako na plátně velína:
 * první a poslední položka v pořadí, v jakém je čtenář před sebou vidí).
 */
export const QUEUE_NAV_KEYS: readonly string[] = ["ArrowDown", "ArrowUp", "j", "k", "Home", "End"];

/**
 * Cílová položka jednoho kroku frontou, nebo `null`, když klávesa krok nedělá
 * (nebo je fronta prázdná). Na krajích se NEZABALUJE — konec seznamu je konec
 * seznamu, ne skok na začátek.
 */
export function queueStep(
  ids: readonly string[],
  currentId: string | null,
  key: string,
): string | null {
  if (ids.length === 0) return null;
  const idx = currentId === null ? -1 : ids.indexOf(currentId);
  switch (key) {
    case "ArrowDown":
    case "j":
      return ids[Math.min(idx + 1, ids.length - 1)];
    case "ArrowUp":
    case "k":
      return idx <= 0 ? ids[0] : ids[idx - 1];
    case "Home":
      return ids[0];
    case "End":
      return ids[ids.length - 1];
    default:
      return null;
  }
}

/**
 * Karta, která drží JEDINÝ tabstop seznamu (roving tabindex): kde je kurzor
 * klávesnice, jinak první karta. Kurzor, který ve VYFILTROVANÉM seznamu není
 * (čtenář přepnul filtr), se ignoruje — jinak by fronta neměla tabstop žádný.
 */
export function queueRovingId(focused: string | null, ids: readonly string[]): string | null {
  if (focused !== null && ids.includes(focused)) return focused;
  return ids[0] ?? null;
}

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
  /**
   * „Doplnit" bez poznámky — konzole ho ZÁMĚRNĚ neodešle. Server by ho na čekající
   * vazbě sice přijal, jenže by uložil holé „ještě nerozhodnuto" a důvod, kvůli
   * kterému recenzent tlačítko zmáčkl, by nikde nezůstal; na rozhodnuté vazbě je
   * to rovnou `reversal requires a note` a nezapíše se ani řádek řetězce. Vlastní
   * fáze, aby se to nečetlo jako chyba sítě ani jako úspěšný zápis.
   */
  | "note-required"
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
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<ClassFilter>("all");
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [writeStatus, setWriteStatus] = useState<Record<string, WriteStatus>>({});
  const [token, setToken] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  /** Vazba, o které mluví živá oblast — jinak by se ohlašovalo 211 karet naráz. */
  const [announced, setAnnounced] = useState<{ id: string; label: string; decision: ReviewDecision } | null>(null);

  // JEDINÝ kanál poznámky k rozhodnutí (viz hlavička): draft žije tady, ne v kartě,
  // a `handleDecide` si ho bere sám. Ref drží aktuální hodnotu, aby psaní v poli
  // nepřepisovalo `handleDecide` ani posluchače klávesnice na každý úhoz.
  const noteDraftsRef = useRef<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const setNote = useCallback((id: string, value: string) => {
    noteDraftsRef.current = { ...noteDraftsRef.current, [id]: value };
    setNoteDrafts(noteDraftsRef.current);
  }, []);

  // data.ties already arrives sorted by reviewRank ASC (batch-005 review order) — the
  // filter narrows the CLASS but never re-sorts, so tier blocks stay contiguous.
  const shown = useMemo(
    () => (data ? (filter === "all" ? data.ties : data.ties.filter((t) => t.tieClass === filter)) : []),
    [data, filter],
  );
  const shownIds = useMemo(() => shown.map((t) => t.id), [shown]);
  const rovingId = queueRovingId(focusedId, shownIds);

  /** Fokus je SKUTEČNÝ fokus, ne přebarvený rámeček — jinak odečítačka stojí jinde,
   *  než kam míří 1/2/3. Plynulé odrolování se řídí `prefers-reduced-motion`. */
  const focusCard = useCallback(
    (id: string) => {
      const el = document.getElementById(`tie-${id}`);
      if (!el) return;
      el.focus();
      el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    },
    [reduceMotion],
  );
  const focusNote = useCallback((id: string) => {
    document.getElementById(`note-${id}`)?.focus();
  }, []);

  const handleDecide = useCallback(async (tie: ReviewTie, decision: ReviewDecision) => {
    // Poznámka se čte na JEDNOM místě, ať rozhodnutí přišlo myší, nebo klávesou.
    const note = (noteDraftsRef.current[tie.id] ?? "").trim() || null;
    setAnnounced({ id: tie.id, label: `${tie.mpName} — ${tie.company}`, decision });
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

    // „Doplnit" bez poznámky se neodesílá — viz WritePhase::note-required. Řekneme
    // to a vrátíme kurzor do pole, místo aby se prázdný krok tvářil jako zápis.
    if (decision === "needs-more" && note === null) {
      setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "note-required" } }));
      focusNote(tie.id);
      return;
    }

    // optimistic: show the decision immediately, reconcile with the real result after.
    setDecisions((prev) => ({ ...prev, [tie.id]: decision }));
    setWriteStatus((prev) => ({ ...prev, [tie.id]: { phase: "pending" } }));
    // Obě tlačítka teď zšednou (disabled) — fokus by jinak spadl na <body> a čtenář
    // by po každém rozhodnutí začínal od začátku stránky. Kurzor zůstává na kartě.
    focusCard(tie.id);

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
  }, [writeConfigured, token, writeStatus, focusCard, focusNote]);

  // Keyboard flow for a humane 211-tie review session: ↓/↑ (or j/k) move the focused
  // card, Home/End jump to its ends, 1/2/3 apply confirm/doplnit/zamítnout to the
  // focused card — S POZNÁMKOU, kterou má karta rozepsanou (viz hlavička). Disabled
  // while typing in the reviewer-token field or in a note so it never steals a keystroke.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (!shownIds.length) return;

      const next = queueStep(shownIds, focusedId, e.key);
      if (next !== null) {
        e.preventDefault();
        setFocusedId(next);
        focusCard(next);
        return;
      }
      const decision = DECISION_KEYS[e.key];
      const tie = focusedId ? shown.find((t) => t.id === focusedId) : undefined;
      if (decision && tie) {
        e.preventDefault();
        void handleDecide(tie, decision);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shown, shownIds, focusedId, handleDecide, focusCard]);

  if (!data) {
    return (
      <main className="min-h-screen bg-paper font-sans text-ink">
        <Shell>
          <div className="border-2 border-dashed border-hairline p-8">
            <SourceNote>zdroj: znalostní graf</SourceNote>
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
    { label: "nepotvrzené vazby", value: f.int(data.stats.pending), sub: "čekají na lidskou kontrolu", src: "kg_edge linked_to · pending_review" },
    {
      label: "vlastník / jednatel",
      value: f.int(data.stats.ownerOperator),
      sub: "soukromá firma dodávající státu",
      // The class is no longer always a heuristic: it is read off the edge where a
      // reviewer/analysis batch recorded one. Cite the real mix, not one of the two.
      src: `kg_edge props.tie_class ${f.int(data.stats.classOrigin.stored)}× · heuristika role × název ${f.int(data.stats.classOrigin.derived)}×`,
    },
    { label: "úplný trojúhelník", value: f.int(data.stats.triangles), sub: "zakázky + dotace + dar straně", src: "props firmy v kg_node" },
    {
      // Split, never merged. This tile used to sum per TIE across every class, so the
      // companies tied to more than one MP were counted twice and a hospital's own
      // contracting sat in the same number as a firm an MP owns.
      label: "peníze u firem poslanců",
      value: compactCzk(data.stats.reachable.attributable.contractCzk, locale),
      sub: `${f.int(data.stats.reachable.attributable.companies)} firem, které poslanci vlastní nebo řídí · dalších ${compactCzk(data.stats.reachable.steward.contractCzk, locale)} u ${f.int(data.stats.reachable.steward.companies)} institucí, kde poslanec jen zasedá v orgánu — to nejsou jeho peníze`,
      src: "registr smluv · kg_edge supplies.weight, jedna firma jednou",
    },
  ];

  // JEDNA živá oblast na stránku, ne jedna na kartu. Text se skládá TÝMŽ pravidlem,
  // jaké sází poznámku u karty (`writeStatusInfo`), takže se ohlášení a to, co je
  // vidět, nemůžou rozejít. Selhání má vlastní `role="alert"`, průběh a úspěch
  // `role="status"` — obě oblasti jsou připojené trvale, protože přepnutí role na
  // jednom uzlu odečítačka spolehlivě neohlásí.
  const announcement = announced
    ? writeStatusInfo(announced.decision, writeConfigured, writeStatus[announced.id] ?? { phase: "idle" })
    : null;
  const announceText = announced && announcement ? `${announced.label}: ${announcement.text}` : "";

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
              <SourceNote className="mt-3">zdroj: {tile.src}</SourceNote>
            </div>
          ))}
        </div>

        {/* filter + progress — sticky so it stays visible while scrolling a 211-card queue */}
        <div className="sticky top-0 z-10 mt-10 space-y-3 border-b-2 border-ink bg-paper/95 pb-3 pt-2 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Výběr filtru nesl JEN barvu — pro odečítačku čtyři nerozlišitelná
                tlačítka. Skupina má jméno, každé tlačítko svůj stav. */}
            <div role="group" aria-label="filtr fronty podle třídy vazby" className="flex flex-wrap gap-2">
              {(["all", "owner-operator", "manager", "steward"] as ClassFilter[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                  className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    filter === c ? "border-ink bg-ink text-paper" : "border-hairline text-steel hover:border-ink hover:text-ink"
                  }`}
                >
                  {c === "all" ? "vše" : CLASS_LABEL[c]}
                  <span className="ml-1.5 font-normal">
                    {c === "all"
                      ? f.int(data.stats.pending)
                      : f.int(c === "owner-operator" ? data.stats.ownerOperator : c === "manager" ? data.stats.manager : data.stats.steward)}
                  </span>
                </button>
              ))}
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-steel">
              {/* Postup zápisu je živá oblast; návod k obsluze VEDLE ní, aby se
                  nečetl znovu při každém rozhodnutí. */}
              <span role="status" aria-live="polite">
                {writeConfigured ? "zapsáno" : "rozhodnuto lokálně"}:{" "}
                <span className="font-bold text-ink">{f.int(decidedCount)}</span> / {f.int(data.stats.pending)}
              </span>
              {/* Legenda kláves byla `hidden sm:inline`, tedy display:none — na mobilu
                  neexistovala ani pro odečítačku. `sr-only` text klipuje, nemaže. */}
              <span className="ml-2 text-steel sr-only sm:not-sr-only sm:ml-2 sm:inline">
                · ↑↓ nebo j/k pohyb · Home/End začátek a konec fronty · 1/2/3 potvrdit/doplnit/zamítnout
                (rozhodnutí odešle poznámku, kterou má karta rozepsanou)
              </span>
            </p>
          </div>
          {/* per-tier progress (batch-005): the review-order axis, not just one aggregate */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-steel">
            {TIER_ORDER.map((tier) => (
              <span key={tier}>
                {TIER_LABEL[tier]}: <span className="font-bold text-ink">{f.int(decidedByTier[tier])}</span> / {f.int(data.stats.tierCounts[tier])}
              </span>
            ))}
          </div>
          {/* Výsledek zápisu — jedna trvalá živá oblast na stránku (viz `announcement`). */}
          <p role="status" aria-live="polite" className="sr-only">
            {announcement && !announcement.failure ? announceText : ""}
          </p>
          {/* ZÁMĚRNĚ bez `empty:hidden`: živá oblast, která je prázdná schovaná
              přes display:none, v přístupnostním stromu neexistuje, a odečítačka
              pak její první naplnění neohlásí. Prázdný <p> nic nezabírá. */}
          <p role="alert" className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
            {announcement && announcement.failure ? announceText : ""}
          </p>
        </div>

        {/* review cards — batch-005 review order (tier asc, reachable CZK desc within tier) */}
        <div className="mt-8 space-y-6">
          {shown.map((tie, i) => {
            const showTierHeader = i === 0 || shown[i - 1].reviewTier !== tie.reviewTier;
            return (
              <div key={tie.id}>
                {showTierHeader && (
                  <p className="mb-3 border-l-4 border-signal pl-3 font-mono text-[11px] font-bold uppercase tracking-widest text-steel">
                    {TIER_LABEL[tie.reviewTier]} <span className="font-normal">({f.int(data.stats.tierCounts[tie.reviewTier])})</span>
                  </p>
                )}
                <ReviewCard
                  tie={tie}
                  locale={locale}
                  decision={decisions[tie.id] ?? null}
                  writeConfigured={writeConfigured}
                  writeStatus={writeStatus[tie.id] ?? { phase: "idle" }}
                  focused={focusedId === tie.id}
                  roving={rovingId === tie.id}
                  note={noteDrafts[tie.id] ?? ""}
                  onNoteChange={(v) => setNote(tie.id, v)}
                  onFocus={() => setFocusedId(tie.id)}
                  onDecide={(d) => handleDecide(tie, d)}
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
          <SourceNote className="mt-2">
            zdroj: kg_edge linked_to props.review_state · review_audit (hash-řetězec)
          </SourceNote>
          {data.decided.length === 0 ? (
            <p className="mt-6 border-2 border-dashed border-hairline p-6 text-sm leading-relaxed text-steel">
              Zatím žádná vazba není rozhodnutá — všech {f.int(data.stats.pending)} čeká na
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
                  note={noteDrafts[tie.id] ?? ""}
                  onNoteChange={(v) => setNote(tie.id, v)}
                  onRevert={() => handleDecide(tie, "needs-more")}
                />
              ))}
            </div>
          )}
        </section>

        {/* Odkud se bere třída a odkud pořadí — obojí je zapsané v grafu a obojí se tady
            čte, ne přepočítává. Kde přepočet nutný byl, říkáme kolikrát a proč. */}
        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-steel">
          <span className="font-bold text-ink">Třída vazby:</span> u{" "}
          <span className="font-bold text-ink">{f.int(data.stats.classOrigin.stored)}</span> z{" "}
          {f.int(data.stats.pending)} nepotvrzených vazeb ji nese hrana v grafu
          (<span className="font-mono">kg_edge.props.tie_class</span>) — zapsal ji analytický průchod
          nebo lidská kontrola a má přednost. U {f.int(data.stats.classOrigin.derived)} zapsaná není a
          program ji odhadl z názvu firmy a textu role; taková je na kartě označená jako{" "}
          <span className="text-ochre">odvozená</span>.{" "}
          {data.stats.classDisagreements > 0 ? (
            <>
              U <span className="font-bold text-ink">{f.int(data.stats.classDisagreements)}</span> vazeb
              se zapsaná třída s odhadem rozchází — karta ukazuje obě.{" "}
            </>
          ) : null}
          <span className="font-bold text-ink">Pořadí kontroly</span> (tier + rank) je v grafu také
          zapsané, ale je to jen mezivýsledek funkce třída × korroborace × dosažitelné peníze. U{" "}
          <span className="font-bold text-ink">{f.int(data.stats.staleReviewOrder)}</span> z{" "}
          {f.int(data.stats.pending)} vazeb už zapsaná hodnota neodpovídá vazbě, kterou máte před sebou
          (byla spočítaná před doplněním korroborace a před opětovným načtením smluv), a je proto
          přepočítaná — jedna fronta nesmí míchat dvě vintage jednoho třídicího klíče.
        </p>
        <SourceNote className="mt-2">
          zdroj: kg_edge linked_to · props.tie_class / review_tier / review_rank vs. přepočet
        </SourceNote>

        {/* Kolik důkazu fronta vlastně nese. Do 2026-08-04 tenhle materiál konzole
            nečetla vůbec — viděl ho jen čtenář veřejného spisu poslance. */}
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-steel">
          <span className="font-bold text-ink">Důkaz u karty:</span> poznámku analytického
          průchodu nese <span className="font-bold text-ink">{f.int(data.stats.withAnalystNote)}</span> z{" "}
          {f.int(data.stats.pending)} vazeb, alespoň jeden příznak{" "}
          <span className="font-bold text-ink">{f.int(data.stats.flagged)}</span>, a u{" "}
          <span className="font-bold text-ink">{f.int(data.stats.staleOngoing)}</span> z nich příznak
          říká, že období „trvá“ je proti obchodnímu rejstříku zastaralé. U{" "}
          <span className="font-bold text-ink">{f.int(data.stats.nearThreshold)}</span> vazeb má aspoň
          jedna smlouva firmy hodnotu těsně pod zákonným limitem pro zadávací řízení — počítá se
          v loaderu od začátku, na kartě je to příznak „N× u limitu“, ale kolik jich fronta nese
          celkem, konzole neřekla. Blízkost limitu není zjištění: je to vzorec, který stojí za
          pohled. Poznámky píšou
          analytické průchody (ARES VR, dataor.justice.cz), ne lidská kontrola — jsou to
          vodítka, ne zjištění, a stav vazby nemění. Karta zároveň říká, co graf u vazby
          nevede, místo aby prázdné místo vydávala za čistý štít.
        </p>
        <SourceNote className="mt-2">
          zdroj: kg_edge linked_to · props.reviewer_note / flags / corroboration_source · registr smluv
          supplies.weight (blízkost limitu)
        </SourceNote>

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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ penize / kontrola</span>
          </div>
          {/* Cesta zpátky k tomu, co o týchž vazbách čte veřejnost. /penize na
              konzoli odkazuje ze své hlavičky; opačným směrem odsud nevedlo nic. */}
          <span className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs uppercase tracking-widest">
            <Link
              href="/penize"
              className="text-steel-aa underline-offset-4 hover:text-ink hover:underline focus-visible:text-cobalt"
            >
              zpět na peněžní ledger
            </Link>
            <Link
              href="/dukazy"
              className="text-steel-aa underline-offset-4 hover:text-ink hover:underline focus-visible:text-cobalt"
            >
              veřejná nástěnka rozhodnutí
            </Link>
          </span>
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

/**
 * Vnitřní adresy jedné vazby — spis poslance, spis firmy a TRVALÁ ADRESA tvrzení.
 *
 * Konzole je jediné místo, kde se o vazbě rozhoduje, a do 2026-08-11 z karty
 * vedl jediný vnitřní odkaz: na profil poslance. Recenzent tak neměl jak se
 * podívat na to, co o téže vazbě čte veřejnost, ani otevřít firmu, která je
 * v grafu KŘIŽOVATKA (14 jich váže víc poslanců, což karta jedné vazby ukázat
 * neumí). Účtenka se skládá `claimRefPath(receiptRef)` — TÝŽ ref, který razí
 * `mapLinkedToTie`, žádná druhá gramatika adresy — a IČO se kanonizuje pravidlem
 * routy `/penize/firma/[ico]`; nekanonický zápis odkaz nedostane.
 */
function InternalTieLinks({ tie }: { tie: ReviewTie }) {
  const ico = canonicalIco(tie.ico);
  const items: { key: string; href: string; label: string }[] = [
    { key: "mp", href: `/penize/${tie.pspId}`, label: "peněžní spis poslance" },
    ...(ico ? [{ key: "co", href: `/penize/firma/${ico}`, label: "spis firmy" }] : []),
    { key: "receipt", href: claimRefPath(tie.receiptRef), label: "účtenka původu (veřejná adresa)" },
  ];
  return (
    <>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-steel">co o vazbě čte veřejnost</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {items.map((i) => (
          <Link
            key={i.key}
            href={i.href}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowUpRight className="h-3 w-3" aria-hidden /> {i.label}
          </Link>
        ))}
      </div>
    </>
  );
}

function ReviewCard({
  tie,
  locale,
  decision,
  writeConfigured,
  writeStatus,
  focused,
  roving,
  note,
  onNoteChange,
  onFocus,
  onDecide,
}: {
  tie: ReviewTie;
  locale: string;
  decision: ReviewDecision | null;
  writeConfigured: boolean;
  writeStatus: WriteStatus;
  focused: boolean;
  /** Drží tato karta jediný tabstop seznamu? (roving tabindex — viz queueRovingId) */
  roving: boolean;
  /** Rozepsaná poznámka k rozhodnutí — stav žije v RODIČI, viz hlavička souboru. */
  note: string;
  onNoteChange: (value: string) => void;
  onFocus: () => void;
  onDecide: (d: ReviewDecision) => void;
}) {
  const f = useFormat();
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
  return (
    // JEDEN tabstop na celý seznam (roving tabindex): 211 karet s pevným
    // `tabIndex={0}` znamenalo 211 zastávek tabulátoru — přesně ten anti-vzor,
    // který features/money/a11y.test.ts zakazuje grafu peněz. Mezi kartami se
    // chodí šipkami (queueStep) a fokus je SKUTEČNÝ, ne přebarvený rámeček;
    // `outline-none` proto zmizelo a je pod ním viditelný kroužek.
    <article
      id={`tie-${tie.id}`}
      tabIndex={roving ? 0 : -1}
      onFocus={onFocus}
      className={`border-2 bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt ${focused ? "border-signal ring-2 ring-signal ring-offset-2 ring-offset-paper" : decision ? "border-ink" : "border-hairline"}`}
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
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel">signál {f.dec(tie.signalScore)}</span>
        </div>
      </div>

      {/* body: money + flags */}
      <div className="grid gap-5 px-5 py-4 sm:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Metric label="zakázky" value={tie.contractCzk > 0 ? compactCzk(tie.contractCzk, locale) : "—"} sub={`${f.int(tie.contractCount)} smluv`} />
            <Metric label="dotace" value={tie.subsidiesCzk > 0 ? compactCzk(tie.subsidiesCzk, locale) : "—"} sub={tie.subsidiesCount ? `${f.int(tie.subsidiesCount)} titulů` : "—"} />
            <Metric
              label="dar straně"
              value={tie.donatedToPartyCzk != null ? compactCzk(tie.donatedToPartyCzk, locale) : "—"}
              sub={tie.donationRecipientParty ?? "—"}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tie.triangle && <Flag>úplný trojúhelník</Flag>}
            {tie.nearThresholdCount > 0 && <Flag>{f.int(tie.nearThresholdCount)}× u limitu</Flag>}
            {/* Zastaralé „trvá“ pozná hrana sama (příznak `stale-ongoing-in-graph`, 42 z
                211 vazeb). Podmínka, která tady stála vedle
                (`periodTo === null && !corroboration`), neplatila ANI JEDNOU: korroboraci
                nese všech 211 vazeb, takže výzva mlčela právě u vazeb, pro které vznikla.
                Byla popsaná jako mrtvá už 2026-08-04 a přesto se vykreslovala dál; mrtvá
                větev, kterou komentář omlouvá, je pořád mrtvá větev — 2026-08-11 smazána. */}
            {stale && <Flag>období „trvá“ je proti rejstříku zastaralé — řiďte se daty z ARES VR</Flag>}
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

          <SourceNote className="mt-4">zdroj: {tie.source || "—"}</SourceNote>
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
          <SourceNote className="mt-1">
            zdroj: registr smluv Σ supplies.weight + subsidies_total_czk
          </SourceNote>
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
          {/* …a co o téhle vazbě ukazuje NAŠE strana. Do 2026-08-11 vedl z karty
              jediný vnitřní odkaz (na profil poslance), takže recenzent neměl
              cestu k tomu, co o vazbě čte veřejnost — ke spisu poslance, ke spisu
              firmy (14 firem váže víc poslanců) ani k trvalé adrese samotného
              tvrzení, kterou plocha /penize u té vazby publikuje. */}
          <InternalTieLinks tie={tie} />
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-col gap-2 border-t-2 border-hairline px-5 py-3">
        {/* Placeholder NENÍ přístupné jméno: zmizí, jakmile se začne psát, a některé
            odečítačky ho nečtou vůbec. Jméno navíc jmenuje VAZBU — v seznamu 211 karet
            je „poznámka k rozhodnutí" bez podmětu k nerozeznání od ostatních 210. */}
        <textarea
          id={`note-${tie.id}`}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          disabled={writeStatus.phase === "pending" || writeStatus.phase === "done"}
          aria-label={`poznámka k rozhodnutí — ${tie.mpName}, ${tie.company}`}
          placeholder="poznámka k rozhodnutí (co je třeba doplnit, na co si dát pozor…)"
          rows={2}
          aria-describedby={`note-rules-${tie.id}`}
          className="w-full resize-y border-2 border-hairline bg-paper px-2 py-1.5 font-mono text-xs text-ink outline-none placeholder:text-steel focus:border-cobalt disabled:opacity-50"
        />
        {/* „nepovinné“ bylo NEPRAVDA ve dvou směrech naráz a obě se dají ověřit
            v reviewActions.ts: „doplnit“ bez poznámky sice projde, ale neuloží
            žádnou informaci nad rámec „ještě nerozhodnuto“, a VRÁCENÍ rozhodnutí
            se bez důvodu vůbec nezapíše (`setTieReviewState` vrátí „reversal
            requires a note“ a nezapíše ani řádek řetězce). Obě pravidla teď
            stojí u pole, ne v hlavičce modulu. */}
        <p id={`note-rules-${tie.id}`} className="text-[11px] leading-relaxed text-steel-aa">
          <span className="font-bold text-ink">Doplnit</span> bez poznámky je prázdný krok — vazba
          zůstane ve frontě a nikde nezůstane, co se má doplnit; konzole ho proto neodešle a řekne
          to. <span className="font-bold text-ink">Vrácení už rozhodnuté vazby</span> poznámku
          vyžaduje: bez ní server zápis odmítne a do auditní stopy nepřipíše nic, protože důvod se
          jinam než do řetězce neuloží (poznámka na hraně se dalším rozhodnutím přepíše). Poznámka
          jde do zápisu i tehdy, když rozhodnutí spustí klávesa 1/2/3.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {DECISIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={writeStatus.phase === "pending" || writeStatus.phase === "done"}
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
  note,
  onNoteChange,
  onRevert,
}: {
  tie: ReviewTie;
  writeConfigured: boolean;
  writeStatus: WriteStatus;
  /** TÝŽ draft, jaký používá fronta — jeden kanál poznámky na vazbu, viz hlavička. */
  note: string;
  onNoteChange: (value: string) => void;
  onRevert: () => void;
}) {
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
          {/* Rozhodnutá vazba potřebuje tytéž adresy jako čekající — vrácení se
              zvažuje proti tomu, co o ní čte veřejnost, ne proti paměti. */}
          <InternalTieLinks tie={tie} />
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
        {/* Pole, které HLÍDÁ povinný důvod, nemělo přístupné jméno vůbec — jen
            placeholder, který po prvním znaku zmizí. */}
        <textarea
          id={`note-${tie.id}`}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          disabled={busy}
          aria-label={`důvod vrácení ke kontrole — ${tie.mpName}, ${tie.company}`}
          aria-describedby={`revert-rules-${tie.id}`}
          placeholder="důvod vrácení ke kontrole — povinný, zůstane v auditní stopě"
          rows={2}
          className="w-full resize-y border-2 border-hairline bg-paper px-2 py-1.5 font-mono text-xs text-ink outline-none placeholder:text-steel focus:border-cobalt disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || note.trim().length === 0}
            onClick={onRevert}
            className="border-2 border-ochre px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-ochre disabled:cursor-not-allowed disabled:opacity-50"
          >
            Vrátit ke kontrole
          </button>
          <span id={`revert-rules-${tie.id}`} className="font-mono text-[10px] uppercase tracking-widest text-steel">
            vazba se vrátí do fronty · vrácení se připíše do auditní stopy · bez důvodu server
            nezapíše ani řádek řetězce
          </span>
          <WriteStatusNote decision="needs-more" writeConfigured={writeConfigured} status={writeStatus} />
        </div>
      </div>
    </article>
  );
}

const STATUS_TONE_CLS = {
  steel: "font-mono text-[10px] uppercase tracking-widest text-steel",
  cobalt: "font-mono text-[10px] font-bold uppercase tracking-widest text-cobalt",
  ochre: "font-mono text-[10px] font-bold uppercase tracking-widest text-ochre",
  signal: "font-mono text-[10px] font-bold uppercase tracking-widest text-signal",
} as const;

/**
 * Honest, clearly-visible reconciliation of the optimistic decision with the real
 * write result — a not-configured state and a network/validation error must never
 * look the same, and neither may look like a successful write.
 *
 * ČISTÉ PRAVIDLO, ne JSX: TENTÝŽ text čte poznámka u karty i JEDINÁ živá oblast
 * stránky (viz `announcement` v konzoli). Kdyby si každá skládala vlastní větu,
 * odečítačka by slyšela něco jiného, než co je vidět. `failure` říká, jestli
 * hlášení patří do `role="alert"` — tedy jestli se NEZAPSALO.
 */
export function writeStatusInfo(
  decision: ReviewDecision,
  writeConfigured: boolean,
  status: WriteStatus,
): { text: string; tone: keyof typeof STATUS_TONE_CLS; failure: boolean } {
  if (!writeConfigured) {
    return { text: `${DECISION_LABEL[decision]} · zápis čeká na backend`, tone: "steel", failure: false };
  }
  switch (status.phase) {
    case "pending":
      return { text: "zapisuje se…", tone: "steel", failure: false };
    case "done":
      return { text: `zapsáno · review_state = ${status.message}`, tone: "cobalt", failure: false };
    case "not-configured":
      return { text: "zápis není nastavený (chybí REVIEWER_TOKEN)", tone: "ochre", failure: true };
    case "unauthorized":
      return { text: "neplatný token recenzenta", tone: "signal", failure: true };
    case "misconfigured":
      return {
        text: `nezapsáno — chybí REVIEWER_NAME${status.message ? `: ${status.message}` : ""}`,
        tone: "signal",
        failure: true,
      };
    case "reason-required":
      return { text: "nezapsáno — vrácení rozhodnutí musí mít důvod v poznámce", tone: "signal", failure: true };
    case "note-required":
      return {
        text: "neodesláno — „doplnit“ bez poznámky nikde nezaznamená, co se má doplnit; napište důvod do poznámky",
        tone: "ochre",
        failure: true,
      };
    case "error":
      return {
        text: `chyba zápisu${status.message ? `: ${status.message}` : ""}`,
        tone: "signal",
        failure: true,
      };
    default:
      return { text: DECISION_LABEL[decision], tone: "steel", failure: false };
  }
}

/** Viditelná poznámka u karty. ŽÁDNÁ vlastní živá oblast: 211 karet = 211 oblastí,
 *  a odečítačka by pak četla každý zápis tolikrát, kolikrát je na stránce karta. */
function WriteStatusNote({
  decision,
  writeConfigured,
  status,
}: {
  decision: ReviewDecision;
  writeConfigured: boolean;
  status: WriteStatus;
}) {
  const info = writeStatusInfo(decision, writeConfigured, status);
  return <span className={`ml-1 ${STATUS_TONE_CLS[info.tone]}`}>{info.text}</span>;
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
