"use client";

/*
 * Hlídky grafu — sekce /admin nad čistou derivací lib/analysis/tripwires.ts.
 * Graf si hlídá sám sebe: deklarativní vzory se vyhodnocují při každém čtení
 * (žádný zápis, precedens 4C) a jejich výstup je VŽDY kandidát pro lidskou
 * revizi, nikdy zjištění. Pravidlo každého vzoru se vykresluje DOSLOVA vedle
 * jeho výsledků; kandidáti jsou seřazeni podle úplnosti důkazů (rozklad skóre
 * se ukazuje celý) a odkazují do ověřovací konzole /penize/kontrola — a tam,
 * kde se hlídka kryje s vypočteným střetem, i na /penize/strety#s-<id>.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { czechDate, czechInt } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import type { TripwireCandidate, TripwireData } from "@/lib/analysis/tripwires";

const SHOWN_PER_PATTERN = 6;

const czk = (n: number): string => `${czechInt(Math.round(n))} Kč`;

function CandidateRow({ c }: { c: TripwireCandidate }) {
  const kontrolaHref = `/penize/kontrola#tie-tie:${c.personPspId}:${c.ico}`;
  return (
    <li id={`w-${c.id}`} className="flex flex-col gap-1 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold">
          {c.personName}
          {c.club ? <span className="font-normal text-steel"> · {c.club}</span> : null}
        </p>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-steel">
          důkazy {czechInt(c.evidence.score)}
        </span>
      </div>
      <p className="text-sm text-steel">
        {c.company} · IČO {c.ico} · {c.role || "role neuvedena"}
        {c.reviewState === "verified" ? " · vazba ověřena" : c.reviewState === "pending_review" ? " · vazba čeká na ověření" : null}
      </p>

      {/* fakta vzoru — jen co join spočítal */}
      {c.votesMatched > 0 && c.latestVoteOn && (
        <p className="text-sm text-steel">
          {czechInt(c.votesMatched)} hlasování v období role {c.roleValidFrom ? czechDate(c.roleValidFrom) : "?"}–
          {c.roleValidTo ? czechDate(c.roleValidTo) : "rejstřík neeviduje konec"}, poslední {czechDate(c.latestVoteOn)}
        </p>
      )}
      {c.pattern === "unverified-contracts" && (
        <p className="text-sm text-steel">
          {czechInt(c.contractCount)} smluv v registru · dosažitelné peníze {czk(c.reachableCzk)}
        </p>
      )}
      {c.bill && (
        <p className="text-sm text-steel">
          zpravodaj tisku{c.bill.cislo != null ? ` č. ${czechInt(c.bill.cislo)}` : ""}: {c.bill.title}
        </p>
      )}
      {c.chain && (
        <p className="text-sm text-steel">
          drží{c.chain.stakePct != null ? ` ${czechInt(c.chain.stakePct)} %` : " podíl"} ve firmě {c.chain.company}
          {c.chain.ico ? ` (IČO ${c.chain.ico})` : ""} · {czechInt(c.chain.contractCount)} smluv, {czk(c.chain.contractCzk)}
        </p>
      )}
      {c.statutes.length > 0 && (
        <p className="font-mono text-[11px] uppercase tracking-widest text-steel">
          zákony: {c.statutes.map((s) => s.ref).join(" · ")}
        </p>
      )}

      {/* rozklad skóre úplnosti důkazů — celý, žádné magické číslo */}
      <p className="font-mono text-[11px] tracking-wide text-steel">
        {c.evidence.parts.length > 0
          ? c.evidence.parts.map((p) => `${p.labelCs} +${p.pts}`).join(" · ")
          : "žádná složka důkazů — jen samotný souběh"}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={kontrolaHref}
          className="group flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-signal hover:underline"
        >
          ověřit v kontrole <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        {c.stretyIds.map((sid) => (
          <Link
            key={sid}
            href={`/penize/strety#s-${sid}`}
            className="font-mono text-[11px] uppercase tracking-widest text-cobalt hover:underline"
          >
            střet #{sid}
          </Link>
        ))}
      </div>
    </li>
  );
}

export default function TripwireSection({ data }: { data: TripwireData | null }) {
  if (!data) {
    return (
      <p className="text-sm text-steel">
        Hlídky se nepodařilo odvodit — bez peněžní vrstvy grafu (vazby MP ↔ firma) není co hlídat.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm leading-relaxed text-steel">
        Deklarativní vzory vyhodnocené nad grafem při každém načtení — nic se nezapisuje. Každý
        kandidát je deterministicky vypočtený souběh, <strong className="font-bold text-ink">vyžaduje lidské ověření</strong> a
        bez něj se nikde netvrdí jako fakt. Pořadí = úplnost důkazů (kolik podkladů má revizor
        v ruce), ne závažnost.
      </p>

      {(!data.votesAvailable || !data.agendaAvailable || !data.collisionsAvailable) && (
        <div className="border-2 border-ink bg-paper p-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-steel">omezení tohoto čtení</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-steel">
            {!data.votesAvailable && (
              <li>hlasovací ledger je pod readiness floorem — hlídka „{data.patterns[0]?.titleCs}&ldquo; je slepá, ne bez nálezu</li>
            )}
            {!data.agendaAvailable && (
              <li>pořad schůze (schuze.zip) není k dispozici — hlasování se na tisky napojují jen přes titulek</li>
            )}
            {!data.collisionsAvailable && <li>kandidáti střetů nejsou dostupní — křížové odkazy na /penize/strety chybí</li>}
          </ul>
        </div>
      )}

      <div className="grid gap-px border border-ink bg-ink lg:grid-cols-2">
        {data.patterns.map((p) => (
          <div key={p.pattern} className="flex flex-col gap-4 bg-paper p-6">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-black uppercase tracking-tight">{p.titleCs}</h3>
              <span className="shrink-0 font-mono text-sm tabular-nums">
                {czechInt(p.candidates.length)}{" "}
                <span className="text-[11px] uppercase tracking-widest text-steel">kand.</span>
              </span>
            </div>

            {/* pravidlo vzoru — doslova, vždy, i u nuly kandidátů */}
            <blockquote className="border-l-4 border-ink pl-3 text-sm leading-relaxed text-steel">
              {p.ruleCs}
            </blockquote>

            {p.candidates.length > 0 ? (
              <>
                <ul className="flex flex-col divide-y divide-hairline border-t-2 border-ink">
                  {p.candidates.slice(0, SHOWN_PER_PATTERN).map((c) => (
                    <CandidateRow key={c.id} c={c} />
                  ))}
                </ul>
                {p.candidates.length > SHOWN_PER_PATTERN && (
                  <p className="font-mono text-[11px] uppercase tracking-widest text-steel">
                    …a dalších {czechInt(p.candidates.length - SHOWN_PER_PATTERN)} kandidátů níže v pořadí důkazů
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-steel">
                Žádný kandidát — hlídka prošla {czechInt(p.examined)}{" "}
                {p.examined === 1 ? "vazbu" : p.examined >= 2 && p.examined <= 4 ? "vazby" : "vazeb"} a drát nikde
                nepřekročila. Nastražená zůstává.
              </p>
            )}

            <SourceNote>
              prošlo {czechInt(p.examined)} vazeb · pravidlo {data.ruleVersion} · odvozeno při čtení, nic nezapsáno
            </SourceNote>
          </div>
        ))}
      </div>

      <SourceNote>
        zdroj: kg_edge linked_to ({czechInt(data.coverage.tiesTotal)} vazeb, z toho {czechInt(data.coverage.tiesPending)} čeká
        na revizi) · {czechInt(data.coverage.votesLinkable)} hlasování o zákonech kanálů · {czechInt(data.coverage.rapporteurAssignments)}{" "}
        zpravodajství · {czechInt(data.coverage.stakeEdges)} podílových hran · {czechInt(data.coverage.liveCollisions)} živých
        střetů · celkem {czechInt(data.coverage.candidatesTotal)} kandidátů
      </SourceNote>
    </div>
  );
}
