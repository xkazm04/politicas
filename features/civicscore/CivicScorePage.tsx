"use client";

/*
 * CivicScore — plný žebříček republiky (/zebricek).
 * REÁLNÁ DATA: všech 207 poslanců 10. období (PSP10 — loader čte termCode
 * "PSP10"; stránka roky tvrdila „9. období") seřazených podle indexu přispění
 * (contribution_score) z deterministického znalostního grafu (psp.cz). Šest
 * složek se zveřejněnou vahou nahrazuje původní čtyři mock pilíře — každé číslo
 * pochází z grafu, žádné se zde nedopočítává ani nevymýšlí. Trend/delta
 * (čtvrtletní řada) nemá reálné podloží (jedno období) → vynecháno.
 *
 * OTEVŘENÝ INDEX (moonshot 1A, 2026-07-30): metodika sama je interaktivní
 * objekt. Sekce /01 nese šest posuvníků nad zveřejněnými vahami; jakmile se
 * čtenářovy váhy liší od metodiky, VŠECHNY sekce (rozložení, souboj, tabulka)
 * se přepočtou čistou funkcí reweigh() z lens.ts a stránka to nezaměnitelně
 * označí (kobalt + lepivý pruh „váš index — váhy …" s vektorem vah, takže ani
 * screenshot nejde vydávat za zveřejněný index). Při výchozích vahách se
 * čočka vůbec nepočítá — ukazuje se autoritativní skóre z grafu, nikdy směs.
 * Vektor vah žije v URL (?vahy=…, useLensWeights) — čočka je sdílitelná a
 * nese svou metodiku v odkazu.
 *
 * Data přicházejí jako typovaná prop z server-only loaderu getLeaderboardData.
 * Null (bez storu / prázdný graf) → stránka se vykreslí s ohlášeným upozorněním.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import type { LeaderboardListData, LeaderboardListEntry } from "./getLeaderboardData";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import ScoreHistogram from "./components/ScoreHistogram";
import DuelStatus from "./components/DuelStatus";
import HeadToHead from "./components/HeadToHead";
import LeaderboardTable from "./components/LeaderboardTable";
import WeightPanel from "./components/WeightPanel";
import { encodeWeights, PUBLISHED_WEIGHTS_LABEL, reweigh } from "./lens";
import { storedRefLabel } from "./provenance";
import { useLensWeights } from "./useLensWeights";
import { useFormat } from "@/lib/i18n/useFormat";

export default function CivicScorePage({ data }: { data: LeaderboardListData | null }) {
  const t = useTranslations("civicscore");
  const tm = useTranslations("metodika");
  const f = useFormat();
  // Souboj: max dva vybraní (klíč = pspId); třetí výběr vyřadí staršího.
  const initial = data?.entries.slice(0, 2).map((e) => e.pspId) ?? [];
  const [duel, setDuel] = useState<number[]>(initial);
  const toggleDuel = (pspId: number) =>
    setDuel((d) => (d.includes(pspId) ? d.filter((x) => x !== pspId) : [...d.slice(-1), pspId]));

  // Čtenářova čočka (?vahy=…). Výchozí metodika ⇒ lensView je null a všechny
  // sekce čtou autoritativní data z grafu beze změny.
  const lens = useLensWeights();
  const lensView = useMemo(
    () => (data && !lens.isDefault ? reweigh(data.entries, data.components, lens.weights) : null),
    [data, lens.isDefault, lens.weights],
  );
  const custom = lensView !== null;
  // Co sekce skutečně kreslí: čočka, nebo oficiální index — nikdy směs.
  const entries = useMemo(() => lensView?.entries ?? data?.entries ?? [], [lensView, data]);
  const components = lensView?.components ?? data?.components ?? [];

  const byId = useMemo(() => new Map(entries.map((e) => [e.pspId, e])), [entries]);
  const pair =
    duel.length === 2 && byId.has(duel[0]) && byId.has(duel[1])
      ? ([byId.get(duel[0])!, byId.get(duel[1])!] as [LeaderboardListEntry, LeaderboardListEntry])
      : null;
  // Rozřešený výběr (0–2) pro stavový řádek: jediné místo, kde se výběr
  // převádí na jména, aby hlášení a panel nemluvily o dvou různých dvojicích.
  const selectedEntries = useMemo(
    () => duel.map((id) => byId.get(id)).filter((e): e is LeaderboardListEntry => e !== undefined),
    [duel, byId],
  );

  // Pravé meta u sekcí: pod čočkou musí každá sekce říkat, čí čísla ukazuje.
  const lensAside = (
    <span className="font-mono text-xs uppercase tracking-widest text-cobalt">
      {t("lensBadge", { weights: encodeWeights(lens.weights) ?? "" })}
    </span>
  );

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      {/* ── Lišta ───────────────────────────────────────────── */}
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-steel">/ civicscore</span>
          </div>
          {/* Můj kraj (5E): kandidátka vlastního kraje; odkaz nese čtenářovu čočku. */}
          <Link
            href={custom && encodeWeights(lens.weights) ? `/kraj?vahy=${encodeWeights(lens.weights)}` : "/kraj"}
            className="font-mono text-xs uppercase tracking-widest text-steel-aa transition-colors hover:text-ink"
          >
            {t("toKrajLink")}
          </Link>
        </div>
      </header>

      {/* ── Lepivý pruh vlastní čočky ───────────────────────────
          Viditelný po celou dobu scrollování, s vektorem vah v textu — čtenář
          (ani screenshot) nesmí zaměnit svou čočku za zveřejněný index. */}
      {custom && (
        <div className="sticky top-0 z-20 border-b-2 border-ink bg-cobalt">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-paper">
              {t("lensStickyLine", { weights: encodeWeights(lens.weights) ?? "" })}
            </p>
            <button
              type="button"
              onClick={lens.reset}
              className="inline-flex items-center gap-1.5 border-2 border-paper px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-paper transition-colors hover:bg-paper hover:text-cobalt"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              {t("resetToPublished")}
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6">
        {/* ── Titulní pás ───────────────────────────────────── */}
        <div className="py-10">
          <SourceNote tone="signal">{t("sourceNote", { weights: PUBLISHED_WEIGHTS_LABEL })}</SourceNote>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl"
          >
            {t("title")}<span className="text-signal">.</span>
          </motion.h1>
          <div className="mt-4 max-w-xl">
            <SectionRule />
          </div>
          {/* Počet poslanců je MĚŘENÝ údaj, ne literál: „Všech 207" stálo v katalogu
              v obou jazycích a přežilo by i změnu sněmovny. Bez storu se počet
              netvrdí vůbec — věta bez čísla je poctivější než číslo bez dat. */}
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel">
            {data ? t("lead", { count: f.int(data.summary.count) }) : t("leadNoData")}
          </p>
          {data && (
            <>
              {/* Původ SKÓRE, ne verze metodiky. Stránka dřív citovala „metodika
                  v1.4" — verzi smazaného mock datasetu se čtyřmi pilíři; reálný
                  šestisložkový index žádné číslo verze nenese. Co data opravdu
                  nesou, je průchod grafu, který skóre spočítal. */}
              {data.provenancePass !== null && (
                <SourceNote className="mt-3">
                  {t("provenanceNote", { pass: f.int(data.provenancePass) })}
                </SourceNote>
              )}
              {/* Metodika žije v kódu, skóre v datech — a mezi 29. 7. a 4. 8. 2026 se ty
                  dvě věci šest dní rozcházely, aniž by to kdokoli viděl. Tady se to
                  přiznává: ne chybová stránka, ale věta u čísla. */}
              {data.provenance.state === "mixed" && (
                <SourceNote className="mt-1.5">
                  {t("provenanceMixed", {
                    count: f.int(data.provenance.distinctCount),
                    withProv: f.int(data.provenance.covered),
                    total: f.int(data.provenance.total),
                  })}
                </SourceNote>
              )}
              {data.provenance.state === "absent" && (
                <SourceNote className="mt-1.5">{t("provenanceAbsent")}</SourceNote>
              )}
              {!data.provenance.formulaMatch && data.provenance.state !== "absent" && (
                <SourceNote className="mt-1.5">
                  {t("provenanceMismatch", {
                    dataRef: storedRefLabel(data.provenance),
                    codeRef: data.provenance.declaredRef,
                  })}
                </SourceNote>
              )}
              {/* Provenience říká, ČÍM se počítalo; tenhle odkaz říká CO se počítá.
                  /metodika vykresluje váhy, nasycení i otisk vzorce přímo z
                  lib/analysis/contribution.ts — do 2026-08-04 nebyl vzorec vidět nikde. */}
              <p className="mt-2">
                <Link
                  href="/metodika"
                  className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-signal hover:underline"
                >
                  {tm("linkLabel")}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </p>
              {/* Pokrytí se uzavřelo — věta to říká místo věčného „dosud probíhá". */}
              <SourceNote className="mt-1.5">
                {data.dossierCoverage.withDossier >= data.dossierCoverage.total
                  ? t("dossierComplete", { total: f.int(data.dossierCoverage.total) })
                  : t("dossierPartial", {
                      count: f.int(data.dossierCoverage.withDossier),
                      total: f.int(data.dossierCoverage.total),
                    })}
              </SourceNote>
            </>
          )}
        </div>

        {data === null ? (
          <div className="mb-20 border-2 border-dashed border-hairline p-8">
            <p className="text-base font-black uppercase tracking-wide">{t("noData")}</p>
          </div>
        ) : (
          <>
            {/* ── 01 Otevřený index ─────────────────────────── */}
            <section id="otevreny-index">
              <SectionHeading
                index={1}
                title={t("openIndexTitle")}
                aside={
                  custom ? lensAside : <SourceNote>{t("publishedWeights", { weights: PUBLISHED_WEIGHTS_LABEL })}</SourceNote>
                }
              />
              <div className="mt-8">
                <WeightPanel
                  components={data.components}
                  lens={lens}
                  totalRaw={lensView?.totalRaw ?? 100}
                  rowCount={entries.length}
                />
              </div>
            </section>

            {/* ── 02 Rozložení ──────────────────────────────── */}
            <section id="rozlozeni" className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={2}
                title={t("distributionTitle")}
                aside={custom ? lensAside : <SourceNote>{t("realNote", { count: f.int(entries.length) })}</SourceNote>}
              />
              <div className="mt-8">
                <ScoreHistogram
                  summary={lensView?.summary ?? data.summary}
                  histogram={lensView?.histogram ?? data.histogram}
                  custom={custom}
                />
              </div>
            </section>

            {/* ── 03 Souboj ───────────────────────────────────
                POJMENOVANÁ OBLAST (2026-08-12): `<section>` s přístupným
                jménem je `role="region"`, takže se dá v odečítačce vyjmenovat
                a přeskočit jako celek — do teď to byl bezejmenný blok, do
                kterého se navíc dá dostat výběrem z místa o čtyři obrazovky
                níž. `aria-label`, ne `aria-labelledby`: nadpis sází sdílený
                `SectionHeading`, který id nepřijímá (a je mimo tuhle dávku),
                a odkaz na jeho obal by do jména vtáhl i index „/03" a citaci
                vedle. */}
            <section id="souboj" aria-label={t("duelRegionAria")} className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={3}
                title={t("duelTitle")}
                aside={custom ? lensAside : <SourceNote>{t("duelSource")}</SourceNote>}
              />
              {/* Stojí ZDE, ne uvnitř HeadToHead: panel se přemontovává přes
                  AnimatePresence a živá oblast uvnitř přemontování je buď dvojí
                  čtení, nebo mlčení. */}
              <DuelStatus selected={selectedEntries} />
              <div className="mt-8">
                <HeadToHead
                  pair={pair}
                  components={components}
                  chamber={entries}
                  provenance={data.provenance}
                  custom={custom}
                />
              </div>
            </section>

            {/* ── 04 Žebříček ───────────────────────────────── */}
            <section id="vsichni" className="mt-14 border-t-4 border-ink pt-10 pb-20">
              <SectionHeading
                index={4}
                title={t("allTitle")}
                aside={custom ? lensAside : <SourceNote>{t("realNote", { count: f.int(entries.length) })}</SourceNote>}
              />
              <div className="mt-8">
                <LeaderboardTable
                  entries={entries}
                  clubs={data.clubs}
                  components={components}
                  provenance={data.provenance}
                  duel={duel}
                  onToggleDuel={toggleDuel}
                  custom={custom}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
