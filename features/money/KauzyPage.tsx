"use client";

/**
 * Kauzy / rozpracované podněty (/penize/kauzy) — nejcitlivější obsah platformy:
 * ruční investigativní spisy (batch-005), zveřejněné verbatim-věrně. Nikdy jeden
 * verdikt — vždy dva sloupce, přesně jak je napsal recenzní pas: „co zdroje
 * dokládají" / „co zdroje nedokládají". Každé tvrzení nese vlastní citaci. Vždy
 * pending_review — nic tady automaticky nepotvrzuje vazbu ani nesytí skóre.
 *
 * ── Co se změnilo 2026-08-11 a proč ────────────────────────────────────────────
 * Plocha se četla jako interní výpis, na stránce, kde se jmenují konkrétní lidé:
 *  • `registryFindings` — blok, který má vlastní typ i komentář „rendered as
 *    labelled key/value pairs, never re-summarized" — se NEVYKRESLOVAL VŮBEC.
 *    Rejstříkový nález je přitom to jediné, co u kauzy stojí na primárním
 *    zdroji; chyběl právě ten důkaz, kvůli kterému spis existuje.
 *  • `proposedAnnotation` se sázela přes `JSON.stringify` — vnořený objekt
 *    Okamurova spisu dopadl na čtenáře jako syrový JSON.
 *  • `mediaContext` má v korpusu DVA tvary (objekty × holé věty) a plocha znala
 *    jen jeden, takže čtyři odstavce Juchelkova spisu se vykreslily jako čtyři
 *    prázdné řádky s odkazem bez adresy.
 *  • `confidence` a `sourceKind` propadaly doslova jako anglické tokeny.
 * Analytická PRÓZA se naopak nepřepisuje ani nepřekládá — je to DATA, pracovní
 * materiál analytika. Plocha u ní jen přizná, co to je (`kauzy.proseDisclosure`).
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import SourceNote from "@/features/shared/components/SourceNote";
import CopyLinkButton from "@/features/shared/components/CopyLinkButton";
import { gateStatusInfo } from "@/features/overeni/gateVocabulary";
import { canonicalIco } from "./companyId";
import {
  DOSSIER_BOOL_KEYS,
  DOSSIER_EMPTY_TOKEN_KEY,
  DOSSIER_MACHINE_STRUCTURE_KEY,
  LEAD_DOSSIER_GATE_TOKEN,
  confidenceInfo,
  sourceKindInfo,
} from "./dossierVocabulary";
import type { LeadDossiers } from "./getLeadDossiers";
import type { PacketTarget } from "./getLeadPacketTargets";
import type { DossierMediaEntry, LeadDossier } from "./moneyTypes";
import { dossierAnchorId } from "./moneyTypes";

export default function KauzyPage({
  data,
  packetTargets = {},
}: {
  data: LeadDossiers;
  /** IČO kauzy → poslanci s doloženou linked_to vazbou (deterministický join
   *  grafem, viz getLeadPacketTargets) — cíle tlačítka „sestavit důkazní paket". */
  packetTargets?: Record<string, PacketTarget[]>;
}) {
  const { dossiers, directoryUnreadable, unreadableFiles } = data;
  const t = useTranslations("money");

  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ penize / kauzy</span>
          {/* Spis je jeden konec stopy — druhý je peněžní ledger a třetí veřejná
              nástěnka rozhodnutí brány. Do 2026-08-11 nevedl odsud ani jeden. */}
          <span className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs uppercase tracking-widest">
            <Link
              href="/penize"
              className="text-steel-aa underline-offset-4 hover:text-ink hover:underline focus-visible:text-cobalt"
            >
              {t("kauzy.backToLedger")}
            </Link>
            {/* Čtvrtý konec: kde se vazba potká s hlasováním. */}
            <Link
              href="/penize/strety"
              className="text-steel-aa underline-offset-4 hover:text-ink hover:underline focus-visible:text-cobalt"
            >
              {t("kauzy.voteCollisions")}
            </Link>
            <Link
              href="/dukazy"
              className="text-steel-aa underline-offset-4 hover:text-ink hover:underline focus-visible:text-cobalt"
            >
              {t("kauzy.evidenceBulletin")}
            </Link>
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <SourceNote tone="signal">{t("kauzy.eyebrow")}</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          {t("kauzy.title")}
          <span className="text-signal">.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">{t("kauzy.intro")}</p>

        {/* Blind and empty are different statements — a payload directory we could not
            read must never be published as "there are no kauzy". */}
        {unreadableFiles.length > 0 && (
          <div className="mt-8 border-l-4 border-ochre bg-ochre/10 px-4 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
              {t("kauzy.unreadableHeading")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-steel-aa">
              {t("kauzy.unreadableBody", { count: unreadableFiles.length })}{" "}
              <span className="font-mono text-xs">{unreadableFiles.join(", ")}</span>
            </p>
          </div>
        )}

        {dossiers.length === 0 ? (
          <div className="mt-10 border-2 border-dashed border-hairline p-8">
            <p className="text-lg">
              {directoryUnreadable ? t("kauzy.directoryUnreadable") : t("kauzy.noDossiers")}
            </p>
          </div>
        ) : (
          <div className="mt-12 space-y-16">
            {dossiers.map((d) => (
              <DossierBlock
                key={d.leadId}
                d={d}
                targets={d.company ? (packetTargets[d.company.ico] ?? []) : []}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function DossierBlock({ d, targets }: { d: LeadDossier; targets: PacketTarget[] }) {
  const t = useTranslations("money");
  const tgate = useTranslations("overeni");
  /* Stabilní adresa spisu — z leadId, které spis nese sám. Kotva se řadí podle
     signálu, takže index pole by třetí kauzou přeadresoval obě stávající. */
  const anchor = dossierAnchorId(d.leadId);
  /* Spolehlivost je uzavřený výčet z payloadu, ne věta pro čtenáře. */
  const conf = confidenceInfo(d.confidence);
  /* Stav lidské brány TÝMŽ slovníkem, jakým ho vyslovuje /overeni — spis je
     ruční podnět a branou zatím neprošel; viz LEAD_DOSSIER_GATE_TOKEN. */
  const gate = gateStatusInfo(LEAD_DOSSIER_GATE_TOKEN);
  const companyIco = d.company ? canonicalIco(d.company.ico) : null;

  return (
    <article id={anchor ?? undefined} className="scroll-mt-24 border-t-4 border-ink pt-8 target:bg-paper-strong">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-steel-aa">{d.leadId}</p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">{d.subject.name}</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-steel-aa">{d.subject.role}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-steel-aa">{d.subject.party}</p>
          {d.company && (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-steel-aa">
              {t("kauzy.companyLabel")}:{" "}
              {/* Firma je v grafu křižovatka a má vlastní spis. IČO se kanonizuje
                  týmž pravidlem, na kterém stojí routa — nekanonický zápis odkaz
                  nedostane, místo aby vedl do prázdna. */}
              {companyIco ? (
                <Link
                  href={`/penize/firma/${companyIco}`}
                  className="underline underline-offset-4 hover:text-signal focus-visible:text-cobalt"
                >
                  {d.company.name}
                </Link>
              ) : (
                d.company.name
              )}{" "}
              · IČO {d.company.ico}
            </p>
          )}
          {/* 4E: jedno kliknutí → důkazní paket. Odkaz existuje JEN když IČO
              kauzy deterministicky joinuje na poslance s linked_to vazbou v
              grafu (drop-don't-guess — nikdy fuzzy match podle jména). Paket
              sám pak pustí dál jen lidsky ověřený materiál. */}
          {targets.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {targets.map((target) => (
                <Link
                  key={target.pspId}
                  href={`/penize/${target.pspId}/paket`}
                  className="inline-flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-colors hover:border-signal hover:text-signal"
                >
                  {t("shared.compilePacket")} — {target.name} →
                </Link>
              ))}
              <span className="font-mono text-[10px] uppercase tracking-widest text-steel-aa">
                {t("shared.verifiedOnly")}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {/* Stav brány je věta z jednoho slovníku, ne štítek vlastní téhle ploše. */}
          <span className="border-2 border-ochre bg-ochre/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
            {tgate(gate.labelKey)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-steel-aa">
            {t("kauzy.signal")} {d.signalScore} · {t("kauzy.confidence")}{" "}
            {conf.known ? t(conf.labelKey) : t(conf.labelKey, { token: conf.token || t(DOSSIER_EMPTY_TOKEN_KEY) })}
          </span>
          <span className="max-w-[16rem] text-right text-[11px] leading-relaxed text-steel-aa">
            {t("kauzy.gateNote")}
          </span>
        </div>
      </div>

      {anchor && (
        <div className="mt-4">
          <CopyLinkButton path={`/penize/kauzy#${anchor}`} errorContext="kopírování odkazu na kauzu selhalo" />
        </div>
      )}

      {/* Próza níž je DATA, ne redakční text — plocha to říká, místo aby to
          nechala vypadat jako věta produktu (a místo aby ji přepisovala). */}
      <p className="mt-6 max-w-3xl border-l-2 border-hairline pl-3 text-xs leading-relaxed text-steel-aa">
        {t("kauzy.proseDisclosure")}
      </p>

      {/* signal reasoning */}
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-steel-aa">{d.signalWhy}</p>

      {/* two-column honest split — the product */}
      <div className="mt-8 grid gap-px border border-ink bg-ink sm:grid-cols-2">
        <div className="bg-paper p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-cobalt">
            {t("kauzy.sustain")}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{d.whatSourcesSustain}</p>
        </div>
        <div className="bg-paper p-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal">
            {t("kauzy.notSustain")}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{d.whatSourcesDoNotSustain}</p>
        </div>
      </div>

      {/* claims */}
      <div className="mt-8">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
          {t("kauzy.claimsCited")}
        </p>
        <ul className="mt-3 divide-y divide-hairline border-t border-hairline">
          {d.claims.map((c, i) => {
            const kind = sourceKindInfo(c.sourceKind ?? "");
            return (
              <li key={i} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed text-ink">{c.claim}</p>
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                      kind.kind === "primary" ? "border-cobalt text-cobalt" : "border-hairline text-steel-aa"
                    }`}
                    title={kind.known ? undefined : kind.token}
                  >
                    {kind.known
                      ? t(kind.labelKey)
                      : t(kind.labelKey, { token: kind.token || t(DOSSIER_EMPTY_TOKEN_KEY) })}
                  </span>
                </div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden /> {c.accessedAt}
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* registry findings — the primary-source half of the dossier, which the
          type has documented since day one and nothing rendered */}
      {Object.keys(d.registryFindings).length > 0 && (
        <div className="mt-8">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
            {t("kauzy.registryFindings")}
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-steel-aa">{t("kauzy.registryFindingsNote")}</p>
          <div className="mt-3 border-t border-hairline pt-3">
            <LabelledFields fields={d.registryFindings} />
          </div>
        </div>
      )}

      {/* media context */}
      {d.mediaContext.length > 0 && (
        <div className="mt-8">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
            {t("kauzy.mediaContext")}
          </p>
          <ul className="mt-3 space-y-3">
            {d.mediaContext.map((m, i) => (
              <MediaContextRow key={i} entry={m} />
            ))}
          </ul>
        </div>
      )}

      {/* proposed annotation — labelled as a proposal, never applied automatically */}
      <div className="mt-8 border-l-4 border-ochre bg-ochre/10 px-4 py-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
          {t("kauzy.proposedAnnotation")}
        </p>
        <div className="mt-2">
          <LabelledFields fields={d.proposedAnnotation} />
        </div>
      </div>
    </article>
  );
}

/* ── kontext média: dva legální tvary jednoho pole ─────────────────────────── */

function MediaContextRow({ entry }: { entry: DossierMediaEntry }) {
  /* Holá věta je stejně platný zápis jako objekt (batch-005-lead-juchelka).
     Vykreslit ji jako prázdný odkaz s prázdným shrnutím znamenalo ztratit text,
     který analytik napsal — a přitom to vypadalo jako existující sekce. */
  if (typeof entry === "string") {
    return (
      <li className="border-l-2 border-hairline pl-3">
        <p className="text-sm leading-relaxed text-steel-aa">{entry}</p>
      </li>
    );
  }
  return (
    <li className="border-l-2 border-hairline pl-3">
      {entry.url ? (
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[11px] font-bold uppercase tracking-wider text-cobalt transition-colors hover:text-signal"
        >
          {entry.outlet}
        </a>
      ) : (
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-steel-aa">{entry.outlet}</span>
      )}
      <p className="mt-1 text-sm leading-relaxed text-steel-aa">{entry.gist}</p>
    </li>
  );
}

/* ── volný blok payloadu jako POJMENOVANÁ POLE ─────────────────────────────── */

/** Hloubka, do které se vnořený objekt ještě rozepisuje na pole. Dnešní korpus
 *  jde do 2 (`proposedAnnotation.proposedFields.frontier_note`); strop je
 *  pojistka proti neznámému payloadu, ne popis dat. */
const MAX_FIELD_DEPTH = 4;

function LabelledFields({ fields, depth = 0 }: { fields: Record<string, unknown>; depth?: number }) {
  return (
    <dl className="space-y-2">
      {Object.entries(fields).map(([k, v]) => (
        <div key={k} className="text-sm leading-relaxed text-ink">
          {/* Klíč je DATOVÝ identifikátor spisu (`ares_vr_siptrade_24225525`) —
              vypisuje se doslova, protože je součástí toho, co analytik zapsal.
              Nepřekládá se: přeložený klíč by byl náš výklad jeho evidence. */}
          <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-steel-aa">{k}</dt>
          <dd className="mt-0.5">
            <FieldValue value={v} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FieldValue({ value, depth }: { value: unknown; depth: number }) {
  const t = useTranslations("money");

  if (typeof value === "string") {
    return <span className="whitespace-pre-line">{value}</span>;
  }
  if (typeof value === "number") {
    // Payload numbers here are identifiers/counters written by the analyst, not
    // display figures — rendered as written, never re-formatted into a claim.
    return <span className="font-mono tabular-nums">{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span className="font-mono text-xs uppercase tracking-wider">
        {t(value ? DOSSIER_BOOL_KEYS.true : DOSSIER_BOOL_KEYS.false)}
      </span>
    );
  }
  if (value === null || value === undefined) {
    return <span className="text-steel-aa">{t(DOSSIER_EMPTY_TOKEN_KEY)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item, i) => (
          <li key={i}>
            <FieldValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (depth < MAX_FIELD_DEPTH) {
    return (
      <div className="mt-1 border-l-2 border-hairline pl-3">
        <LabelledFields fields={value as Record<string, unknown>} depth={depth + 1} />
      </div>
    );
  }
  /* Za stropem se hodnota NESKRÝVÁ ani nesází jako by to byla věta: vypíše se
     doslova a označí jako nerozepsaná strojová struktura (vzor tieFlags.ts). */
  return (
    <span className="block">
      <span className="font-mono text-[10px] uppercase tracking-widest text-steel-aa">
        {t(DOSSIER_MACHINE_STRUCTURE_KEY)}
      </span>{" "}
      <span className="font-mono text-xs break-all">{JSON.stringify(value)}</span>
    </span>
  );
}
