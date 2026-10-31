import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Building, PropertyType, Unit, resolvePlanConfig } from "@/types/database";

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

/**
 * Inserts vacant units for a building using progressive schema tiers so that
 * older or partially-migrated `public.units` schemas still succeed cleanly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertUnitsResilient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  buildingId: string,
  landlordId: string,
  totalUnits: number,
  unitPrefix: string
): Promise<{ units: Unit[] | null; error: string | null }> {
  const count = Math.max(1, Number(totalUnits) || 1);
  const prefix = (unitPrefix || "Unit").trim() || "Unit";

  const tier1 = [];
  const tier2 = [];
  const tier3 = [];
  const tier4 = [];

  for (let i = 1; i <= count; i++) {
    const unitNumber = `${prefix} ${i}`;
    tier1.push({
      building_id: buildingId,
      landlord_id: landlordId,
      unit_number: unitNumber,
      status: "vacant",
      rent_amount: 0,
      deposit_amount: 0,
      rent_due_day: 5,
      parlors: 0,
      rooms: 0,
      bedrooms: 0,
      bathrooms: 0,
      kitchens: 0,
    });
    tier2.push({
      building_id: buildingId,
      landlord_id: landlordId,
      unit_number: unitNumber,
      status: "vacant",
      rent_amount: 0,
      parlors: 0,
      rooms: 0,
      bedrooms: 0,
      bathrooms: 0,
      kitchens: 0,
    });
    tier3.push({
      building_id: buildingId,
      landlord_id: landlordId,
      unit_number: unitNumber,
      status: "vacant",
      rent_amount: 0,
      floor: 1,
    });
    tier4.push({
      building_id: buildingId,
      unit_number: unitNumber,
      status: "vacant",
      rent_amount: 0,
    });
  }

  let lastError = "Failed to insert units";
  for (const payload of [tier1, tier2, tier3, tier4]) {
    const { data, error } = await db.from("units").insert(payload).select("*");
    if (!error && Array.isArray(data) && data.length > 0) {
      return { units: data as Unit[], error: null };
    }
    if (error?.message) {
      lastError = error.message;
    }
  }

  return { units: null, error: lastError };
}

function sortUnitsNumeric(units: Unit[]): Unit[] {
  return [...units].sort((a, b) => {
    const numA = parseInt((a.unit_number || "").replace(/\D/g, ""), 10) || 0;
    const numB = parseInt((b.unit_number || "").replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });
}

export async function GET(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authErr,
    } = await serverSupabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedLandlordId = searchParams.get("landlordId") || user.id;

    const adminClient = getAdminClient();
    const db = adminClient || serverSupabase;

    // Authorization check when accessing another landlord's portfolio (manager or admin)
    let assignedBuildingIds: string[] | null = null;
    if (requestedLandlordId !== user.id) {
      const { data: callerProfile } = await db
        .from("profiles")
        .select("role, landlord_id, assigned_building_ids")
        .eq("id", user.id)
        .maybeSingle();

      const isAdmin =
        callerProfile?.role === "admin" || user.user_metadata?.role === "admin";
      const isAuthorizedManager =
        callerProfile?.role === "manager" &&
        callerProfile?.landlord_id === requestedLandlordId;

      if (!isAdmin && !isAuthorizedManager) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }

      if (isAuthorizedManager && Array.isArray(callerProfile?.assigned_building_ids)) {
        assignedBuildingIds = callerProfile.assigned_building_ids;
      }
    }

    if (Array.isArray(assignedBuildingIds) && assignedBuildingIds.length === 0) {
      return NextResponse.json(
        { success: true, buildings: [] },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    const { data: bData, error: bError } = await db
      .from("buildings")
      .select("*")
      .eq("landlord_id", requestedLandlordId)
      .order("created_at", { ascending: false });

    if (bError) {
      return NextResponse.json(
        { success: false, error: bError.message },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    let buildingsList = (bData || []) as Building[];
    const buildingIds = buildingsList.map((b) => b.id);

    let unitsList: Unit[] = [];
    if (buildingIds.length > 0) {
      const { data: uByBuilding, error: uErr } = await db
        .from("units")
        .select("*")
        .in("building_id", buildingIds);

      if (!uErr && uByBuilding) {
        unitsList = uByBuilding as Unit[];
      } else {
        const { data: uByLandlord } = await db
          .from("units")
          .select("*")
          .eq("landlord_id", requestedLandlordId);
        if (uByLandlord) {
          unitsList = uByLandlord as Unit[];
        }
      }
    }

    // Group units by building_id
    const unitsByBuilding = new Map<string, Unit[]>();
    for (const u of unitsList) {
      const list = unitsByBuilding.get(u.building_id) || [];
      list.push(u);
      unitsByBuilding.set(u.building_id, list);
    }

    // Self-heal any partial/orphan 0-unit buildings from earlier interrupted creations
    const orphanIdsToRemove = new Set<string>();
    for (const b of buildingsList) {
      const bUnits = unitsByBuilding.get(b.id) || [];
      const expectedUnits = Math.max(0, Number(b.total_units) || 0);
      if (bUnits.length === 0 && expectedUnits > 0) {
        const normName = (b.name || "").trim().toLowerCase();
        const normAddr = (b.address || "").trim().toLowerCase();

        // Check if another building with the exact same name & address already has units
        const siblingWithUnits = buildingsList.find(
          (other) =>
            other.id !== b.id &&
            (other.name || "").trim().toLowerCase() === normName &&
            (other.address || "").trim().toLowerCase() === normAddr &&
            (unitsByBuilding.get(other.id)?.length || 0) > 0
        );

        if (siblingWithUnits) {
          // Delete duplicate 0-unit orphan row
          await db.from("buildings").delete().eq("id", b.id);
          orphanIdsToRemove.add(b.id);
        } else {
          // Repair the single building by provisioning its missing vacant units
          const repaired = await insertUnitsResilient(
            db,
            b.id,
            requestedLandlordId,
            expectedUnits,
            "Unit"
          );
          if (repaired.units && repaired.units.length > 0) {
            unitsByBuilding.set(b.id, repaired.units);
          }
        }
      }
    }

    if (orphanIdsToRemove.size > 0) {
      buildingsList = buildingsList.filter((b) => !orphanIdsToRemove.has(b.id));
    }

    let hydrated: Building[] = buildingsList.map((b) => ({
      ...b,
      units: sortUnitsNumeric(unitsByBuilding.get(b.id) || []),
    }));

    if (Array.isArray(assignedBuildingIds)) {
      hydrated = hydrated.filter((b) => assignedBuildingIds!.includes(b.id));
    }

    return NextResponse.json(
      { success: true, buildings: hydrated },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch buildings";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authErr,
    } = await serverSupabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in again." },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestedLandlordId =
      typeof body.landlordId === "string" && body.landlordId.trim()
        ? body.landlordId.trim()
        : user.id;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const city =
      typeof body.city === "string" && body.city.trim() ? body.city.trim() : null;
    const stateRegion =
      typeof body.state_region === "string" && body.state_region.trim()
        ? body.state_region.trim()
        : null;
    const propertyType: PropertyType = body.property_type || "commercial";
    const totalUnits = Math.max(1, Number(body.total_units) || 1);
    const unitPrefix =
      typeof body.unit_prefix === "string" && body.unit_prefix.trim()
        ? body.unit_prefix.trim()
        : "Unit";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    if (!name || !address) {
      return NextResponse.json(
        { success: false, error: "Building name and address are required." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const adminClient = getAdminClient();
    const db = adminClient || serverSupabase;

    // 1. Verify caller permissions & resolve landlord plan quota
    let isAdmin = user.user_metadata?.role === "admin";
    if (requestedLandlordId !== user.id) {
      const { data: callerProfile } = await db
        .from("profiles")
        .select("role, landlord_id")
        .eq("id", user.id)
        .maybeSingle();

      if (callerProfile?.role === "admin") isAdmin = true;
      const isManager =
        callerProfile?.role === "manager" &&
        callerProfile?.landlord_id === requestedLandlordId;

      if (!isAdmin && !isManager) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
    }

    const { data: landlordProfile } = await db
      .from("profiles")
      .select("role, plan, plan_unit_limit, unit_limit")
      .eq("id", requestedLandlordId)
      .maybeSingle();

    if (landlordProfile?.role === "admin") {
      isAdmin = true;
    }

    const fallbackPlan = resolvePlanConfig(
      landlordProfile?.plan || (user.user_metadata?.plan as string | undefined)
    );
    const planUnitLimit = Number(
      landlordProfile?.plan_unit_limit ||
        landlordProfile?.unit_limit ||
        body.planUnitLimit ||
        fallbackPlan.maxUnits
    );

    // 2. Idempotency Guard: prevent duplicate creation if an identical request arrived within the last 15s
    const { data: existingBuildings } = await db
      .from("buildings")
      .select("*")
      .eq("landlord_id", requestedLandlordId)
      .order("created_at", { ascending: false });

    const nowMs = Date.now();
    const recentDuplicate = (existingBuildings || []).find((b: Building) => {
      const createdMs = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (
        nowMs - createdMs >= 0 &&
        nowMs - createdMs < 15000 &&
        (b.name || "").trim().toLowerCase() === name.toLowerCase() &&
        (b.address || "").trim().toLowerCase() === address.toLowerCase() &&
        Number(b.total_units) === totalUnits
      );
    });

    if (recentDuplicate) {
      const { data: dupUnits } = await db
        .from("units")
        .select("*")
        .eq("building_id", recentDuplicate.id);

      let finalUnits = (dupUnits || []) as Unit[];
      if (finalUnits.length === 0) {
        const repaired = await insertUnitsResilient(
          db,
          recentDuplicate.id,
          requestedLandlordId,
          totalUnits,
          unitPrefix
        );
        finalUnits = repaired.units || [];
      }

      const sorted = sortUnitsNumeric(finalUnits);
      return NextResponse.json(
        {
          success: true,
          building: { ...(recentDuplicate as Building), units: sorted },
          units: sorted,
          deduplicated: true,
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    // 3. Enforce subscription unit quota
    if (!isAdmin) {
      const existingBuildingIds = (existingBuildings || []).map(
        (b: Building) => b.id
      );
      let existingUnitsCount = 0;
      if (existingBuildingIds.length > 0) {
        const { count } = await db
          .from("units")
          .select("id", { count: "exact", head: true })
          .in("building_id", existingBuildingIds);
        existingUnitsCount = count || 0;
      }

      if (existingUnitsCount + totalUnits > planUnitLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Plan capacity reached! Your plan allows up to ${planUnitLimit} units and you already have ${existingUnitsCount} unit(s).`,
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
    }

    // 4. Insert building (full schema payload with base-column fallback)
    let createdBuilding: Building | null = null;
    let buildingInsertError = "";

    const fullBuildingPayload = {
      landlord_id: requestedLandlordId,
      name,
      address,
      city,
      state_region: stateRegion,
      property_type: propertyType,
      total_floors: 1,
      total_units: totalUnits,
      description,
    };

    const resFull = await db
      .from("buildings")
      .insert(fullBuildingPayload)
      .select("*")
      .single();

    if (!resFull.error && resFull.data) {
      createdBuilding = resFull.data as Building;
    } else {
      buildingInsertError = resFull.error?.message || "Failed to insert building";
      // Retry with safe property_type ('commercial') or base columns if a legacy check constraint rejected property_type
      const baseBuildingPayload = {
        landlord_id: requestedLandlordId,
        name,
        address,
        total_units: totalUnits,
        property_type:
          buildingInsertError.includes("property_type") ||
          buildingInsertError.includes("check")
            ? "commercial"
            : propertyType,
      };
      const resBase = await db
        .from("buildings")
        .insert(baseBuildingPayload)
        .select("*")
        .single();

      if (!resBase.error && resBase.data) {
        createdBuilding = resBase.data as Building;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: resBase.error?.message || buildingInsertError,
          },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }
    }

    // 5. Insert vacant units atomically — ROLL BACK building if unit creation fails!
    const unitsResult = await insertUnitsResilient(
      db,
      createdBuilding.id,
      requestedLandlordId,
      totalUnits,
      unitPrefix
    );

    if (!unitsResult.units || unitsResult.units.length === 0) {
      // Atomic cleanup: never leave a 0-unit orphan building in the database
      await db.from("buildings").delete().eq("id", createdBuilding.id);
      return NextResponse.json(
        {
          success: false,
          error:
            unitsResult.error ||
            "Failed to generate vacant units for the building. Changes were rolled back.",
        },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const sortedUnits = sortUnitsNumeric(unitsResult.units);
    const hydratedBuilding: Building = {
      ...createdBuilding,
      units: sortedUnits,
    };

    return NextResponse.json(
      {
        success: true,
        building: hydratedBuilding,
        units: sortedUnits,
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create building";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

