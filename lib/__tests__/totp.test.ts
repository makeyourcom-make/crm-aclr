import { describe, expect, it } from "vitest";

import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  otpauthUri,
  totpToken,
  verifyTotp,
} from "../totp";

describe("TOTP (RFC 6238)", () => {
  // Secret de test RFC 6238 : ASCII "12345678901234567890".
  const RFC_SECRET_ASCII = "12345678901234567890";
  const rfcSecretB32 = base32Encode(Buffer.from(RFC_SECRET_ASCII));

  it("base32 round-trip", () => {
    expect(base32Decode(rfcSecretB32).toString()).toBe(RFC_SECRET_ASCII);
    expect(rfcSecretB32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("vecteur RFC 6238 : T=59s → 287082 (SHA1, 6 chiffres)", () => {
    expect(totpToken(rfcSecretB32, 59_000)).toBe("287082");
  });

  it("vecteur RFC 6238 : T=1111111109s → 081804", () => {
    expect(totpToken(rfcSecretB32, 1_111_111_109_000)).toBe("081804");
  });

  it("verifyTotp accepte le token courant et refuse un mauvais", () => {
    const secret = generateTotpSecret();
    const now = totpToken(secret);
    expect(verifyTotp(secret, now)).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
    expect(verifyTotp(secret, "abc")).toBe(false);
    expect(verifyTotp(secret, "")).toBe(false);
  });

  it("otpauthUri contient secret + issuer", () => {
    const uri = otpauthUri("ABC234", "arthur@x.ch", "CRM");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABC234");
    expect(uri).toContain("issuer=CRM");
  });

  it("génère des codes de secours au bon format", () => {
    const codes = generateRecoveryCodes(8);
    expect(codes).toHaveLength(8);
    for (const c of codes) expect(c).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}$/);
    expect(new Set(codes).size).toBe(8); // tous distincts
  });
});
