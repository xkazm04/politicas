"use client";

/*
 * Velín smyček (6E) — sekce /admin, která stav smyček nejen ukazuje, ale umí
 * ho i řídit. Tři plochy: stavová tabulka (poslední aktivita, trvání, čerstvost
 * ve slovníku sdíleném s /atlas — čerstvé/stárnoucí/zastaralé/nehodnoceno),
 * výstrahy (stalled > kadence × 2, série selhání) a fronta znovuzařazené práce.
 *
 * BRZDY (batch-6 bod 25): každá řídicí akce tady projde dvoufázovým potvrzením
 * (ConfirmButton), zapíše se do append-only žurnálu (app/admin/loopActions →
 * driveLog) a žádná nemaže data. Přiznání: žurnál má vlastní sha-256 řetěz,
 * Merkle pečeť revizního ledgeru se na něj nevztahuje — vykresluje se doslova.
 */

import { useState, useTransition } from "react";
import { czech, czechDate, czechInt } from "@/lib/format";
import SourceNote from "@/features/shared/components/SourceNote";
import {
  acknowledgeAlert,
  requeueLoopStep,
  resolveQueueItem,
  saveQueueOrder,
  type LoopActionResult,
} from "@/app/admin/loopActions";
import type { LoopStatus } from "../loops/loopState";
import type { LoopsDoc, LoopsDocAlert } from "../loops/loopsJson";

/* ── drobné pomocníky ─────────────────────────────────────────────────────── */

function durationCs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return "pod 1 s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${czechInt(s)} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${czechInt(min)} min ${czechInt(s % 60)} s`;
  return `${czechInt(Math.floor(min / 60))} h ${czechInt(min % 60)} min`;
}

function ageCs(ageDays: number | null): string {
  if (ageDays == null) return "—";
  return `${czech(ageDays)} d`;
}

const STALENESS_CLS: Record<string, string> = {
  "čerstvé": "border-ink text-ink",
  "stárnoucí": "border-ochre text-ink",
  "zastaralé": "border-signal text-signal",
};

const STATUS_CLS: Record<LoopStatus["status"], string> = {
  "pozastaveno": "border-ochre text-ink",
  "v pořádku": "border-ink text-ink",
  "běží": "border-cobalt text-cobalt",
  "selhává": "border-signal text-signal",
  "neznámo": "border-hairline text-steel-aa",
};

/** Dvoufázové potvrzení — brzda z batch-6 bodu 25: první klik zbraní,
 *  akce se spustí až explicitním „Opravdu“. */
function ConfirmButton({
  label,
  armedLabel,
  onConfirm,
  disabled = false,
  tone = "ink",
}: {
  label: string;
  armedLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  tone?: "ink" | "signal";
}) {
  const [armed, setArmed] = useState(false);
  const base =
    "border px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt " +
    "disabled:cursor-not-allowed disabled:opacity-40";
  if (!armed) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setArmed(true)}
        className={`${base} ${tone === "signal" ? "border-signal text-signal hover:bg-signal hover:text-paper" : "border-ink text-ink hover:bg-ink hover:text-paper"}`}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        className={`${base} border-signal bg-signal text-paper hover:bg-ink hover:border-ink`}
      >
        {armedLabel}
      </button>
      <button type="button" onClick={() => setArmed(false)} className={`${base} border-hairline text-steel-aa hover:border-ink hover:text-ink`}>
        Zrušit
      </button>
    </span>
  );
}

/* ── hlavní komponenta ────────────────────────────────────────────────────── */

export default function LoopMissionControl({ doc }: { doc: LoopsDoc }) {
  const [pendingAction, startTransition] = useTransition();
  const [lastError, setLastError] = useState<string | null>(null);
  const [requeueNote, setRequeueNote] = useState("");

  // Lokální návrh pořadí fronty — commit až explicitním „Uložit pořadí“.
  // Resync při změně serverového stavu vzorem „adjust state during render"
  // (react.dev/you-might-not-need-an-effect), ne efektem.
  const [draftOrder, setDraftOrder] = useState<number[]>(doc.drive.pending.map((p) => p.seq));
  const serverOrderKey = doc.drive.pending.map((p) => p.seq).join(",");
  const [prevOrderKey, setPrevOrderKey] = useState(serverOrderKey);
  if (prevOrderKey !== serverOrderKey) {
    setPrevOrderKey(serverOrderKey);
    setDraftOrder(serverOrderKey ? serverOrderKey.split(",").map(Number) : []);
  }
  const orderDirty = draftOrder.join(",") !== serverOrderKey;
  const pendingBySeq = new Map(doc.drive.pending.map((p) => [p.seq, p]));

  const run = (fn: () => Promise<LoopActionResult>, onSuccess?: () => void) => {
    setLastError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setLastError(res.error);
      else onSuccess?.();
    });
  };

  const move = (seq: number, dir: -1 | 1) => {
    setDraftOrder((prev) => {
      const i = prev.indexOf(seq);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const unacked = doc.alerts.filter((a) => !a.acknowledged);
  const acked = doc.alerts.filter((a) => a.acknowledged);

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-3xl text-sm leading-relaxed text-steel">
        Strojově čitelný stav smyček a řídicí zásahy. Slovník čerstvosti je sdílený s{" "}
        <a href="/atlas" className="font-bold text-cobalt underline-offset-2 hover:underline">/atlas</a>
        {" "}(čerstvé ≤ kadence · stárnoucí ≤ 2× · zastaralé &gt; 2× = „stalled“; bez podkladu
        „nehodnoceno“). Týž dokument slouží i strojově:{" "}
        <a href="/admin/loops.json" className="font-mono font-bold text-cobalt underline-offset-2 hover:underline">
          /admin/loops.json
        </a>
        .
      </p>

      {doc.pausedNoteCs && (
        <p className="border-l-4 border-ochre bg-paper py-1 pl-3 font-mono text-xs uppercase tracking-widest text-ink">
          {doc.pausedNoteCs} — pozastavené smyčky se jako „stalled“ nehlásí
        </p>
      )}

      {lastError && (
        <p role="alert" className="border-2 border-signal p-3 text-sm font-bold text-signal">
          {lastError}
        </p>
      )}

      {/* ── stavová tabulka ── */}
      <div className="overflow-x-auto border border-ink">
        <table className="w-full min-w-[64rem] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-ink font-mono text-[11px] uppercase tracking-widest text-steel-aa">
              <th scope="col" className="px-3 py-2">smyčka</th>
              <th scope="col" className="px-3 py-2">stav</th>
              <th scope="col" className="px-3 py-2">poslední aktivita</th>
              <th scope="col" className="px-3 py-2">trvání</th>
              <th scope="col" className="px-3 py-2">stáří / kadence</th>
              <th scope="col" className="px-3 py-2">čerstvost</th>
              <th scope="col" className="px-3 py-2">další očekávaná</th>
              <th scope="col" className="px-3 py-2">selhání</th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">akce</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.loops.map((loop) => (
              <tr key={loop.id} className="border-b border-hairline align-top last:border-b-0">
                <td className="px-3 py-2">
                  <p className="text-sm font-bold text-ink">{loop.labelCs}</p>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-steel-aa">{loop.id}</p>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest ${STATUS_CLS[loop.status]}`}>
                    {loop.status}
                  </span>
                </td>
                <td className="max-w-[16rem] px-3 py-2">
                  <p className="font-mono text-xs tabular-nums text-ink">
                    {loop.lastActivityAt ? czechDate(loop.lastActivityAt) : "—"}
                  </p>
                  {loop.lastActivityLabel && (
                    <p className="truncate text-xs text-steel" title={loop.lastActivityLabel}>
                      {loop.lastActivityLabel}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink" title={loop.durationNote ?? undefined}>
                  {durationCs(loop.lastDurationMs)}
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink">
                  {ageCs(loop.ageDays)}
                  {loop.cadenceDays != null ? ` / ${czechInt(loop.cadenceDays)} d` : " / —"}
                </td>
                <td className="px-3 py-2">
                  {loop.staleness ? (
                    <span className={`inline-block border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest ${STALENESS_CLS[loop.staleness]}`}>
                      {loop.staleness}
                    </span>
                  ) : (
                    <span
                      className="inline-block border border-hairline px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest text-steel-aa"
                      title={loop.stalenessReason ?? undefined}
                    >
                      nehodnoceno
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink">
                  {loop.nextExpectedAt ? czechDate(loop.nextExpectedAt) : "—"}
                </td>
                <td className="px-3 py-2">
                  {loop.failureStreak > 0 ? (
                    <p className="font-mono text-xs font-bold tabular-nums text-signal">{czechInt(loop.failureStreak)}×</p>
                  ) : (
                    <p className="font-mono text-xs tabular-nums text-steel-aa">0×</p>
                  )}
                  {loop.lastFailureCause && (
                    <p className="max-w-[14rem] truncate text-xs text-steel" title={loop.lastFailureCause}>
                      {loop.lastFailureCause}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <ConfirmButton
                    label="Znovu zařadit"
                    armedLabel="Opravdu zařadit"
                    disabled={pendingAction || doc.drive.pending.some((p) => p.target === loop.id)}
                    onConfirm={() =>
                      run(
                        () => requeueLoopStep({ loopId: loop.id, note: requeueNote || undefined }),
                        () => setRequeueNote(""),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
            {doc.loops.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-sm text-steel">
                  Žádný stav smyček — ani pass žurnál, ani ingest běhy nejsou k dispozici.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── výstrahy ── */}
      <div>
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">
          výstrahy ({czechInt(unacked.length)} nepotvrzených)
        </h3>
        <div className="mt-3 flex flex-col gap-2">
          {unacked.map((a) => (
            <AlertRow key={a.id} alert={a} disabled={pendingAction} onAck={() => run(() => acknowledgeAlert({ alertId: a.id }))} />
          ))}
          {acked.map((a) => (
            <AlertRow key={a.id} alert={a} disabled onAck={null} />
          ))}
          {doc.alerts.length === 0 && (
            <p className="text-sm text-steel">
              Žádné výstrahy. Pozastavené case-smyčky se jako „stalled“ nehlásí a zdroj bez
              deklarované kadence nebo bez záznamu běhů je „nehodnoceno“ — ticho tu znamená
              „není z čeho hlásit“, ne „vše ověřeno“.
            </p>
          )}
        </div>
      </div>

      {/* ── fronta znovuzařazené práce ── */}
      <div>
        <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-steel-aa">
          fronta čekající práce ({czechInt(doc.drive.pending.length)})
        </h3>
        <div className="mt-3 flex flex-col gap-2">
          {draftOrder.map((seq, i) => {
            const item = pendingBySeq.get(seq);
            if (!item) return null;
            return (
              <div key={seq} className="flex flex-wrap items-center gap-3 border border-hairline p-3">
                <span className="font-mono text-xs font-bold tabular-nums text-steel-aa">{czechInt(i + 1)}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-ink">{item.target}</p>
                  <p className="text-xs text-steel">
                    zařazeno {czechDate(item.requestedAt)}
                    {item.note ? ` — ${item.note}` : ""}
                  </p>
                </div>
                <span className="inline-flex gap-1">
                  <button
                    type="button"
                    aria-label={`Posunout ${item.target} výš`}
                    disabled={i === 0 || pendingAction}
                    onClick={() => move(seq, -1)}
                    className="border border-ink px-2 py-1 font-mono text-[11px] font-bold text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Posunout ${item.target} níž`}
                    disabled={i === draftOrder.length - 1 || pendingAction}
                    onClick={() => move(seq, 1)}
                    className="border border-ink px-2 py-1 font-mono text-[11px] font-bold text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↓
                  </button>
                </span>
                <ConfirmButton
                  label="Vyřízeno"
                  armedLabel="Opravdu vyřídit"
                  disabled={pendingAction || orderDirty}
                  onConfirm={() => run(() => resolveQueueItem({ seq }))}
                />
              </div>
            );
          })}
          {doc.drive.pending.length === 0 && (
            <p className="text-sm text-steel">
              Fronta je prázdná — žádný krok nečeká na znovuzařazení. Krok zařadíte tlačítkem
              „Znovu zařadit“ u smyčky výše.
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-steel-aa">
            poznámka k dalšímu zařazení
            <input
              type="text"
              value={requeueNote}
              maxLength={280}
              onChange={(e) => setRequeueNote(e.target.value)}
              className="w-64 border border-hairline bg-paper px-2 py-1 font-sans text-xs normal-case tracking-normal text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cobalt"
              placeholder="volitelné — zapíše se do žurnálu"
            />
          </label>
          {orderDirty && (
            <>
              <ConfirmButton
                label="Uložit pořadí"
                armedLabel="Opravdu uložit"
                disabled={pendingAction}
                onConfirm={() => run(() => saveQueueOrder({ order: draftOrder }))}
              />
              <button
                type="button"
                onClick={() => setDraftOrder(serverOrderKey ? serverOrderKey.split(",").map(Number) : [])}
                className="border border-hairline px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-steel-aa transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
              >
                Vrátit beze změny
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── žurnál — přiznání ── */}
      <div className="border-t border-hairline pt-4">
        <p className="text-xs leading-relaxed text-steel">
          Akční žurnál: {czechInt(doc.drive.log.entries)} záznamů
          {doc.drive.log.skipped > 0 ? `, ${czechInt(doc.drive.log.skipped)} poškozených přeskočeno` : ""}
          {" · "}
          {doc.drive.log.chainOk ? (
            <span className="font-bold text-ink">sha-256 řetěz v pořádku</span>
          ) : (
            <span className="font-bold text-signal">sha-256 řetěz žurnálu NESEDÍ — záznamy byly změněny nebo vypuštěny</span>
          )}
          {" · "}
          <span className="font-mono">{doc.drive.log.path}</span>
        </p>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-steel">{doc.drive.log.chainNoteCs}</p>
        <SourceNote className="mt-3">
          zdroj: graph-log.md · ledger.json (money/effort/law) · ingest_run (store) · {doc.drive.log.path}
        </SourceNote>
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  disabled,
  onAck,
}: {
  alert: LoopsDocAlert;
  disabled: boolean;
  onAck: (() => void) | null;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border p-3 ${alert.acknowledged ? "border-hairline" : "border-signal"}`}
    >
      <span
        className={`inline-block border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-widest ${
          alert.acknowledged ? "border-hairline text-steel-aa" : "border-signal text-signal"
        }`}
      >
        {alert.kind === "stalled" ? "zastaralé" : "série selhání"}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-relaxed ${alert.acknowledged ? "text-steel" : "text-ink"}`}>{alert.messageCs}</p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-steel-aa">
          {alert.loopId}
          {alert.since ? ` · od ${czechDate(alert.since)}` : ""}
          {alert.acknowledged && alert.acknowledgedAt ? ` · potvrzeno ${czechDate(alert.acknowledgedAt)}` : ""}
        </p>
      </div>
      {onAck && !alert.acknowledged && (
        <ConfirmButton label="Potvrdit (ztišit)" armedLabel="Opravdu ztišit" tone="signal" disabled={disabled} onConfirm={onAck} />
      )}
    </div>
  );
}
