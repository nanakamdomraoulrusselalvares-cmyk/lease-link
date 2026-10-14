import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { landlordId, fullName, email, phone, password, assignedBuildingIds } = body;

    if (!landlordId || !fullName || !email || !phone) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: landlordId, fullName, email, and phone" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || supabaseUrl.includes("your-project-ref")) {
      const now = new Date().toISOString();
      const mockManager = {
        id: "mng_" + Math.random().toString(36).substring(2, 11),
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        role: "manager",
        landlord_id: landlordId,
        assigned_building_ids: assignedBuildingIds || null,
        created_at: now,
        updated_at: now,
      };
      return NextResponse.json({ success: true, manager: mockManager });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let effectiveUserId: string = "";

    // If service role is available, use auth.admin.createUser
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: password || "Mng#12345",
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          role: "manager",
          landlord_id: landlordId,
        },
      });

      if (createError) {
        return NextResponse.json({ success: false, error: createError.message }, { status: 400 });
      }
      effectiveUserId = userData.user.id;
    } else {
      // Fallback with isolated anon signup
      const { data: signUpData, error: signError } = await adminClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password || "Mng#12345",
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: "manager",
            landlord_id: landlordId,
          },
        },
      });

      if (signError && !signError.message.includes("already registered")) {
        return NextResponse.json({ success: false, error: signError.message }, { status: 400 });
      }
      effectiveUserId = signUpData?.user?.id || ("mng_" + Math.random().toString(36).substring(2, 11));
    }

    const now = new Date().toISOString();
    const managerRecord = {
      id: effectiveUserId,
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      role: "manager",
      landlord_id: landlordId,
      plan: "free",
      plan_name: "Manager Access",
      plan_status: "active",
      assigned_building_ids: assignedBuildingIds || null,
      updated_at: now,
      created_at: now,
    };

    const { data: profileRow } = await adminClient
      .from("profiles")
      .upsert(managerRecord, { onConflict: "id" })
      .select()
      .maybeSingle();

    return NextResponse.json({
      success: true,
      manager: profileRow || managerRecord,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
