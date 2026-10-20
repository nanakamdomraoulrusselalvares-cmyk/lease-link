import { NextResponse } from "next/server";
import { verifyOtpToken } from "@/lib/services/otpService";
import { createClient } from "@supabase/supabase-js";

// Rate limit attempts per email: max 5 failed attempts per window
const failedAttemptsMap = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body.email || "").toString().trim().toLowerCase();
    const code = (body.code || "").toString().trim();
    const otpToken = (body.otpToken || "").toString().trim();

    if (!email || !code || !otpToken) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: email, code, or token." },
        { status: 400 }
      );
    }

    if (code.length < 6 || code.length > 8 || !/^\d{6,8}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "The code must be 6 to 8 digits." },
        { status: 400 }
      );
    }

    // Check brute-force lockout
    const now = Date.now();
    const attemptRecord = failedAttemptsMap.get(email);
    if (attemptRecord && attemptRecord.lockedUntil > now) {
      const waitMinutes = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
      return NextResponse.json(
        {
          success: false,
          error: `Too many invalid attempts. Please wait ${waitMinutes} minute(s) before trying again.`,
        },
        { status: 429 }
      );
    }

    // Verify HMAC signature and expiration
    const verification = verifyOtpToken(email, code, otpToken);

    if (!verification.valid) {
      // Increment failed attempts
      const currentAttempts = (attemptRecord?.count || 0) + 1;
      if (currentAttempts >= MAX_ATTEMPTS) {
        failedAttemptsMap.set(email, {
          count: currentAttempts,
          lockedUntil: now + LOCKOUT_MINUTES * 60 * 1000,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Too many failed attempts. Account temporarily locked for 10 minutes.",
          },
          { status: 429 }
        );
      } else {
        failedAttemptsMap.set(email, {
          count: currentAttempts,
          lockedUntil: 0,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error:
            verification.reason === "Code expired"
              ? "Verification code has expired. Please request a new one."
              : "Invalid verification code. Please check your inbox and try again.",
        },
        { status: 400 }
      );
    }

    // Success! Clear failed attempts
    failedAttemptsMap.delete(email);

    // If Supabase Admin Service Role Key is configured, confirm user directly in auth.users
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceKey && !supabaseUrl.includes("your-project-ref")) {
      try {
        const adminClient = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Find user by email and mark email confirmed
        const { data: usersData } = await adminClient.auth.admin.listUsers();
        const user = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );

        if (user) {
          await adminClient.auth.admin.updateUserById(user.id, {
            email_confirm: true,
          });

          // Ensure profile exists in public.profiles
          const { data: profile } = await adminClient
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

          if (!profile) {
            const meta = user.user_metadata || {};
            const trialExpires = new Date();
            trialExpires.setDate(trialExpires.getDate() + 30);

            await adminClient.from("profiles").upsert({
              id: user.id,
              email: user.email,
              full_name: meta.full_name || meta.name || email.split("@")[0],
              phone: meta.phone || "",
              role: "landlord",
              plan: meta.plan || "free",
              plan_name: "Essai Gratuit 30 Jours",
              plan_unit_limit: 5,
              unit_limit: 5,
              plan_status: "active",
              subscription_status: "active",
              has_used_free_trial: true,
              has_used_trial: true,
              plan_starts_at: new Date().toISOString(),
              plan_expires_at: trialExpires.toISOString(),
              trial_expires_at: trialExpires.toISOString(),
              subscription_expires_at: trialExpires.toISOString(),
              billing_cycle: "monthly",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (adminErr) {
        console.warn("[LeaseLink] Supabase admin auto-confirm warning:", adminErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification error";
    console.error("[LeaseLink] Failed to verify OTP:", message);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during verification." },
      { status: 500 }
    );
  }
}
