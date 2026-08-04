"use client";

/*
 * Občanská schránka (/schranka, moonshot 7A) — „co se změnilo od minulé
 * návštěvy" pro sledované entity.
 *
 * Klientská plocha z nutnosti: sledování žije v localStorage (žádné účty) a
 * server ho nezná. Stránka přečte sledované klíče + razítko poslední návštěvy,
 * orazítkuje NOVOU návštěvu (práh zůstává ten předchozí po celou dobu pohledu)
 * a stáhne /schranka/novinky.json — delty odvozené na serveru read-only nad
 * deníkem a důkazy, každý řádek s provenancí a příznakem pending.
 *
 * Copy česky přímo zde (messages/*.json mimo plochu — precedens /denik).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, Inbox } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { czechDate, czechInt } from "@/lib/format";
import { compactCzk } from "@/features/money/moneyTypes";
import { FIRST_VISIT_DAYS, sinceDay, type DeltaEntry, type EntityDelta } from "./deriveDeltas";
import type { NovinkyResponse } from "./novinky";
import FollowButton from "./FollowButton";
import { fetchNovinky } from "./useNews";
import { useSchranka } from "./useSchranka";
import { useToday } from "./useToday";
import { countSeen, newVisitGuard, openVisit, type VisitWindow } from "./visitWindow";

const TONE_DOT: Record<DeltaEntry["tone"], string> = {
  signal: "bg-signal",
  cobalt: "bg-cobalt",
  ink: "bg-steel",
  ochre: "bg-ochre",
};

/** Řádek delty — týž hlas jako řádek deníku (žádná nová věta, jen záznam). */
function DeltaRow({ e }: { e: DeltaEntry }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3">
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${TONE_DOT[e.tone]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        <span className="mr-2 font-mono text-[12px] font-bold tabular-nums text-steel-aa">
          {czechDate(e.date)}
        </span>
        {e.internalHref ? (
          <Link href={e.internalHref} className="hover:text-signal-deep hover:underline">
            {e.titleCs}
          </Link>
        ) : (
          e.titleCs
        )}
        {e.czk !== undefined && (
          <span className="ml-2 whitespace-nowrap font-mono text-[13px] font-bold tabular-nums">
            {compactCzk(e.czk, "cs")}
          </span>
        )}
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
          [{e.source}]
        </span>
        {e.timeBasis === "zaznamenano" ? (
          <span className="ml-2 whitespace-nowrap border border-cobalt px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
            zaznamenáno
          </span>
        ) : (
          <span className="ml-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-steel-aa">
            účinné
          </span>
        )}
        {e.pending && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            stojí na vazbě čekající na lidskou kontrolu
          </span>
        )}
      </span>
    </div>
  );
}

function EntityBlock({ delta, storedLabel }: { delta: EntityDelta; storedLabel: string | null }) {
  const label = delta.label !== delta.key ? delta.label : (storedLabel ?? delta.key);
  const isObec = delta.key.startsWith("obec:");
  return (
    <article className="border-2 border-ink">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-ink bg-paper-strong px-4 py-3">
        <span className="flex min-w-0 items-baseline gap-3">
          {delta.href ? (
            <Link
              href={delta.href}
              className="truncate text-lg font-black uppercase tracking-tight hover:text-signal-deep hover:underline"
            >
              {label}
            </Link>
          ) : (
            <span className="truncate text-lg font-black uppercase tracking-tight">{label}</span>
          )}
          <span className="font-mono text-[11px] uppercase tracking-wider text-steel-aa">{delta.key}</span>
        </span>
        <span className="flex items-center gap-3">
          <Link
            href={delta.denikHref}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            <Eye className="h-3 w-3" aria-hidden /> deník entity
          </Link>
          <FollowButton entityKey={delta.key} label={label} compact />
        </span>
      </div>

      {delta.total === 0 ? (
        <p className="px-4 py-4 text-sm leading-relaxed text-steel-aa">
          {isObec
            ? "Deník obce zatím záznam nevede — sledování obce je připravené, ale delty pro ni dnes nemá kdo psát. Zrcadlo rozpočtu je na evidenční stránce."
            : "Beze změny — od prahu pohledu záznam pro tuhle entitu žádný nový zápis nenese."}
        </p>
      ) : (
        <>
          <div>
            {delta.entries.map((e) => (
              <DeltaRow key={e.id} e={e} />
            ))}
          </div>
          {delta.total > delta.entries.length && (
            <p className="px-4 py-3">
              <Link
                href={delta.denikHref}
                className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
              >
                + {czechInt(delta.total - delta.entries.length)} dalších zápisů v deníku entity
              </Link>
            </p>
          )}
        </>
      )}
    </article>
  );
}

export default function SchrankaPage() {
  const { state, stampVisit, markSeen } = useSchranka();
  const today = useToday();

  // Práh pohledu = PŘEDCHOZÍ razítko; nová návštěva se orazítkuje hned při
  // otevření, ale pohled drží starý práh do reloadu.
  // Razítkuje se v rAF — zápis do localStorage rozvlní useSchranka a
  // synchronní setState v těle efektu je kaskádový render (precedens
  // useActiveSection; react-hooks/set-state-in-effect). Razítko se počítá
  // PŘED setState a přes jednorázovou pojistku: updater ve StrictMode běží
  // dvakrát a razítkování uvnitř něj by okno „od minulé návštěvy" zavřelo
  // (viz openVisit v visitWindow.ts).
  const [visit, setVisit] = useState<VisitWindow | null>(null);
  const guard = useRef(newVisitGuard());
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const opened = openVisit(guard.current, stampVisit);
      if (opened !== null) setVisit(opened);
    });
    return () => cancelAnimationFrame(frame);
  }, [stampVisit]);

  const keysSig = state.follows
    .map((f) => f.key)
    .sort()
    .join("|");
  const since = visit !== null ? sinceDay(visit.prev, today) : null;
  const sig = since !== null && keysSig !== "" ? `${keysSig}@${since}` : null;

  // Odpověď nese podpis dotazu — zastaralá se v renderu prostě nepoužije,
  // žádné synchronní nulování v efektu.
  const [fetched, setFetched] = useState<{ sig: string; res: NovinkyResponse | null } | null>(null);
  useEffect(() => {
    if (sig === null || since === null) return;
    let alive = true;
    fetchNovinky(keysSig.split("|"), since).then((res) => {
      if (alive) setFetched({ sig, res });
    });
    return () => {
      alive = false;
    };
  }, [sig, since, keysSig]);

  // undefined = načítá se · null = nelze načíst · jinak odpověď serveru.
  const data: NovinkyResponse | null | undefined =
    fetched !== null && fetched.sig === sig ? fetched.res : undefined;

  // Vodoznak viděného: co tahle návštěva ukázala z DNEŠNÍHO dne. Odznak
  // v liště to pak odečítá a po návštěvě zhasne (visitWindow.ts). Zapisuje se
  // až nad načtenými daty a jen při změně — markSeen sám nezapíše totéž znovu.
  useEffect(() => {
    if (visit === null || data === undefined || data === null) return;
    markSeen({ day: visit.day, count: countSeen(data.deltas, visit.day) });
  }, [visit, data, markSeen]);

  const storedLabels = new Map(state.follows.map((f) => [f.key, f.label]));
  const firstVisit = visit !== null && visit.prev === null;
  const dropped = (data?.droppedEntries ?? 0) + (data?.droppedDeltas ?? 0);

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ schranka</span>
          <Link
            href="/denik"
            className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            deník republiky
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">osobní schránka záznamu</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Občanská schránka
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
          Sledujte poslance, tisky, firmy nebo obce — a schránka vám při každé návštěvě ukáže, co se
          v záznamu změnilo od té minulé. Každý řádek je datovaný zápis deníku se svým zdrojem;
          schránka nic nedopisuje, jen filtruje.
        </p>

        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">pravidlo schránky</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            Sledování je bez účtu: seznam žije jen ve vašem prohlížeči (localStorage) a serveru se
            posílá pouze jako parametry dotazu na novinky — žádná identita. Zápisy deníku jsou
            datované dnem, práh „od minulé návštěvy&ldquo; je proto denní: den poslední návštěvy se
            počítá celý znovu — raději zápis ukázat podruhé než zamlčet.
            {firstVisit
              ? ` První návštěva razítko nemá — ukazuje se posledních ${czechInt(FIRST_VISIT_DAYS)} dnů záznamu.`
              : ""}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-steel-aa">
            Odznak v liště se řídí přísnějším pravidlem: po návštěvě si schránka poznamená, kolik
            zápisů dnešního dne jste tady měli před sebou, a odznak je pak nepočítá — proto po
            návštěvě zhasne, i když je den návštěvy nad prahem pořád celý. Odečítá se jen počet
            z téhož dne; jinak nic. Stránka zůstává shovívavá — pravidla jsou dvě záměrně.
          </p>
        </div>

        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={1}
            title="Sledované"
            aside={
              data ? (
                <SourceNote>
                  zdroj: deník republiky + deník důkazů · práh {czechDate(data.since)} · sestaveno{" "}
                  {czechDate(data.builtOn)}
                </SourceNote>
              ) : (
                <SourceNote>zdroj: deník republiky + deník důkazů</SourceNote>
              )
            }
          />

          {state.follows.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="flex items-start gap-3 text-lg">
                <Inbox className="mt-1 h-5 w-5 shrink-0 text-steel" aria-hidden />
                <span>
                  Zatím nesledujete nic<span className="text-signal">.</span> Tlačítko{" "}
                  <span className="font-mono text-sm font-bold uppercase tracking-wider">sledovat</span>{" "}
                  najdete v levé liště na spisu poslance, na sněmovním tisku, na zrcadle obce a na
                  filtrovaném deníku — nebo začněte u{" "}
                  <Link
                    href="/denik"
                    className="font-mono text-sm font-bold uppercase tracking-widest text-signal-deep hover:underline"
                  >
                    deníku republiky
                  </Link>{" "}
                  a{" "}
                  <Link
                    href="/zebricek"
                    className="font-mono text-sm font-bold uppercase tracking-widest text-signal-deep hover:underline"
                  >
                    žebříčku
                  </Link>
                  .
                </span>
              </p>
            </div>
          ) : data === undefined ? (
            <p className="mt-8 border-2 border-dashed border-hairline p-8 text-lg" aria-live="polite">
              Novinky se načítají…
            </p>
          ) : data === null ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-lg">
                Novinky teď nelze načíst — záznam je v tomto prostředí nečitelný. Schránka nemůže
                říct, jestli se něco změnilo; sledování ve vašem prohlížeči zůstává.
              </p>
            </div>
          ) : (
            <>
              {(!data.coverage.money || !data.coverage.law || !data.coverage.reviews || !data.coverage.changes || !data.coverage.dukazy) && (
                <div className="mt-6 max-w-2xl border-l-4 border-ochre bg-paper-strong px-4 py-3">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">neúplné pokrytí</p>
                  <p className="mt-1 text-sm leading-relaxed text-steel-aa">
                    Některá vrstva záznamu je teď nečitelná — delty mohou být neúplné:
                    {!data.coverage.money ? " smlouvy a rejstříkové role;" : ""}
                    {!data.coverage.law ? " kroky tisků;" : ""}
                    {!data.coverage.reviews ? " rozhodnutí lidské brány;" : ""}
                    {!data.coverage.changes ? " proud „zaznamenáno“;" : ""}
                    {!data.coverage.dukazy ? " forenzní posudky;" : ""} chybějící skupina se nedopisuje.
                  </p>
                </div>
              )}

              {dropped > 0 && (
                <div className="mt-6 max-w-2xl border-l-4 border-ochre bg-paper-strong px-4 py-3">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
                    nečitelné řádky odpovědi
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-steel-aa">
                    {czechInt(dropped)}{" "}
                    {dropped === 1 ? "řádek odpovědi měl" : "řádků odpovědi mělo"} tvar, kterému
                    schránka nerozumí — {dropped === 1 ? "byl zahozen" : "byly zahozeny"} a
                    nedokreslují se odhadem. Zbytek delty platí; úplný záznam nese deník entity.
                  </p>
                </div>
              )}

              <div className="mt-8 space-y-8">
                {data.deltas.map((d) => (
                  <EntityBlock key={d.key} delta={d} storedLabel={storedLabels.get(d.key) ?? null} />
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/denik"
                  className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
                >
                  celý deník republiky{" "}
                  <ArrowUpRight
                    className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </Link>
                <SourceNote>
                  sledovaných entit: {czechInt(state.follows.length)} · delty se odvozují za requestu,
                  nic se neukládá
                </SourceNote>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
