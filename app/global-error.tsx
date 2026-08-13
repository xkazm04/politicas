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
 * — tenhle soubor tedy funguje stejně s DSN i bez něj. Do 2026-08-13 to ale
 * čtenáři říkal opačně: „Chybu jsme zaznamenali" / „The error has been
 * reported" byla věta, která v tomhle repozitáři neplatí nikdy (DSN není
 * nastavené, takže se nezaznamenalo nic). Věta je pryč; zůstal identifikátor
 * pádu, který platí stejně s DSN i bez něj, a poznámka, co s ním.
 *
 * i18n: tahle plocha se vykresluje MIMO NextIntlClientProvider (kořenový layout
 * neexistuje), takže useTranslations tu není k dispozici. Copy je proto
 * bilingvní STATICKY — česky jako primární hlas, anglický řádek hned pod ním.
 * Žádná závislost na katalogu: poslední síť musí fungovat, i když spadl i18n.
 *
 * JAZYK DOKUMENTU. `<html lang="cs">` je správně a zůstává: jazyk kořene je
 * VÝCHOZÍ jazyk obsahu, ne jeho jediný jazyk, a čeština je tu primární hlas
 * (stojí první v každé dvojici). Locale čtenáře se odsud zjistit nedá —
 * cookie čte `lib/i18n/request.ts` na serveru a ten kontext tu není. Co bylo
 * skutečně rozbité: ze SEDMI anglických úseků nesly `lang="en"` jen DVA
 * odstavce, takže odečítačka četla „unhandled application error" i „Try
 * again" českou výslovností. Každý anglický úsek teď svůj `lang` má, včetně
 * poloviček uvnitř dvojjazyčných řádků; `<span>` bez tříd nemění sazbu ani
 * o pixel. Jediná výjimka je `<title>` — do titulku se element vložit nedá,
 * takže dvojjazyčný titulek zůstává deklarovaný jako český.
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
        <title>Chyba aplikace · Application error · Politicas</title>
        <main className="mx-auto max-w-3xl px-6 py-20">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep">
            neošetřená chyba aplikace <span lang="en">· unhandled application error</span>
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            Aplikace spadla<span className="text-signal">.</span>
          </h1>
          <p className="mt-2 text-xl font-bold uppercase tracking-tight text-steel" lang="en">
            The application crashed.
          </p>
          <div className="mt-4 h-1 w-40 bg-signal" />
          <p className="mt-6 text-base leading-relaxed text-steel-aa">
            Tohle není prázdný stav dat ani chybějící záznam — vykreslování stránky selhalo dřív,
            než se cokoli mohlo zobrazit. Nic z toho, co vidíte, nejsou data.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-steel-aa" lang="en">
            This is not an empty data state or a missing record — page rendering failed before
            anything could be shown. Nothing you see here is data.
          </p>
          {error.digest ? (
            <>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
                identifikátor chyby <span lang="en">· error id</span>:{" "}
                <span className="text-ink">{error.digest}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-steel-aa">
                Opište si ho, pokud budete chybu hlásit — je to jediný jednoznačný název tohohle
                pádu. Že se hlášení odeslalo samo, tahle plocha netvrdí: sběr chyb se zapíná
                v nasazení a nemusí běžet.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-steel-aa" lang="en">
                Copy it down if you report the error — it is the only unambiguous name this crash
                has. This page does not claim a report was sent on its own: error collection is
                switched on per deployment and may not be running.
              </p>
            </>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="border-2 border-ink bg-ink px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-paper transition-colors hover:border-signal hover:bg-signal"
            >
              Zkusit znovu <span lang="en">· Try again</span>
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
              Načíst úvodní stranu znovu <span lang="en">· Reload the home page</span>
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
