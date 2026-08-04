"use client";

/*
 * Exponát — galerijní stránka jednoho citovatelného výřezu / faktu.
 *
 * Karta JE celá stránka: muzejní štítek s exponátem uprostřed, popiska s
 * pravidlem pod ním a citační patička s prameny, otiskem obsahu a datem
 * získání dat. Nic tu není navíc — exponát je určený k citování a vkládání
 * do článků, takže každý pixel buď nese obsah, nebo jeho původ.
 *
 * Obsah přichází ze serveru už znovuodvozený (viz ./getExhibitData.ts);
 * tahle komponenta jen sází a drží dvě lokální interakce: výběr uzlu na
 * plátně (nezrcadlí se do URL — adresa exponátu je adresou OBSAHU, ne stavu
 * prohlížení) a kopírování odkazu s potvrzením.
 *
 * Copy je záměrně česky přímo v komponentě (vzor DataUnavailable.tsx):
 * messages/*.json je sdílený soubor napříč paralelně stavěnými plochami a
 * tahle plocha do něj proto nezapisuje.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Stamp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useFormat } from "@/lib/i18n/useFormat";
import CopyLinkButton from "@/features/shared/components/CopyLinkButton";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { compactCzk } from "@/features/money/moneyTypes";
import StateGraphCanvas from "./components/StateGraphCanvas";
import type { DatedFact } from "./datedFacts";
import {
  FACT_SOURCE_LINKS,
  HASH_ALGORITHM,
  SLICE_SOURCE_LINKS,
  type ExhibitSourceLink,
  type ExhibitViewModel,
} from "./exhibit";

const TONE_DOT: Record<DatedFact["tone"], string> = {
  signal: "bg-signal",
  cobalt: "bg-cobalt",
  ink: "bg-steel",
};

/** Citační patička — prameny s odkazy, otisk obsahu, datum získání, průchod. */
function CitationFooter({
  sources,
  currentHash,
  urlHash,
  fresh,
  builtOn,
  pass,
  path,
}: {
  sources: ExhibitSourceLink[];
  currentHash: string;
  urlHash: string;
  fresh: boolean;
  builtOn: string;
  pass: number | null;
  path: string;
}) {
  const f = useFormat();
  return (
    <footer className="mt-10 border-t-4 border-ink pt-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">citace</p>
      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink">prameny</p>
          {/* Neznámý registr nedostane vymyšlený odkaz — jeho doslovné jméno
              nese štítek exponátu a tady se to řekne. */}
          {sources.length === 0 && (
            <p className="mt-2 font-mono text-xs text-steel-aa">
              registr bez veřejného odkazu — doslovné jméno pramene nese štítek exponátu
            </p>
          )}
          <ul className="mt-2 space-y-1">
            {sources.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-cobalt underline decoration-hairline underline-offset-2 transition-colors hover:text-signal"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink">otisk obsahu</p>
          <p className="mt-2 font-mono text-xs text-steel-aa">
            {HASH_ALGORITHM} <span className="font-bold text-ink">{currentHash}</span>
            {!fresh && <> · v adrese: {urlHash}</>}
          </p>
          <p className="mt-1 font-mono text-xs text-steel-aa">
            data získána {f.date(builtOn)}
            {pass !== null ? ` · průchod grafu č. ${f.int(pass)}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-6 border-t border-hairline pt-4">
        {/* Jedno tlačítko „kopírovat odkaz" v celém repu — vytažené 2026-08-04
            z ReceiptPage právě proto, aby druhá kopie nezůstala pozadu při
            první opravě (features/shared/components/CopyLinkButton.tsx). */}
        <CopyLinkButton path={path} errorContext="exponát: kopírování odkazu selhalo" />
        <p className="mt-2 break-all font-mono text-xs text-steel-aa">{path}</p>
        {/* Exponát je URČENÝ k citování — a citace, kterou nelze ověřit, je jen
            tvrzení. Brána (/overeni) tenhle tvar adresy zná (`family: exponat`)
            a odvodí ho proti dnešnímu záznamu znovu; odkaz je GET, takže
            odpověď má vlastní sdílitelnou adresu. */}
        <Link
          href={`/overeni?ref=${encodeURIComponent(path)}`}
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          ověřit tuto citaci <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </footer>
  );
}

/** Muzejní štítek jednoho datovaného faktu — datum, věta, částka, původ. */
function FactExhibit({ fact }: { fact: DatedFact }) {
  const tf = useTranslations("dashboard.feed");
  const f = useFormat();
  const locale = useLocale();
  return (
    <div className="border-2 border-ink bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-5 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
          <span className={`inline-block h-2.5 w-2.5 ${TONE_DOT[fact.tone]}`} aria-hidden />
          datovaný fakt
        </span>
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
          {f.date(fact.date)}
        </span>
      </div>
      <div className="px-5 py-10 sm:px-10 sm:py-14">
        <p className="max-w-3xl text-2xl font-black leading-snug tracking-tight sm:text-3xl">
          {tf(`fact.${fact.kind}`, { subject: fact.subject, detail: fact.detail ?? "" })}
          <span className="text-signal">.</span>
        </p>
        {fact.czk !== undefined && (
          <p className="mt-6 font-mono text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
            {compactCzk(fact.czk, locale)}
          </p>
        )}
        {fact.pending && (
          <SourceNote tone="signal" className="mt-6">
            {tf("factPending")}
          </SourceNote>
        )}
      </div>
      <div className="border-t border-hairline px-5 py-2.5">
        <SourceNote>zdroj: {fact.source}</SourceNote>
      </div>
    </div>
  );
}

export default function ExhibitPage({ data }: { data: ExhibitViewModel }) {
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  // Výběr uzlu je tady jen prohlížecí stav plátna — do URL se nezrcadlí,
  // protože adresa exponátu adresuje OBSAH a musí zůstat stabilní.
  const [selected, setSelected] = useState<string | null>(null);

  const isGone = data.status === "gone";
  const path = `/dashboard/exponat/${data.id}`;

  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
            politicas / exponát
          </span>
          <SourceNote className="hidden sm:block">
            znovuodvozeno ze znalostního grafu · {f.date(data.builtOn)}
          </SourceNote>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div className="py-10">
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
            <Stamp className="h-3.5 w-3.5" aria-hidden /> exponát
            {!isGone && <span className="text-steel-aa">č. {data.currentHash}</span>}
          </p>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl"
          >
            {data.kind === "rez" ? "Výřez grafu státu" : "Datovaný fakt"}
            <span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-3 max-w-md">
            <SectionRule />
          </div>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-steel-aa">
            Samonosný, citovatelný otisk z velína: obsah adresuje otisk v adrese, ne řádek v
            databázi — stránka ho při každém zobrazení deterministicky odvodí znovu z týchž
            registrů a případný rozdíl proti vydané verzi přizná.
          </p>
        </div>

        {/* Zastaralost se říká NAD exponátem, ne v patičce — čtenář citace ji
            musí potkat dřív než obsah. */}
        {!isGone && !data.fresh && (
          <div className="mb-6 border-2 border-signal bg-paper-strong px-4 py-3">
            <SourceNote tone="signal">
              obsah se od vydání tohoto odkazu změnil — otisk v adrese {data.urlHash} ≠ dnešní
              otisk {data.currentHash}; zobrazeno je dnešní sestavení, ne to citované
            </SourceNote>
          </div>
        )}

        {isGone ? (
          <div className="border-2 border-ink bg-paper px-5 py-10 sm:px-10 sm:py-14">
            <p className="max-w-3xl text-2xl font-black leading-snug tracking-tight sm:text-3xl">
              Tento fakt už dnešní sestavení knihy neodvozuje
              <span className="text-signal">.</span>
            </p>
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-steel-aa">
              Kniha datovaných faktů je okno nad živým grafem — novější fakta mohla tento řádek
              vytlačit, nebo se podkladová data změnila. Nic podobného se nedosazuje: exponát buď
              odpovídá vydanému otisku, nebo to řekne.
            </p>
            <SourceNote className="mt-6">
              otisk v adrese: {HASH_ALGORITHM} {data.urlHash} · znovuodvozeno {f.date(data.builtOn)}
            </SourceNote>
          </div>
        ) : data.kind === "rez" ? (
          <StateGraphCanvas graph={data.graph} rule={data.rule} selected={selected} onSelect={setSelected} />
        ) : (
          <FactExhibit fact={data.fact} />
        )}

        {!isGone && (
          <CitationFooter
            sources={
              data.kind === "rez"
                ? SLICE_SOURCE_LINKS
                : [
                    {
                      label: data.fact.source,
                      href: FACT_SOURCE_LINKS[data.fact.source] ?? "",
                    },
                  ].filter((s) => s.href !== "")
            }
            currentHash={data.currentHash}
            urlHash={data.urlHash}
            fresh={data.fresh}
            builtOn={data.builtOn}
            pass={data.pass}
            path={path}
          />
        )}

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> zpět do velína
          </Link>
        </div>
      </div>
    </main>
  );
}
