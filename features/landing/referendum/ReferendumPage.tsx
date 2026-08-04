"use client";

/*
 * Referendum o metodice (moonshot 7B) — /referendum.
 * Metodika přestává být zveřejněním a stává se hlasováním: čtenář si nastaví
 * vlastní váhy šesti složek indexu přispění, vidí žebříček pod svou čočkou,
 * odnese si sdílený odkaz (OG karta s otiskem vah + top 5) nebo vestavný
 * widget — a může svůj vektor anonymně odevzdat do agregátu „jak váží Česko",
 * který se ukazuje vedle zveřejněné metodiky až od k-anonymitního prahu.
 *
 * KODEK ČOČKY JE JEDEN: stav vah žije v URL přes useLensWeights (?vahy=…) a
 * přepočet jde přes reweigh() — obojí importované READ-ONLY z
 * features/civicscore. Panel posuvníků je PŘÍMO WeightPanel z /zebricek
 * (žádná kopie): stejné ovládání, stejné přiznané pravidlo, stejný kobaltový
 * jazyk „vaše číslo, ne zveřejněné".
 *
 * Česká kopie inline literálem — messages/*.json je mimo plochu (precedens
 * /kompas, /denik, WeightPanel).
 */

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Code2, Vote } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SourceNote from "@/features/shared/components/SourceNote";
import WeightPanel from "@/features/civicscore/components/WeightPanel";
import { COMPONENT_FILL } from "@/features/civicscore/componentFill";
import type { LeaderboardListData } from "@/features/civicscore/getLeaderboardData";
import { encodeWeights, PUBLISHED_WEIGHTS_LABEL, reweigh } from "@/features/civicscore/lens";
import { useLensWeights } from "@/features/civicscore/useLensWeights";
import { useFormat } from "@/lib/i18n/useFormat";
import { submitLensVector } from "./actions";
import { K_ANONYMITY_FLOOR, serializeWeights, type WeightAggregate } from "./aggregate";

/** Klíč místní zábrany dvojhlasu — jedna urna na prohlížeč, přiznaně měkká. */
const BALLOT_KEY = "politicas-referendum-hlas";
const PREVIEW_ROWS = 10;

/** window.location.origin se za život stránky nemění — není co odebírat. */
const noopSubscribe = () => () => {};
/** storage event pokryje i druhou záložku, která mezitím hlasovala. */
const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

export default function ReferendumPage({
  data,
  initialAggregate,
}: {
  data: LeaderboardListData | null;
  initialAggregate: WeightAggregate | null;
}) {
  const f = useFormat();
  const lens = useLensWeights();
  const lensView = useMemo(
    () => (data && !lens.isDefault ? reweigh(data.entries, data.components, lens.weights) : null),
    [data, lens.isDefault, lens.weights],
  );
  const custom = lensView !== null;
  const entries = lensView?.entries ?? data?.entries ?? [];
  const vector = encodeWeights(lens.weights);

  // Počátek adresy hydratačně bezpečně (server ho nezná → prázdný snapshot);
  // useSyncExternalStore místo efektu se setState (react-hooks doktrína).
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
  const shareHref = custom && vector ? `/referendum?vahy=${vector}` : "/referendum";
  const embedSrc = `${origin || ""}/embed/zebricek${custom && vector ? `?vahy=${vector}` : ""}`;
  const embedSnippet = `<iframe src="${embedSrc}" width="420" height="560" style="border:0" title="politicas — otevřený index přispění"></iframe>`;

  // ── hlas do urny ──────────────────────────────────────────────────────────
  const [aggregate, setAggregate] = useState<WeightAggregate | null>(initialAggregate);
  // Místní zábrana dvojhlasu z localStorage přes useSyncExternalStore (žádný
  // setState v efektu): serverový snapshot říká „nevím" (false), klientský čte
  // urnu; bez localStorage (soukromý režim) zůstává urna otevřená — zábrana je
  // beztak jen místní zdvořilost, ne bezpečnostní hranice.
  const storedBallot = useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return window.localStorage.getItem(BALLOT_KEY) !== null;
      } catch (err) {
        console.warn("[referendum] localStorage nedostupné — urna zůstává otevřená", err);
        return false;
      }
    },
    () => false,
  );
  const [sessionBallot, setSessionBallot] = useState<"open" | "cast" | "failed">("open");
  const cast = storedBallot || sessionBallot === "cast";
  const [pending, startTransition] = useTransition();
  const castVote = () => {
    const canonical = serializeWeights(lens.weights);
    startTransition(async () => {
      const res = await submitLensVector(canonical);
      if (res.status === "ok") {
        setAggregate(res.aggregate);
        setSessionBallot("cast");
        try {
          window.localStorage.setItem(BALLOT_KEY, canonical);
        } catch (err) {
          // Hlas už je odevzdán — jen se místní zábrana dvojhlasu neudrží.
          console.warn("[referendum] zápis místní zábrany selhal", err);
        }
      } else {
        setSessionBallot("failed");
      }
    });
  };

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ referendum</span>
          <Link
            href={custom && vector ? `/zebricek?vahy=${vector}` : "/zebricek"}
            className="font-mono text-xs uppercase tracking-widest text-steel-aa transition-colors hover:text-ink"
          >
            plný žebříček →
          </Link>
        </div>
      </header>

      {custom && (
        <div className="sticky top-0 z-20 border-b-2 border-ink bg-cobalt">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-paper">
              váš index — váhy {vector} · nejde o zveřejněnou metodiku
            </p>
            <button
              type="button"
              onClick={lens.reset}
              className="border-2 border-paper px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-paper transition-colors hover:bg-paper hover:text-cobalt"
            >
              Výchozí metodika
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6">
        <div className="py-10">
          <SourceNote tone="signal">referendum o metodice — anonymní, bez účtu</SourceNote>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
            Kolik váží dobrý poslanec<span className="text-signal">?</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            Index přispění stojí na šesti zveřejněných vahách. Tady je můžete přepsat: nastavte
            vlastní priority, žebříček všech {f.int(data?.entries.length ?? 207)} poslanců se
            přepočítá pod vaší čočkou a odkaz ji ponese s sebou — i s kartou pro sociální sítě a
            vestavným widgetem pro každou redakci. A když svůj vektor odevzdáte, přibude do
            anonymního agregátu „jak váží Česko“ vedle zveřejněné metodiky.
          </p>
        </div>

        {data === null ? (
          <div className="mb-20 border-2 border-dashed border-hairline p-8">
            <p className="text-base font-black uppercase tracking-wide">
              Znalostní graf teď není k dispozici — referendum potřebuje skutečný žebříček a nikdy
              neukazuje náhradní čísla.
            </p>
          </div>
        ) : (
          <>
            {/* ── 01 Váhy ─────────────────────────────────────── */}
            <section id="vahy">
              <SectionHeading
                index={1}
                title="Nastavte váhy"
                aside={
                  custom ? (
                    <span className="font-mono text-xs uppercase tracking-widest text-cobalt">
                      váš index — váhy {vector}
                    </span>
                  ) : (
                    <SourceNote>zveřejněné váhy: {PUBLISHED_WEIGHTS_LABEL} · psp.cz</SourceNote>
                  )
                }
              />
              <div className="mt-8">
                <WeightPanel components={data.components} lens={lens} totalRaw={lensView?.totalRaw ?? 100} />
              </div>
            </section>

            {/* ── 02 Náhled žebříčku ──────────────────────────── */}
            <section id="nahled" className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={2}
                title="Žebříček pod vaší čočkou"
                aside={
                  custom ? (
                    <span className="font-mono text-xs uppercase tracking-widest text-cobalt">
                      přepočet čočkou — pravidlo přiznáno výše
                    </span>
                  ) : (
                    <SourceNote>autoritativní index přispění — psp.cz, deterministický výpočet</SourceNote>
                  )
                }
              />
              <ol className="mt-8 border-2 border-ink">
                {entries.slice(0, PREVIEW_ROWS).map((e) => (
                  <li
                    key={e.pspId}
                    className="flex items-baseline gap-3 border-b border-hairline px-4 py-2.5 last:border-b-0"
                  >
                    <span className="w-10 shrink-0 font-mono text-xs text-steel-aa">
                      {f.int(e.rank)}.{e.tiedCount > 1 ? "=" : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold">
                      {e.name}{" "}
                      <span className="font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                        {e.clubAbbrev}
                      </span>
                    </span>
                    <span
                      className={`font-mono text-sm font-bold tabular-nums ${custom ? "text-cobalt" : "text-ink"}`}
                    >
                      {f.dec(e.score)}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <SourceNote>
                  top {f.int(PREVIEW_ROWS)} z {f.int(entries.length)} ·{" "}
                  {custom
                    ? "skóre přepočtené vaší čočkou (kobalt) — nejde o zveřejněný index"
                    : "autoritativní skóre z grafu (contribution_score)"}
                </SourceNote>
                <Link
                  href={custom && vector ? `/zebricek?vahy=${vector}` : "/zebricek"}
                  className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
                >
                  celý žebříček pod touto čočkou{" "}
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </Link>
              </div>
            </section>

            {/* ── 03 Sdílení a vestavění ──────────────────────── */}
            <section id="sdileni" className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={3}
                title="Odneste si to"
                aside={<SourceNote>odkaz nese metodiku v sobě — karta i widget citují zdroj</SourceNote>}
              />
              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div className="border-2 border-ink p-6">
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">
                    sdílený odkaz s OG kartou
                  </p>
                  <p className="mt-3 break-all font-mono text-sm">{origin ? `${origin}${shareHref}` : shareHref}</p>
                  <p className="mt-3 text-sm leading-relaxed text-steel-aa">
                    Odkaz vykreslí kartu s otiskem {custom ? "vašich" : "zveřejněných"} vah a top 5
                    poslanci pod {custom ? "vaší čočkou" : "oficiálním indexem"} — každé číslo na ní
                    má týž zdroj jako stránka sama.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(`${window.location.origin}${shareHref}`)
                        .then(() => setCopied(true))
                    }
                    className="mt-4 inline-flex items-center gap-1.5 border-2 border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:bg-ink hover:text-paper"
                  >
                    {copied ? <Check className="h-3 w-3" aria-hidden /> : null}
                    {copied ? "Odkaz zkopírován" : "Kopírovat odkaz"}
                  </button>
                </div>
                <div className="border-2 border-ink p-6">
                  <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">
                    <Code2 className="h-3.5 w-3.5" aria-hidden /> vestavný widget (iframe)
                  </p>
                  <pre className="mt-3 overflow-x-auto border border-hairline bg-paper-strong p-3 font-mono text-[11px] leading-relaxed">
                    {embedSnippet}
                  </pre>
                  <p className="mt-3 text-sm leading-relaxed text-steel-aa">
                    Samostatná stránka bez skriptů: top 10 pod {custom ? "vaší čočkou" : "zveřejněnou metodikou"},
                    s povinným řádkem „zdroj: politicas“ a odkazem na plný žebříček. Neplatné váhy
                    widget odmítne — nikdy je tiše neopraví.
                  </p>
                </div>
              </div>
            </section>

            {/* ── 04 Jak váží Česko ───────────────────────────── */}
            <section id="jak-vazi-cesko" className="mt-14 border-t-4 border-ink pt-10 pb-20">
              <SectionHeading
                index={4}
                title="Jak váží Česko"
                aside={<SourceNote>anonymní agregát čtenářů politicas — sebevýběr, ne reprezentativní průzkum</SourceNote>}
              />
              <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
                <div className="border-2 border-ink p-6">
                  <p className="max-w-md text-[15px] leading-relaxed text-steel-aa">
                    Odevzdáním přidáte svůj aktuální vektor vah do anonymního agregátu — ukládá se
                    jen šest čísel a čas, žádná identita. Medián se zveřejní až od{" "}
                    {f.int(K_ANONYMITY_FLOOR)} hlasů (k-anonymitní práh), aby z něj nešly vyčíst
                    jednotlivé hlasy.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={castVote}
                      disabled={pending || cast}
                      className="inline-flex items-center gap-2 bg-signal-deep px-5 py-3 text-sm font-black uppercase tracking-wider text-paper transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      <Vote className="h-4 w-4" aria-hidden />
                      {cast ? "Hlas odevzdán" : pending ? "Odevzdává se…" : "Odevzdat můj vektor"}
                    </button>
                    <span aria-live="polite" className="font-mono text-xs uppercase tracking-wider text-steel-aa">
                      {cast
                        ? "tenhle prohlížeč už hlasoval (místní zábrana, ne účet)"
                        : sessionBallot === "failed"
                          ? "hlas se nepodařilo uložit — úložiště teď nepřijímá zápisy"
                          : custom
                            ? `odevzdáte váhy ${vector}`
                            : "odevzdáte zveřejněnou metodiku (i souhlas je hlas)"}
                    </span>
                  </div>
                </div>
                <div className="border-2 border-ink">
                  <div className="grid grid-cols-[1fr_5rem_5rem] items-baseline gap-2 border-b-2 border-ink px-4 py-2.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">složka</span>
                    <span className="text-right font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">metodika</span>
                    <span className="text-right font-mono text-[10px] font-bold uppercase tracking-widest text-cobalt">medián ČR</span>
                  </div>
                  {data.components.map((c) => {
                    const fill = COMPONENT_FILL[c.key];
                    return (
                      <div
                        key={c.key}
                        className="grid grid-cols-[1fr_5rem_5rem] items-baseline gap-2 border-b border-hairline px-4 py-2 last:border-b-0"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm font-black uppercase tracking-wide">
                          <span
                            className="inline-block h-3 w-3 shrink-0"
                            style={{ background: fill?.color, opacity: fill?.opacity ?? 1 }}
                            aria-hidden
                          />
                          <span className="truncate">{c.label}</span>
                        </span>
                        <span className="text-right font-mono text-sm tabular-nums">{f.int(c.weight)}</span>
                        <span className="text-right font-mono text-sm font-bold tabular-nums text-cobalt">
                          {aggregate?.median ? f.dec(aggregate.median[c.key]) : "—"}
                        </span>
                      </div>
                    );
                  })}
                  <div className="px-4 py-3">
                    <SourceNote>
                      {aggregate === null
                        ? "agregát teď není k dispozici (úložiště neběží) — počet ani medián se nefabulují"
                        : aggregate.median === null
                          ? `hlasů zatím ${f.int(aggregate.n)} — medián se zveřejní od ${f.int(K_ANONYMITY_FLOOR)} (k-anonymita)`
                          : `medián efektivních vah z ${f.int(aggregate.n)} hlasů po složkách — součet mediánů nemusí dát 100; sebevýběr čtenářů, ne průzkum`}
                    </SourceNote>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
