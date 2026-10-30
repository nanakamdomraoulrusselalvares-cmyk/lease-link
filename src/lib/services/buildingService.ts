import { createClient } from "@/lib/supabase/client";
import { Building, Unit, CreateBuildingFormInput, UpdateUnitInput } from "@/types/database";
import { generateTenantPassword, generateAccessToken } from "./tenantService";
import { notifyTenantArrival, notifyTenantDeparture } from "./notificationService";

const LOCAL_STORAGE_KEY_BUILDINGS = "leaselink_local_buildings";
const LOCAL_STORAGE_KEY_UNITS = "leaselink_local_units";

// Helper to access localStorage safely in browser
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
 * Broadcasts an update event so that any active view (e.g. Dashboard, Buildings page)
 * refreshes its local state immediately without requiring a full browser reload.
 */
export function broadcastBuildingsUpdated(building?: Building) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("leaselink:buildings_updated", {
        detail: { building },
      })
    );
  } catch (e) {
    console.warn("Could not dispatch leaselink:buildings_updated:", e);
  }
}

/**
 * Updates the cached dashboard payload stored in localStorage so the main dashboard
 * reflects newly created or updated buildings without delay.
 */
function updateCachedDashboardBuildings(building: Building, units: Unit[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("leaselink_cached_dashboard");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const existing = Array.isArray(parsed.buildings) ? parsed.buildings : [];
    const bWithUnits = { ...building, units: units || building.units || [] };
    const merged = [
      bWithUnits,
      ...existing.filter((b: Building) => b.id !== building.id),
    ];
    parsed.buildings = merged;
    parsed.cachedAt = Date.now();
    localStorage.setItem("leaselink_cached_dashboard", JSON.stringify(parsed));
  } catch (e) {
    console.warn("Could not update cached dashboard buildings:", e);
  }
}

/**
 * Persists a newly created or updated building and its units into local cache,
 * updates the cached dashboard data, and notifies the entire application.
 */
function saveBuildingToLocal(building: Building, units: Unit[]) {
  if (typeof window === "undefined") return;
  try {
    const localBuildings = getLocalData<Building>(LOCAL_STORAGE_KEY_BUILDINGS);
    const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);

    const bWithUnits: Building = {
      ...building,
      units: units || building.units || [],
    };

    const updatedBuildings = [
      bWithUnits,
      ...localBuildings.filter((b) => b.id !== building.id),
    ];

    const unitIds = new Set(units.map((u) => u.id));
    const updatedUnits = [
      ...units,
      ...localUnits.filter((u) => !unitIds.has(u.id)),
    ];

    setLocalData(LOCAL_STORAGE_KEY_BUILDINGS, updatedBuildings);
    setLocalData(LOCAL_STORAGE_KEY_UNITS, updatedUnits);

    updateCachedDashboardBuildings(bWithUnits, units);
    broadcastBuildingsUpdated(bWithUnits);
  } catch (err) {
    console.warn("Error caching building locally:", err);
  }
}

export interface BuildingCreationResult {
  success: boolean;
  building?: Building;
  units?: Unit[];
  error?: string;
  isLocalFallback?: boolean;
}

export interface UnitUpdateResult {
  success: boolean;
  unit?: Unit;
  error?: string;
  isLocalFallback?: boolean;
}

/**
 * Creates a building and automatically generates the specified number of vacant units.
 * Note: Rent price, parlors, rooms, bathrooms, and kitchens are NOT set by default (0/unconfigured),
 * and floors have been removed per specifications. Landlord customizes each unit after creation.
 */
export async function createBuildingWithUnits(
  landlordId: string,
  input: CreateBuildingFormInput,
  planUnitLimit: number = 30
): Promise<BuildingCreationResult> {
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  // Validate unit limits
  const totalUnits = Math.max(1, Number(input.total_units) || 1);
  const cleanPrefix = (input.unit_prefix || "Unit").trim();

  // If not mock, attempt Supabase insertion
  if (!isMockConfig && landlordId) {
    try {
      // 1. Try atomic RPC function first
      let rpcData: any = null;
      let rpcError: any = null;

      try {
        const res = await supabase.rpc("create_building_with_vacant_units", {
          p_name: input.name.trim(),
          p_address: input.address.trim(),
          p_city: input.city.trim() || null,
          p_state_region: input.state_region.trim() || null,
          p_property_type: input.property_type || "commercial",
          p_total_units: totalUnits,
          p_unit_prefix: cleanPrefix,
          p_description: input.description.trim() || null,
          p_landlord_id: landlordId,
        });
        rpcData = res.data;
        rpcError = res.error;
      } catch (e: any) {
        rpcError = e;
      }

      // If RPC failed due to parameter mismatch (older migration signature), retry without p_landlord_id
      if (rpcError && rpcError.message && (rpcError.message.includes("p_landlord_id") || rpcError.message.includes("argument"))) {
        try {
          const res = await supabase.rpc("create_building_with_vacant_units", {
            p_name: input.name.trim(),
            p_address: input.address.trim(),
            p_city: input.city.trim() || null,
            p_state_region: input.state_region.trim() || null,
            p_property_type: input.property_type || "commercial",
            p_total_units: totalUnits,
            p_unit_prefix: cleanPrefix,
            p_description: input.description.trim() || null,
          });
          rpcData = res.data;
          rpcError = res.error;
        } catch (e2: any) {
          rpcError = e2;
        }
      }

      if (!rpcError && rpcData && rpcData.success && rpcData.building_id) {
        // Fetch the created building and units separately to avoid nested join failures
        const { data: createdBuilding } = await supabase
          .from("buildings")
          .select("*")
          .eq("id", rpcData.building_id)
          .maybeSingle();

        const { data: createdUnits } = await supabase
          .from("units")
          .select("*")
          .eq("building_id", rpcData.building_id);

        if (createdBuilding) {
          const finalBuilding: Building = {
            ...(createdBuilding as Building),
            units: (createdUnits || []) as Unit[],
          };

          saveBuildingToLocal(finalBuilding, (createdUnits || []) as Unit[]);

          return {
            success: true,
            building: finalBuilding,
            units: (createdUnits || []) as Unit[],
          };
        }
      }

      // If RPC failed due to quota validation, return that error directly
      if (rpcData && !rpcData.success && rpcData.error) {
        return { success: false, error: rpcData.error };
      }

      // 2. Direct client insert fallback (if RPC function is not yet installed in Supabase)
      const { count: currentUnitsCount } = await supabase
        .from("units")
        .select("id", { count: "exact", head: true })
        .eq("landlord_id", landlordId);

      const existingUnits = currentUnitsCount || 0;
      if (existingUnits + totalUnits > planUnitLimit) {
        return {
          success: false,
          error: `Exceeds subscription unit capacity! You already have ${existingUnits} of ${planUnitLimit} units. Adding ${totalUnits} units exceeds your plan limit.`,
        };
      }

      // Insert building (with fallback retry for schemas missing optional columns)
      let newBuilding: any = null;
      let buildingError: any = null;

      const fullBuildingPayload = {
        landlord_id: landlordId,
        name: input.name.trim(),
        address: input.address.trim(),
        city: input.city.trim() || null,
        state_region: input.state_region.trim() || null,
        property_type: input.property_type || "commercial",
        total_floors: 1,
        total_units: totalUnits,
        description: input.description.trim() || null,
      };

      const resBuilding = await supabase
        .from("buildings")
        .insert(fullBuildingPayload)
        .select()
        .single();

      newBuilding = resBuilding.data;
      buildingError = resBuilding.error;

      if (buildingError) {
        console.warn("Direct building insert with full payload failed, trying base columns:", buildingError.message);
        const baseBuildingPayload = {
          landlord_id: landlordId,
          name: input.name.trim(),
          address: input.address.trim(),
          total_units: totalUnits,
          property_type: input.property_type || "commercial",
        };
        const retryBuilding = await supabase
          .from("buildings")
          .insert(baseBuildingPayload)
          .select()
          .single();
        if (!retryBuilding.error && retryBuilding.data) {
          newBuilding = retryBuilding.data;
          buildingError = null;
        } else {
          throw buildingError;
        }
      }

      // Generate all units with status = 'vacant' and 0 default specs
      const unitsToInsert = [];

      for (let i = 1; i <= totalUnits; i++) {
        const unitNumber = `${cleanPrefix} ${i}`;

        unitsToInsert.push({
          building_id: newBuilding.id,
          landlord_id: landlordId,
          unit_number: unitNumber,
          status: "vacant" as const,
          rent_amount: 0,
          deposit_amount: 0,
          parlors: 0,
          rooms: 0,
          bedrooms: 0,
          bathrooms: 0,
          kitchens: 0,
        });
      }

      let insertedUnits: any = null;
      let unitsError: any = null;

      const resUnits = await supabase
        .from("units")
        .insert(unitsToInsert)
        .select();

      insertedUnits = resUnits.data;
      unitsError = resUnits.error;

      if (unitsError) {
        console.warn("Units batch insert with full columns failed, retrying base columns:", unitsError.message);
        const minimalUnits = unitsToInsert.map((u) => ({
          building_id: u.building_id,
          landlord_id: u.landlord_id,
          unit_number: u.unit_number,
          status: u.status,
          rent_amount: 0,
          deposit_amount: 0,
        }));
        const retryUnits = await supabase
          .from("units")
          .insert(minimalUnits)
          .select();
        if (!retryUnits.error && retryUnits.data) {
          insertedUnits = retryUnits.data;
          unitsError = null;
        } else {
          throw unitsError;
        }
      }

      const finalBuilding: Building = {
        ...newBuilding,
        units: (insertedUnits || []) as Unit[],
      };

      saveBuildingToLocal(finalBuilding, (insertedUnits || []) as Unit[]);

      return {
        success: true,
        building: finalBuilding,
        units: (insertedUnits || []) as Unit[],
      };
    } catch (err: unknown) {
      console.warn("Supabase database insert error, falling back to local session store:", err);
      // Fall through to local fallback
    }
  }

  // 3. Local Fallback (for testing / pending Supabase migrations)
  try {
    const localBuildings = getLocalData<Building>(LOCAL_STORAGE_KEY_BUILDINGS);
    const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);

    const userUnits = localUnits.filter((u) => u.landlord_id === landlordId);

    if (userUnits.length + totalUnits > planUnitLimit) {
      return {
        success: false,
        error: `Exceeds subscription unit capacity! You already have ${userUnits.length} of ${planUnitLimit} units. Adding ${totalUnits} units exceeds your plan limit.`,
      };
    }

    const buildingId = "bld_" + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();

    const createdBuilding: Building = {
      id: buildingId,
      landlord_id: landlordId,
      name: input.name.trim(),
      address: input.address.trim(),
      city: input.city.trim() || null,
      state_region: input.state_region.trim() || null,
      property_type: input.property_type || "commercial",
      total_units: totalUnits,
      description: input.description.trim() || null,
      created_at: now,
      updated_at: now,
    };

    const generatedUnits: Unit[] = [];

    for (let i = 1; i <= totalUnits; i++) {
      const unitNumber = `${cleanPrefix} ${i}`;

      generatedUnits.push({
        id: "unt_" + Math.random().toString(36).substring(2, 11),
        building_id: buildingId,
        landlord_id: landlordId,
        unit_number: unitNumber,
        status: "vacant",
        rent_amount: 0,
        deposit_amount: 0,
        parlors: 0,
        rooms: 0,
        bedrooms: 0,
        bathrooms: 0,
        kitchens: 0,
        created_at: now,
        updated_at: now,
      });
    }

    const finalBuilding: Building = {
      ...createdBuilding,
      units: generatedUnits,
    };

    saveBuildingToLocal(finalBuilding, generatedUnits);

    return {
      success: true,
      building: finalBuilding,
      units: generatedUnits,
      isLocalFallback: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create building";
    return { success: false, error: message };
  }
}

/**
 * Modifies an existing unit's configuration:
 * Rent price, parlors, rooms, bathrooms, kitchens, unit number, and notes.
 */
export async function updateUnitConfiguration(
  landlordId: string,
  unitId: string,
  input: UpdateUnitInput
): Promise<UnitUpdateResult> {
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  const cleanRent = Math.max(0, Number(input.rent_amount) || 0);
  const cleanParlors = Math.max(0, Math.floor(Number(input.parlors) || 0));
  const cleanRooms = Math.max(0, Math.floor(Number(input.rooms) || 0));
  const cleanBathrooms = Math.max(0, Number(input.bathrooms) || 0);
  const cleanKitchens = Math.max(0, Math.floor(Number(input.kitchens) || 0));
  const cleanNotes = input.notes?.trim() || null;

  const isAssigningTenant = Boolean(
    input.tenant_name?.trim() || input.tenant_phone?.trim() || input.tenant_email?.trim()
  );
  const isUnassigning = input.status === "vacant" && !isAssigningTenant;

  const tenantName = input.tenant_name?.trim() || null;
  const tenantPhone = input.tenant_phone?.trim() || null;
  const tenantEmail = input.tenant_email?.trim() || null;
  const tenantPassword = input.tenant_password || generateTenantPassword();
  const tenantAccessToken = input.tenant_access_token || generateAccessToken();
  const tenantAssignedAt = new Date().toISOString();

  const localUnitsInit = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
  const previousUnit = localUnitsInit.find((u) => u.id === unitId);
  const previousTenantName = previousUnit?.tenant_name?.trim() || null;

  const dispatchMovementNotification = async (savedUnit: Unit) => {
    try {
      const localBuildings = getLocalData<Building>(LOCAL_STORAGE_KEY_BUILDINGS);
      const building = localBuildings.find((b) => b.id === savedUnit.building_id);
      const buildingName = building?.name || "Residence";
      const bId = savedUnit.building_id || "";

      if (isAssigningTenant && tenantName) {
        if (!previousTenantName || previousTenantName.toLowerCase() !== tenantName.toLowerCase()) {
          await notifyTenantArrival({
            buildingId: bId,
            buildingName,
            unitId: savedUnit.id,
            unitNumber: savedUnit.unit_number,
            tenantName,
            landlordId,
          });
        }
      } else if (isUnassigning && previousTenantName) {
        await notifyTenantDeparture({
          buildingId: bId,
          buildingName,
          unitId: savedUnit.id,
          unitNumber: savedUnit.unit_number,
          tenantName: previousTenantName,
          landlordId,
        });
      }
      broadcastBuildingsUpdated();
    } catch (err) {
      console.warn("Could not dispatch movement notification:", err);
    }
  };

  if (!isMockConfig && landlordId) {
    try {
      // 1. Prepare direct client update payload
      const payload: Record<string, unknown> = {
        rent_amount: cleanRent,
        parlors: cleanParlors,
        rooms: cleanRooms,
        bedrooms: cleanRooms,
        bathrooms: cleanBathrooms,
        kitchens: cleanKitchens,
        notes: cleanNotes,
        updated_at: new Date().toISOString(),
      };

      if (input.unit_number?.trim()) {
        payload.unit_number = input.unit_number.trim();
      }

      if (input.lease_start_date !== undefined) {
        payload.lease_start_date = input.lease_start_date || null;
      }
      if (input.rent_due_day !== undefined) {
        payload.rent_due_day = Number(input.rent_due_day) || 5;
      }

      if (isAssigningTenant) {
        payload.tenant_name = tenantName;
        payload.tenant_phone = tenantPhone;
        payload.tenant_email = tenantEmail;
        payload.tenant_password = tenantPassword;
        payload.tenant_access_token = tenantAccessToken;
        payload.tenant_assigned_at = tenantAssignedAt;
        payload.lease_start_date = input.lease_start_date || new Date().toISOString().split("T")[0];
        payload.rent_due_day = Number(input.rent_due_day) || 5;
        payload.status = "occupied";
      } else if (isUnassigning) {
        payload.tenant_name = null;
        payload.tenant_phone = null;
        payload.tenant_email = null;
        payload.tenant_password = null;
        payload.tenant_access_token = null;
        payload.tenant_assigned_at = null;
        payload.lease_start_date = null;
        payload.rent_due_day = 5;
        payload.status = "vacant";
      }

      const { data: updatedUnit, error: updateError } = await supabase
        .from("units")
        .update(payload)
        .eq("id", unitId)
        .eq("landlord_id", landlordId)
        .select()
        .single();

      if (!updateError && updatedUnit) {
        // Sanitize sensitive credentials before any local caching
        if (typeof window !== "undefined") {
          try {
            const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
            const idx = localUnits.findIndex((u) => u.id === unitId);
            if (idx !== -1) {
              const safeUnit = { ...updatedUnit, tenant_password: null };
              localUnits[idx] = safeUnit as Unit;
              setLocalData(LOCAL_STORAGE_KEY_UNITS, localUnits);
            }
          } catch {
            // ignore
          }
        }
        await dispatchMovementNotification(updatedUnit as Unit);
        return { success: true, unit: updatedUnit as Unit };
      }

      if (updateError) {
        console.warn("Supabase update unit error, trying schema fallback:", updateError.message);

        // Fallback: update with base columns accepted by older Supabase schemas
        try {
          const basePayload: Record<string, unknown> = {
            rent_amount: cleanRent,
            bedrooms: cleanRooms,
            bathrooms: cleanBathrooms,
            notes: cleanNotes,
            updated_at: new Date().toISOString(),
          };
          if (input.unit_number?.trim()) {
            basePayload.unit_number = input.unit_number.trim();
          }

          const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
          const existing = localUnits.find((u) => u.id === unitId);

          let baseUnit: any = null;
          try {
            const { data } = await supabase
              .from("units")
              .update(basePayload)
              .eq("id", unitId)
              .eq("landlord_id", landlordId)
              .select("id, building_id, unit_number, rent_amount, created_at")
              .maybeSingle();
            baseUnit = data;
          } catch {
            // Base select exception ignored, fallback to local data
          }

          const fallbackMerged: Unit = {
            id: unitId,
            building_id: (baseUnit?.building_id as string) || existing?.building_id || "",
            landlord_id: landlordId,
            unit_number: input.unit_number?.trim() || baseUnit?.unit_number || existing?.unit_number || "Unit",
            rent_amount: cleanRent,
            parlors: cleanParlors,
            rooms: cleanRooms,
            bedrooms: cleanRooms,
            bathrooms: cleanBathrooms,
            kitchens: cleanKitchens,
            notes: cleanNotes,
            status: isAssigningTenant ? "occupied" : isUnassigning ? "vacant" : existing?.status || "vacant",
            tenant_name: isAssigningTenant ? tenantName : isUnassigning ? null : existing?.tenant_name || null,
            tenant_phone: isAssigningTenant ? tenantPhone : isUnassigning ? null : existing?.tenant_phone || null,
            tenant_email: isAssigningTenant ? tenantEmail : isUnassigning ? null : existing?.tenant_email || null,
            tenant_password: isAssigningTenant ? (existing?.tenant_password || tenantPassword) : isUnassigning ? null : existing?.tenant_password || null,
            tenant_access_token: isAssigningTenant ? (existing?.tenant_access_token || tenantAccessToken) : isUnassigning ? null : existing?.tenant_access_token || null,
            tenant_assigned_at: isAssigningTenant ? (existing?.tenant_assigned_at || tenantAssignedAt) : isUnassigning ? null : existing?.tenant_assigned_at || null,
            lease_start_date: isAssigningTenant ? (input.lease_start_date || new Date().toISOString().split("T")[0]) : isUnassigning ? null : (input.lease_start_date !== undefined ? input.lease_start_date : existing?.lease_start_date || null),
            rent_due_day: isAssigningTenant ? (Number(input.rent_due_day) || 5) : isUnassigning ? 5 : (input.rent_due_day !== undefined ? Number(input.rent_due_day) : existing?.rent_due_day || 5),
            created_at: baseUnit?.created_at || existing?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const idx = localUnits.findIndex((u) => u.id === unitId);
          if (idx !== -1) {
            localUnits[idx] = fallbackMerged;
          } else {
            localUnits.push(fallbackMerged);
          }
          setLocalData(LOCAL_STORAGE_KEY_UNITS, localUnits);

          await dispatchMovementNotification(fallbackMerged);
          return { success: true, unit: fallbackMerged };
        } catch (baseErr) {
          console.warn("Base schema retry failed, using full local fallback:", baseErr);
        }
      }
    } catch (err) {
      console.warn("Supabase unit update exception:", err);
    }
  }

  // 3. Local fallback update (always succeeds and preserves credentials & specs)
  try {
    const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
    const index = localUnits.findIndex((u) => u.id === unitId);
    const existing = index !== -1 ? localUnits[index] : ({} as Partial<Unit>);

    const updated: Unit = {
      id: unitId,
      building_id: (existing.building_id as string) || "",
      landlord_id: landlordId,
      unit_number: input.unit_number?.trim() || existing.unit_number || "Unit",
      rent_amount: cleanRent,
      parlors: cleanParlors,
      rooms: cleanRooms,
      bedrooms: cleanRooms,
      bathrooms: cleanBathrooms,
      kitchens: cleanKitchens,
      notes: cleanNotes,
      status: isAssigningTenant ? "occupied" : isUnassigning ? "vacant" : (existing.status as any) || "vacant",
      tenant_name: isAssigningTenant ? tenantName : isUnassigning ? null : existing.tenant_name || null,
      tenant_phone: isAssigningTenant ? tenantPhone : isUnassigning ? null : existing.tenant_phone || null,
      tenant_email: isAssigningTenant ? tenantEmail : isUnassigning ? null : existing.tenant_email || null,
      tenant_password: isAssigningTenant ? (existing.tenant_password || tenantPassword) : isUnassigning ? null : existing.tenant_password || null,
      tenant_access_token: isAssigningTenant ? (existing.tenant_access_token || tenantAccessToken) : isUnassigning ? null : existing.tenant_access_token || null,
      tenant_assigned_at: isAssigningTenant ? (existing.tenant_assigned_at || tenantAssignedAt) : isUnassigning ? null : existing.tenant_assigned_at || null,
      created_at: existing.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (index !== -1) {
      localUnits[index] = updated;
    } else {
      localUnits.push(updated);
    }
    setLocalData(LOCAL_STORAGE_KEY_UNITS, localUnits);

    await dispatchMovementNotification(updated);
    return { success: true, unit: updated, isLocalFallback: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update unit";
    return { success: false, error: msg };
  }
}

/**
 * Fetch all buildings belonging to the landlord along with their units.
 * If assignedBuildingIds is provided as an array:
 *   - Empty array [] => returns [] (strictly 0 buildings)
 *   - Array with IDs => returns only buildings matching those IDs
 * If assignedBuildingIds is null or undefined => returns all buildings belonging to landlord
 */
export async function getBuildingsWithUnits(
  landlordId: string,
  assignedBuildingIds?: string[] | null
): Promise<Building[]> {
  if (!landlordId) return [];

  // If specifically restricted to an empty list of buildings, return empty immediately
  if (Array.isArray(assignedBuildingIds) && assignedBuildingIds.length === 0) {
    return [];
  }

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  const localBuildings = getLocalData<Building>(LOCAL_STORAGE_KEY_BUILDINGS);
  const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);

  let remoteBuildings: Building[] = [];
  let remoteUnits: Unit[] = [];
  let fetchedRemoteSuccessfully = false;

  if (!isMockConfig) {
    try {
      // 1. Fetch remote buildings separately to avoid fragile nested join failures
      const { data: bData, error: bError } = await supabase
        .from("buildings")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false });

      if (!bError && bData) {
        remoteBuildings = bData as Building[];
        fetchedRemoteSuccessfully = true;

        // 2. Fetch remote units for this landlord
        const { data: uData, error: uError } = await supabase
          .from("units")
          .select("*")
          .eq("landlord_id", landlordId);

        if (!uError && uData) {
          remoteUnits = uData as Unit[];
        } else if (remoteBuildings.length > 0) {
          // Fallback: fetch units by building IDs
          const bIds = remoteBuildings.map((b) => b.id);
          const { data: uData2 } = await supabase
            .from("units")
            .select("*")
            .in("building_id", bIds);
          if (uData2) {
            remoteUnits = uData2 as Unit[];
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote buildings from Supabase:", err);
    }
  }

  // 3. Resilient Merge: Combine remote and local storage so no buildings or units disappear
  const buildingMap = new Map<string, Building>();

  // Add local buildings for this landlord first
  for (const lb of localBuildings.filter((b) => b.landlord_id === landlordId)) {
    buildingMap.set(lb.id, lb);
  }

  // Overlay remote buildings (they take precedence for shared IDs)
  for (const rb of remoteBuildings) {
    buildingMap.set(rb.id, rb);
  }

  // Merge units by ID
  const unitMap = new Map<string, Unit>();
  for (const lu of localUnits.filter((u) => u.landlord_id === landlordId)) {
    unitMap.set(lu.id, lu);
  }
  for (const ru of remoteUnits) {
    const localOverride = unitMap.get(ru.id);
    // Preserve local modifications if present
    unitMap.set(ru.id, localOverride ? { ...ru, ...localOverride } : ru);
  }

  // Associate units with buildings
  const allBuildings = Array.from(buildingMap.values()).map((b) => {
    const bUnits = Array.from(unitMap.values())
      .filter((u) => u.building_id === b.id)
      .sort((a, b) => {
        const numA = parseInt(a.unit_number.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.unit_number.replace(/\D/g, "")) || 0;
        return numA - numB;
      });
    return {
      ...b,
      units: bUnits,
    };
  });

  // 4. Update local cache with merged dataset so other pages stay in sync
  if (fetchedRemoteSuccessfully && typeof window !== "undefined") {
    try {
      const otherBuildings = localBuildings.filter((b) => b.landlord_id !== landlordId);
      setLocalData(LOCAL_STORAGE_KEY_BUILDINGS, [...allBuildings, ...otherBuildings]);

      const otherUnits = localUnits.filter((u) => u.landlord_id !== landlordId);
      const currentUnits = Array.from(unitMap.values());
      setLocalData(LOCAL_STORAGE_KEY_UNITS, [...currentUnits, ...otherUnits]);
    } catch (syncErr) {
      console.warn("Could not sync merged buildings to local storage:", syncErr);
    }
  }

  // 5. Apply assignedBuildingIds filter if specified (e.g. for managers)
  let finalBuildings = allBuildings;
  if (Array.isArray(assignedBuildingIds)) {
    finalBuildings = finalBuildings.filter((b) => assignedBuildingIds.includes(b.id));
  }

  // Sort by creation date descending
  finalBuildings.sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return finalBuildings;
}
