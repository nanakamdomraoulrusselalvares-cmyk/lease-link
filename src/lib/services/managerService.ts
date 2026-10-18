import { createClient } from "@/lib/supabase/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ManagerProfile, CreateManagerInput } from "@/types/database";

const LOCAL_STORAGE_KEY_MANAGERS = "leaselink_local_managers";

function getLocalManagers(): ManagerProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MANAGERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalManagers(managers: ManagerProfile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_MANAGERS, JSON.stringify(managers));
  } catch (err) {
    console.error("Error storing local managers:", err);
  }
}

/**
 * Generates an initial memorable temporary password for a new manager
 */
export function generateManagerPassword(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `Mng#${randomDigits}`;
}

/**
 * Fetch all managers registered under a specific landlord
 */
export async function getManagersForLandlord(landlordId: string): Promise<ManagerProfile[]> {
  if (!landlordId) return [];

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  const localManagers = getLocalManagers().filter((m) => m.landlord_id === landlordId);

  if (!isMockConfig) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "manager")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Merge with local overrides if any
        const merged = (data as ManagerProfile[]).map((m) => {
          const local = localManagers.find((lm) => lm.id === m.id);
          return local ? { ...m, ...local } : m;
        });

        // Also append any local-only managers created in offline mode
        const remoteIds = new Set(data.map((d: any) => d.id));
        const localOnly = localManagers.filter((lm) => !remoteIds.has(lm.id));
        return [...merged, ...localOnly];
      }
    } catch (err) {
      console.warn("Could not fetch managers from Supabase, using local store:", err);
    }
  }

  return localManagers;
}

/**
 * Creates a new manager under the landlord's account
 */
export async function createManager(
  landlordId: string,
  input: CreateManagerInput
): Promise<{ success: boolean; manager?: ManagerProfile; error?: string; initialPassword?: string }> {
  if (!landlordId) {
    return { success: false, error: "Landlord ID is required." };
  }

  const cleanName = input.full_name?.trim();
  const cleanEmail = input.email?.trim().toLowerCase();
  const cleanPhone = input.phone?.trim();
  const password = input.password?.trim() || generateManagerPassword();

  if (!cleanName || !cleanEmail || !cleanPhone) {
    return { success: false, error: "Full name, email, and phone number are required." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const isMockConfig = !supabaseUrl || supabaseUrl.includes("your-project-ref");

  const managerId = "mng_" + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();

  let createdProfile: ManagerProfile = {
    id: managerId,
    full_name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    role: "manager",
    landlord_id: landlordId,
    assigned_building_ids: Array.isArray(input.assigned_building_ids) ? input.assigned_building_ids : null,
    created_at: now,
    updated_at: now,
  };

  // Check local manager store for duplicate email
  const existingLocal = getLocalManagers();
  if (existingLocal.some((m) => m.email.toLowerCase() === cleanEmail)) {
    return {
      success: false,
      error: "Cette adresse e-mail est déjà associée à un compte sur la plateforme.",
    };
  }

  // 1. Try backend API creation route first
  try {
    const apiRes = await fetch("/api/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        landlordId,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        password,
        assignedBuildingIds: input.assigned_building_ids,
      }),
    });

    const json = await apiRes.json();
    if (json.success && json.manager) {
      createdProfile = json.manager;
      const local = getLocalManagers();
      setLocalManagers([createdProfile, ...local]);
      return { success: true, manager: createdProfile, initialPassword: password };
    } else if (json.error) {
      return { success: false, error: json.error };
    }
  } catch {
    // API route not available or errored, continue to client fallback
  }

  // 2. Direct Supabase Auth client with persistSession: false
  if (!isMockConfig) {
    try {
      const isolatedAuthClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: authData, error: authError } = await isolatedAuthClient.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            phone: cleanPhone,
            role: "manager",
            landlord_id: landlordId,
          },
        },
      });

      if (authError) {
        // If user already exists or error
        if (authError.message.includes("already registered") || authError.message.includes("User already exists")) {
          return { success: false, error: "An account with this email address already exists." };
        }
        console.warn("Direct signUp warning:", authError.message);
      }

      const effectiveUserId = authData?.user?.id || managerId;
      createdProfile.id = effectiveUserId;

      // Save into profiles table
      const mainSupabase = createClient();
      const { data: profileRow, error: pError } = await mainSupabase
        .from("profiles")
        .upsert(
          {
            id: effectiveUserId,
            full_name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            role: "manager",
            landlord_id: landlordId,
            plan: "free",
            plan_name: "Manager Access",
            plan_status: "active",
            assigned_building_ids: Array.isArray(input.assigned_building_ids) ? input.assigned_building_ids : null,
            updated_at: now,
          },
          { onConflict: "id" }
        )
        .select()
        .maybeSingle();

      if (!pError && profileRow) {
        createdProfile = profileRow as ManagerProfile;
      }
    } catch (err: unknown) {
      console.warn("Supabase manager creation error, using local fallback:", err);
    }
  }

  // 3. Save to local storage for resilience
  const local = getLocalManagers();
  setLocalManagers([createdProfile, ...local.filter((m) => m.id !== createdProfile.id)]);

  return {
    success: true,
    manager: createdProfile,
    initialPassword: password,
  };
}

/**
 * Updates or revokes building assignments for an existing manager
 * @param assignedBuildingIds null = all portfolio buildings, string[] = specific buildings only
 */
export async function updateManagerAssignedBuildings(
  managerId: string,
  landlordId: string,
  assignedBuildingIds: string[] | null
): Promise<{ success: boolean; manager?: ManagerProfile; error?: string }> {
  if (!managerId || !landlordId) {
    return { success: false, error: "Manager ID and Landlord ID are required." };
  }

  const sanitizedBuildingIds = Array.isArray(assignedBuildingIds) ? assignedBuildingIds : null;
  const now = new Date().toISOString();
  let updatedManager: ManagerProfile | undefined;

  // 1. Try backend API PATCH route first
  try {
    const res = await fetch("/api/managers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        managerId,
        landlordId,
        assignedBuildingIds: sanitizedBuildingIds,
      }),
    });

    const json = await res.json();
    if (json.success && json.manager) {
      updatedManager = json.manager;
    }
  } catch (err) {
    console.warn("API update manager error, trying direct Supabase client:", err);
  }

  // 2. Direct Supabase Client fallback
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !supabaseUrl || supabaseUrl.includes("your-project-ref");

  if (!updatedManager && !isMockConfig) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .update({
          assigned_building_ids: sanitizedBuildingIds,
          updated_at: now,
        })
        .eq("id", managerId)
        .eq("landlord_id", landlordId)
        .select()
        .maybeSingle();

      if (!error && data) {
        updatedManager = data as ManagerProfile;
      }
    } catch (err) {
      console.warn("Direct Supabase update manager error:", err);
    }
  }

  // 3. Update local storage
  const localManagers = getLocalManagers();
  const idx = localManagers.findIndex((m) => m.id === managerId);
  if (idx !== -1) {
    localManagers[idx] = {
      ...localManagers[idx],
      assigned_building_ids: sanitizedBuildingIds,
      updated_at: now,
    };
    if (!updatedManager) {
      updatedManager = localManagers[idx];
    }
  } else if (!updatedManager) {
    updatedManager = {
      id: managerId,
      full_name: "Manager",
      email: "",
      phone: "",
      role: "manager",
      landlord_id: landlordId,
      assigned_building_ids: sanitizedBuildingIds,
      created_at: now,
      updated_at: now,
    };
    localManagers.push(updatedManager);
  }
  setLocalManagers(localManagers);

  return {
    success: true,
    manager: updatedManager,
  };
}

/**
 * Remove/delete a manager from the landlord's team
 */
export async function deleteManager(
  managerId: string,
  landlordId: string
): Promise<{ success: boolean; error?: string }> {
  if (!managerId || !landlordId) {
    return { success: false, error: "Manager ID and Landlord ID are required." };
  }

  // 1. Try API delete
  try {
    await fetch("/api/managers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId, landlordId }),
    });
  } catch (apiErr) {
    console.warn("API delete manager error:", apiErr);
  }

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      await supabase
        .from("profiles")
        .delete()
        .eq("id", managerId)
        .eq("landlord_id", landlordId);
    } catch (err) {
      console.warn("Could not delete from Supabase profiles:", err);
    }
  }

  const local = getLocalManagers();
  setLocalManagers(local.filter((m) => m.id !== managerId));

  return { success: true };
}
