/**
 * Datové verze (/data) — vydávací stránka datové vrstvy: verze, datum řezu,
 * kardinality proti prahům, integrita (hash-řetěz revizí + Merkle kořeny
 * ingest běhů) a stažení snapshotu s přiznanou velikostí. Sází se jako
 * release page seriózního open-data projektu: strohé řádky, mono čísla,
 * citace zdroje u každé figury.
 *
 * Serverová komponenta — žádná interaktivita kromě odkazů.
 *
 * COPY JE V KATALOGU (2026-08-05): čtenářské věty žijí v messages/{cs,en}.json
 * pod `dataReleases.*` a sází se přes next-intl (vzor /overeni); adresář
 * odběrů (feedIndex.ts) vrací KLÍČE, ne text. Čísla a data jdou přes
 * formattersFor(locale) — žádné natvrdo české formátování.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Download, ExternalLink } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { formattersFor } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { CARDINALITY_FLOORS } from "@/lib/db/readiness";
import { bytesToMegabytes, SNAPSHOT_EDGE_CAP, SNAPSHOT_NODE_CAP } from "./snapshot";
import {
  FEED_ADDRESSES,
  FEED_FAMILIES,
  FEED_FORMATS,
  MACHINE_ENDPOINTS,
} from "./feedIndex";
import type { DataReleasesData } from "./getDataReleasesData";

/** sha256 kořeny mají 64 znaků — v tabulce se sází zkrácený otisk, plná
 *  hodnota zůstává v title (a strojově v /data/manifest.json). */
const shortHash = (hash: string) => (hash.length > 18 ? `${hash.slice(0, 16)}…` : hash);

function StoreDownState() {
  const t = useTranslations("dataReleases");
  return (
    <div className="mt-8 border-2 border-dashed border-hairline p-8">
      <p className="text-lg">{t("storeDown.body")}</p>
      <div className="mt-3">
        <SourceNote>{t("storeDown.source")}</SourceNote>
      </div>
    </div>
  );
}

export default function DataReleasesPage({
  data,
  locale,
}: {
  data: DataReleasesData | null;
  locale: Locale;
}) {
  const t = useTranslations("dataReleases");
  const f = formattersFor(locale);
  const mono = (chunks: React.ReactNode) => <span className="font-mono">{chunks}</span>;
  const m = data?.manifest ?? null;
  // Číslo sekce se ODVOZUJE z toho, co se skutečně vykreslí: při nedostupném
  // úložišti sekce 01–04 nejsou, a „05" nad prázdnem by odkazovalo na kapitoly,
  // které na stránce nikde nestojí. Adresář odběrů úložiště nepotřebuje —
  // adresy platí, i když je graf zrovna nečitelný (feedy tehdy vrací 503).
  const feedSectionIndex = data !== null && m !== null ? 5 : 1;
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <header className="border-b-4 border-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">/ data</span>
          {/* Strojově čitelná podoba vydání — veřejné API vlaku. */}
          <div className="flex items-center gap-4">
            <a
              href="/data/manifest.json"
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              manifest.json
            </a>
            <a
              href="/data/snapshot.json"
              className="font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
            >
              snapshot.json
            </a>
          </div>
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
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
          {t.rich("hero.lead", { mono })}
        </p>

        {/* Metodika vydání — co verze tvrdí a co záměrně netvrdí. */}
        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
            {t("methodology.kicker")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            {t("methodology.body", {
              nodeCap: f.int(SNAPSHOT_NODE_CAP),
              edgeCap: f.int(SNAPSHOT_EDGE_CAP),
            })}
          </p>
        </div>

        {data == null || m == null ? (
          <StoreDownState />
        ) : (
          <>
            {/* ── /01 Aktuální verze ── */}
            <section className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={1}
                title={t("current.title")}
                aside={<SourceNote>{t("current.aside")}</SourceNote>}
              />
              {m.version === null ? (
                <div className="mt-8 border-2 border-dashed border-hairline p-8">
                  <p className="text-lg">
                    {t("current.unreleasedLead")}
                    <span className="text-signal">.</span> {t("current.unreleasedBody")}
                  </p>
                  <div className="mt-3">
                    <SourceNote>{t("current.unreleasedSource")}</SourceNote>
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <p className="font-mono text-5xl font-black tabular-nums tracking-tight sm:text-6xl">
                      {m.version}
                    </p>
                    <span
                      className={`px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest ${
                        m.degraded ? "bg-signal-deep text-paper" : "bg-ink text-paper"
                      }`}
                    >
                      {m.degraded ? t("current.badgeDegraded") : t("current.badgeLatest")}
                    </span>
                    {m.cutAt && (
                      <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
                        {t("current.cut", { date: f.date(m.cutAt) })}
                      </span>
                    )}
                  </div>

                  {/* Kardinality proti prahům — vydávací brána, řádek po řádku. */}
                  <div className="mt-8 overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b-2 border-ink font-mono text-xs uppercase tracking-widest text-steel-aa">
                          <th className="py-2 pr-4 font-bold">{t("table.kind")}</th>
                          <th className="py-2 pr-4 text-right font-bold">{t("table.count")}</th>
                          <th className="py-2 pr-4 text-right font-bold">{t("table.floor")}</th>
                          <th className="py-2 font-bold">{t("table.verdict")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.verdicts.map((v) => (
                          <tr key={v.kind} className="border-b border-hairline">
                            <td className="py-2 pr-4 font-mono text-sm">{v.kind}</td>
                            <td className="py-2 pr-4 text-right font-mono text-sm tabular-nums">
                              {f.int(v.count)}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-sm tabular-nums text-steel-aa">
                              ≥ {f.int(v.floor)}
                            </td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest ${
                                  v.ok ? "bg-ink text-paper" : "bg-signal-deep text-paper"
                                }`}
                              >
                                {v.ok ? t("table.met") : t("table.below")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2">
                      <SourceNote>
                        {t("table.source", {
                          count: f.int(Object.keys(CARDINALITY_FLOORS).length),
                        })}
                      </SourceNote>
                    </div>
                  </div>

                  {/* Souhrnné počty vydání. */}
                  <div className="mt-8 grid gap-px border-2 border-ink bg-ink sm:grid-cols-3">
                    {(
                      [
                        [t("counts.nodes"), m.counts.kgNodes],
                        [t("counts.edges"), m.counts.kgEdges],
                        [t("counts.ballots"), m.counts.voteBallots],
                      ] as const
                    ).map(([label, n]) => (
                      <div key={label} className="bg-paper px-4 py-3">
                        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                          {label}
                        </p>
                        <p className="mt-1 font-mono text-2xl font-black tabular-nums">{f.int(n)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <SourceNote>{t("counts.source")}</SourceNote>
                  </div>
                </div>
              )}
            </section>

            {/* ── /02 Integrita ── */}
            <section className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={2}
                title={t("integrity.title")}
                aside={<SourceNote>{t("integrity.aside")}</SourceNote>}
              />
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
                {t("integrity.lead")}{" "}
                <span className="font-mono" title={m.manifestHash}>
                  {m.hashAlgorithm}:{m.manifestHash}
                </span>{" "}
                {t("integrity.leadSuffix")}
              </p>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="border-2 border-ink p-4">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
                    {t("chain.title")}
                  </p>
                  {m.integrity.reviewChain === null ? (
                    <p className="mt-2 text-sm leading-relaxed text-steel-aa">{t("chain.empty")}</p>
                  ) : (
                    <dl className="mt-2 space-y-1 font-mono text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-steel-aa">{t("chain.length")}</dt>
                        <dd className="tabular-nums">
                          {t("chain.links", { count: f.int(m.integrity.reviewChain.length) })}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-steel-aa">{t("chain.head")}</dt>
                        <dd title={m.integrity.reviewChain.rowHash}>{shortHash(m.integrity.reviewChain.rowHash)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-steel-aa">{t("chain.lastDecision")}</dt>
                        <dd>{f.date(m.integrity.reviewChain.decidedAt)}</dd>
                      </div>
                    </dl>
                  )}
                  <div className="mt-3">
                    <SourceNote>{t("chain.source")}</SourceNote>
                  </div>
                </div>

                <div className="border-2 border-ink p-4">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
                    {t("sealed.title")}
                  </p>
                  {m.integrity.sealedRuns.length === 0 ? (
                    <p className="mt-2 text-sm leading-relaxed text-steel-aa">{t("sealed.empty")}</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {m.integrity.sealedRuns.slice(0, 8).map((r) => (
                        <li key={r.runId} className="border-b border-hairline pb-2 font-mono text-sm last:border-b-0">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                            <span>
                              {t("sealed.run", { id: f.int(r.runId) })} · {r.source}
                            </span>
                            <span className="tabular-nums text-steel-aa">
                              {t("sealed.leaves", { count: f.int(r.leafCount) })}
                            </span>
                          </div>
                          <div className="text-steel-aa" title={r.merkleRoot}>
                            {t("sealed.root", { hash: shortHash(r.merkleRoot) })}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    <SourceNote>{t("sealed.source")}</SourceNote>
                  </div>
                </div>
              </div>
            </section>

            {/* ── /03 Stažení ── */}
            <section className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={3}
                title={t("download.title")}
                aside={<SourceNote>{t("download.aside")}</SourceNote>}
              />
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a
                  href="/data/snapshot.json"
                  download={data.snapshotFilename}
                  className="inline-flex items-center gap-2 border-2 border-ink bg-ink px-4 py-2 font-mono text-sm font-bold uppercase tracking-widest text-paper hover:bg-paper hover:text-ink"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {data.snapshotFilename}
                </a>
                <span className="font-mono text-sm tabular-nums text-steel-aa">
                  {t("download.size", {
                    mb: f.dec(bytesToMegabytes(data.snapshotBytes)),
                    bytes: f.int(data.snapshotBytes),
                  })}
                </span>
              </div>
              <div className="mt-3">
                <SourceNote>{t("download.sizeNote")}</SourceNote>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
                {t("download.body")}
              </p>
            </section>

            {/* ── /04 Changelog ── */}
            <section className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={4}
                title={t("changelog.title")}
                aside={<SourceNote>{t("changelog.aside")}</SourceNote>}
              />
              {data.changelog.length === 0 ? (
                <div className="mt-8 border-2 border-dashed border-hairline p-8">
                  <p className="text-lg">
                    {t("changelog.emptyLead")}
                    <span className="text-signal">.</span> {t("changelog.emptyBody")}
                  </p>
                </div>
              ) : (
                <div className="mt-8 border-t-2 border-ink">
                  {data.changelog.map((rel) => (
                    <article
                      key={rel.date}
                      className="grid gap-x-6 gap-y-2 border-b border-hairline py-5 sm:grid-cols-[9rem_1fr]"
                    >
                      <div className="flex flex-col gap-1">
                        <time dateTime={rel.date} className="font-mono text-sm font-bold tabular-nums">
                          {rel.version}
                        </time>
                        <span
                          className={`w-fit px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest ${
                            rel.allOk ? "bg-ink text-paper" : "bg-signal-deep text-paper"
                          }`}
                        >
                          {rel.allOk ? t("changelog.badgeOk") : t("changelog.badgeFailures")}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="font-mono text-xs uppercase tracking-widest text-steel-aa">
                          {t("changelog.runsLine", {
                            runs: f.int(rel.runs.length),
                            rows: f.int(rel.rowsWritten),
                          })}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {rel.runs.map((r) => (
                            <li key={r.id} className="font-mono text-sm">
                              <span className={r.status === "failed" ? "text-signal-deep" : ""}>
                                {r.status === "ok" ? "✓" : r.status === "failed" ? "✕" : "…"}
                              </span>{" "}
                              {r.source} · {t("changelog.runRow", { rows: f.int(r.rowsWritten) })}
                              {r.note ? <span className="text-steel-aa"> — {r.note}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/dukazy"
                  className="group inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-signal-deep hover:underline"
                >
                  {t("changelog.dukazyLink")} <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
                <SourceNote>{t("changelog.dukazyNote")}</SourceNote>
              </div>
            </section>
          </>
        )}

        {/* ── Odběry ── Adresář feedů. Do teď žily adresy jen v hlavičkách route
            handlerů, takže o strojových podobách platformy nevěděl nikdo, kdo
            nečte zdroják. Sekce stojí MIMO větev dostupnosti úložiště: adresy
            platí i tehdy, když je graf nečitelný (feed pak vrací 503, ne
            prázdno). */}
        <section className="mt-14 border-t-4 border-ink pt-10">
          <SectionHeading
            index={feedSectionIndex}
            title={t("feeds.title")}
            aside={<SourceNote>{t("feeds.aside", { count: f.int(FEED_ADDRESSES.length) })}</SourceNote>}
          />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
            {t.rich("feeds.lead", {
              mono,
              families: f.int(FEED_FAMILIES.length),
              formats: FEED_FORMATS.map((fmt) => fmt.label).join(t("feeds.joinAnd")),
            })}
          </p>

          <div className="mt-8 border-t-2 border-ink">
            {FEED_FAMILIES.map((fam) => (
              <article key={fam.base} className="grid gap-x-6 gap-y-2 border-b border-hairline py-5 sm:grid-cols-[13rem_1fr]">
                <div className="flex flex-col gap-2">
                  <Link
                    href={fam.page}
                    className="font-mono text-sm font-bold text-signal-deep hover:underline"
                  >
                    {t(fam.titleKey)}
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    {FEED_FORMATS.map((fmt) => (
                      <a
                        key={fmt.ext}
                        href={`${fam.base}${fmt.ext}`}
                        className="border border-ink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-ink hover:text-paper"
                      >
                        {fmt.ext.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="font-mono text-xs text-steel-aa">
                    {FEED_FORMATS.map((fmt) => `${fam.base}${fmt.ext}`).join(" · ")}
                  </p>
                  <p className="text-sm leading-relaxed">{t(fam.carriesKey)}</p>
                  {fam.noteKey && (
                    <p className="border-l-4 border-hairline pl-3 text-sm leading-relaxed text-steel-aa">
                      {t(fam.noteKey, fam.noteValues)}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <h3 className="mt-10 font-mono text-[11px] font-bold uppercase tracking-widest">
            {t("feeds.machineTitle")}
          </h3>
          <ul className="mt-3 border-t-2 border-ink">
            {MACHINE_ENDPOINTS.map((e) => (
              <li key={e.href} className="grid gap-x-6 gap-y-1 border-b border-hairline py-4 sm:grid-cols-[13rem_1fr]">
                <a href={e.href} className="font-mono text-sm font-bold text-signal-deep hover:underline">
                  {e.href}
                </a>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-mono text-xs uppercase tracking-widest text-steel-aa">{t(e.titleKey)}</p>
                  <p className="text-sm leading-relaxed">{t(e.carriesKey)}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-steel-aa">
            {t.rich("feeds.sitemap", { mono })}
          </p>
        </section>
      </div>
    </main>
  );
}
