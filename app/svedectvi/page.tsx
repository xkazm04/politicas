import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import CitableNumber from "@/lib/claims/CitableNumber";
import { makeClaimRef, serializeClaim, type Claim } from "@/lib/claims/claim";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { CHAMBER_STATS } from "@/lib/civic/data";
import { CHAMBER_SUMMARY } from "@/lib/civic/leaderboard";
import SourceNote from "@/features/shared/components/SourceNote";

/*
 * /svedectvi — Svědectví čísel (batch 2E): referenční integrace citovatelného
 * formátování. Každá figura na této stránce se vykreslí byte-identicky s běžným
 * formátovačem, ale nese strojově čitelné data-claim-* atributy; ověřený claim
 * navíc vyzáří schema.org ClaimReview JSON-LD. Široká adopce (žebříček, spisy)
 * je práce pozdějších dávek — tady je ukázka a dokumentace slovníku.
 *
 * Copy je záměrně česky přímo zde (batch-1D precedent): katalog messages/*.json
 * je mimo plochu 2E.
 */

export const metadata: Metadata = {
  title: "Svědectví čísel — Politicas",
  description:
    "Každé číslo na Politicas může svědčit: nese strojově čitelný záznam o datasetu, datu a stavu ověření. Referenční ukázka citovatelného formátování.",
};

/** Ústavní velikost sněmovny — jediný ručně OVĚŘENÝ claim ukázky (čl. 16
 *  odst. 1 Ústavy ČR); u něj se proto smí vydat ClaimReview JSON-LD. */
const SEATS_CLAIM: Claim = {
  ref: makeClaimRef({ dataset: "Ústava ČR", metric: "pocet-poslancu" }),
  dataset: "Ústava ČR, čl. 16 odst. 1",
  metric: "pocet-poslancu",
  unit: "poslanců",
  sourceUrl: "https://www.psp.cz/docs/laws/constitution.html",
  retrievedAt: "2026-07-30",
  reviewStatus: "verified",
};

/** Agregáty vzorkové vrstvy lib/civic — poctivě `pending`: neprošly lidskou
 *  bránou, takže svědčí jen datovými atributy, nikdy jako ClaimReview. */
const AVG_CLAIM: Claim = {
  ref: makeClaimRef({ dataset: "civicscore v1.4", metric: "prumerny-kompozit" }),
  dataset: "civicscore v1.4",
  metric: "prumerny-kompozit",
  retrievedAt: "2026-07-30",
  reviewStatus: "pending",
};

const ATTENDANCE_CLAIM: Claim = {
  ref: makeClaimRef({ dataset: "psp.cz — jmenovitá hlasování", metric: "prumerna-dochazka" }),
  dataset: "psp.cz — jmenovitá hlasování",
  metric: "prumerna-dochazka",
  unit: "%",
  retrievedAt: "2026-07-30",
  reviewStatus: "pending",
};

const ATTENDANCE_SOURCE =
  CHAMBER_STATS.find((s) => s.key === "attendance")?.source ?? "psp.cz — jmenovitá hlasování";

export default async function SvedectviPage() {
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : defaultLocale;

  const exhibits = [
    {
      no: 1,
      label: "ústavní velikost sněmovny",
      value: 200,
      kind: "int" as const,
      claim: SEATS_CLAIM,
      withJsonLd: true,
      unit: "poslanců",
      cite: "Ústava ČR, čl. 16 odst. 1 — ověřeno",
      note: "Ověřený claim: figura vyzařuje i schema.org ClaimReview JSON-LD (viz zdrojový kód stránky).",
    },
    {
      no: 2,
      label: "průměrný kompozit sněmovny",
      value: CHAMBER_SUMMARY.avg,
      kind: "dec" as const,
      claim: AVG_CLAIM,
      withJsonLd: true,
      unit: "",
      cite: "civicscore v1.4 — ilustrativní vzorek",
      note: "Čeká na ověření: svědčí jen datovými atributy; ClaimReview se nevydá, i když o něj šablona požádá.",
    },
    {
      no: 3,
      label: "průměrná docházka",
      value: 78.3,
      kind: "dec" as const,
      claim: ATTENDANCE_CLAIM,
      withJsonLd: false,
      unit: "%",
      cite: `${ATTENDANCE_SOURCE} — ilustrativní vzorek`,
      note: "Čeká na ověření: svědčí jen datovými atributy.",
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-signal-deep">
        /svědectví
      </p>
      <h1 className="mt-2 text-4xl font-black uppercase tracking-tight text-ink sm:text-5xl">
        Svědectví čísel<span className="text-signal">.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink">
        Každé číslo na Politicas může svědčit: kromě viditelné hodnoty nese strojově čitelný
        záznam o svém původu — dataset, datum a stav lidského ověření (atributy{" "}
        <span className="font-mono">data-claim-*</span>). Ověřené figury navíc vydávají
        schema.org ClaimReview, takže citace cestuje s číslem i mimo tento web. Viditelná podoba
        se přitom nemění ani o bajt.
      </p>

      <div className="mt-10 space-y-10">
        {exhibits.map((ex) => (
          <section key={ex.no} aria-label={ex.label} className="border-t-2 border-ink pt-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-steel-aa">
              obr. {ex.no} — {ex.label}
            </p>
            <p className="mt-3 text-6xl font-black tracking-tight text-ink tabular-nums">
              <CitableNumber
                value={ex.value}
                claim={ex.claim}
                locale={locale}
                kind={ex.kind}
                withJsonLd={ex.withJsonLd}
              />
              {ex.unit && (
                <span className="ml-3 align-baseline text-lg font-bold uppercase tracking-tight text-steel-aa">
                  {ex.unit}
                </span>
              )}
            </p>
            <SourceNote className="mt-2">{ex.cite}</SourceNote>
            <p className="mt-3 text-sm leading-relaxed text-steel-aa">{ex.note}</p>
            <pre className="mt-3 overflow-x-auto border border-hairline bg-paper-strong p-3 font-mono text-xs leading-relaxed text-ink">
              {JSON.stringify(JSON.parse(serializeClaim(ex.claim)), null, 2)}
            </pre>
          </section>
        ))}
      </div>

      <div className="mt-12 border border-hairline p-4">
        <SourceNote as="sentence">
          pravidlo instrumentu — ClaimReview se vydává výhradně pro claimy se stavem „verified“
          (prošly lidskou bránou); vzorková data vrstvy lib/civic proto svědčí jen datovými
          atributy se stavem „pending“. Slovník claimů: lib/claims/claim.ts.
        </SourceNote>
      </div>
    </main>
  );
}
