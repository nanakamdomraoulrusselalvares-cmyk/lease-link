import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolvePlanConfig, AVAILABLE_PLANS } from "@/types/database";

function generateSecurePassword(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LL-VIP-${randomPart}`;
}

async function verifyAdminAuthorization(): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
  status?: number;
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!supabaseUrl || supabaseUrl.includes("your-project-ref")) {
    return { authorized: true, userId: "mock_admin" };
  }

  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: userErr,
    } = await serverSupabase.auth.getUser();

    if (userErr || !user) {
      return { authorized: false, error: "Unauthorized. Please log in as an administrator.", status: 401 };
    }

    const { data: profile } = await serverSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return {
        authorized: false,
        error: "Forbidden. Super-Admin privileges required.",
        status: 403,
      };
    }

    return { authorized: true, userId: user.id };
  } catch (err) {
    console.warn("Authorization verification error in /api/admin/users:", err);
    return { authorized: false, error: "Authentication verification failed", status: 401 };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fullName,
      email,
      phone,
      password: inputPassword,
      planId = "tier_300_plus",
      customUnitLimit,
      durationDays: rawDurationDays = 30,
    } = body;

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        { success: false, error: "Full Name, Email, and Phone number are required." },
        { status: 400 }
      );
    }

    const authCheck = await verifyAdminAuthorization();
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.status || 401 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanName = fullName.trim();
    const password = (inputPassword && String(inputPassword).trim()) || generateSecurePassword();

    // Duration calculation: 30 days (1 month) or 365 days (12 months / 1 year)
    const durationDays = Number(rawDurationDays) >= 360 ? 365 : Number(rawDurationDays) || 30;
    const billingCycle = durationDays >= 360 ? "annual" : "monthly";

    // Unit capacity calculation (300+ units or custom capacity)
    const planConfig = resolvePlanConfig(planId);
    let effectiveUnitLimit = planConfig.maxUnits;
    if (planId === "tier_300_plus" || planId === "custom" || customUnitLimit) {
      effectiveUnitLimit = Math.max(300, Number(customUnitLimit) || 500);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const cycleLabelFr = billingCycle === "annual" ? "Annuel (12 Mois)" : "Mensuel (30 Jours)";
    const planDisplayName = `${planConfig.nameFr || planConfig.name} - ${effectiveUnitLimit} Lots (${cycleLabelFr})`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    // 1. Mock Mode Fallback (Offline / Sandbox)
    if (!supabaseUrl || supabaseUrl.includes("your-project-ref")) {
      const mockId = "usr_" + Math.random().toString(36).substring(2, 11);
      const mockProfile = {
        id: mockId,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: "landlord",
        plan: planConfig.id,
        plan_name: planDisplayName,
        billing_cycle: billingCycle,
        plan_unit_limit: effectiveUnitLimit,
        unit_limit: effectiveUnitLimit,
        plan_duration_days: durationDays,
        plan_starts_at: now.toISOString(),
        plan_expires_at: expiresAt.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
        plan_status: "active",
        subscription_status: "active",
        has_used_free_trial: true,
        has_used_trial: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      return NextResponse.json({
        success: true,
        message: "User successfully created (Sandbox mode).",
        profile: mockProfile,
        credentials: {
          userId: mockId,
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          password,
          plan: planConfig.id,
          planName: planDisplayName,
          unitLimit: effectiveUnitLimit,
          durationDays,
          billingCycle,
          startsAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      });
    }

    // 2. Production Mode: Supabase Admin Client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let userId: string;

    // Check if user already exists in auth or profiles
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, email, role")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
      // Update existing password if provided
      await adminClient.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          full_name: cleanName,
          phone: cleanPhone,
          role: "landlord",
          plan: planConfig.id,
          plan_unit_limit: effectiveUnitLimit,
        },
      });
    } else {
      // Create new Auth User
      const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          phone: cleanPhone,
          role: "landlord",
          plan: planConfig.id,
          plan_unit_limit: effectiveUnitLimit,
        },
      });

      if (createErr || !createData.user) {
        return NextResponse.json(
          { success: false, error: createErr?.message || "Failed to create authentication user." },
          { status: 500 }
        );
      }
      userId = createData.user.id;
    }

    // 3. Upsert into public.profiles
    const profilePayload = {
      id: userId,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: "landlord",
      plan: planConfig.id,
      plan_name: planDisplayName,
      billing_cycle: billingCycle,
      plan_unit_limit: effectiveUnitLimit,
      unit_limit: effectiveUnitLimit,
      plan_duration_days: durationDays,
      plan_starts_at: now.toISOString(),
      plan_expires_at: expiresAt.toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
      plan_status: "active",
      subscription_status: "active",
      has_used_free_trial: true,
      has_used_trial: true,
      updated_at: now.toISOString(),
    };

    const { error: upsertErr } = await adminClient
      .from("profiles")
      .upsert(profilePayload);

    if (upsertErr) {
      console.warn("Error upserting profile in /api/admin/users:", upsertErr);
    }

    // 4. Create certified subscription audit record
    try {
      const receiptNumber = `ADM-VIP-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      await adminClient.from("subscriptions").insert([
        {
          receipt_number: receiptNumber,
          landlord_id: userId,
          landlord_name: cleanName,
          landlord_email: cleanEmail,
          landlord_phone: cleanPhone,
          plan_id: planConfig.id,
          plan_name: planDisplayName,
          billing_cycle: billingCycle,
          amount_paid: billingCycle === "annual" ? planConfig.annualPrice || 0 : planConfig.monthlyPrice || 0,
          payment_method: "cash",
          transaction_ref: `ADM-ADMIN-PROVISIONED-${userId.slice(0, 8).toUpperCase()}`,
          duration_days: durationDays,
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: "completed",
          notes: `VIP Landlord Provisioned by Super-Admin. Unit capacity: ${effectiveUnitLimit} units.`,
          receipt_url: `subscriptions/${userId}/${receiptNumber}.png`,
          created_at: now.toISOString(),
        },
      ]);
    } catch (subErr) {
      console.warn("Could not insert subscription audit record:", subErr);
    }

    return NextResponse.json({
      success: true,
      message: "Landlord successfully created with personalized plan.",
      credentials: {
        userId,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        password,
        plan: planConfig.id,
        planName: planDisplayName,
        unitLimit: effectiveUnitLimit,
        durationDays,
        billingCycle,
        startsAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
