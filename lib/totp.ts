/**
 * TOTP (RFC 6238) en pur node:crypto — pas de dépendance externe (surface
 * d'attaque minimale). Compatible Google Authenticator / Authy / 1Password.
 *
 * Paramètres standard : SHA-1, 6 chiffres, pas de 30 s.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Secret aléatoire 160 bits, encodé base32 (format clé d'authentificateur). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secretBuf: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (bin % 1_000_000).toString().padStart(6, "0");
}

/** Token courant pour un secret donné (utile pour les tests). */
export function totpToken(secret: string, time = Date.now()): string {
  return hotp(base32Decode(secret), Math.floor(time / 1000 / 30));
}

/**
 * Vérifie un token saisi, avec une tolérance de ±`window` pas de 30 s
 * (gère le décalage d'horloge). Comparaison à temps constant.
 */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const t = (token ?? "").trim();
  if (!/^\d{6}$/.test(t)) return false;
  const buf = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const target = Buffer.from(t);
  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(hotp(buf, counter + i));
    if (candidate.length === target.length && timingSafeEqual(candidate, target)) {
      return true;
    }
  }
  return false;
}

/** URI otpauth:// à encoder en QR pour l'app d'authentification. */
export function otpauthUri(
  secret: string,
  account: string,
  issuer = "MakeYourCom CRM",
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Génère N codes de secours lisibles (format xxxx-xxxx, base32). */
export function generateRecoveryCodes(n = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const raw = base32Encode(randomBytes(5)).slice(0, 8).toLowerCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}
