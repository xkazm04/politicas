"use client";

/**
 * Dnešní zápis — kompaktní rubrika titulní strany (moonshot 3A, teaser only).
 * Čte veřejný strojový feed /denik/feed.json (týž formát jako Deník důkazů —
 * validátor `parseEvidenceFeedJson` je sdílený) a ukáže poslední zapsaný den:
 * datum, počet zápisů a první řádky. Titulní strana je klientská komponenta
 * nad vzorkem, takže rubrika čte feed až v prohlížeči — a všechny tři stavy
 * (načítám / prázdné / nečitelné) říká poctivě, nikdy nefabuluje.
 * Copy česky přímo zde (messages/*.json je mimo plochu 3A — precedens /dukazy).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import { parseEvidenceFeedJson } from "@/features/dukazy/feedCodecs";
import { useFormat } from "@/lib/i18n/useFormat";

interface TeaserDay {
  /** `YYYY-MM-DD` posledního zapsaného dne. */
  date: string;
  /** Kolik zápisů ten den nese (ve feedu, seříznutém na FEED_ENTRIES). */
  count: number;
  /** První řádky dne — brankované věty záznamů. */
  titles: string[];
}

type TeaserState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "empty" }
  | { kind: "day"; day: TeaserDay; isToday: boolean };

export default function DenikTeaser() {
  const f = useFormat();
  const [state, setState] = useState<TeaserState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/denik/feed.json")
      .then(async (res) => {
        if (!res.ok) throw new Error(`feed.json: HTTP ${res.status}`);
        return parseEvidenceFeedJson(await res.text());
      })
      .then((feed) => {
        if (cancelled) return;
        if (feed.items.length === 0) {
          setState({ kind: "empty" });
          return;
        }
        // Feed je seřazený dny sestupně — poslední zapsaný den je první položka.
        const date = feed.items[0].date_published.slice(0, 10);
        const dayItems = feed.items.filter((it) => it.date_published.slice(0, 10) === date);
        setState({
          kind: "day",
          day: { date, count: dayItems.length, titles: dayItems.slice(0, 3).map((it) => it.title) },
          isToday: date === new Date().toISOString().slice(0, 10),
        });
      })
      .catch((err) => {
        console.warn("[DenikTeaser] /denik/feed.json se nepodařilo načíst", err);
        if (!cancelled) setState({ kind: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-label="Dnešní zápis" className="border-t-4 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep">
              {state.kind === "day" && !state.isToday ? "poslední zápis" : "dnešní zápis"}
            </p>
            <h2 className="mt-1 text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Deník republiky<span className="text-signal">.</span>
            </h2>
          </div>
          <Link
            href="/denik"
            className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            číst deník{" "}
            <ArrowUpRight
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden
            />
          </Link>
        </div>

        {state.kind === "loading" && (
          <p className="mt-4 max-w-2xl text-sm text-steel-aa">Zápis se načítá…</p>
        )}
        {state.kind === "unavailable" && (
          <p className="mt-4 max-w-2xl text-sm text-steel-aa">
            Zápis se teď nepodařilo načíst — deník není prázdný, jen nečitelný. Celý záznam drží
            stránka /denik.
          </p>
        )}
        {state.kind === "empty" && (
          <p className="mt-4 max-w-2xl text-sm text-steel-aa">
            Deník zatím žádný zápis nenese — první se objeví, jakmile registry ponesou datovanou
            událost.
          </p>
        )}
        {state.kind === "day" && (
          <div className="mt-4 max-w-2xl">
            <p className="font-mono text-sm font-bold uppercase tracking-widest">
              {f.date(state.day.date)} · zápisů: {f.int(state.day.count)}
            </p>
            <ul className="mt-3 list-none space-y-1 border-l-4 border-ink pl-4">
              {state.day.titles.map((t) => (
                <li key={t} className="text-[15px] leading-relaxed">
                  {t}
                </li>
              ))}
              {state.day.count > state.day.titles.length && (
                <li className="font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                  … a další zápisy dne v deníku
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <SourceNote>zdroj: /denik/feed.json — deník republiky (registr smluv + ares + psp.cz + review_audit)</SourceNote>
        </div>
      </div>
    </section>
  );
}
