import { createClient } from "@/lib/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  BillingCycle,
  LandlordProfile,
  UserRole,
  resolvePlanConfig,
} from "@/types/database";

export function buildFallbackProfileFromUser(
  user: SupabaseUser
): LandlordProfile {
  const meta = user.user_metadata || {};
  const planConfig = resolvePlanConfig(meta.plan as string | undefined);
  const createdAt = user.created_at || new Date().toISOString();
  const createdMs = new Date(createdAt).getTime() || Date.now();
  const durationDays = Number(
    meta.plan_duration_days || planConfig.durationDays || 30
  );
  const defaultExpiresAt = new Date(
    createdMs + durationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const unitLimit = Number(
    meta.plan_unit_limit || meta.unit_limit || planConfig.maxUnits
  );
  const expiresAt = (meta.plan_expires_at as string) || defaultExpiresAt;
  const role: UserRole =
    meta.role === "admin" || meta.role === "manager" || meta.role === "landlord"
      ? meta.role
      : "landlord";
  const billingCycle: BillingCycle =
    meta.billing_cycle === "annual" ? "annual" : "monthly";

  let cachedProfile: Partial<LandlordProfile> | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("leaselink_cached_dashboard");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.profile?.id === user.id) {
          cachedProfile = parsed.profile;
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const metaPhone = ((meta.phone as string) || "").trim();

  return {
    id: user.id,
    email: user.email || cachedProfile?.email || "",
    full_name:
      cachedProfile?.full_name ||
      (meta.full_name as string) ||
      (meta.name as string) ||
      user.email?.split("@")[0] ||
      "Bailleur",
    phone: cachedProfile?.phone || metaPhone || "",
    role: cachedProfile?.role || role,
    landlord_id:
      cachedProfile?.landlord_id ?? ((meta.landlord_id as string) || null),
    assigned_building_ids:
      cachedProfile?.assigned_building_ids ??
      (Array.isArray(meta.assigned_building_ids)
        ? (meta.assigned_building_ids as string[])
        : null),
    plan: cachedProfile?.plan || planConfig.id,
    plan_name:
      cachedProfile?.plan_name || (meta.plan_name as string) || planConfig.name,
    billing_cycle: cachedProfile?.billing_cycle || billingCycle,
    plan_unit_limit: cachedProfile?.plan_unit_limit || unitLimit,
    unit_limit: cachedProfile?.unit_limit || unitLimit,
    plan_duration_days: cachedProfile?.plan_duration_days || durationDays,
    plan_starts_at:
      cachedProfile?.plan_starts_at ||
      (meta.plan_starts_at as string) ||
      createdAt,
    plan_expires_at: cachedProfile?.plan_expires_at || expiresAt,
    subscription_expires_at:
      cachedProfile?.subscription_expires_at || expiresAt,
    plan_status: cachedProfile?.plan_status || "active",
    subscription_status: cachedProfile?.subscription_status || "active",
    has_used_free_trial: cachedProfile?.has_used_free_trial ?? true,
    has_used_trial: cachedProfile?.has_used_trial ?? true,
    created_at: cachedProfile?.created_at || createdAt,
    updated_at:
      cachedProfile?.updated_at || user.updated_at || new Date().toISOString(),
  };
}

/**
 * Fetches the authenticated user's LandlordProfile safely via `/api/profile`
 * (which bypasses RLS recursion via Service Role / SECURITY DEFINER RPC)
 * and falls back gracefully to cached / Auth metadata profile when offline.
 */
export async function fetchCurrentProfileSafe(
  authUser: SupabaseUser
): Promise<LandlordProfile> {
  const fallback = buildFallbackProfileFromUser(authUser);
  const metaPhone = ((authUser.user_metadata?.phone as string) || "").trim();

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return fallback;
  }

  try {
    const res = await fetch("/api/profile", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      if (json?.success && json?.profile) {
        const fetched = json.profile as LandlordProfile;
        if ((!fetched.phone || !fetched.phone.trim()) && metaPhone) {
          return { ...fetched, phone: metaPhone };
        }
        return fetched;
      }
    }
  } catch {
    // Network offline or transient fetch failure -> return offline fallback
  }

  return fallback;
}

/**
 * Saves the authenticated user's telephone number cleanly across:
 * 1. Supabase Auth `user_metadata` (persists in local session token immediately)
 * 2. Server-side `PATCH /api/profile` (updates `public.profiles` bypassing RLS recursion)
 */
export async function updateCurrentProfilePhoneSafe(
  phone: string
): Promise<LandlordProfile | null> {
  const cleanPhone = phone.trim();
  const supabase = createClient();

  let authSucceeded = false;
  let apiSucceeded = false;
  let updatedProfile: LandlordProfile | null = null;
  let lastError = "";

  // 1. Update client-side Supabase Auth user metadata so local JWT/session has phone immediately
  try {
    const { error: authErr } = await supabase.auth.updateUser({
      data: { phone: cleanPhone },
    });
    if (!authErr) {
      authSucceeded = true;
    } else {
      lastError = authErr.message;
    }
  } catch (err: unknown) {
    lastError = err instanceof Error ? err.message : "Auth update failed";
  }

  // 2. Persist to `public.profiles` via server endpoint (Service Role / SECURITY DEFINER RPC)
  try {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone: cleanPhone }),
    });

    const json = await res.json().catch(() => null);
    if (res.ok && json?.success) {
      apiSucceeded = true;
      updatedProfile = (json.profile as LandlordProfile) || null;
    } else if (json?.error) {
      lastError = json.error;
    }
  } catch (err: unknown) {
    if (!lastError) {
      lastError = err instanceof Error ? err.message : "Profile update failed";
    }
  }

  if (!authSucceeded && !apiSucceeded) {
    throw new Error(lastError || "Could not save phone number.");
  }

  return updatedProfile;
}

