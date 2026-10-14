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

    const cleanEmail = email.trim().toLowerCase();

    // Enforce strict email uniqueness across the entire platform
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, email, role")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cette adresse e-mail est déjà utilisée par un autre compte sur LeaseLink. Un utilisateur ne peut s'inscrire qu'une seule fois avec la même adresse e-mail.",
        },
        { status: 400 }
      );
    }

    let effectiveUserId: string = "";

    // If service role is available, use auth.admin.createUser
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
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
        const msg = createError.message.toLowerCase();
        const userMsg =
          msg.includes("already registered") || msg.includes("already in use") || msg.includes("user already")
            ? "Cette adresse e-mail est déjà enregistrée sur la plateforme."
            : createError.message;
        return NextResponse.json({ success: false, error: userMsg }, { status: 400 });
      }
      effectiveUserId = userData.user.id;
    } else {
      // Fallback with isolated anon signup
      const { data: signUpData, error: signError } = await adminClient.auth.signUp({
        email: cleanEmail,
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

      if (signError) {
        const msg = signError.message.toLowerCase();
        const userMsg =
          msg.includes("already registered") || msg.includes("already in use") || msg.includes("user already")
            ? "Cette adresse e-mail est déjà enregistrée sur la plateforme."
            : signError.message;
        return NextResponse.json({ success: false, error: userMsg }, { status: 400 });
      }

      if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Cette adresse e-mail est déjà enregistrée sur la plateforme.",
          },
          { status: 400 }
        );
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
