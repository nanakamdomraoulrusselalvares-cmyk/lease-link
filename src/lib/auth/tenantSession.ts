import crypto from "node:crypto";

export const TENANT_COOKIE_NAME = "leaselink_tenant_session";
export const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export function getTenantSecretKey(): string {
  return (
    process.env.OTP_SECRET ||
    process.env.CAMPAY_WEBHOOK_KEY ||
    "leaselink-tenant-secure-cookie-hmac-key-2026"
  );
}

/**
 * Creates a cryptographically signed, tamper-proof session string
 */
export function signSessionPayload(token: string, unitId: string): string {
  const secret = getTenantSecretKey();
  const payload = JSON.stringify({
    token: token.trim(),
    unitId: unitId.trim(),
    createdAt: Date.now(),
  });
  const b64 = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${signature}`;
}

/**
 * Validates and decodes the signed cookie session
 */
export function verifySessionPayload(
  cookieValue: string
): { valid: boolean; token?: string; unitId?: string } {
  try {
    const parts = cookieValue.split(".");
    if (parts.length !== 2) {
      return { valid: false };
    }
    const [b64, signature] = parts;
    const secret = getTenantSecretKey();
    const expectedSig = crypto.createHmac("sha256", secret).update(b64).digest("base64url");

    const bufSig = Buffer.from(signature);
    const bufExp = Buffer.from(expectedSig);

    if (bufSig.length !== bufExp.length || !crypto.timingSafeEqual(bufSig, bufExp)) {
      return { valid: false };
    }

    const jsonStr = Buffer.from(b64, "base64url").toString("utf8");
    const data = JSON.parse(jsonStr);

    if (!data.token || typeof data.token !== "string") {
      return { valid: false };
    }

    return { valid: true, token: data.token, unitId: data.unitId };
  } catch {
    return { valid: false };
  }
}
