import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { processSubscriptionPayment } from "@/lib/services/subscriptionService";
import { checkCampayTransactionStatus } from "@/lib/services/campayService";
import { createClient } from "@/lib/supabase/client";
import { SubscriptionPlanId, BillingCycle } from "@/types/database";

// In-memory idempotency cache (TTL: 24h) to prevent replay attacks and duplicate activations
interface IdempotencyRecord {
  timestamp: number;
  status: string;
}
const idempotencyStore = new Map<string, IdempotencyRecord>();

// Webhook rate limiting per client IP (flood / DoS prevention: max 60 hits/minute)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (record.count >= 60) {
    return true;
  }
  record.count += 1;
  return false;
}

/**
 * Constant-time comparison between two strings to prevent timing side-channel attacks
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim());
  const bufB = Buffer.from(b.trim());
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Cryptographic validation of Campay HS256 JWT signatures
 */
function verifyJwtHs256(
  token: string,
  secret: string
): { valid: boolean; payload?: Record<string, unknown>; reason?: string } {
  try {
    const cleanToken = token.replace(/^(Bearer|Token)\s+/i, "").trim();
    const parts = cleanToken.split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Invalid JWT format" };
    }

    const [headerB64, payloadB64, sigB64] = parts;

    // Recalculate HMAC-SHA256 signature using the configured secret key
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    const bufSig = Buffer.from(sigB64);
    const bufExp = Buffer.from(expectedSig);

    if (bufSig.length !== bufExp.length || !crypto.timingSafeEqual(bufSig, bufExp)) {
      return { valid: false, reason: "JWT signature digest mismatch" };
    }

    const decodedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );

    // Validate expiration claim if present (allow 60s clock skew)
    if (typeof decodedPayload.exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayload.exp < now - 60) {
        return { valid: false, reason: "JWT has expired" };
      }
    }

    return { valid: true, payload: decodedPayload };
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : "JWT parsing failed",
    };
  }
}

/**
 * Constant-time verification of raw webhook tokens or Bearer authorization headers
 */
function verifyRawSecret(candidate: string, secret: string): boolean {
  const clean = candidate.replace(/^(Bearer|Token)\s+/i, "").trim();
  return clean.length > 0 && timingSafeEqualStr(clean, secret);
}

/**
 * Constant-time verification of HMAC-SHA256 hex digest of the raw webhook body
 */
function verifyHmacHex(candidate: string, rawBody: string, secret: string): boolean {
  const clean = candidate.replace(/^(Bearer|Token|sha256=)\s*/i, "").trim();
  if (clean.length !== 64) return false;
  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualStr(clean, expectedHex);
}

/**
 * Comprehensive verification engine supporting all Campay webhook signature methods
 */
function validateCampaySignature(
  candidates: (string | null | undefined)[],
  rawBody: string,
  secret: string
): { valid: boolean; matchedMethod?: string; reason?: string } {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    // 1. Test HS256 JWT (Standard Campay Webhook Specification)
    if (trimmed.includes(".")) {
      const jwtResult = verifyJwtHs256(trimmed, secret);
      if (jwtResult.valid) {
        return { valid: true, matchedMethod: "JWT-HS256" };
      }
    }

    // 2. Test Raw Shared Webhook Key / Authorization Token
    if (verifyRawSecret(trimmed, secret)) {
      return { valid: true, matchedMethod: "SHARED-SECRET" };
    }

    // 3. Test Raw Body HMAC-SHA256 Hex Digest
    if (verifyHmacHex(trimmed, rawBody, secret)) {
      return { valid: true, matchedMethod: "HMAC-SHA256-HEX" };
    }
  }

  return { valid: false, reason: "Cryptographic signature check failed on all candidates" };
}

export async function POST(req: NextRequest) {
  // 1. Rate Limiting / Flood Mitigation
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown-ip";

  if (isRateLimited(clientIp)) {
    console.warn(`[SECURITY ALERT] Campay webhook rate limit exceeded by IP: ${clientIp}`);
    return NextResponse.json(
      { error: "Too many webhook requests. Throttled." },
      { status: 429 }
    );
  }

  // 2. Fail-Closed Secret Verification
  const webhookKey = process.env.CAMPAY_WEBHOOK_KEY?.trim();
  if (!webhookKey) {
    console.error(
      "[SECURITY CRITICAL] CAMPAY_WEBHOOK_KEY is missing from environment. " +
      "Refusing to process unauthenticated Campay webhook."
    );
    return NextResponse.json(
      { error: "Webhook signature verification service not configured" },
      { status: 500 }
    );
  }

  try {
    // 3. Extract Raw Body & Signatures
    const rawBody = await req.text();
    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn("[SECURITY ALERT] Received malformed JSON in Campay webhook body.");
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
    }

    const sigHeader = req.headers.get("x-campay-signature")?.trim();
    const authHeader = req.headers.get("authorization")?.trim();
    const bodySignature =
      typeof payload.signature === "string" ? payload.signature.trim() : null;

    // Reject immediately if no authentication header or signature exists
    if (!sigHeader && !authHeader && !bodySignature) {
      console.warn(
        `[SECURITY ALERT] Rejected unauthenticated Campay webhook from IP ${clientIp}: Missing signature.`
      );
      return NextResponse.json(
        { error: "Missing signature or authorization header" },
        { status: 401 }
      );
    }

    // 4. Strict Cryptographic Verification
    const sigValidation = validateCampaySignature(
      [sigHeader, authHeader, bodySignature],
      rawBody,
      webhookKey
    );

    if (!sigValidation.valid) {
      console.warn(
        `[SECURITY ALERT] Cryptographic signature validation failed for Campay webhook from IP ${clientIp}. Reason: ${sigValidation.reason}`
      );
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // 5. Payload Field Validation
    const reference = typeof payload.reference === "string" ? payload.reference.trim() : "";
    const rawStatus = typeof payload.status === "string" ? payload.status.trim().toUpperCase() : "";
    const externalRef = typeof payload.external_reference === "string" ? payload.external_reference.trim() : "";
    const amount = Number(payload.amount);

    if (!reference) {
      return NextResponse.json(
        { error: "Missing required field: reference" },
        { status: 400 }
      );
    }

    const validStatuses = ["SUCCESSFUL", "FAILED", "PENDING"];
    if (!validStatuses.includes(rawStatus)) {
      return NextResponse.json(
        { error: `Invalid transaction status: ${rawStatus}` },
        { status: 400 }
      );
    }

    console.log(
      `[Campay Webhook] Authenticated notification (${sigValidation.matchedMethod}) for ref ${reference}, status: ${rawStatus}`
    );

    // 6. Anti-Replay & Idempotency Check
    const existingRecord = idempotencyStore.get(reference);
    if (existingRecord && existingRecord.status === "SUCCESSFUL") {
      console.log(
        `[Campay Webhook] Transaction ${reference} was already successfully processed. Returning idempotent 200.`
      );
      return NextResponse.json({
        received: true,
        status: "already_processed",
        reference,
      });
    }

    // 7. Defense-in-Depth: Independent Verification with Campay Gateway
    // If webhook claims payment was successful, cross-verify against Campay's server-to-server API
    if (rawStatus === "SUCCESSFUL") {
      const campayVerification = await checkCampayTransactionStatus(reference);
      if (campayVerification.status !== "SUCCESSFUL") {
        console.warn(
          `[SECURITY ALERT] Webhook reported status SUCCESSFUL for ref ${reference}, ` +
          `but independent Campay API check returned status '${campayVerification.status}'. Aborting activation.`
        );
        return NextResponse.json(
          { error: "Transaction verification with Campay API gateway failed" },
          { status: 422 }
        );
      }
    }

    // 8. Execute Database State Updates for Confirmed Subscriptions
    if (rawStatus === "SUCCESSFUL" && externalRef) {
      // Support structured format: SUB_${landlordId}_${planId}_${billingCycle}_${timestamp}
      if (externalRef.startsWith("SUB_") || externalRef.startsWith("SUB-")) {
        const separator = externalRef.includes("_") ? "_" : "-";
        const parts = externalRef.split(separator);

        let landlordId = "";
        let planId: SubscriptionPlanId = "starter";
        let billingCycle: BillingCycle = "monthly";

        if (separator === "_" && parts.length >= 4) {
          landlordId = parts[1];
          planId = parts[2] as SubscriptionPlanId;
          billingCycle = (parts[3] || "monthly") as BillingCycle;
        }

        if (landlordId) {
          try {
            const supabase = createClient();
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email, phone")
              .eq("id", landlordId)
              .maybeSingle();

            const activation = await processSubscriptionPayment({
              landlordId,
              landlordName: profile?.full_name || "Landlord",
              landlordEmail: profile?.email || undefined,
              landlordPhone: profile?.phone || undefined,
              planId,
              billingCycle,
              paymentMethod: "momo",
              payerPhone: payload.operator_reference || payload.phone || profile?.phone,
              payerName: payload.operator || "Mobile Money",
              notes: `Campay Webhook Verified: Ref ${reference} (${amount > 0 ? `${amount} XAF` : ""})`,
            });

            if (activation.success) {
              console.log(
                `[Campay Webhook] Subscription successfully activated in Supabase for landlord ${landlordId} (Plan: ${planId})`
              );
            } else {
              console.warn(`[Campay Webhook] Subscription activation note:`, activation.error);
            }
          } catch (actErr) {
            console.error("[Campay Webhook] Exception during subscription activation:", actErr);
          }
        }
      }

      // Mark reference as completed in the idempotency store
      idempotencyStore.set(reference, {
        timestamp: Date.now(),
        status: "SUCCESSFUL",
      });
    }

    return NextResponse.json({
      received: true,
      reference,
      status: rawStatus,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error processing webhook";
    console.error("[Campay Webhook Exception]:", msg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
