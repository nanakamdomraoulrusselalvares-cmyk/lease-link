import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { resolvePlanConfig } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Read mode ('login' | 'signup') from query params or short-lived cookie
  const cookieStore = await cookies();
  const flowCookie = cookieStore.get("sb_oauth_flow")?.value;
  const mode = (searchParams.get("mode") || flowCookie || "").toLowerCase();

  // Helper to determine destination URL
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const getDestination = (path: string) => {
    if (isLocalEnv || !forwardedHost) {
      return `${origin}${path}`;
    }
    return `https://${forwardedHost}${path}`;
  };

  if (error) {
    console.error("Auth callback error:", error, errorDescription);
    const redirectRes = NextResponse.redirect(
      getDestination(`/login?error=${encodeURIComponent(errorDescription || error)}`)
    );
    redirectRes.cookies.delete("sb_oauth_flow");
    return redirectRes;
  }

  if (code) {
    const supabase = await createClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.user) {
      const userEmail = (data.user.email || "").trim().toLowerCase();
      const userId = data.user.id;

      // Admin client for bypass-RLS account check if service key is present
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      let adminClient: any = null;
      if (serviceKey && supabaseUrl && !supabaseUrl.includes("your-project-ref")) {
        adminClient = createAdminClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
      }

      const db = adminClient || supabase;

      // -------------------------------------------------------------------------
      // Step A: Check existing profile in database
      // -------------------------------------------------------------------------
      let matchedProfile: any = null;
      try {
        const { data: profileById } = await db
          .from("profiles")
          .select("id, role, email, full_name, plan, plan_status, created_at")
          .eq("id", userId)
          .maybeSingle();

        if (profileById) {
          matchedProfile = profileById;
        } else if (userEmail) {
          const { data: profileByEmail } = await db
            .from("profiles")
            .select("id, role, email, full_name, plan, plan_status, created_at")
            .ilike("email", userEmail)
            .maybeSingle();

          if (profileByEmail) {
            matchedProfile = profileByEmail;
          }
        }
      } catch (checkErr) {
        console.warn("Could not check existing profile in auth callback:", checkErr);
      }

      // -------------------------------------------------------------------------
      // Step B: Determine if this account existed BEFORE this OAuth exchange
      // Note: When a new user logs in via Google, Supabase creates auth.users at T0,
      // and the on_auth_user_created DB trigger immediately inserts a profile row.
      // Therefore, if BOTH records are under 45 seconds old, this is a BRAND NEW user.
      // If either record was created earlier (> 45s), this is a PRE-EXISTING user.
      // -------------------------------------------------------------------------
      const now = Date.now();
      const authUserCreatedAt = data.user.created_at ? new Date(data.user.created_at).getTime() : now;
      const authUserAgeMs = now - authUserCreatedAt;

      const profileCreatedAt = matchedProfile?.created_at ? new Date(matchedProfile.created_at).getTime() : now;
      const profileAgeMs = now - profileCreatedAt;

      const isBrandNewAccount = authUserAgeMs < 45000 && (!matchedProfile || profileAgeMs < 45000);
      const isPreExistingAccount = !isBrandNewAccount;

      console.log(`[OAuth Flow] Mode: '${mode}', User: ${userEmail}, IsNew: ${isBrandNewAccount}, AuthAge: ${authUserAgeMs}ms, ProfileAge: ${profileAgeMs}ms`);

      // =========================================================================
      // CASE 1: Mode is 'login' -> REJECT IF NO ACCOUNT EXISTED PREVIOUSLY
      // =========================================================================
      if (mode === "login") {
        if (isBrandNewAccount) {
          console.warn(`[OAuth Login Blocked] Brand-new user attempted login without registration: ${userEmail}`);

          // 1. Sign out immediately from local session
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});

          // 2. Clean up trigger-created profile & orphan auth user
          if (adminClient && userId) {
            try {
              await adminClient.from("profiles").delete().eq("id", userId);
              await adminClient.auth.admin.deleteUser(userId);
            } catch (delErr) {
              console.warn("Could not clean up unlinked OAuth user:", delErr);
            }
          }

          // 3. Clear auth cookies and redirect to /login with no_account banner
          const redirectRes = NextResponse.redirect(
            getDestination(`/login?error=no_account&email=${encodeURIComponent(userEmail)}`)
          );
          redirectRes.cookies.delete("sb_oauth_flow");
          const allCookies = cookieStore.getAll();
          for (const c of allCookies) {
            if (c.name.startsWith("sb-") || c.name.includes("auth-token") || c.name.includes("supabase")) {
              redirectRes.cookies.set(c.name, "", { maxAge: 0, path: "/" });
            }
          }
          return redirectRes;
        }

        // Account exists! If profile ID differs from auth user ID, sync email
        if (matchedProfile && matchedProfile.id !== userId && adminClient) {
          try {
            await adminClient
              .from("profiles")
              .update({ id: userId, updated_at: new Date().toISOString() })
              .eq("email", userEmail);
          } catch (syncErr) {
            console.warn("Could not sync profile id with auth id:", syncErr);
          }
        }

        // Route tenants to tenant dashboard, landlords to dashboard or next
        let destination = next;
        if (matchedProfile?.role === "tenant" && (!next || next === "/dashboard")) {
          destination = "/tenant/dashboard";
        }

        const redirectRes = NextResponse.redirect(getDestination(destination));
        redirectRes.cookies.delete("sb_oauth_flow");
        return redirectRes;
      }

      // =========================================================================
      // CASE 2: Mode is 'signup' -> REJECT IF ACCOUNT ALREADY EXISTS
      // =========================================================================
      if (mode === "signup") {
        if (isPreExistingAccount) {
          console.warn(`[OAuth Signup Blocked] Pre-existing account attempted signup: ${userEmail}`);

          // Sign out immediately so we don't leave partial session
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});

          // Redirect to login page informing user their account already exists
          const redirectRes = NextResponse.redirect(
            getDestination(`/login?error=account_exists&email=${encodeURIComponent(userEmail)}`)
          );
          redirectRes.cookies.delete("sb_oauth_flow");
          const allCookies = cookieStore.getAll();
          for (const c of allCookies) {
            if (c.name.startsWith("sb-") || c.name.includes("auth-token") || c.name.includes("supabase")) {
              redirectRes.cookies.set(c.name, "", { maxAge: 0, path: "/" });
            }
          }
          return redirectRes;
        }

        // New landlord signup: initialize plan profile
        try {
          const userMeta = data.user.user_metadata || {};
          const fullName =
            userMeta.full_name || userMeta.name || userEmail.split("@")[0] || "Bailleur";
          const planConfig = resolvePlanConfig(userMeta.plan);
          const trialExpires = new Date();
          trialExpires.setDate(trialExpires.getDate() + (planConfig.durationDays || 30));

          await db.from("profiles").upsert({
            id: userId,
            email: userEmail,
            full_name: fullName,
            phone: userMeta.phone || "",
            role: "landlord",
            plan: planConfig.id,
            plan_name: planConfig.name,
            plan_unit_limit: planConfig.maxUnits,
            unit_limit: planConfig.maxUnits,
            plan_duration_days: planConfig.durationDays || 30,
            plan_status: "active",
            subscription_status: "active",
            has_used_free_trial: true,
            has_used_trial: true,
            plan_starts_at: new Date().toISOString(),
            plan_expires_at: trialExpires.toISOString(),
            trial_expires_at: trialExpires.toISOString(),
            subscription_expires_at: trialExpires.toISOString(),
            billing_cycle: userMeta.billing_cycle || "monthly",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          console.warn("Could not create landlord profile in auth callback:", profileErr);
        }

        const redirectRes = NextResponse.redirect(getDestination(`${next}?welcome=new_landlord`));
        redirectRes.cookies.delete("sb_oauth_flow");
        return redirectRes;
      }

      // =========================================================================
      // FALLBACK: Mode unspecified -> Route gracefully
      // =========================================================================
      if (isBrandNewAccount) {
        try {
          const userMeta = data.user.user_metadata || {};
          const fullName =
            userMeta.full_name || userMeta.name || userEmail.split("@")[0] || "Bailleur";
          const planConfig = resolvePlanConfig(userMeta.plan);
          const trialExpires = new Date();
          trialExpires.setDate(trialExpires.getDate() + (planConfig.durationDays || 30));

          await db.from("profiles").upsert({
            id: userId,
            email: userEmail,
            full_name: fullName,
            phone: userMeta.phone || "",
            role: "landlord",
            plan: planConfig.id,
            plan_name: planConfig.name,
            plan_unit_limit: planConfig.maxUnits,
            unit_limit: planConfig.maxUnits,
            plan_duration_days: planConfig.durationDays || 30,
            plan_status: "active",
            subscription_status: "active",
            has_used_free_trial: true,
            has_used_trial: true,
            plan_starts_at: new Date().toISOString(),
            plan_expires_at: trialExpires.toISOString(),
            trial_expires_at: trialExpires.toISOString(),
            subscription_expires_at: trialExpires.toISOString(),
            billing_cycle: userMeta.billing_cycle || "monthly",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch (fallbackErr) {
          console.warn("Fallback profile creation warning:", fallbackErr);
        }
      }

      let destination = next;
      if (matchedProfile?.role === "tenant" && (!next || next === "/dashboard")) {
        destination = "/tenant/dashboard";
      }

      const redirectRes = NextResponse.redirect(getDestination(destination));
      redirectRes.cookies.delete("sb_oauth_flow");
      return redirectRes;
    } else if (exchangeError) {
      console.error("Failed to exchange auth code for session:", exchangeError.message);
      const redirectRes = NextResponse.redirect(
        getDestination(`/login?error=${encodeURIComponent(exchangeError.message)}`)
      );
      redirectRes.cookies.delete("sb_oauth_flow");
      return redirectRes;
    }
  }

  // Return the user to login if no code was provided
  const redirectRes = NextResponse.redirect(getDestination("/login"));
  redirectRes.cookies.delete("sb_oauth_flow");
  return redirectRes;
}
