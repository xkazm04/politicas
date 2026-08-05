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
 * COPY JE V KATALOGU (2026-08-05): čtenářské věty žijí v messages/{cs,en}.json
 * pod `schranka.*` a plocha je sází přes next-intl (precedens /overeni) —
 * čisté moduly (kindVocabulary.ts, recomputeFact.ts) vracejí KLÍČE, ne text.
 * Doslovné titulky záznamů (titleCs, source) jsou DATA deníku, ne copy —
 * nepřekládají se.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Eye, Inbox } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { useFormat } from "@/lib/i18n/useFormat";
import { compactCzk } from "@/features/money/moneyTypes";
import {
  DELTA_ENTRIES_CAP,
  FIRST_VISIT_DAYS,
  sinceDay,
  type DeltaEntry,
  type EntityDelta,
} from "./deriveDeltas";
import { schrankaFeedQuery } from "./feed";
import { kindTallies } from "./kindVocabulary";
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

/** Řádek delty — týž hlas jako řádek deníku (žádná nová věta, jen záznam).
 *  Titulek/zdroj s klíčem katalogu (`titleKey`/`sourceKey` — PLNÁ cesta:
 *  `denik.entry.*` u záznamů deníku, `schranka.delta.*` u vět skládaných
 *  schránkou) se sází kořenovým překladačem; řádek bez klíče zůstává doslova
 *  (`titleCs`/`source` — starší odpověď serveru, doslovná jména registrů). */
function DeltaRow({ e }: { e: DeltaEntry }) {
  const t = useTranslations("schranka");
  const tAll = useTranslations();
  const locale = useLocale();
  const f = useFormat();
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border-b border-hairline px-3 py-3">
      <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 ${TONE_DOT[e.tone]}`} aria-hidden />
      <span className="min-w-0 text-[15px] leading-relaxed">
        <span className="mr-2 font-mono text-[12px] font-bold tabular-nums text-steel-aa">
          {f.date(e.date)}
        </span>
        {e.internalHref ? (
          <Link href={e.internalHref} className="hover:text-signal-deep hover:underline">
            {e.titleKey ? tAll(e.titleKey, e.titleParams) : e.titleCs}
          </Link>
        ) : e.titleKey ? (
          tAll(e.titleKey, e.titleParams)
        ) : (
          e.titleCs
        )}
        {e.czk !== undefined && (
          <span className="ml-2 whitespace-nowrap font-mono text-[13px] font-bold tabular-nums">
            {compactCzk(e.czk, locale)}
          </span>
        )}
        <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-steel">
          [{e.sourceKey ? tAll(e.sourceKey, e.sourceParams) : e.source}]
        </span>
        {e.timeBasis === "zaznamenano" ? (
          <span className="ml-2 whitespace-nowrap border border-cobalt px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt">
            {t("delta.recordedBadge")}
          </span>
        ) : (
          <span className="ml-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-steel-aa">
            {t("delta.effectiveBadge")}
          </span>
        )}
        {e.pending && (
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-wider text-ochre">
            {t("delta.pendingNote")}
          </span>
        )}
      </span>
    </div>
  );
}

/** Souhrn druhů zápisu pod jménem entity — „3 smlouvy · 1 rozhodnutí brány".
 *  Počty jdou ze serveru a jsou spočítané PŘED seříznutím, takže mluví o celé
 *  deltě; strojový token bez slovníku se vypíše doslova a označí. */
function KindSummary({ kinds }: { kinds: EntityDelta["kinds"] }) {
  const t = useTranslations("schranka");
  const f = useFormat();
  const tallies = kindTallies(kinds);
  if (tallies.length === 0) return null;
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
      {tallies.map((tally, i) => (
        <span key={tally.kind}>
          {i > 0 && <span className="mr-3 text-hairline">·</span>}
          <span className="font-bold tabular-nums text-ink">{f.int(tally.count)}</span>{" "}
          {tally.nounKey !== null ? t(tally.nounKey, { count: tally.count }) : tally.kind}
          {!tally.translated && <span className="ml-1 text-ochre">{t("kinds.untranslated")}</span>}
        </span>
      ))}
    </p>
  );
}

function EntityBlock({ delta, storedLabel }: { delta: EntityDelta; storedLabel: string | null }) {
  const t = useTranslations("schranka");
  const f = useFormat();
  const label = delta.label !== delta.key ? delta.label : (storedLabel ?? delta.key);
  const isObec = delta.key.startsWith("obec:");
  return (
    <article className="border-2 border-ink">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b-2 border-ink bg-paper-strong px-4 py-3">
        <span className="flex min-w-0 flex-col">
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
          <KindSummary kinds={delta.kinds} />
        </span>
        <span className="flex items-center gap-3">
          <Link
            href={delta.denikHref}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            <Eye className="h-3 w-3" aria-hidden /> {t("entity.denikLink")}
          </Link>
          <FollowButton entityKey={delta.key} label={label} compact />
        </span>
      </div>

      {delta.total === 0 ? (
        <p className="px-4 py-4 text-sm leading-relaxed text-steel-aa">
          {isObec ? t("entity.obecEmpty") : t("entity.noChange")}
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
                {t("entity.more", { count: f.int(delta.total - delta.entries.length) })}
              </Link>
            </p>
          )}
        </>
      )}
    </article>
  );
}

export default function SchrankaPage() {
  const t = useTranslations("schranka");
  const f = useFormat();
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
    .map((f2) => f2.key)
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

  // Adresa odběru: origin se čte AŽ po připojení (na serveru žádný není a
  // dokreslit ho do prvního renderu je hydratační rozdíl); do té doby se
  // ukazuje relativní cesta, která funguje stejně.
  // (Zapisuje se v rAF, ne v těle efektu — týž důvod jako u razítka návštěvy:
  // synchronní setState v efektu je kaskádový render.)
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOrigin(window.location.origin));
    return () => cancelAnimationFrame(frame);
  }, []);
  const feedQuery = schrankaFeedQuery(
    state.follows.map((f2) => f2.key),
    since,
  );

  const storedLabels = new Map(state.follows.map((f2) => [f2.key, f2.label]));
  const firstVisit = visit !== null && visit.prev === null;
  const dropped = (data?.droppedEntries ?? 0) + (data?.droppedDeltas ?? 0);

  // Nečitelné vrstvy záznamu — fragmenty se skládají v pořadí vrstev (klíče
  // katalogu; fragment nese vlastní středník, viz messages/*.json).
  const coverageMissing: string[] = [];
  if (data && !data.coverage.money) coverageMissing.push(t("coverage.money"));
  if (data && !data.coverage.law) coverageMissing.push(t("coverage.law"));
  if (data && !data.coverage.reviews) coverageMissing.push(t("coverage.reviews"));
  if (data && !data.coverage.changes) coverageMissing.push(t("coverage.changes"));
  if (data && !data.coverage.dukazy) coverageMissing.push(t("coverage.dukazy"));
  if (data && !data.coverage.recompute) coverageMissing.push(t("coverage.recompute"));

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ schranka</span>
          <Link
            href="/denik"
            className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
          >
            {t("header.denikLink")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">{t("hero.kicker")}</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("hero.title")}
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">{t("hero.lead")}</p>

        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">{t("rule.kicker")}</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            {t.rich("rule.body1", {
              code: (chunks) => <code>{chunks}</code>,
            })}
            {firstVisit ? ` ${t("rule.firstVisit", { days: f.int(FIRST_VISIT_DAYS) })}` : ""}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-steel-aa">{t("rule.body2")}</p>
          <p className="mt-2 text-sm leading-relaxed text-steel-aa">
            {t.rich("rule.body3", {
              metodika: (chunks) => (
                <Link
                  href="/metodika"
                  className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
                >
                  {chunks}
                </Link>
              ),
              cap: f.int(DELTA_ENTRIES_CAP),
            })}
          </p>
        </div>

        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={1}
            title={t("followed.title")}
            aside={
              data ? (
                <SourceNote>
                  {t("followed.asideLoaded", {
                    since: f.date(data.since),
                    builtOn: f.date(data.builtOn),
                  })}
                </SourceNote>
              ) : (
                <SourceNote>{t("followed.aside")}</SourceNote>
              )
            }
          />

          {state.follows.length === 0 ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="flex items-start gap-3 text-lg">
                <Inbox className="mt-1 h-5 w-5 shrink-0 text-steel" aria-hidden />
                <span>
                  {t.rich("empty.body", {
                    dot: (chunks) => <span className="text-signal">{chunks}</span>,
                    btn: (chunks) => (
                      <span className="font-mono text-sm font-bold uppercase tracking-wider">
                        {chunks}
                      </span>
                    ),
                    denik: (chunks) => (
                      <Link
                        href="/denik"
                        className="font-mono text-sm font-bold uppercase tracking-widest text-signal-deep hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                    zebricek: (chunks) => (
                      <Link
                        href="/zebricek"
                        className="font-mono text-sm font-bold uppercase tracking-widest text-signal-deep hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </p>
            </div>
          ) : data === undefined ? (
            <p className="mt-8 border-2 border-dashed border-hairline p-8 text-lg" aria-live="polite">
              {t("loading")}
            </p>
          ) : data === null ? (
            <div className="mt-8 border-2 border-dashed border-hairline p-8">
              <p className="text-lg">{t("error.body")}</p>
            </div>
          ) : (
            <>
              {coverageMissing.length > 0 && (
                <div className="mt-6 max-w-2xl border-l-4 border-ochre bg-paper-strong px-4 py-3">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
                    {t("coverage.kicker")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-steel-aa">
                    {[t("coverage.intro"), ...coverageMissing, t("coverage.outro")].join(" ")}
                  </p>
                </div>
              )}

              {dropped > 0 && (
                <div className="mt-6 max-w-2xl border-l-4 border-ochre bg-paper-strong px-4 py-3">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
                    {t("dropped.kicker")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-steel-aa">
                    {t("dropped.body", { count: dropped, countFmt: f.int(dropped) })}
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
                  {t("footer.allDenik")}{" "}
                  <ArrowUpRight
                    className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </Link>
                <SourceNote>
                  {t("footer.followedNote", { count: f.int(state.follows.length) })}
                </SourceNote>
              </div>
            </>
          )}
        </section>

        {state.follows.length > 0 && (
          <section className="mt-14 border-t-4 border-ink pt-10">
            <SectionHeading
              index={2}
              title={t("subscribe.title")}
              aside={<SourceNote>{t("subscribe.aside")}</SourceNote>}
            />
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
              {t("subscribe.body", { count: f.int(state.follows.length) })}
            </p>
            <div className="mt-6 space-y-3">
              {(["xml", "json"] as const).map((format) => {
                const path = `/schranka/feed.${format}${feedQuery}`;
                return (
                  <div key={format} className="border-2 border-ink bg-paper-strong px-4 py-3">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
                      {format === "xml" ? "RSS 2.0" : "JSON Feed 1.1"}
                    </p>
                    <a
                      href={path}
                      className="mt-1 block break-all font-mono text-[12px] text-signal-deep hover:underline"
                    >
                      {origin}
                      {path}
                    </a>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <SourceNote>{t("subscribe.addressNote")}</SourceNote>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
