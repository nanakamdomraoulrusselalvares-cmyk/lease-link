import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  BillingCycle,
  LandlordProfile,
  UserRole,
  resolvePlanConfig,
} from "@/types/database";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

function getSanitizedSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim()
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/auth\/v1\/?$/, "")
    .replace(/\/+$/, "");
}

function getAdminClient() {
  const supabaseUrl = getSanitizedSupabaseUrl();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey || supabaseUrl.includes("your-project-ref")) {
    return null;
  }
  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function synthesizeProfileFromUser(
  user: SupabaseUser,
  overrides?: { phone?: string; full_name?: string }
): LandlordProfile {
  const meta = user.user_metadata || {};
  const planConfig = resolvePlanConfig(meta.plan as string | undefined);
  const createdAt = user.created_at || new Date().toISOString();
  const createdMs = new Date(createdAt).getTime() || Date.now();
  const durationDays = Number(meta.plan_duration_days || planConfig.durationDays || 30);
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

  return {
    id: user.id,
    email: user.email || "",
    full_name:
      overrides?.full_name ??
      ((meta.full_name as string) ||
        (meta.name as string) ||
        user.email?.split("@")[0] ||
        "Bailleur"),
    phone: overrides?.phone ?? ((meta.phone as string) || ""),
    role,
    landlord_id: (meta.landlord_id as string) || null,
    assigned_building_ids: Array.isArray(meta.assigned_building_ids)
      ? (meta.assigned_building_ids as string[])
      : null,
    plan: planConfig.id,
    plan_name: (meta.plan_name as string) || planConfig.name,
    billing_cycle: billingCycle,
    plan_unit_limit: unitLimit,
    unit_limit: unitLimit,
    plan_duration_days: durationDays,
    plan_starts_at: (meta.plan_starts_at as string) || createdAt,
    plan_expires_at: expiresAt,
    subscription_expires_at: expiresAt,
    plan_status: "active",
    subscription_status: "active",
    has_used_free_trial: true,
    has_used_trial: true,
    created_at: createdAt,
    updated_at: user.updated_at || new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const metaPhone = ((user.user_metadata?.phone as string) || "").trim();
    const adminClient = getAdminClient();
    let profile: LandlordProfile | null = null;

    // 1. Primary path: Service Role client (bypasses RLS completely)
    if (adminClient) {
      const { data: row, error: rowErr } = await adminClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!rowErr && row) {
        let resolvedRow = row as LandlordProfile;

        // Sync phone from Auth metadata if DB row is missing phone
        if ((!resolvedRow.phone || !resolvedRow.phone.trim()) && metaPhone) {
          const { data: synced } = await adminClient
            .from("profiles")
            .update({ phone: metaPhone, updated_at: new Date().toISOString() })
            .eq("id", user.id)
            .select("*")
            .maybeSingle();
          if (synced) {
            resolvedRow = synced as LandlordProfile;
          } else {
            resolvedRow = { ...resolvedRow, phone: metaPhone };
          }
        }

        // Merge parent landlord plan fields for delegated managers
        if (resolvedRow.role === "manager" && resolvedRow.landlord_id) {
          const { data: landlordRow } = await adminClient
            .from("profiles")
            .select(
              "plan, plan_name, plan_unit_limit, unit_limit, plan_status, subscription_status, billing_cycle, plan_expires_at"
            )
            .eq("id", resolvedRow.landlord_id)
            .maybeSingle();

          if (landlordRow) {
            resolvedRow = {
              ...resolvedRow,
              plan: landlordRow.plan || resolvedRow.plan,
              plan_name: landlordRow.plan_name || resolvedRow.plan_name,
              plan_unit_limit:
                landlordRow.plan_unit_limit ||
                landlordRow.unit_limit ||
                resolvedRow.plan_unit_limit,
              unit_limit:
                landlordRow.unit_limit ||
                landlordRow.plan_unit_limit ||
                resolvedRow.unit_limit,
              plan_status: landlordRow.plan_status || resolvedRow.plan_status,
              subscription_status:
                landlordRow.subscription_status ||
                resolvedRow.subscription_status,
              billing_cycle:
                landlordRow.billing_cycle || resolvedRow.billing_cycle,
              plan_expires_at:
                landlordRow.plan_expires_at || resolvedRow.plan_expires_at,
            };
          }
        }

        profile = resolvedRow;
      } else if (!rowErr && !row) {
        // Auto-provision missing profile row (with minimal-column fallback if DB lacks newer columns)
        const synthesized = synthesizeProfileFromUser(user);
        const { data: created, error: createErr } = await adminClient
          .from("profiles")
          .upsert({
            ...synthesized,
            trial_expires_at: synthesized.plan_expires_at,
          })
          .select("*")
          .maybeSingle();

        if (!createErr && created) {
          profile = created as LandlordProfile;
        } else {
          const { data: minCreated } = await adminClient
            .from("profiles")
            .upsert({
              id: synthesized.id,
              email: synthesized.email,
              full_name: synthesized.full_name,
              phone: synthesized.phone,
            })
            .select("*")
            .maybeSingle();
          profile = minCreated
            ? ({ ...synthesized, ...(minCreated as Partial<LandlordProfile>) } as LandlordProfile)
            : synthesized;
        }
      }
    }

    // 2. Secondary path: SECURITY DEFINER RPC `get_my_profile`
    if (!profile) {
      try {
        const { data: rpcRes, error: rpcErr } =
          await serverSupabase.rpc("get_my_profile");
        if (!rpcErr && rpcRes?.success && rpcRes?.profile) {
          const rpcProfile = rpcRes.profile as LandlordProfile;
          profile =
            (!rpcProfile.phone || !rpcProfile.phone.trim()) && metaPhone
              ? { ...rpcProfile, phone: metaPhone }
              : rpcProfile;
        }
      } catch {
        // RPC may not be deployed yet; fall through cleanly
      }
    }

    // 3. Tertiary path: Standard authenticated query
    if (!profile) {
      const { data: stdRow, error: stdErr } = await serverSupabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!stdErr && stdRow) {
        const typedRow = stdRow as LandlordProfile;
        profile =
          (!typedRow.phone || !typedRow.phone.trim()) && metaPhone
            ? { ...typedRow, phone: metaPhone }
            : typedRow;
      }
    }

    // 4. Guaranteed resilient fallback from verified Supabase Auth user metadata
    if (!profile) {
      profile = synthesizeProfileFromUser(user);
    }

    return NextResponse.json(
      { success: true, profile },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load profile";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawPhone = typeof body.phone === "string" ? body.phone.trim() : undefined;
    const rawFullName =
      typeof body.full_name === "string" ? body.full_name.trim() : undefined;

    if (rawPhone === undefined && rawFullName === undefined) {
      return NextResponse.json(
        { success: false, error: "No profile fields provided to update." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();
    const metadataUpdate: Record<string, string> = {};
    const dbUpdate: Record<string, string> = { updated_at: nowIso };

    if (rawPhone !== undefined) {
      metadataUpdate.phone = rawPhone;
      dbUpdate.phone = rawPhone;
    }
    if (rawFullName !== undefined) {
      metadataUpdate.full_name = rawFullName;
      dbUpdate.full_name = rawFullName;
    }

    // 1. Always persist into Supabase Auth user_metadata (RLS-independent)
    try {
      await serverSupabase.auth.updateUser({
        data: metadataUpdate,
      });
    } catch {
      // Non-fatal; adminClient fallback below also updates metadata if available
    }

    const adminClient = getAdminClient();
    let updatedProfile: LandlordProfile | null = null;
    let persistedToDb = false;

    // 2. Primary DB update: Service Role client (bypasses RLS completely)
    if (adminClient) {
      try {
        await adminClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...(user.user_metadata || {}),
            ...metadataUpdate,
          },
        });
      } catch {
        // Ignore if already updated via serverSupabase
      }

      const { data: updatedRow, error: updateErr } = await adminClient
        .from("profiles")
        .update(dbUpdate)
        .eq("id", user.id)
        .select("*")
        .maybeSingle();

      if (!updateErr && updatedRow) {
        updatedProfile = updatedRow as LandlordProfile;
        persistedToDb = true;
      } else if (!updateErr && !updatedRow) {
        const synthesized = synthesizeProfileFromUser(user, {
          phone: rawPhone,
          full_name: rawFullName,
        });
        const { data: insertedRow, error: insertErr } = await adminClient
          .from("profiles")
          .upsert({
            ...synthesized,
            trial_expires_at: synthesized.plan_expires_at,
          })
          .select("*")
          .maybeSingle();

        if (!insertErr && insertedRow) {
          updatedProfile = insertedRow as LandlordProfile;
          persistedToDb = true;
        } else {
          const { data: minInserted, error: minErr } = await adminClient
            .from("profiles")
            .upsert({
              id: synthesized.id,
              email: synthesized.email,
              full_name: synthesized.full_name,
              phone: synthesized.phone,
            })
            .select("*")
            .maybeSingle();
          if (!minErr && minInserted) {
            updatedProfile = {
              ...synthesized,
              ...(minInserted as Partial<LandlordProfile>),
            } as LandlordProfile;
            persistedToDb = true;
          }
        }
      }
    }

    // 3. Secondary DB update: SECURITY DEFINER RPC `update_my_profile_phone`
    if (!persistedToDb && rawPhone !== undefined) {
      try {
        const { data: rpcRes, error: rpcErr } = await serverSupabase.rpc(
          "update_my_profile_phone",
          { p_phone: rawPhone }
        );
        if (!rpcErr && rpcRes?.success && rpcRes?.profile) {
          updatedProfile = rpcRes.profile as LandlordProfile;
          persistedToDb = true;
        }
      } catch {
        // RPC may not be deployed yet
      }
    }

    // 4. Tertiary DB update: Standard authenticated table update
    if (!persistedToDb) {
      const { data: stdUpdated, error: stdErr } = await serverSupabase
        .from("profiles")
        .update(dbUpdate)
        .eq("id", user.id)
        .select("*")
        .maybeSingle();

      if (!stdErr && stdUpdated) {
        updatedProfile = stdUpdated as LandlordProfile;
        persistedToDb = true;
      }
    }

    // 5. Fallback profile synthesized with updated fields (already saved in Auth user_metadata)
    if (!updatedProfile) {
      updatedProfile = synthesizeProfileFromUser(user, {
        phone: rawPhone,
        full_name: rawFullName,
      });
    }

    return NextResponse.json(
      {
        success: true,
        profile: updatedProfile,
        persistedToDb,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

