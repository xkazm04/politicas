"use client";

/*
 * Rozcestník krajů (/kraj) — výběr kraje pro volební kartu (moonshot 5E).
 *
 * Interakce podle precedensu TownPicker (features/budget — jen vzor, žádný
 * import): search-first pole s našeptávačem bez diakritiky a plným ovládáním
 * klávesnicí (šipky / Enter / Escape, ARIA combobox), pod ním rychlé volby.
 * Krajů je 14 + poctivý koš „kraj neuveden", takže chipy tu — na rozdíl od
 * 6 254 obcí — nesou celý výčet a hledání je zkratka, ne nutnost.
 *
 * Čtenářova čočka (?vahy=…) se při volbě kraje PŘENÁŠÍ do cílové adresy —
 * odkaz na kartu nese metodiku, kterou si čtenář nastavil.
 *
 * Česká copy inline — messages/*.json je mimo plochu (precedens batch 1D).
 */

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import { decodeWeights, LENS_PARAM } from "./lens";
import type { KrajInfo } from "./kraj";

/** Bez diakritiky, malými — jen pro hledání v tomhle poli. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function KrajPickerPage({ kraje }: { kraje: KrajInfo[] | null }) {
  const t = useTranslations("civicscore");
  const f = useFormat();
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!kraje) return [];
    const q = fold(query.trim());
    return q === "" ? kraje : kraje.filter((k) => fold(k.label).includes(q));
  }, [kraje, query]);

  /** Cíl volby — s přenosem platné čtenářovy čočky z aktuální adresy. */
  const hrefFor = (slug: string) => {
    if (typeof window !== "undefined") {
      const raw = new URL(window.location.href).searchParams.get(LENS_PARAM);
      if (raw && decodeWeights(raw)) return `/kraj/${slug}?${LENS_PARAM}=${raw}`;
    }
    return `/kraj/${slug}`;
  };

  const choose = (slug: string) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(hrefFor(slug));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      setActive((a) => Math.min(a + 1, results.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((a) => Math.max(a - 1, 0));
      e.preventDefault();
    } else if (e.key === "Home") {
      setActive(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setActive(results.length - 1);
      e.preventDefault();
    } else if (e.key === "Enter") {
      const hit = results[active];
      if (hit) choose(hit.slug);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    }
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel">/ {t("krajCrumb")}</span>
          <Link
            href="/zebricek"
            className="font-mono text-xs uppercase tracking-widest text-steel-aa transition-colors hover:text-ink"
          >
            {t("toFullLeaderboard")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <SourceNote tone="signal">{t("krajPickerSource")}</SourceNote>
        <h1 className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
          {t("krajTitle")}<span className="text-signal">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
          {t("krajPickerLead")}
        </p>

        {kraje === null ? (
          <div className="mt-10 border-2 border-dashed border-hairline p-8">
            <p className="text-base font-black uppercase tracking-wide">
              {t("krajPickerNoData")}
            </p>
          </div>
        ) : (
          <div className="relative mt-10 max-w-2xl">
            <div className="flex items-center gap-3 border-2 border-ink bg-paper px-4 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cobalt">
              <Search className="h-4 w-4 shrink-0 text-steel-aa" aria-hidden />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-activedescendant={
                  open && results[active] ? `${listboxId}-${results[active].slug}` : undefined
                }
                aria-autocomplete="list"
                aria-label={t("krajSearchAria")}
                className="w-full bg-transparent font-mono text-sm text-ink outline-none placeholder:text-steel-aa"
                placeholder={t("krajSearchPlaceholder")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  // Timeout: klik na položku (mousedown) musí proběhnout dřív,
                  // než blur seznam zavře — jinak by se nedalo kliknout myší.
                  window.setTimeout(() => setOpen(false), 120);
                }}
                onKeyDown={onKeyDown}
              />
            </div>

            {open && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label={t("krajResultsAria")}
                className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto border-2 border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)]"
              >
                {results.length === 0 && (
                  <li className="px-4 py-3 font-mono text-xs text-steel-aa" role="presentation">
                    {t("krajNoMatch", { count: f.int(kraje.length) })}
                  </li>
                )}
                {results.map((k, i) => (
                  <li
                    key={k.slug}
                    id={`${listboxId}-${k.slug}`}
                    role="option"
                    aria-selected={false}
                    className={`flex cursor-pointer items-baseline justify-between gap-3 border-b border-hairline px-4 py-2 ${
                      i === active ? "bg-ink text-paper" : "hover:bg-paper-strong"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(k.slug);
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="text-sm font-black uppercase tracking-tight">
                      {k.unassigned ? t("krajUnassignedLabel") : k.label}
                    </span>
                    <span className={`font-mono text-xs tabular-nums ${i === active ? "text-paper/70" : "text-steel-aa"}`}>
                      {/* citation-ok: zdroj počtů (registr psp.cz) cituje SourceNote v hlavičce stránky */}
                      {t("krajMpCount", { count: f.int(k.count) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Úplný výčet — 14 krajů + případný koš „neuveden" naráz. */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {kraje.map((k) => (
                <Link
                  key={k.slug}
                  href={hrefFor(k.slug)}
                  className={`border-2 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    k.unassigned
                      ? "border-dashed border-hairline text-steel-aa hover:text-ink"
                      : "border-hairline text-steel-aa hover:border-ink hover:text-ink"
                  }`}
                >
                  {k.unassigned ? t("krajUnassignedLabel") : k.label} · {f.int(k.count)}
                </Link>
              ))}
            </div>

            <p className="mt-6 font-mono text-xs leading-relaxed text-steel-aa">
              {t("krajPickerFootnote")}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
