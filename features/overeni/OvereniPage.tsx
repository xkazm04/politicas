/*
 * /overeni — Civic Claim Gate: ověřovací plocha pro redakce.
 *
 * Serverová presentační komponenta (žádný klientský stav): formulář je čistý
 * GET (`?ref=…` — URL je ověření, dá se sdílet), verdikt sází z hotového
 * GateData, návod z guide.ts. Copy česky přímo zde (vzor ExhibitPage /
 * ReceiptPage — messages/*.json je mimo plochu).
 *
 * HRANICE PRODUKTU JE SOUČÁST SAZBY: brána ověřuje výhradně odkazy, které
 * politicas vydal — žádný fact-check volného textu. Rámeček s hranicí stojí
 * nad formulářem, ne pod čarou; to, co nástroj nedělá, je jeho definice.
 */

import Link from "next/link";
import { ArrowRight, ScanLine, Stamp } from "lucide-react";
import CopyLinkButton from "@/features/shared/components/CopyLinkButton";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { caseFileLinkFor } from "@/features/shared/provenance/caseFileLink";
import CitableNumber from "@/lib/claims/CitableNumber";
import { claimStatus } from "@/lib/claims/claim";
import { formattersFor } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { formatWeightCs } from "@/features/shared/provenance/receipt";
import type { GateData } from "./getVerdictData";
import { GUIDE_EXAMPLES, GUIDE_STEPS, type GuideExample } from "./guide";
import VerdictFocus from "./VerdictFocus";
import { gateHeadlineCs, gateStatusInfo, UNGATED_LABEL_CS } from "./gateVocabulary";
import {
  verdictGate,
  verdictHeadline,
  verdictLead,
  verdictTone,
  type GateVerdict,
  type VerdictTone,
} from "./verdict";

// ── Slovníček sazby ─────────────────────────────────────────────────────────

const FAMILY_LABELS: Record<GateVerdict["family"], string> = {
  figura: "figura (data-claim)",
  zdroj: "účtenka původu",
  graf: "citace pohledu na graf",
  exponat: "exponát velína",
  neznamy: "mimo rodiny politicas",
};

/** Barevný akcent verdiktu — tokeny, žádné hex hodnoty. Odstín NENÍ `kind`:
 *  existující, ale zamítnutý či nezkontrolovaný záznam nesmí nosit potvrzující
 *  kobalt (viz verdictTone). */
const VERDICT_TONE: Record<VerdictTone, { border: string; text: string }> = {
  confirmed: { border: "border-cobalt", text: "text-cobalt" },
  "gated-pending": { border: "border-ochre", text: "text-ink" },
  "gated-rejected": { border: "border-signal-deep", text: "text-signal-deep" },
  moved: { border: "border-signal-deep", text: "text-signal-deep" },
  unknown: { border: "border-steel-aa", text: "text-ink" },
};

/** Kotva odpovědi — formulář je čistý GET, takže odpověď přijde až s novou
 *  stránkou; sem míří i programové zaostření (VerdictFocus). */
const VERDICT_ID = "verdikt";

// ── Dílčí sazba verdiktu ────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-hairline py-2">
      <span className="w-40 shrink-0 font-mono text-xs font-bold uppercase tracking-wider text-steel-aa">
        {label}
      </span>
      <span className="min-w-0 break-all text-sm leading-relaxed text-ink">{children}</span>
    </div>
  );
}

/** Koncový bod záznamu — odkaz na NÁŠ spis, existuje-li pro tvar id; jinak
 *  jen štítek. Nikdy se nehádá (features/shared/provenance/caseFileLink.ts). */
function EndpointLink({ label, id, kind }: { label: string; id: string; kind: string }) {
  const link = caseFileLinkFor({ id, kind });
  if (!link) return <>{label}</>;
  return (
    <Link href={link.href} className="text-cobalt underline decoration-hairline underline-offset-2 hover:text-signal">
      {label}
    </Link>
  );
}

function VerdictBody({ verdict, locale }: { verdict: GateVerdict; locale: Locale }) {
  const f = formattersFor(locale);
  const num = (v: number, kind: "dec" | "int" | "czk") =>
    kind === "int" ? f.int(v) : kind === "czk" ? f.czk(v) : f.dec(v);

  if (verdict.family === "figura" && verdict.kind !== "unknown") {
    const { figure } = verdict;
    return (
      <div className="mt-4">
        <Row label="tvrzení dnes">
          <span className="text-lg font-black tabular-nums">
            <CitableNumber value={figure.value} claim={figure.claim} locale={locale} kind={figure.kind} />
            {figure.claim.unit !== undefined && (
              <span className="ml-1.5 text-xs font-bold uppercase text-steel-aa">{figure.claim.unit}</span>
            )}
          </span>{" "}
          <span className="text-steel-aa">
            ({figure.claim.retrievedAt !== undefined ? f.date(figure.claim.retrievedAt) : "datum nezaznamenáno"})
          </span>
        </Row>
        {verdict.citedValue !== null && (
          <Row label="citováno">
            <span className="text-lg font-black tabular-nums">{num(verdict.citedValue, figure.kind)}</span>{" "}
            <span className="text-steel-aa">
              ({verdict.citedDate !== null ? f.date(verdict.citedDate) : "datum citace payload nenese"})
            </span>
          </Row>
        )}
        <Row label="dataset">{figure.claim.dataset}</Row>
        <Row label="metrika">{figure.claim.metric}</Row>
        <Row label="stav lidské brány">{gateStatusInfo(claimStatus(figure.claim)).labelCs}</Row>
        <Row label="figura vydaná na">
          <Link href={figure.issuedAt} className="text-cobalt underline-offset-2 hover:underline">
            {figure.issuedAt}
          </Link>
        </Row>
      </div>
    );
  }

  if (verdict.family === "zdroj" && verdict.kind === "verified") {
    const r = verdict.receipt;
    return (
      <div className="mt-4">
        {r.kind === "edge" ? (
          <>
            <Row label="záznam">
              <EndpointLink label={r.subject.label} id={r.subject.id} kind={r.subject.kind} />{" "}
              <span className="text-steel-aa">{r.relLabel}</span>{" "}
              <EndpointLink label={r.object.label} id={r.object.id} kind={r.object.kind} />
            </Row>
            {r.weight !== null && <Row label="váha záznamu">{formatWeightCs(r.weight)}</Row>}
            <Row label="stav lidské brány">
              {r.gate === null ? UNGATED_LABEL_CS : gateStatusInfo(r.gate.status).labelCs}
            </Row>
          </>
        ) : (
          <Row label="záznam">
            {r.subject.label} <span className="text-steel-aa">({r.subject.kind})</span>
          </Row>
        )}
        <Row label="původ">
          {r.provenance.method ?? "metoda nezaznamenána"}
          {r.provenance.pass !== null && <span className="text-steel-aa"> · průchod {r.provenance.pass}</span>}
        </Row>
        <Row label="plná účtenka">
          <Link href={`/zdroj/${r.ref}`} className="inline-flex items-center gap-1 text-cobalt underline-offset-2 hover:underline">
            /zdroj/… <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Row>
      </div>
    );
  }

  if ((verdict.family === "graf" || verdict.family === "exponat") && verdict.kind !== "unknown") {
    const v = verdict.view;
    const path = verdict.family === "graf" ? `/graf/p/${v.encoded}` : `/dashboard/exponat/${v.encoded}`;
    return (
      <div className="mt-4">
        <Row label="obsah">{v.title}</Row>
        <Row label="otisk citace">
          <span className="font-mono">{v.citedHash}</span>{" "}
          <span className="text-steel-aa">(datum vydání adresa nenese)</span>
        </Row>
        <Row label="otisk dnes">
          <span className="font-mono">{v.currentHash}</span>{" "}
          <span className="text-steel-aa">({f.date(v.currentDate)}, fnv-1a/32)</span>
        </Row>
        <Row label="plný pohled">
          <Link href={path} className="inline-flex items-center gap-1 text-cobalt underline-offset-2 hover:underline">
            {verdict.family === "graf" ? "/graf/p/…" : "/dashboard/exponat/…"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Row>
      </div>
    );
  }

  return null;
}

function VerdictPanel({ verdict, locale }: { verdict: GateVerdict; locale: Locale }) {
  const tone = VERDICT_TONE[verdictTone(verdict)];
  const gate = verdictGate(verdict);
  return (
    <section
      id={VERDICT_ID}
      tabIndex={-1}
      aria-label="verdikt brány"
      aria-live="polite"
      className={`mt-8 border-2 border-ink border-l-8 ${tone.border} bg-paper p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt`}
    >
      <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-steel-aa">
        rozpoznáno: {FAMILY_LABELS[verdict.family]}
      </p>
      <h2 className={`mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl ${tone.text}`}>
        {verdictHeadline(verdict)}
      </h2>
      {/* Stav lidské brány STOJÍ V HLAVIČCE, ne šedesát pixelů pod ní: existence
          záznamu a jeho schválení jsou dvě různá tvrzení a screenshot musí unést
          obě. Zamítnutá vazba se tak nedá vyfotit jako „OVĚŘENO". */}
      {gate !== null && (
        <p
          className={`mt-1.5 text-lg font-black uppercase tracking-tight sm:text-xl ${
            gate.kind === "ungated" ? "text-steel-aa" : tone.text
          }`}
        >
          {gate.kind === "ungated" ? UNGATED_LABEL_CS : gateHeadlineCs(gate.info)}
        </p>
      )}
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink">{verdictLead(verdict)}</p>
      <VerdictBody verdict={verdict} locale={locale} />
    </section>
  );
}

// ── Stránka ─────────────────────────────────────────────────────────────────

export default function OvereniPage({
  data,
  input,
  locale,
  examples = GUIDE_EXAMPLES,
}: {
  data: GateData;
  input: string;
  locale: Locale;
  /** Sada příkladů návodu; výchozí je ilustrační fallback (guide.ts). */
  examples?: readonly GuideExample[];
}) {
  return (
    <main className="min-h-screen bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
            politicas / ověření
          </span>
          <SourceNote className="hidden sm:block">
            znovuodvozeno ze záznamu při každém ověření
          </SourceNote>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="py-10">
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-signal">
            <Stamp className="h-3.5 w-3.5" aria-hidden /> civic claim gate
          </p>
          <h1 className="mt-2 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            Ověření citace<span className="text-signal">.</span>
          </h1>
          <div className="mt-3 max-w-md">
            <SectionRule />
          </div>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-steel-aa">
            Vložte politicas odkaz — účtenku původu, citaci pohledu na graf, exponát velína,
            claim-ref nebo zkopírovaný element s <span className="font-mono">data-claim-*</span>{" "}
            atributy. Brána tvrzení znovu odvodí proti dnešnímu záznamu a odpoví jednou ze tří
            odpovědí: ověřeno · hodnota se pohnula · neznámý odkaz.
          </p>

          {/* Hranice produktu — stojí NAD formulářem, je to definice nástroje. */}
          <div className="mt-6 border-2 border-ink bg-paper-strong p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-signal-deep">
              hranice nástroje
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">
              <strong>Tohle není fact-check volného textu.</strong> Brána ověřuje výhradně
              odkazy, které politicas sám vydal — pravdivost cizích výroků neposuzuje a nikdy
              posuzovat nebude. Právě to je produkt: číslo odvozené z veřejného záznamu se nedá
              vyfabulovat, protože jeho adresa se dá kdykoli znovu přepočítat.
            </p>
          </div>
        </div>

        <form action="/overeni" method="get" className="border-2 border-ink bg-paper p-5">
          <label
            htmlFor="overeni-ref"
            className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.25em] text-steel-aa"
          >
            <ScanLine className="h-3.5 w-3.5" aria-hidden /> politicas odkaz k ověření
          </label>
          <textarea
            id="overeni-ref"
            name="ref"
            rows={3}
            defaultValue={input}
            placeholder={'např. /zdroj/h.… nebo <data value="200" data-claim-ref="claim:…" …>'}
            className="mt-3 w-full resize-y border border-hairline bg-paper-strong p-3 font-mono text-sm leading-relaxed text-ink placeholder:text-steel-aa focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
          />
          <button
            type="submit"
            className="mt-3 inline-flex items-center gap-1.5 border border-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-paper-strong hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt"
          >
            ověřit proti záznamu <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </form>

        <VerdictFocus targetId={VERDICT_ID} token={input} />

        {/* Prázdný stav NENÍ prázdno: plocha bez odpovědi říkala doslova nic,
            takže po prvním načtení nebylo poznat, že formulář vůbec funguje. */}
        {data.status === "empty" && (
          <section
            aria-label="zatím bez odpovědi"
            className="mt-8 border-2 border-dashed border-hairline bg-paper p-5"
          >
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-steel-aa">
              zatím bez odpovědi
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink">
              Vložte odkaz nebo zkopírovanou citaci do pole výše a brána odpoví jednou ze tří
              odpovědí. Nevíte, kde adresu vzít? Každá peněžní vazba na{" "}
              <Link href="/penize" className="text-cobalt underline-offset-2 hover:underline">
                /penize
              </Link>{" "}
              nese odkaz <span className="font-mono">účtenka</span> (/zdroj/…) — a hotové příklady
              i s tlačítkem kopírovat jsou{" "}
              <a href="#priklady" className="text-cobalt underline-offset-2 hover:underline">
                níže v návodu
              </a>
              .
            </p>
          </section>
        )}

        {data.status === "unavailable" && (
          <section
            id={VERDICT_ID}
            tabIndex={-1}
            aria-label="verdikt brány"
            aria-live="polite"
            className="mt-8 border-2 border-ink border-l-8 border-steel-aa bg-paper p-5"
          >
            <h2 className="text-2xl font-black uppercase tracking-tight text-steel-aa">
              Záznam je teď nedostupný.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink">
              Databáze grafu je jednopřipojen&shy;í a právě ji drží jiný proces. Tohle{" "}
              <strong>není</strong> verdikt o odkazu — zkuste to znovu za chvíli.
            </p>
          </section>
        )}
        {data.status === "ok" && <VerdictPanel verdict={data.verdict} locale={locale} />}

        {/* ── Návod pro redakce ─────────────────────────────────────────── */}
        <section aria-label="jak citovat, aby to bylo ověřitelné" className="mt-14">
          <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
            Jak citovat, aby to bylo ověřitelné<span className="text-signal">.</span>
          </h2>
          <div className="mt-3 max-w-md">
            <SectionRule />
          </div>
          <ol className="mt-6 space-y-5">
            {GUIDE_STEPS.map((step) => (
              <li key={step.no} className="border-t border-hairline pt-4">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-signal-deep">
                  krok {step.no}
                </p>
                <h3 className="mt-1 text-base font-black uppercase tracking-tight">{step.title}</h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-steel-aa">{step.body}</p>
              </li>
            ))}
          </ol>

          <h3
            id="priklady"
            className="mt-10 scroll-mt-6 font-mono text-xs font-bold uppercase tracking-[0.25em] text-steel-aa"
          >
            příklady odkazů, které brána přijímá
          </h3>
          <div className="mt-3 space-y-4">
            {examples.map((ex) => (
              <figure key={ex.label} className="border border-hairline">
                <figcaption className="border-b border-hairline bg-paper-strong px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ink">
                  {ex.label}
                </figcaption>
                <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed text-ink">
                  {ex.input}
                </pre>
                {/* Kopírovat + ověřit jen u příkladu, který brána DNES ověří —
                    ilustrační tvar by pod tlačítkem skončil na „Neznámý odkaz.". */}
                {ex.live && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-3 py-2">
                    <CopyLinkButton
                      path={ex.input}
                      label="kopírovat příklad"
                      copiedLabel="příklad zkopírován"
                      failedLabel="kopírování se nezdařilo — vyberte text výše ručně"
                      errorContext="ověření citace: kopírování příkladu selhalo"
                    />
                    <Link
                      href={`/overeni?ref=${encodeURIComponent(ex.input)}#${VERDICT_ID}`}
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-cobalt underline-offset-2 hover:underline"
                    >
                      ověřit tento příklad <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                )}
                <p className="border-t border-hairline px-3 py-1.5 text-xs leading-relaxed text-steel-aa">
                  {ex.note}
                </p>
              </figure>
            ))}
          </div>
        </section>

        <div className="mt-12 border border-hairline p-4">
          <SourceNote as="sentence">
            pravidlo instrumentu — brána nic neukládá a nic nefactcheckuje: každou rodinu adres
            posílá do jejího vlastnického odvození (účtenka původu, citace grafu, exponát velína,
            rejstřík vydaných figur) a odpověď jen překládá do tří verdiktů. Slovník:
            features/overeni/verdict.ts.
          </SourceNote>
        </div>
      </div>
    </main>
  );
}
