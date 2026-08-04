/**
 * Datové verze (/data) — vydávací stránka datové vrstvy: verze, datum řezu,
 * kardinality proti prahům, integrita (hash-řetěz revizí + Merkle kořeny
 * ingest běhů) a stažení snapshotu s přiznanou velikostí. Sází se jako
 * release page seriózního open-data projektu: strohé řádky, mono čísla,
 * citace zdroje u každé figury.
 *
 * Serverová komponenta — žádná interaktivita kromě odkazů.
 *
 * Copy je záměrně česky přímo zde (ne přes messages/*.json): katalog překladů
 * je mimo plochu batch-3D — precedens /dukazy (batch 2C).
 */

import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import SectionHeading from "@/features/shared/components/SectionHeading";
import SectionRule from "@/features/shared/components/SectionRule";
import SourceNote from "@/features/shared/components/SourceNote";
import { czech, czechDate, czechInt } from "@/lib/format";
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
  return (
    <div className="mt-8 border-2 border-dashed border-hairline p-8">
      <p className="text-lg">
        Manifest teď nelze sestavit — úložiště je v tomto prostředí nedostupné. Tahle stránka
        nemůže říct, jaké verze existují ani jak je na tom integrita; vydávací vlak není
        prázdný, jen nečitelný.
      </p>
      <div className="mt-3">
        <SourceNote>zdroj: store nedostupný — žádná verze není zamlčena</SourceNote>
      </div>
    </div>
  );
}

export default function DataReleasesPage({ data }: { data: DataReleasesData | null }) {
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
        <SourceNote tone="signal">veřejný vydávací vlak datové vrstvy</SourceNote>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
          Datové verze
          <span className="text-signal">.</span>
        </h1>
        <div className="mt-4 max-w-md">
          <SectionRule />
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-steel-aa">
          Graf republiky se vydává jako software: každé úspěšné nasypání dat řeže verzi{" "}
          <span className="font-mono">RRRR.MM.DD</span>, kardinalitní prahy jsou vydávací brána
          a integrita každého vydání je doložitelná Merkle kořeny a hash-řetězem revizí. Co si
          stáhnete dnes, můžete citovat — a kdokoli si to může ověřit.
        </p>

        {/* Metodika vydání — co verze tvrdí a co záměrně netvrdí. */}
        <div className="mt-8 max-w-2xl border-l-4 border-ink bg-paper-strong px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest">metodika vydání</p>
          <p className="mt-1 text-sm leading-relaxed text-steel-aa">
            Verze = den posledního dokončeného úspěšného ingest běhu (tabulka ingest_run). Verze,
            která nesplňuje kardinalitní prahy (CARDINALITY_FLOORS), je označena „degradováno&ldquo;
            a nikdy není „latest&ldquo;. Verdikty prahů se počítají z aktuálního stavu úložiště —
            o historických verzích tahle stránka netvrdí nic, co by neuměla doložit. Snapshot je
            výřez odvozeného grafu (kg_node / kg_edge) se stropem {czechInt(SNAPSHOT_NODE_CAP)} uzlů
            a {czechInt(SNAPSHOT_EDGE_CAP)} hran; případný ořez je přiznán v poli limits.
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
                title="Aktuální verze"
                aside={<SourceNote>zdroj: ingest_run + kg_node (kardinality) · psp.cz, Registr smluv</SourceNote>}
              />
              {m.version === null ? (
                <div className="mt-8 border-2 border-dashed border-hairline p-8">
                  <p className="text-lg">
                    Zatím nevydáno<span className="text-signal">.</span> Úložiště je čitelné, ale
                    žádný dokončený úspěšný ingest běh neexistuje — první verze se tu objeví ve
                    chvíli, kdy první běh doběhne se stavem „ok&ldquo;.
                  </p>
                  <div className="mt-3">
                    <SourceNote>zdroj: ingest_run — 0 úspěšných běhů; nic není zamlčeno</SourceNote>
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
                      {m.degraded ? "degradováno — není latest" : "latest"}
                    </span>
                    {m.cutAt && (
                      <span className="font-mono text-xs uppercase tracking-widest text-steel-aa">
                        řez: {czechDate(m.cutAt)}
                      </span>
                    )}
                  </div>

                  {/* Kardinality proti prahům — vydávací brána, řádek po řádku. */}
                  <div className="mt-8 overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b-2 border-ink font-mono text-xs uppercase tracking-widest text-steel-aa">
                          <th className="py-2 pr-4 font-bold">druh uzlu</th>
                          <th className="py-2 pr-4 text-right font-bold">počet</th>
                          <th className="py-2 pr-4 text-right font-bold">práh</th>
                          <th className="py-2 font-bold">verdikt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.verdicts.map((v) => (
                          <tr key={v.kind} className="border-b border-hairline">
                            <td className="py-2 pr-4 font-mono text-sm">{v.kind}</td>
                            <td className="py-2 pr-4 text-right font-mono text-sm tabular-nums">
                              {czechInt(v.count)}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-sm tabular-nums text-steel-aa">
                              ≥ {czechInt(v.floor)}
                            </td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest ${
                                  v.ok ? "bg-ink text-paper" : "bg-signal-deep text-paper"
                                }`}
                              >
                                {v.ok ? "splněno" : "pod prahem"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2">
                      <SourceNote>
                        zdroj: kg_node (plné počty per kind) proti CARDINALITY_FLOORS — {czechInt(Object.keys(CARDINALITY_FLOORS).length)} bran; viz lib/db/readiness.ts
                      </SourceNote>
                    </div>
                  </div>

                  {/* Souhrnné počty vydání. */}
                  <div className="mt-8 grid gap-px border-2 border-ink bg-ink sm:grid-cols-3">
                    {(
                      [
                        ["uzly grafu", m.counts.kgNodes],
                        ["hrany grafu", m.counts.kgEdges],
                        ["hlasovací lístky", m.counts.voteBallots],
                      ] as const
                    ).map(([label, n]) => (
                      <div key={label} className="bg-paper px-4 py-3">
                        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa">
                          {label}
                        </p>
                        <p className="mt-1 font-mono text-2xl font-black tabular-nums">{czechInt(n)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <SourceNote>zdroj: kg_node, kg_edge, vote_ballot — plné počty v okamžiku sestavení manifestu</SourceNote>
                  </div>
                </div>
              )}
            </section>

            {/* ── /02 Integrita ── */}
            <section className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={2}
                title="Integrita"
                aside={<SourceNote>zdroj: review_audit (hash-řetěz) + ingest_run (Merkle kořeny)</SourceNote>}
              />
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
                Každé lidské rozhodnutí je článek hash-řetězu, každý zapečetěný ingest běh nese
                Merkle kořen nad všemi řádky, které zapsal. Otisk manifestu tohoto vydání:{" "}
                <span className="font-mono" title={m.manifestHash}>
                  {m.hashAlgorithm}:{m.manifestHash}
                </span>
                {" "}(kontrolní otisk obsahu, ne kryptografický podpis).
              </p>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="border-2 border-ink p-4">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">hlava řetězu revizí</p>
                  {m.integrity.reviewChain === null ? (
                    <p className="mt-2 text-sm leading-relaxed text-steel-aa">
                      Řetěz je zatím prázdný — první rozhodnutí revizora ho založí. Prázdný řetěz
                      je taky doložitelný stav.
                    </p>
                  ) : (
                    <dl className="mt-2 space-y-1 font-mono text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-steel-aa">délka</dt>
                        <dd className="tabular-nums">{czechInt(m.integrity.reviewChain.length)} článků</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-steel-aa">hlava</dt>
                        <dd title={m.integrity.reviewChain.rowHash}>{shortHash(m.integrity.reviewChain.rowHash)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-steel-aa">poslední rozhodnutí</dt>
                        <dd>{czechDate(m.integrity.reviewChain.decidedAt)}</dd>
                      </div>
                    </dl>
                  )}
                  <div className="mt-3">
                    <SourceNote>zdroj: review_audit.row_hash — hlavu drží i /admin (trezor)</SourceNote>
                  </div>
                </div>

                <div className="border-2 border-ink p-4">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest">zapečetěné ingest běhy</p>
                  {m.integrity.sealedRuns.length === 0 ? (
                    <p className="mt-2 text-sm leading-relaxed text-steel-aa">
                      Žádný běh zatím není zapečetěn Merkle kořenem — pečeť se přikládá po
                      dokončení běhu, ne při něm.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {m.integrity.sealedRuns.slice(0, 8).map((r) => (
                        <li key={r.runId} className="border-b border-hairline pb-2 font-mono text-sm last:border-b-0">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                            <span>
                              běh #{czechInt(r.runId)} · {r.source}
                            </span>
                            <span className="tabular-nums text-steel-aa">{czechInt(r.leafCount)} listů</span>
                          </div>
                          <div className="text-steel-aa" title={r.merkleRoot}>
                            kořen {shortHash(r.merkleRoot)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    <SourceNote>zdroj: ingest_run.merkle_root — pečetí LedgerRepository.sealIngestRun</SourceNote>
                  </div>
                </div>
              </div>
            </section>

            {/* ── /03 Stažení ── */}
            <section className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={3}
                title="Stažení"
                aside={<SourceNote>zdroj: kg_node + kg_edge — výřez odvozeného grafu, jen čtení</SourceNote>}
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
                  {czech(bytesToMegabytes(data.snapshotBytes))} MB ({czechInt(data.snapshotBytes)} B)
                </span>
              </div>
              <div className="mt-3">
                <SourceNote>
                  velikost: přesná délka UTF-8 payloadu v okamžiku sestavení stránky — stažený soubor se
                  sestavuje znovu z aktuálního úložiště a mezi ingesty se může lišit; přesnou velikost
                  stažení nese Content-Length
                </SourceNote>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
                Snapshot nese verzi, otisk manifestu a pole limits s přiznanými stropy výřezu.
                Surová zdrojová data (raw payloady registrů) součástí nejsou — snapshot je odvozená
                vrstva, kterou aplikace sama čte.
              </p>
            </section>

            {/* ── /04 Changelog ── */}
            <section className="mt-14 border-t-4 border-ink pt-10">
              <SectionHeading
                index={4}
                title="Changelog"
                aside={<SourceNote>zdroj: ingest_run — každý den s během = řádek vlaku</SourceNote>}
              />
              {data.changelog.length === 0 ? (
                <div className="mt-8 border-2 border-dashed border-hairline p-8">
                  <p className="text-lg">
                    Vlak zatím nevyjel<span className="text-signal">.</span> Žádný ingest běh není
                    zaznamenán — changelog se založí prvním nasypáním dat.
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
                          {rel.allOk ? "zeleně" : "obsahuje selhání"}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="font-mono text-xs uppercase tracking-widest text-steel-aa">
                          {czechInt(rel.runs.length)} běhů · {czechInt(rel.rowsWritten)} zapsaných řádků
                        </p>
                        <ul className="mt-1 space-y-1">
                          {rel.runs.map((r) => (
                            <li key={r.id} className="font-mono text-sm">
                              <span className={r.status === "failed" ? "text-signal-deep" : ""}>
                                {r.status === "ok" ? "✓" : r.status === "failed" ? "✕" : "…"}
                              </span>{" "}
                              {r.source} · {czechInt(r.rowsWritten)} řádků
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
                  deník důkazů <ExternalLink className="h-3 w-3" aria-hidden />
                </Link>
                <SourceNote>rozhodnutí lidské brány mají vlastní věstník — /dukazy</SourceNote>
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
            title="Odběry"
            aside={<SourceNote>zdroj: route handlery aplikace — {czechInt(FEED_ADDRESSES.length)} veřejných adres</SourceNote>}
          />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-steel-aa">
            {czechInt(FEED_FAMILIES.length)} rodiny feedů, každá ve dvou formátech:{" "}
            {FEED_FORMATS.map((f) => f.label).join(" a ")}. JSON podoba je u všech týž drát —
            ověřit si ji můžete jedním validátorem (<span className="font-mono">parseEvidenceFeedJson</span>).
            Feed nikdy nevrací prázdno místo poruchy: je-li úložiště nečitelné, odpoví{" "}
            <span className="font-mono">503</span>, protože prázdný seznam je tvrzení „nic se nestalo&ldquo;.
          </p>

          <div className="mt-8 border-t-2 border-ink">
            {FEED_FAMILIES.map((f) => (
              <article key={f.base} className="grid gap-x-6 gap-y-2 border-b border-hairline py-5 sm:grid-cols-[13rem_1fr]">
                <div className="flex flex-col gap-2">
                  <Link
                    href={f.page}
                    className="font-mono text-sm font-bold text-signal-deep hover:underline"
                  >
                    {f.title}
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    {FEED_FORMATS.map((fmt) => (
                      <a
                        key={fmt.ext}
                        href={`${f.base}${fmt.ext}`}
                        className="border border-ink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-ink hover:text-paper"
                      >
                        {fmt.ext.slice(1)}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="font-mono text-xs text-steel-aa">
                    {FEED_FORMATS.map((fmt) => `${f.base}${fmt.ext}`).join(" · ")}
                  </p>
                  <p className="text-sm leading-relaxed">{f.carries}</p>
                  {f.note && (
                    <p className="border-l-4 border-hairline pl-3 text-sm leading-relaxed text-steel-aa">{f.note}</p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <h3 className="mt-10 font-mono text-[11px] font-bold uppercase tracking-widest">
            strojové podoby, které nejsou feed
          </h3>
          <ul className="mt-3 border-t-2 border-ink">
            {MACHINE_ENDPOINTS.map((e) => (
              <li key={e.href} className="grid gap-x-6 gap-y-1 border-b border-hairline py-4 sm:grid-cols-[13rem_1fr]">
                <a href={e.href} className="font-mono text-sm font-bold text-signal-deep hover:underline">
                  {e.href}
                </a>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-mono text-xs uppercase tracking-widest text-steel-aa">{e.title}</p>
                  <p className="text-sm leading-relaxed">{e.carries}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-steel-aa">
            Mapu stránek pro roboty vydává <span className="font-mono">/sitemap.xml</span>, pravidla
            procházení <span className="font-mono">/robots.txt</span>. Sitemapa nese statické plochy;
            adresy konkrétních poslanců, tisků a firem v ní záměrně nejsou — vyjmenovat je znamená
            číst za běhu celý graf, a vedou na ně rozcestníky, které v sitemapě jsou.
          </p>
        </section>
      </div>
    </main>
  );
}
