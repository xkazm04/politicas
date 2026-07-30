"use server";

// Řídicí akce velína smyček (6E) — jediný zápisový okraj akčního žurnálu.
// BRZDY (batch-6 bod 25): každou akci operátor v UI explicitně potvrzuje
// (LoopMissionControl — dvoufázové tlačítko), každá se zapisuje do
// append-only žurnálu (driveLog) a ŽÁDNÁ nemaže data. Vzor gate-first:
// features/money/reviewActions.ts — přístup rozhoduje readAdminGate, tatáž
// jediná brána jako u stránky; akce sama nikdy.
//
// Validace cílů čte AKTUÁLNÍ odvozený stav (getLoopsDoc) — akce na smyčku,
// výstrahu nebo položku, kterou stav nezná, se odmítne poctivou českou
// hláškou místo zápisu nesmyslu do žurnálu.

import { revalidatePath } from "next/cache";
import { readAdminGate } from "./accessGate";
import { getLoopsDoc } from "@/features/admin/loops/getLoopState";
import { appendDriveEntry } from "@/features/admin/loops/driveLog";

export type LoopActionResult = { ok: true } | { ok: false; error: string };

/** Jediný lokální operátor prokázaný sdíleným tokenem — jmenovitě se neeviduje. */
const ACTOR = "operátor (ADMIN_TOKEN)";

const NOTE_MAX = 280;

async function gateVerdict(): Promise<string | null> {
  const gate = await readAdminGate();
  if (gate === "ok") return null;
  return gate === "not-configured"
    ? "Konzole není nakonfigurována (ADMIN_TOKEN chybí) — akce zamítnuta."
    : "Přístup neověřen — přihlaste se tokenem na /admin.";
}

function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, NOTE_MAX) : null;
}

/** Znovu zařadit krok smyčky do fronty čekající práce. */
export async function requeueLoopStep(input: { loopId: string; note?: string }): Promise<LoopActionResult> {
  const denied = await gateVerdict();
  if (denied) return { ok: false, error: denied };

  const loopId = typeof input?.loopId === "string" ? input.loopId.trim() : "";
  const doc = await getLoopsDoc();
  if (!doc.loops.some((l) => l.id === loopId)) {
    return { ok: false, error: `Neznámá smyčka „${loopId}“ — krok nelze zařadit.` };
  }
  if (doc.drive.pending.some((p) => p.target === loopId)) {
    return { ok: false, error: `Smyčka „${loopId}“ už ve frontě čeká — duplicitně se nezařazuje.` };
  }
  const res = appendDriveEntry({ actor: ACTOR, action: "requeue", target: loopId, note: cleanNote(input?.note) });
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}

/** Uložit nové pořadí čekající fronty (permutace stávajících položek). */
export async function saveQueueOrder(input: { order: number[] }): Promise<LoopActionResult> {
  const denied = await gateVerdict();
  if (denied) return { ok: false, error: denied };

  const order = Array.isArray(input?.order) ? input.order : null;
  if (!order || !order.every((x) => typeof x === "number" && Number.isInteger(x))) {
    return { ok: false, error: "Pořadí musí být pole celých čísel (seq položek fronty)." };
  }
  const doc = await getLoopsDoc();
  const current = doc.drive.pending.map((p) => p.seq);
  const same =
    current.length === order.length &&
    [...current].sort((a, b) => a - b).every((v, i) => v === [...order].sort((a, b) => a - b)[i]);
  if (!same) {
    return { ok: false, error: "Pořadí neodpovídá aktuální frontě — obnovte stránku a zkuste znovu." };
  }
  const res = appendDriveEntry({ actor: ACTOR, action: "reorder", target: JSON.stringify(order), note: null });
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}

/** Potvrdit (ztišit) výstrahu — váže se na otisk stavu; změní-li se stav, výstraha se vrátí. */
export async function acknowledgeAlert(input: { alertId: string }): Promise<LoopActionResult> {
  const denied = await gateVerdict();
  if (denied) return { ok: false, error: denied };

  const alertId = typeof input?.alertId === "string" ? input.alertId.trim() : "";
  const doc = await getLoopsDoc();
  const alert = doc.alerts.find((a) => a.id === alertId);
  if (!alert) {
    return { ok: false, error: "Výstraha už neexistuje v aktuálním stavu — není co potvrzovat." };
  }
  if (alert.acknowledged) {
    return { ok: false, error: "Výstraha už je potvrzena." };
  }
  const res = appendDriveEntry({ actor: ACTOR, action: "ack", target: alertId, note: cleanNote(alert.messageCs) });
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}

/** Označit položku fronty za vyřízenou (v žurnálu zůstává, z fronty mizí). */
export async function resolveQueueItem(input: { seq: number }): Promise<LoopActionResult> {
  const denied = await gateVerdict();
  if (denied) return { ok: false, error: denied };

  const seq = typeof input?.seq === "number" && Number.isInteger(input.seq) ? input.seq : null;
  if (seq == null) return { ok: false, error: "Chybí platné seq položky fronty." };
  const doc = await getLoopsDoc();
  const item = doc.drive.pending.find((p) => p.seq === seq);
  if (!item) {
    return { ok: false, error: "Položka fronty neexistuje nebo už je vyřízená." };
  }
  const res = appendDriveEntry({ actor: ACTOR, action: "resolve", target: String(seq), note: item.target });
  if (!res.ok) return res;
  revalidatePath("/admin");
  return { ok: true };
}
