import { createClient } from "@/lib/supabase/client";
import { Building, Unit, CreateBuildingFormInput, UpdateUnitInput } from "@/types/database";

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
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "create_building_with_vacant_units",
        {
          p_name: input.name.trim(),
          p_address: input.address.trim(),
          p_city: input.city.trim() || null,
          p_state_region: input.state_region.trim() || null,
          p_property_type: input.property_type || "apartment",
          p_total_units: totalUnits,
          p_unit_prefix: cleanPrefix,
          p_description: input.description.trim() || null,
        }
      );

      if (!rpcError && rpcData && rpcData.success) {
        // Fetch the created building with its units
        const { data: createdBuilding } = await supabase
          .from("buildings")
          .select("*, units(*)")
          .eq("id", rpcData.building_id)
          .maybeSingle();

        if (createdBuilding) {
          return {
            success: true,
            building: createdBuilding as Building,
            units: (createdBuilding.units || []) as Unit[],
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

      // Insert building (without floor requirement)
      const { data: newBuilding, error: buildingError } = await supabase
        .from("buildings")
        .insert({
          landlord_id: landlordId,
          name: input.name.trim(),
          address: input.address.trim(),
          city: input.city.trim() || null,
          state_region: input.state_region.trim() || null,
          property_type: input.property_type || "apartment",
          total_floors: 1,
          total_units: totalUnits,
          description: input.description.trim() || null,
        })
        .select()
        .single();

      if (buildingError) {
        console.warn("Direct building insert failed, using fallback:", buildingError.message);
        throw buildingError;
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

      const { data: insertedUnits, error: unitsError } = await supabase
        .from("units")
        .insert(unitsToInsert)
        .select();

      if (unitsError) {
        console.warn("Units batch insert failed:", unitsError.message);
        throw unitsError;
      }

      return {
        success: true,
        building: { ...newBuilding, units: insertedUnits as Unit[] },
        units: insertedUnits as Unit[],
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
      property_type: input.property_type || "apartment",
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

    setLocalData(LOCAL_STORAGE_KEY_BUILDINGS, [createdBuilding, ...localBuildings]);
    setLocalData(LOCAL_STORAGE_KEY_UNITS, [...generatedUnits, ...localUnits]);

    return {
      success: true,
      building: { ...createdBuilding, units: generatedUnits },
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

  if (!isMockConfig && landlordId) {
    try {
      // 1. Try RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "update_unit_configuration",
        {
          p_unit_id: unitId,
          p_unit_number: input.unit_number?.trim() || null,
          p_rent_amount: cleanRent,
          p_parlors: cleanParlors,
          p_rooms: cleanRooms,
          p_bathrooms: cleanBathrooms,
          p_kitchens: cleanKitchens,
          p_notes: cleanNotes,
        }
      );

      if (!rpcError && rpcData?.success) {
        const { data: updatedData } = await supabase
          .from("units")
          .select("*")
          .eq("id", unitId)
          .maybeSingle();

        if (updatedData) {
          return { success: true, unit: updatedData as Unit };
        }
      }

      // 2. Direct client update fallback
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

      const { data: updatedUnit, error: updateError } = await supabase
        .from("units")
        .update(payload)
        .eq("id", unitId)
        .eq("landlord_id", landlordId)
        .select()
        .single();

      if (!updateError && updatedUnit) {
        return { success: true, unit: updatedUnit as Unit };
      }
    } catch (err) {
      console.warn("Supabase unit update failed, trying local store update:", err);
    }
  }

  // 3. Local fallback update
  try {
    const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);
    const index = localUnits.findIndex((u) => u.id === unitId);

    if (index !== -1) {
      const existing = localUnits[index];
      const updated: Unit = {
        ...existing,
        unit_number: input.unit_number?.trim() || existing.unit_number,
        rent_amount: cleanRent,
        parlors: cleanParlors,
        rooms: cleanRooms,
        bedrooms: cleanRooms,
        bathrooms: cleanBathrooms,
        kitchens: cleanKitchens,
        notes: cleanNotes,
        updated_at: new Date().toISOString(),
      };

      localUnits[index] = updated;
      setLocalData(LOCAL_STORAGE_KEY_UNITS, localUnits);

      return { success: true, unit: updated, isLocalFallback: true };
    }

    return { success: false, error: "Unit not found" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update unit";
    return { success: false, error: msg };
  }
}

/**
 * Fetch all buildings belonging to the landlord along with their units.
 */
export async function getBuildingsWithUnits(landlordId: string): Promise<Building[]> {
  if (!landlordId) return [];

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      const { data, error } = await supabase
        .from("buildings")
        .select("*, units(*)")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Sort units inside buildings by created_at or unit_number
        return (data as Building[]).map((b) => ({
          ...b,
          units: (b.units || []).sort((a, b) => {
            const numA = parseInt(a.unit_number.replace(/\D/g, "")) || 0;
            const numB = parseInt(b.unit_number.replace(/\D/g, "")) || 0;
            return numA - numB;
          }),
        }));
      }
    } catch (err) {
      console.warn("Could not fetch buildings from Supabase, checking local fallback:", err);
    }
  }

  // Fallback to local storage
  const localBuildings = getLocalData<Building>(LOCAL_STORAGE_KEY_BUILDINGS);
  const localUnits = getLocalData<Unit>(LOCAL_STORAGE_KEY_UNITS);

  return localBuildings
    .filter((b) => b.landlord_id === landlordId)
    .map((b) => ({
      ...b,
      units: localUnits
        .filter((u) => u.building_id === b.id)
        .sort((a, b) => {
          const numA = parseInt(a.unit_number.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.unit_number.replace(/\D/g, "")) || 0;
          return numA - numB;
        }),
    }));
}
