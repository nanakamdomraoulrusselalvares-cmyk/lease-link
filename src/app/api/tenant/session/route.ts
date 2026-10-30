import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/client";
import {
  TENANT_COOKIE_NAME as COOKIE_NAME,
  TENANT_COOKIE_MAX_AGE as COOKIE_MAX_AGE,
  signSessionPayload,
  verifySessionPayload,
} from "@/lib/auth/tenantSession";


/**
 * POST /api/tenant/session
 * Establishes a secure HttpOnly session cookie for the authenticated tenant
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Access token is required" },
        { status: 400 }
      );
    }

    let portalData = body.portalData;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const isMock = !supabaseUrl || supabaseUrl.includes("your-project-ref");

    if (!isMock) {
      // Cross-verify token validity against Supabase security definer procedure
      const supabase = createClient();
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("get_tenant_portal_data", {
        p_token: token,
      });

      if (rpcErr || !rpcRes?.success || !rpcRes?.data) {
        return NextResponse.json(
          { success: false, error: rpcRes?.error || "Invalid access token" },
          { status: 401 }
        );
      }
      portalData = rpcRes.data;
    }

    const unitId = portalData?.unit_id || "unit";
    const signedCookieValue = signSessionPayload(token, unitId);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, signedCookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return NextResponse.json({
      success: true,
      data: portalData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error establishing tenant session";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * GET /api/tenant/session
 * Retrieves and validates the active session from the HttpOnly cookie
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);

    if (!cookie?.value) {
      return NextResponse.json({ authenticated: false, session: null }, { status: 200 });
    }

    const verification = verifySessionPayload(cookie.value);
    if (!verification.valid || !verification.token) {
      // Clear invalid / tampered cookie
      cookieStore.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
      return NextResponse.json({ authenticated: false, session: null }, { status: 200 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const isMock = !supabaseUrl || supabaseUrl.includes("your-project-ref");

    if (isMock) {
      return NextResponse.json({
        authenticated: true,
        session: {
          token: verification.token,
          portalData: null,
          authenticatedAt: new Date().toISOString(),
        },
      });
    }

    // Always fetch fresh tenant data using the verified token
    const supabase = createClient();
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("get_tenant_portal_data", {
      p_token: verification.token,
    });

    let portalData = rpcRes.data;

    // Check landlord's active plan expiration
    if (portalData?.landlord_id) {
      try {
        const { data: landlordProfile } = await supabase
          .from("profiles")
          .select("plan_status, plan_expires_at, subscription_status, subscription_expires_at")
          .eq("id", portalData.landlord_id)
          .maybeSingle();

        if (landlordProfile) {
          const expTime = landlordProfile.plan_expires_at
            ? new Date(landlordProfile.plan_expires_at).getTime()
            : null;
          const isExp = Boolean(
            (expTime && expTime < Date.now()) ||
            landlordProfile.plan_status === "expired" ||
            landlordProfile.subscription_status === "expired"
          );
          portalData.is_landlord_plan_expired = isExp;
          portalData.landlord_plan_expires_at = landlordProfile.plan_expires_at;
          portalData.landlord_plan_status = landlordProfile.plan_status;
        }
      } catch (_) {}
    }

    return NextResponse.json({
      authenticated: true,
      session: {
        token: verification.token,
        portalData,
        authenticatedAt: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error verifying tenant session";
    return NextResponse.json({ authenticated: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/tenant/session
 * Destroys the HttpOnly tenant session cookie (logout)
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error clearing tenant session";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
