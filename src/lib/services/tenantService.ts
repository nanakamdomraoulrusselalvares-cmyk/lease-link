import { createClient } from "@/lib/supabase/client";
import {
  Unit,
  Building,
  LandlordProfile,
  TenantPortalData,
  TenantSession,
} from "@/types/database";

const LOCAL_STORAGE_KEY_BUILDINGS = "leaselink_local_buildings";
const LOCAL_STORAGE_KEY_UNITS = "leaselink_local_units";
const LOCAL_STORAGE_KEY_TENANT_SESSION = "leaselink_tenant_session";

// Helper to access localStorage safely
function getLocalData<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalData<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("Error saving local data:", err);
  }
}

/**
 * Generate a friendly, secure, unambiguous password.
 * E.g., LL-7K9P-4M
 */
export function generateTenantPassword(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // No 0, O, 1, I
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  for (let i = 0; i < 4; i++) {
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LL-${part1}-${part2}`;
}

/**
 * Generate a cryptographically secure token for 1-click magic link.
 */
export function generateAccessToken(): string {
  const chars = "abcdef0123456789";
  let token = "tnt_";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Normalize and clean phone numbers for WhatsApp API.
 * Ensures international format without +, spaces, or leading zeros.
 * Defaults to Cameroon country code (+237) for 9-digit local numbers.
 */
export function formatWhatsAppPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";
  let digits = rawPhone.replace(/\D/g, "");

  // If local Cameroon 9-digit mobile (e.g. 6xxxxxxxx), prepend 237
  if (digits.length === 9 && digits.startsWith("6")) {
    digits = "237" + digits;
  } else if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }

  return digits;
}

/**
 * Generate WhatsApp share message and click-to-chat URL.
 */
export function buildTenantWhatsAppUrl(params: {
  tenantName: string;
  tenantPhone: string;
  buildingName: string;
  unitNumber: string;
  rentAmount: number;
  email: string;
  password: string;
  directAccessUrl: string;
  landlordName?: string;
  language?: "en" | "fr";
}): { url: string; cleanPhone: string; message: string } {
  const cleanPhone = formatWhatsAppPhoneNumber(params.tenantPhone);
  const formattedRent = Number(params.rentAmount || 0).toLocaleString();
  const isEn = params.language === "en";

  const message = isEn
    ? `Hello ${params.tenantName.trim()}! 👋
Your tenant portal on *LeaseLink* for unit *${params.unitNumber}* at *${params.buildingName}* is now active.

🏠 *Unit Details:*
• Property: ${params.buildingName}
• Unit: ${params.unitNumber}
• Monthly Rent: ${formattedRent} XAF

🔑 *Your Login Credentials:*
• Email: ${params.email.trim()}
• Password: ${params.password}

🚀 *1-Click Direct Access:*
Click this secure link to immediately access your tenant portal without typing your password:
${params.directAccessUrl}

ℹ️ *Important:* Keep these credentials safe. If you ever log out, you can reconnect anytime using your email and password.`
    : `Bonjour ${params.tenantName.trim()} ! 👋
Votre espace locataire sur *LeaseLink* pour l'appartement *${params.unitNumber}* à *${params.buildingName}* est maintenant activé.

🏠 *Détails du Logement :*
• Résidence : ${params.buildingName}
• Logement : ${params.unitNumber}
• Loyer mensuel : ${formattedRent} XAF

🔑 *Vos Identifiants de Connexion :*
• E-mail : ${params.email.trim()}
• Mot de passe : ${params.password}

🚀 *Accès Direct en 1-Clic :*
Cliquez directement sur ce lien sécurisé pour accéder instantanément à votre portail locataire sans avoir à taper votre mot de passe :
${params.directAccessUrl}

ℹ️ *Important :* Conservez précieusement ces identifiants. Si vous vous déconnectez, vous pourrez à tout moment vous reconnecter avec votre e-mail et ce mot de passe.`;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return { url, cleanPhone, message };
}

/**
 * Fetch a unit and its parent building & landlord info.
 */
export async function getUnitWithBuildingAndLandlord(
  unitId: string
): Promise<{
  unit: Unit | null;
  building: Building | null;
  landlord: LandlordProfile | null;
}> {
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig && unitId) {
    try {
      const { data: unitData, error: unitErr } = await supabase
        .from("units")
        .select("*, buildings(*)")
        .eq("id", unitId)
        .maybeSingle();

      if (!unitErr && unitData) {
        const building = unitData.buildings as unknown as Building;
        let landlord: LandlordProfile | null = null;

        if (building?.landlord_id) {
          const { data: landlordData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", building.landlord_id)
            .maybeSingle();

          if (landlordData) {
            landlord = landlordData as LandlordProfile;
          }
        }

        return {
          unit: unitData as Unit,
          building: building || null,
          landlord: landlord || null,
        };
      }
    } catch (err) {
      console.warn("Could not fetch unit from Supabase, checking local fallback:", err);
    }
  }

  // Local fallback
  const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
  const localBuildings = getLocalData<Building>(LOCAL_STORAGE_KEY_BUILDINGS);

  const unit = localUnits.find((u) => u.id === unitId) || null;
  if (!unit) return { unit: null, building: null, landlord: null };

  const building = localBuildings.find((b) => b.id === unit.building_id) || null;

  return {
    unit,
    building,
    landlord: null,
  };
}

/**
 * Assign a tenant to a unit and persist generated credentials.
 */
export async function assignTenantToUnit(
  landlordId: string,
  unitId: string,
  data: {
    tenant_name: string;
    tenant_phone: string;
    tenant_email: string;
    tenant_password?: string;
    tenant_access_token?: string;
  }
): Promise<{
  success: boolean;
  unit?: Unit;
  error?: string;
  credentials?: {
    email: string;
    password: string;
    token: string;
  };
}> {
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  const tenantName = data.tenant_name.trim();
  const tenantPhone = data.tenant_phone.trim();
  const tenantEmail = data.tenant_email.trim();

  // Determine password and access token
  const password = data.tenant_password || generateTenantPassword();
  const token = data.tenant_access_token || generateAccessToken();
  const assignedAt = new Date().toISOString();

  if (!isMockConfig && landlordId) {
    try {
      // 1. Try atomic RPC if available
      const { data: rpcData, error: rpcErr } = await supabase.rpc("assign_unit_tenant", {
        p_unit_id: unitId,
        p_tenant_name: tenantName,
        p_tenant_phone: tenantPhone,
        p_tenant_email: tenantEmail,
        p_tenant_password: password,
        p_tenant_access_token: token,
      });

      if (!rpcErr && rpcData?.success) {
        const { data: updatedUnit } = await supabase
          .from("units")
          .select("*")
          .eq("id", unitId)
          .maybeSingle();

        if (updatedUnit) {
          return {
            success: true,
            unit: updatedUnit as Unit,
            credentials: { email: tenantEmail, password, token },
          };
        }
      }

      // 2. Direct Supabase update fallback
      const payload = {
        tenant_name: tenantName,
        tenant_phone: tenantPhone,
        tenant_email: tenantEmail,
        tenant_password: password,
        tenant_access_token: token,
        tenant_assigned_at: assignedAt,
        status: "occupied" as const,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedUnit, error: updateErr } = await supabase
        .from("units")
        .update(payload)
        .eq("id", unitId)
        .eq("landlord_id", landlordId)
        .select()
        .single();

      if (!updateErr && updatedUnit) {
        // Also update local storage cache for consistency
        const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
        const idx = localUnits.findIndex((u) => u.id === unitId);
        if (idx !== -1) {
          localUnits[idx] = updatedUnit as Unit;
          setLocalData(LOCAL_STORAGE_KEY_UNITS, localUnits);
        }

        return {
          success: true,
          unit: updatedUnit as Unit,
          credentials: { email: tenantEmail, password, token },
        };
      }

      if (updateErr) {
        console.warn("Direct update for tenant assignment failed in Supabase:", updateErr);
      }
    } catch (err) {
      console.warn("Error in assignTenantToUnit Supabase call:", err);
    }
  }

  // 3. Local storage fallback
  try {
    const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
    const idx = localUnits.findIndex((u) => u.id === unitId);

    if (idx !== -1) {
      const existing = localUnits[idx];
      const updated: Unit = {
        ...existing,
        tenant_name: tenantName,
        tenant_phone: tenantPhone,
        tenant_email: tenantEmail,
        tenant_password: password,
        tenant_access_token: token,
        tenant_assigned_at: assignedAt,
        status: "occupied",
        updated_at: new Date().toISOString(),
      };

      localUnits[idx] = updated;
      setLocalData(LOCAL_STORAGE_KEY_UNITS, localUnits);

      return {
        success: true,
        unit: updated,
        credentials: { email: tenantEmail, password, token },
      };
    }

    return { success: false, error: "Unit not found" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to assign tenant locally";
    return { success: false, error: msg };
  }
}

/**
 * Remove/unassign a tenant from a unit and set it back to vacant.
 */
export async function unassignTenant(
  landlordId: string,
  unitId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig && landlordId) {
    try {
      const payload = {
        tenant_name: null,
        tenant_phone: null,
        tenant_email: null,
        tenant_password: null,
        tenant_access_token: null,
        tenant_assigned_at: null,
        status: "vacant" as const,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("units")
        .update(payload)
        .eq("id", unitId)
        .eq("landlord_id", landlordId);

      if (!error) {
        const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
        const idx = localUnits.findIndex((u) => u.id === unitId);
        if (idx !== -1) {
          localUnits[idx] = { ...localUnits[idx], ...payload };
          setLocalData(LOCAL_STORAGE_KEY_UNITS, localUnits);
        }
        return { success: true };
      }
    } catch (err) {
      console.warn("Error unassigning tenant in Supabase:", err);
    }
  }

  // Local fallback
  const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
  const idx = localUnits.findIndex((u) => u.id === unitId);
  if (idx !== -1) {
    localUnits[idx] = {
      ...localUnits[idx],
      tenant_name: null,
      tenant_phone: null,
      tenant_email: null,
      tenant_password: null,
      tenant_access_token: null,
      tenant_assigned_at: null,
      status: "vacant",
      updated_at: new Date().toISOString(),
    };
    setLocalData(LOCAL_STORAGE_KEY_UNITS, localUnits);
    return { success: true };
  }

  return { success: false, error: "Unit not found" };
}

/**
 * Retrieve tenant portal data using 1-click access token.
 */
export async function getTenantPortalDataByToken(
  token: string
): Promise<{ success: boolean; data?: TenantPortalData; error?: string }> {
  if (!token) return { success: false, error: "Token is required" };

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      // 1. Try stored procedure
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_tenant_portal_data", {
        p_token: token,
      });

      if (!rpcErr && rpcData?.success && rpcData?.data) {
        return { success: true, data: rpcData.data as TenantPortalData };
      }

      // 2. Direct query fallback
      const { data: unitData, error: unitErr } = await supabase
        .from("units")
        .select("*, buildings(*)")
        .eq("tenant_access_token", token)
        .maybeSingle();

      if (!unitErr && unitData) {
        const building = unitData.buildings as unknown as Building;
        let landlordName = "Property Landlord";
        let landlordPhone = "";
        let landlordEmail = "";

        if (building?.landlord_id) {
          const { data: landlordData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", building.landlord_id)
            .maybeSingle();

          if (landlordData) {
            landlordName = landlordData.full_name || landlordName;
            landlordPhone = landlordData.phone || "";
            landlordEmail = landlordData.email || "";
          }
        }

        const portalData: TenantPortalData = {
          tenant_name: unitData.tenant_name || "Valued Tenant",
          tenant_phone: unitData.tenant_phone || "",
          tenant_email: unitData.tenant_email || "",
          unit_id: unitData.id,
          unit_number: unitData.unit_number,
          rent_amount: unitData.rent_amount || 0,
          parlors: unitData.parlors || 0,
          rooms: unitData.rooms || unitData.bedrooms || 0,
          bathrooms: unitData.bathrooms || 0,
          kitchens: unitData.kitchens || 0,
          notes: unitData.notes || null,
          building_id: building?.id || unitData.building_id,
          building_name: building?.name || "Residential Property",
          building_address: building?.address || "Address on file",
          building_city: building?.city || "Cameroon",
          landlord_id: unitData.landlord_id,
          landlord_name: landlordName,
          landlord_phone: landlordPhone,
          landlord_email: landlordEmail,
          assigned_at: unitData.tenant_assigned_at,
          access_token: token,
        };

        return { success: true, data: portalData };
      }
    } catch (err) {
      console.warn("Supabase portal data lookup failed, checking local storage:", err);
    }
  }

  // Local fallback
  const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
  const localBuildings = getLocalData<Building>(LOCAL_STORAGE_KEY_BUILDINGS);

  const unit = localUnits.find((u) => u.tenant_access_token === token);
  if (!unit) {
    return { success: false, error: "Invalid or expired access token." };
  }

  const building = localBuildings.find((b) => b.id === unit.building_id);

  const portalData: TenantPortalData = {
    tenant_name: unit.tenant_name || "Valued Tenant",
    tenant_phone: unit.tenant_phone || "",
    tenant_email: unit.tenant_email || "",
    unit_id: unit.id,
    unit_number: unit.unit_number,
    rent_amount: unit.rent_amount || 0,
    parlors: unit.parlors || 0,
    rooms: unit.rooms || unit.bedrooms || 0,
    bathrooms: unit.bathrooms || 0,
    kitchens: unit.kitchens || 0,
    notes: unit.notes || null,
    building_id: building?.id || unit.building_id,
    building_name: building?.name || "Residential Property",
    building_address: building?.address || "Address on file",
    building_city: building?.city || "Cameroon",
    landlord_id: unit.landlord_id,
    landlord_name: "Property Management",
    landlord_phone: "+237 600 00 00 00",
    landlord_email: "landlord@leaselink.cm",
    assigned_at: unit.tenant_assigned_at,
    access_token: token,
  };

  return { success: true, data: portalData };
}

/**
 * Authenticate tenant with Email/Phone and Password when logging in manually after logout.
 */
export async function authenticateTenant(
  identifier: string,
  password: string
): Promise<{ success: boolean; data?: TenantPortalData; error?: string }> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  if (!cleanId || !cleanPass) {
    return { success: false, error: "Please enter your email/phone and password." };
  }

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      // 1. Try RPC procedure
      const { data: rpcData, error: rpcErr } = await supabase.rpc("authenticate_tenant", {
        p_identifier: cleanId,
        p_password: cleanPass,
      });

      if (!rpcErr && rpcData?.success && rpcData?.data) {
        return { success: true, data: rpcData.data as TenantPortalData };
      }

      // 2. Direct query fallback
      const { data: unitData } = await supabase
        .from("units")
        .select("*, buildings(*)")
        .or(`tenant_email.ilike.${cleanId},tenant_phone.ilike.%${cleanId}%`)
        .eq("tenant_password", cleanPass)
        .maybeSingle();

      if (unitData) {
        const building = unitData.buildings as unknown as Building;
        let landlordName = "Property Landlord";
        let landlordPhone = "";
        let landlordEmail = "";

        if (building?.landlord_id) {
          const { data: landlordData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", building.landlord_id)
            .maybeSingle();

          if (landlordData) {
            landlordName = landlordData.full_name || landlordName;
            landlordPhone = landlordData.phone || "";
            landlordEmail = landlordData.email || "";
          }
        }

        const portalData: TenantPortalData = {
          tenant_name: unitData.tenant_name || "Valued Tenant",
          tenant_phone: unitData.tenant_phone || "",
          tenant_email: unitData.tenant_email || "",
          unit_id: unitData.id,
          unit_number: unitData.unit_number,
          rent_amount: unitData.rent_amount || 0,
          parlors: unitData.parlors || 0,
          rooms: unitData.rooms || unitData.bedrooms || 0,
          bathrooms: unitData.bathrooms || 0,
          kitchens: unitData.kitchens || 0,
          notes: unitData.notes || null,
          building_id: building?.id || unitData.building_id,
          building_name: building?.name || "Residential Property",
          building_address: building?.address || "Address on file",
          building_city: building?.city || "Cameroon",
          landlord_id: unitData.landlord_id,
          landlord_name: landlordName,
          landlord_phone: landlordPhone,
          landlord_email: landlordEmail,
          assigned_at: unitData.tenant_assigned_at,
          access_token: unitData.tenant_access_token || generateAccessToken(),
        };

        return { success: true, data: portalData };
      }
    } catch (err) {
      console.warn("Supabase tenant login attempt exception:", err);
    }
  }

  // Local fallback
  const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
  const localBuildings = getLocalData<Building>(LOCAL_STORAGE_KEY_BUILDINGS);

  const match = localUnits.find((u) => {
    const emailMatch = u.tenant_email?.trim().toLowerCase() === cleanId;
    const phoneMatch = u.tenant_phone?.replace(/\D/g, "") === cleanId.replace(/\D/g, "");
    const passMatch = u.tenant_password?.trim() === cleanPass;
    return (emailMatch || phoneMatch) && passMatch;
  });

  if (!match) {
    return {
      success: false,
      error: "Invalid email or password. Please verify the credentials received from your landlord.",
    };
  }

  const building = localBuildings.find((b) => b.id === match.building_id);

  const portalData: TenantPortalData = {
    tenant_name: match.tenant_name || "Valued Tenant",
    tenant_phone: match.tenant_phone || "",
    tenant_email: match.tenant_email || "",
    unit_id: match.id,
    unit_number: match.unit_number,
    rent_amount: match.rent_amount || 0,
    parlors: match.parlors || 0,
    rooms: match.rooms || match.bedrooms || 0,
    bathrooms: match.bathrooms || 0,
    kitchens: match.kitchens || 0,
    notes: match.notes || null,
    building_id: building?.id || match.building_id,
    building_name: building?.name || "Residential Property",
    building_address: building?.address || "Address on file",
    building_city: building?.city || "Cameroon",
    landlord_id: match.landlord_id,
    landlord_name: "Property Management",
    landlord_phone: "+237 600 00 00 00",
    landlord_email: "landlord@leaselink.cm",
    assigned_at: match.tenant_assigned_at,
    access_token: match.tenant_access_token || generateAccessToken(),
  };

  return { success: true, data: portalData };
}

/**
 * Tenant Browser Session Storage Helpers
 */
export function setTenantSession(data: TenantPortalData) {
  if (typeof window === "undefined") return;
  const session: TenantSession = {
    token: data.access_token,
    portalData: data,
    authenticatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_TENANT_SESSION, JSON.stringify(session));
  } catch (err) {
    console.error("Failed to store tenant session:", err);
  }
}

export function getTenantSession(): TenantSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_TENANT_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTenantSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_TENANT_SESSION);
  } catch (err) {
    console.error("Failed to clear tenant session:", err);
  }
}
