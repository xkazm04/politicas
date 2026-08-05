"use client"; // error boundaries must be Client Components

/*
 * Poslední záchranná síť aplikace. Chytá chyby, které shodí i kořenový layout
 * (app/layout.tsx) — proto si podle kontraktu App Routeru musí vykreslit
 * VLASTNÍ <html> a <body> a natáhnout si vlastní globální styly: v okamžiku,
 * kdy se zobrazí, kořenový layout neexistuje. Viz
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
 *
 * Metadata se odsud exportovat nedají (client component), takže titulek jde
 * přes React <title>. Fonty taky ne — proměnné --font-* nastavuje kořenový
 * layout, který tu není; text spadne na systémový sans-serif a to je v pořádku:
 * degradace má být viditelná, ne předstíraná.
 *
 * Hlášení: Sentry.captureException. Bez NEXT_PUBLIC_SENTRY_DSN se Sentry vůbec
 * neinicializuje (instrumentation-client.ts) a captureException je tichý no-op
 * — tenhle soubor tedy funguje stejně s DSN i bez něj.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error] kořenový layout selhal", error);
    Sentry.captureException(error, { tags: { boundary: "global-error" } });
  }, [error]);

  return (
    // global-error musí obsahovat html i body
    <html lang="cs" className="h-full">
      <body className="min-h-full bg-paper font-sans text-ink antialiased">
        <title>Chyba aplikace · Politicas</title>
        <main className="mx-auto max-w-3xl px-6 py-20">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
            neošetřená chyba aplikace
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            Aplikace spadla<span className="text-signal">.</span>
          </h1>
          <div className="mt-4 h-1 w-40 bg-signal" />
          <p className="mt-6 text-base leading-relaxed text-steel">
            Tohle není prázdný stav dat ani chybějící záznam — vykreslování stránky selhalo dřív,
            než se cokoli mohlo zobrazit. Chybu jsme zaznamenali; nic z toho, co vidíte, nejsou
            data.
          </p>
          {error.digest ? (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-steel">
              identifikátor chyby: <span className="text-ink">{error.digest}</span>
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="border-2 border-ink bg-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-paper transition-colors hover:border-signal hover:bg-signal"
            >
              Zkusit znovu
            </button>
            {/* Tvrdé načtení, ne <Link>: kořenový layout je v tomhle stavu
                rozbitý, takže klientská navigace by se vracela do stejného
                stromu. Celý dokument se musí postavit znovu. */}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="border-2 border-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong"
            >
              Načíst úvodní stranu znovu
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
