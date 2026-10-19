import crypto from "crypto";

const OTP_SECRET =
  process.env.OTP_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "leaselink_secure_otp_default_secret_key_2026";

export interface SignedOtpPayload {
  email: string;
  expiresAt: number;
  sig: string;
}

/**
 * Generates a cryptographically strong 6-digit numeric OTP code.
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Creates a tamper-proof HMAC-signed token binding email, OTP code, and expiration.
 * The raw code itself is NEVER included in the returned token string.
 */
export function signOtpToken(
  email: string,
  code: string,
  expiresInMinutes = 10
): { token: string; expiresAt: number } {
  const cleanEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  const payload = `${cleanEmail}:${code.trim()}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", OTP_SECRET).update(payload).digest("hex");

  const tokenData: SignedOtpPayload = {
    email: cleanEmail,
    expiresAt,
    sig,
  };

  const token = Buffer.from(JSON.stringify(tokenData)).toString("base64url");
  return { token, expiresAt };
}

/**
 * Verifies the user-entered 6-digit code against the signed token and email.
 */
export function verifyOtpToken(
  email: string,
  enteredCode: string,
  token: string
): { valid: boolean; reason?: string } {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parsed: SignedOtpPayload = JSON.parse(raw);
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = enteredCode.trim();

    if (!parsed.email || !parsed.expiresAt || !parsed.sig) {
      return { valid: false, reason: "Malformed token" };
    }

    if (parsed.email !== cleanEmail) {
      return { valid: false, reason: "Email mismatch" };
    }

    if (Date.now() > parsed.expiresAt) {
      return { valid: false, reason: "Code expired" };
    }

    const payload = `${cleanEmail}:${cleanCode}:${parsed.expiresAt}`;
    const expectedSig = crypto.createHmac("sha256", OTP_SECRET).update(payload).digest("hex");

    const sigBuffer = Buffer.from(parsed.sig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");

    if (
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return { valid: true };
    }

    return { valid: false, reason: "Invalid code" };
  } catch {
    return { valid: false, reason: "Invalid token" };
  }
}
