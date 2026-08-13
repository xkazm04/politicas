"use client";

/**
 * Linie klubů nad REÁLNÝM záznamem — žebříček průměrné disciplíny a soudržnosti
 * (Rice) přes všechna platná hlasování, matice linií nad posledními 12 zápisy
 * deníku a metodická poznámka zveřejňující celé pravidlo výpočtu (vzor
 * stateSlice: ohraničená poznámka + SourceNote).
 */

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { MIN_CLUB_POSITIONAL } from "@/lib/analysis/kg";
import { useFormat } from "@/lib/i18n/useFormat";
import SourceNote from "@/features/shared/components/SourceNote";
import { MONEY_MEMO_TTL_MS } from "@/features/dashboard/freshness";
import { clubStyle } from "../record/clubStyle";
import { votePspUrl } from "../record/anchor";
import { RECONCILE_BUCKETS, type ReconcileBucket } from "../record/reconcile";
import type { ClubAggregate, LedgerVote, VoteRecordData } from "../record/types";

/** Kolik nejnovějších zápisů deníku matice sází. Do popisku se INTERPOLUJE —
 *  „posledních 12" v katalogu bylo číslo, které tenhle řádek mohl kdykoli
 *  vyvrátit, a nad kratším deníkem bylo rovnou nepravdivé. */
const MATRIX_WINDOW = 12;

/** Od jaké disciplíny (v %) se buňka kreslí plnou barvou. Táž konstanta pod
 *  matricí i v poznámce, která ji čtenáři vysvětluje. */
const STRONG_DISCIPLINE_PCT = 90;

/** Co dnes SKUTEČNĚ omezuje stáří čísel na téhle ploše: ne revalidace routy
 *  (lib/i18n/request.ts čte cookie, takže je celá aplikace dynamická), ale memo
 *  odvozeného záznamu — features/votetrack/ledgerMemo.ts. Okno je importované
 *  z /dashboard, nikdy tu předeklarované (vzor FollowTheMoneyPage). */
const RECORD_MEMO_HOURS = MONEY_MEMO_TTL_MS / 3_600_000;

export default function RealDisciplineBoard({
  data,
  onSelectVote,
}: {
  data: VoteRecordData;
  /** Jump the matrix column's vote into the ledger detail. */
  onSelectVote: (votePspId: number) => void;
}) {
  const t = useTranslations("votetrack");
  // Linie klubu je „pro"/„proti" — TÁŽ dvojice slov, jakou vedle vypisuje deník
  // i kronika rebelií (common.voteChoice.*). Vlastní kopie by ve dvou sekcích
  // jedné stránky pojmenovala jednu věc dvakrát.
  const tcom = useTranslations("common");
  const f = useFormat();
  const reduceMotion = useReducedMotion();
  const ranked: ClubAggregate[] = [...data.clubs].sort(
    (a, b) => (b.avgDiscipline ?? -1) - (a.avgDiscipline ?? -1) || a.club.localeCompare(b.club, "cs"),
  );
  const matrixVotes: LedgerVote[] = data.ledger.slice(0, MATRIX_WINDOW);

  return (
    <div className="min-w-0">
      <div className="grid gap-12 lg:grid-cols-[5fr_7fr]">
        {/* ── žebříček disciplíny ───────────────────────────── */}
        <div className="min-w-0">
          <SourceNote>{t("record.disciplineNote", { valid: data.coverage.valid })}</SourceNote>
          <div className="mt-3 border-t-2 border-ink">
            {ranked.map((c, i) => {
              const style = clubStyle(c.club);
              const pct = c.avgDiscipline === null ? null : c.avgDiscipline * 100;
              return (
                <motion.div
                  key={c.club}
                  initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ delay: reduceMotion ? 0 : i * 0.04 }}
                  className="grid grid-cols-[2rem_7.5rem_1fr_4.5rem] items-center gap-3 border-b border-hairline px-1 py-3.5"
                >
                  <span className={`font-mono text-lg font-bold ${i === 0 ? "text-signal" : "text-steel-aa"}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-black uppercase tracking-tight">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: style.color }} />
                      <span className="truncate">{style.short}</span>
                      <span className="font-mono text-[11px] font-normal text-steel-aa">{c.seats}</span>
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-wider text-steel-aa">
                      {t("record.cohesionColumn")}{" "}
                      <span className="font-bold tabular-nums">
                        {c.cohesion === null ? "—" : f.dec(Math.round(c.cohesion * 1000) / 10)}
                      </span>
                    </span>
                    {/* Každé z obou čísel řádku má VLASTNÍ jmenovatel a ani jeden
                        se nerovná počtu platných hlasování: disciplína se měří
                        tam, kde klub měl linii, soudržnost tam, kde měl dost
                        pozičních hlasů. Klub, který se půlku období zdržel, tak
                        stál pod větou o „všech {valid} hlasováních" s dvojnásobnou
                        deklarovanou základnou. */}
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-steel-aa">
                      {t("record.clubBasis", {
                        lineVotes: f.int(c.lineVotes),
                        riceVotes: f.int(c.riceVotes),
                      })}
                    </span>
                  </span>
                  <span className="h-4 w-full bg-hairline">
                    <motion.span
                      className="block h-full bg-cobalt"
                      initial={reduceMotion ? false : { width: 0 }}
                      whileInView={{ width: `${pct ?? 0}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : i * 0.04 }}
                    />
                  </span>
                  <span className="text-right text-lg font-black tabular-nums">
                    {pct === null ? <span className="text-steel-aa">—</span> : `${f.dec(Math.round(pct * 10) / 10)} %`}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── matice linií ──────────────────────────────────── */}
        <div className="min-w-0">
          {/* Deník kratší než okno je reálný stav (čerstvě naingestované období),
              ne chyba — a věta o „posledních {MATRIX_WINDOW}" by v něm lhala. */}
          <SourceNote>
            {matrixVotes.length < MATRIX_WINDOW
              ? t("record.matrixNoteShort", { shown: f.int(matrixVotes.length), window: f.int(MATRIX_WINDOW) })
              : t("record.matrixNote", { window: f.int(MATRIX_WINDOW) })}
          </SourceNote>
          <div className="mt-3 overflow-x-auto">
            {/* Matice JE tabulka a od 2026-08-12 se tak i čte: `scope` říká
                odečítačce, ke které hlavičce buňka patří (bez něj čte holá
                čísla), a klubový sloupec je hlavičkou řádku, ne buňkou. */}
            <table className="w-full min-w-[34rem] border-collapse text-center">
              <caption className="sr-only">{t("record.matrixCaption")}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-b-2 border-ink py-2 pr-3 text-left font-mono text-[11px] uppercase tracking-widest text-steel-aa"
                  >
                    {t("record.partyHeader")}
                  </th>
                  {matrixVotes.map((v) => (
                    <th key={v.pspId} scope="col" className="border-b-2 border-ink px-1.5 py-2">
                      <button
                        type="button"
                        onClick={() => onSelectVote(v.pspId)}
                        title={v.title}
                        className="font-mono text-[11px] uppercase tracking-wider text-steel-aa transition-colors hover:text-ink motion-reduce:transition-none"
                      >
                        {v.votedOn ? f.date(v.votedOn) : `#${v.pspId}`}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.clubs.map((c) => {
                  const style = clubStyle(c.club);
                  return (
                    <tr key={c.club} className="border-b border-hairline">
                      {/* Klub je HLAVIČKA ŘÁDKU, ne buňka: bez `scope="row"`
                          přečte odečítačka v každé buňce jen datum sloupce a
                          holé číslo, o klubu ani slovo. Tečka je dekorace
                          (barva je tady jediný její obsah a ten nese text
                          vedle); jméno klubu se čte tak, jak je vidět —
                          `clubStyle` sází displejovou formu („TOP 09"), a
                          `sr-only` kopie by nabídla jen rejstříkovou zkratku
                          („TOP09"), tedy horší čtení téhož. */}
                      <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                        <span className="flex items-center gap-1.5 text-sm font-black uppercase">
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: style.color }}
                          />
                          {style.short}
                        </span>
                      </th>
                      {matrixVotes.map((v) => {
                        const s = v.stat.byClub[c.club];
                        const disc = s?.discipline ?? null;
                        if (!s || s.line === null || disc === null) {
                          return (
                            <td key={v.pspId} className="px-1.5 py-2.5">
                              <span className="inline-flex min-w-[3.75rem] items-center justify-center border-2 border-dashed border-hairline px-1.5 py-1 font-mono text-xs text-steel-aa">
                                <span aria-hidden>—</span>
                                {/* Pomlčka je tvrzení („klub linii neměl"), ne
                                    prázdná buňka — a odečítačce se dá říct jen slovem. */}
                                <span className="sr-only">{t("record.matrixNoLine")}</span>
                              </span>
                            </td>
                          );
                        }
                        const pct = Math.round(disc * 100);
                        const strong = pct >= STRONG_DISCIPLINE_PCT;
                        return (
                          <td key={v.pspId} className="px-1.5 py-2.5">
                            <span
                              className={`inline-flex min-w-[3.75rem] items-center justify-center gap-1 border-2 px-1.5 py-1 font-mono text-xs font-bold tabular-nums ${
                                s.line === "yes"
                                  ? strong
                                    ? "border-cobalt bg-cobalt text-paper"
                                    : "border-cobalt text-cobalt"
                                  : strong
                                    ? "border-signal-deep bg-signal-deep text-paper"
                                    : "border-signal-deep text-signal-deep"
                              }`}
                            >
                              {/* Šipka NESE VÝZNAM (linie klubu), a byla to holá
                                  glyfa: kdo ji nevidí nebo nerozliší dva
                                  trojúhelníky, četl jen číslo. Vidět zůstává
                                  glyfa, slyšet je linie i to, že číslo je
                                  disciplína v procentech. */}
                              <span aria-hidden>{s.line === "yes" ? "▲" : "▼"}</span>
                              <span className="sr-only">
                                {t("record.matrixCellAria", {
                                  line: s.line === "yes" ? tcom("voteChoice.for") : tcom("voteChoice.against"),
                                  pct: f.int(pct),
                                })}
                              </span>
                              <span aria-hidden>{f.int(pct)}</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-md text-sm italic leading-relaxed text-steel-aa">
            {t("record.matrixFootnote", { threshold: f.int(STRONG_DISCIPLINE_PCT) })}
          </p>
        </div>
      </div>

      {/* ── zveřejněné pravidlo (stateSlice disclosure pattern) ── */}
      <div className="mt-10 border-2 border-ink p-5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal-deep">{t("record.methodTitle")}</p>
        {/* Práh pozičních hlasů klubu se bere z konstanty, kterou derivace
            SKUTEČNĚ filtruje (lib/analysis/kg.ts) — precedens: RealRebellions
            čte MIN_ELIGIBLE_VOTES ze stejného modulu. */}
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">
          {t("record.methodBody", { minClubPositional: f.int(MIN_CLUB_POSITIONAL) })}
        </p>
        <SourceNote className="mt-3">
          {t("record.methodSource", {
            valid: data.coverage.valid,
            voided: data.coverage.voided,
            // Čtvrtá počítaná ztráta záznamu, vedle zmatečných a hlasování bez
            // jediného uloženého hlasu: platné hlasování, které zdroj nedatoval.
            withoutDate: f.int(data.coverage.withoutDate),
            ballots: f.int(data.coverage.ballots),
            from: data.coverage.from ? f.date(data.coverage.from) : "—",
            to: data.coverage.to ? f.date(data.coverage.to) : "—",
          })}
        </SourceNote>
        <SourceNote className="mt-2">
          {t("record.freshness", { ballots: f.int(data.coverage.ballots), hours: f.int(RECORD_MEMO_HOURS) })}
        </SourceNote>

        <ReconciliationNote data={data} />
      </div>
    </div>
  );
}

/**
 * Sněmovna kontroluje sama sebe — náš přepočet postavený vedle součtů, které
 * o týchž hlasováních zveřejnil zdroj (record/reconcile.ts).
 *
 * Rozdíl je NÁLEZ: vypíše se i s počtem a nejhorším příkladem (a ten příklad
 * dostane adresu na psp.cz, ať ho jde otevřít), ale ani jedna strana se
 * nepřepisuje — týž precedens jako nemožná data smluv. Okrový pruh nese jen
 * verze s rozdílem; shoda není nález datové kvality, a barvit ji jako varování
 * by tvrdilo něco jiného, než co se stalo.
 */
function ReconciliationNote({ data }: { data: VoteRecordData }) {
  const t = useTranslations("votetrack");
  const tcom = useTranslations("common");
  const f = useFormat();
  const r = data.reconciliation;
  const flagged = r.discrepancies > 0;
  const gaps = r.uncompared + r.withoutBallots;

  /* Obsah nálezu, ne jen jeho velikost. `worst.compared` (které sloty šlo
   * porovnat) a `worst.deltas` (o kolik se v každém liší) kontrola počítá od
   * začátku a do 2026-08-12 přecházely přes síť nevykreslené: čtenář se dozvěděl
   * „hlasování č. X se liší o N hlasů" a odešel na psp.cz bez tušení, KTERÝ
   * sloupec. Pořadí je RECONCILE_BUCKETS, ne pořadí klíčů objektu — deterministicky.
   * Znaménko se sází explicitně, číslo přes lib/format; nic se nepřepočítává. */
  const bucketLabel: Record<ReconcileBucket, string> = {
    yes: tcom("voteChoice.for"),
    no: tcom("voteChoice.against"),
    k: t("record.legendK"),
  };
  const worstDeltas = r.worst
    ? RECONCILE_BUCKETS.filter((b) => r.worst!.compared.includes(b))
        .map((b) => {
          const delta = r.worst!.deltas[b] ?? 0;
          const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
          return `${bucketLabel[b]} ${sign}${f.int(Math.abs(delta))}`;
        })
        .join(" · ")
    : "";

  return (
    <div
      className={`mt-5 border-l-4 px-4 py-3 ${flagged ? "border-ochre bg-ochre/5" : "border-hairline bg-paper-strong"}`}
    >
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">{t("record.reconcileTitle")}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">{t("record.reconcileMethod")}</p>

      {r.compared === 0 ? (
        <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-ink">{t("record.reconcileNone")}</p>
      ) : flagged ? (
        <>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-ink">
            {t("record.reconcileDiff", {
              discrepancies: f.int(r.discrepancies),
              compared: f.int(r.compared),
              // Identifikátor, ne množství: id se sází holé, nikdy po tisících.
              worstId: r.worst ? String(r.worst.votePspId) : "—",
              worstDistance: f.int(r.worst?.distance ?? 0),
            })}
          </p>
          {r.worst && (
            <>
              {/* Nález se dá přečíst až tady: který slot se porovnával a o kolik
                  se v něm přepočet a zveřejněný součet rozešly. Datum je den
                  hlasování, ne den výpočtu. */}
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">
                {t("record.reconcileWorstDeltas", {
                  worstId: String(r.worst.votePspId),
                  date: r.worst.votedOn ? f.date(r.worst.votedOn) : t("record.reconcileWorstNoDate"),
                  deltas: worstDeltas,
                })}
              </p>
              <a
                href={votePspUrl(r.worst.votePspId)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-mono text-xs uppercase tracking-wider text-steel-aa underline-offset-2 hover:text-ink hover:underline"
              >
                {t("record.reconcileWorstLink", { worstId: String(r.worst.votePspId) })} ↗
              </a>
            </>
          )}
        </>
      ) : (
        <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-ink">
          {t("record.reconcileAgree", { compared: f.int(r.compared), buckets: f.int(r.comparedBuckets) })}
        </p>
      )}

      {/* Rozsah kontroly — čtyři čísla, která summary počítá od začátku a která
          až do 2026-08-12 nikam nešla: kolik hlasování se kontrolovalo, ke kolika
          držíme aspoň jeden hlas, kolik jich šlo porovnat a kolik z nich sedí
          přesně. Bez nich se „porovnáno {compared}" nedalo zasadit do ničeho. */}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-steel-aa">
        {t("record.reconcileScope", {
          votes: f.int(r.votes),
          recounted: f.int(r.recounted),
          compared: f.int(r.compared),
          agreed: f.int(r.agreed),
        })}
      </p>

      {gaps > 0 && (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-steel-aa">
          {t("record.reconcileGaps", {
            uncompared: f.int(r.uncompared),
            withoutBallots: f.int(r.withoutBallots),
          })}
        </p>
      )}

      <SourceNote className="mt-2">
        {t("record.reconcileSource", {
          ballots: f.int(data.coverage.ballots),
          compared: f.int(r.compared),
          buckets: f.int(r.comparedBuckets),
        })}
      </SourceNote>
    </div>
  );
}
