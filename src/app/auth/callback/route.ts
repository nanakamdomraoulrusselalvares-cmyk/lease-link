import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error("Auth callback error:", error, errorDescription);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.user) {
      // Ensure the user's landlord profile exists in public.profiles
      try {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!existingProfile) {
          const userMeta = data.user.user_metadata || {};
          const fullName = userMeta.full_name || userMeta.name || data.user.email?.split("@")[0] || "Bailleur";
          const trialExpires = new Date();
          trialExpires.setDate(trialExpires.getDate() + 30);

          await supabase.from("profiles").upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            phone: userMeta.phone || "",
            role: "landlord",
            plan: "free_trial",
            plan_name: "Essai Gratuit 30 Jours",
            unit_limit: 5,
            subscription_status: "active",
            has_used_trial: true,
            trial_expires_at: trialExpires.toISOString(),
            subscription_expires_at: trialExpires.toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } catch (profileErr) {
        console.warn("Could not ensure profile in auth callback:", profileErr);
      }

      // Successful exchange, redirect user to dashboard
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else if (exchangeError) {
      console.error("Failed to exchange auth code for session:", exchangeError.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`);
    }
  }

  // Return the user to login if no code was provided
  return NextResponse.redirect(`${origin}/login`);
}
