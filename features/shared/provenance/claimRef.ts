/*
 * ÚČTENKA PŮVODU — stabilní adresa jednoho tvrzení znalostního grafu.
 *
 * Čistý modul, žádný server ani DOM. Tvrzení („claim") je buď HRANA grafu
 * (src --rel--> dst: vazba, dodávka, hlasovací shoda…), nebo UZEL (osoba,
 * firma, smlouva…). Adresa /zdroj/<ref> nese celý identifikátor tvrzení,
 * takže server umí účtenku deterministicky znovuodvodit jen ze čtení grafu —
 * účtenka není řádek v databázi, ale adresovaný výpočet (stejná disciplína
 * jako Exponát, features/dashboard/exhibit.ts).
 *
 * Tvar:  h.<b64url(src)>.<b64url(rel)>.<b64url(dst)>   — hrana
 *        u.<b64url(id)>                                — uzel
 * Oddělovač je tečka: base64url ji neobsahuje a v URL segmentu je legální.
 *
 * ADRESA JE TVRZENÍ: nerozluštitelný ref není účtenka — dekodér vrací null
 * a plocha odpoví 404, nikdy prázdným rámem (pravidlo Exponátu č. 3).
 *
 * Base64url kodek je zde ZÁMĚRNĚ vlastní, ne import z features/dashboard/
 * exhibit.ts — sdílený primitiv nesmí záviset na cizí feature (katalogová
 * hranice); orchestrátor může obě kopie později sloučit do lib/.
 */

export type ClaimRef =
  | { kind: "edge"; src: string; rel: string; dst: string }
  | { kind: "node"; id: string };

// ── Base64url (bez Buffer/btoa — týž kód na serveru, klientu i ve vitestu) ──

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 !== undefined) out += B64[((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 !== undefined) out += B64[b2 & 0b111111];
  }
  return out;
}

/** null = řetězec není platný base64url (adresu neopravujeme, odmítáme). */
function fromBase64Url(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded) || encoded.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 4) {
    const chunk = [...encoded.slice(i, i + 4)].map((c) => B64.indexOf(c));
    bytes.push((chunk[0] << 2) | (chunk[1] >> 4));
    if (chunk.length > 2) bytes.push(((chunk[1] & 0b1111) << 4) | (chunk[2] >> 2));
    if (chunk.length > 3) bytes.push(((chunk[2] & 0b11) << 6) | chunk[3]);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// ── Kodek adresy tvrzení ────────────────────────────────────────────────────

/** Horní mez délky segmentu adresy — id grafu jsou krátké urny; cokoli delšího
 *  je zneužitá adresa, ne tvrzení. */
const MAX_REF_LENGTH = 512;

export function encodeClaimRef(ref: ClaimRef): string {
  return ref.kind === "edge"
    ? `h.${toBase64Url(ref.src)}.${toBase64Url(ref.rel)}.${toBase64Url(ref.dst)}`
    : `u.${toBase64Url(ref.id)}`;
}

export function decodeClaimRef(encoded: string): ClaimRef | null {
  if (typeof encoded !== "string" || encoded.length === 0 || encoded.length > MAX_REF_LENGTH) {
    return null;
  }
  const parts = encoded.split(".");
  if (parts[0] === "u" && parts.length === 2) {
    const id = fromBase64Url(parts[1]);
    return id ? { kind: "node", id } : null;
  }
  if (parts[0] === "h" && parts.length === 4) {
    const src = fromBase64Url(parts[1]);
    const rel = fromBase64Url(parts[2]);
    const dst = fromBase64Url(parts[3]);
    return src && rel && dst ? { kind: "edge", src, rel, dst } : null;
  }
  return null;
}

/** Adresa účtenky pro hranu — počítá ji plocha u citace. */
export const edgeClaimRef = (src: string, rel: string, dst: string): string =>
  encodeClaimRef({ kind: "edge", src, rel, dst });

/** Adresa účtenky pro uzel. */
export const nodeClaimRef = (id: string): string => encodeClaimRef({ kind: "node", id });

/** Cesta trvalé účtenky — jediné místo, kde se skládá /zdroj/<ref>. */
export const claimRefPath = (ref: ClaimRef | string): string =>
  `/zdroj/${typeof ref === "string" ? ref : encodeClaimRef(ref)}`;
