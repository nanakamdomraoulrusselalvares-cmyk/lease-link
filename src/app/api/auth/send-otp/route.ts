import { NextResponse } from "next/server";
import { generateOtpCode, signOtpToken } from "@/lib/services/otpService";
import { sendVerificationOtpEmail } from "@/lib/services/emailService";

// In-memory rate limiting map: email -> lastSentTimestamp
const lastSentMap = new Map<string, number>();
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_SECONDS = 30;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
    const now = Date.now();

    // IP flood protection: max 10 OTP requests per minute per IP
    const ipRecord = ipRateLimitMap.get(ip);
    if (!ipRecord || now > ipRecord.resetAt) {
      ipRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    } else {
      if (ipRecord.count >= 10) {
        return NextResponse.json(
          { success: false, error: "Too many requests. Please try again in a minute." },
          { status: 429 }
        );
      }
      ipRecord.count++;
    }

    const body = await req.json();
    const email = (body.email || "").toString().trim().toLowerCase();

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // Rate limiting check
    const lastSent = lastSentMap.get(email);
    if (lastSent && now - lastSent < RATE_LIMIT_SECONDS * 1000) {
      const waitTime = Math.ceil((RATE_LIMIT_SECONDS * 1000 - (now - lastSent)) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Please wait ${waitTime}s before requesting a new code.`,
          retryAfter: waitTime,
        },
        { status: 429 }
      );
    }

    // 1. Generate 6-digit code and HMAC-signed token
    const code = generateOtpCode();
    const { token, expiresAt } = signOtpToken(email, code, 10);

    // 2. Dispatch email via Resend (or log in dev mode)
    const emailResult = await sendVerificationOtpEmail(email, code, 10);

    // Update rate limit timestamp
    lastSentMap.set(email, now);

    const isProduction = process.env.NODE_ENV === "production";

    return NextResponse.json({
      success: true,
      otpToken: token,
      expiresAt,
      expiresInSeconds: 600,
      isDevBypass: !isProduction && Boolean(emailResult.isDevBypass),
      devCode: !isProduction ? (emailResult.devCode || null) : null,
      message: "Verification code sent successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[LeaseLink] Failed to send OTP:", message);
    return NextResponse.json(
      { success: false, error: "Failed to send verification code." },
      { status: 500 }
    );
  }
}
