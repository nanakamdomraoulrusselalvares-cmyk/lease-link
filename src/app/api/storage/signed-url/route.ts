import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  TENANT_COOKIE_NAME,
  verifySessionPayload,
} from "@/lib/auth/tenantSession";

const ALLOWED_BUCKETS = ["receipts", "maintenance-media"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

const MAX_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days max
const DEFAULT_EXPIRES_IN = 60 * 60 * 2; // 2 hours default

/**
 * POST /api/storage/signed-url
 * Generates an HMAC-signed temporary access URL for private storage objects.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bucket, path, expiresIn } = body;

    if (!bucket || typeof bucket !== "string" || !ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
      return NextResponse.json(
        { success: false, error: "Invalid storage bucket specified." },
        { status: 400 }
      );
    }

    if (!path || typeof path !== "string") {
      return NextResponse.json(
        { success: false, error: "Object path is required." },
        { status: 400 }
      );
    }

    // Path traversal defense
    const cleanPath = path.trim().replace(/^\/+/, "");
    if (cleanPath.includes("..") || cleanPath.includes("\0")) {
      return NextResponse.json(
        { success: false, error: "Invalid path traversal sequence." },
        { status: 400 }
      );
    }

    const safeExpiresIn = Math.min(
      MAX_EXPIRES_IN,
      Math.max(60, Number(expiresIn) || DEFAULT_EXPIRES_IN)
    );

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    const isMock = !supabaseUrl || supabaseUrl.includes("your-project-ref") || !supabaseServiceKey;

    // 1. Check Authenticated Supabase User (Landlord, Manager, Super-Admin)
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isAuthorized = false;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, landlord_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "admin") {
        isAuthorized = true;
      } else if (profile?.role === "landlord") {
        // Landlords can access maintenance media or their own receipts
        if (bucket === "maintenance-media") {
          isAuthorized = true;
        } else if (bucket === "receipts") {
          const segments = cleanPath.split("/");
          // Allow if landlord ID is present in path or root match
          if (cleanPath.includes(user.id) || segments[1] === user.id) {
            isAuthorized = true;
          }
        }
      } else if (profile?.role === "manager") {
        const parentLandlordId = profile.landlord_id;
        if (bucket === "maintenance-media") {
          isAuthorized = true;
        } else if (bucket === "receipts" && parentLandlordId) {
          if (cleanPath.includes(parentLandlordId)) {
            isAuthorized = true;
          }
        }
      }
    }

    // 2. If not authenticated as Dashboard user, check Tenant Session Cookie
    if (!isAuthorized) {
      const cookieStore = await cookies();
      const tenantCookie = cookieStore.get(TENANT_COOKIE_NAME);

      if (tenantCookie?.value) {
        const session = verifySessionPayload(tenantCookie.value);
        if (session.valid && session.token) {
          // If accessing maintenance-media: tenants can view repair attachments
          if (bucket === "maintenance-media") {
            isAuthorized = true;
          } else if (bucket === "receipts") {
            // Verify token matches landlord or rent receipt
            const { data: rpcRes } = await supabase.rpc("get_tenant_portal_data", {
              p_token: session.token,
            });

            if (rpcRes?.success && rpcRes?.data) {
              const landlordId = rpcRes.data.landlord_id;
              if (cleanPath.startsWith(`rent/${landlordId}/`) || cleanPath.includes(landlordId)) {
                isAuthorized = true;
              }
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Access denied. You do not have permission to view this protected document." },
        { status: 403 }
      );
    }

    // 3. Fallback for Mock / Offline Dev Environment
    if (isMock) {
      return NextResponse.json({
        success: true,
        signedUrl: `/storage/mock/${bucket}/${cleanPath}`,
        expiresIn: safeExpiresIn,
        isMock: true,
      });
    }

    // 4. Generate Cryptographically Signed URL via Supabase Storage
    const adminClient = createAdminClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signedData, error: signErr } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(cleanPath, safeExpiresIn);

    if (signErr || !signedData?.signedUrl) {
      return NextResponse.json(
        { success: false, error: signErr?.message || "Failed to generate signed URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: signedData.signedUrl,
      expiresIn: safeExpiresIn,
      isMock: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error generating signed URL";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
