import { createClient } from "@/lib/supabase/client";
import {
  AdminStats,
  AdminLandlordSummary,
  AdminManagerSummary,
  AdminTenantSummary,
  AdminActivityEvent,
  AdminGlobalTransaction,
  LandlordProfile,
  Building,
  Unit,
  RentPayment,
  MaintenanceRequest,
  SubscriptionPlanId,
  AVAILABLE_PLANS,
  resolvePlanConfig,
} from "@/types/database";

const LOCAL_STORAGE_PROFILES_KEY = "leaselink_mock_profiles";
const LOCAL_STORAGE_BUILDINGS_KEY = "leaselink_mock_buildings";
const LOCAL_STORAGE_PAYMENTS_KEY = "leaselink_mock_payments";
const LOCAL_STORAGE_MAINTENANCE_KEY = "leaselink_mock_maintenance";
const LOCAL_STORAGE_MANAGERS_KEY = "leaselink_mock_managers";

/**
 * Fetch all platform-wide metrics and aggregates for the Administrator Dashboard
 */
export async function getAdminPlatformStats(): Promise<AdminStats> {
  const supabase = createClient();

  try {
    // 1. Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, role, plan");

    // 2. Fetch buildings
    const { data: buildingsData } = await supabase
      .from("buildings")
      .select("id, landlord_id, total_units");

    // 3. Fetch units
    const { data: unitsData } = await supabase
      .from("units")
      .select("id, status, tenant_name");

    // 4. Fetch rent payments
    const { data: paymentsData } = await supabase
      .from("rent_payments")
      .select("id, amount_paid, payment_method");

    // 5. Fetch maintenance requests
    const { data: maintenanceData } = await supabase
      .from("maintenance_requests")
      .select("id, status, urgency");

    let profiles = (profilesData || []) as any[];
    let buildings = (buildingsData || []) as any[];
    let units = (unitsData || []) as any[];
    let payments = (paymentsData || []) as any[];
    let maintenance = (maintenanceData || []) as any[];

    // Fallback to local storage if in sandbox/offline mode
    if (typeof window !== "undefined") {
      if (profiles.length === 0) {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
          if (raw) profiles = JSON.parse(raw);
        } catch (_) {}
      }
      if (buildings.length === 0) {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_BUILDINGS_KEY);
          if (raw) buildings = JSON.parse(raw);
        } catch (_) {}
      }
      if (payments.length === 0) {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_PAYMENTS_KEY);
          if (raw) payments = JSON.parse(raw);
        } catch (_) {}
      }
      if (maintenance.length === 0) {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_MAINTENANCE_KEY);
          if (raw) maintenance = JSON.parse(raw);
        } catch (_) {}
      }
    }

    const landlords = profiles.filter(
      (p) => !p.role || p.role === "landlord"
    );
    const managers = profiles.filter((p) => p.role === "manager");

    const totalBuildings = buildings.length;
    let totalUnits = units.length;
    let occupiedUnits = 0;

    if (units.length > 0) {
      occupiedUnits = units.filter(
        (u) => u.status === "occupied" || Boolean(u.tenant_name?.trim())
      ).length;
    } else {
      // If units table is empty, calculate from buildings.total_units
      totalUnits = buildings.reduce(
        (sum, b) => sum + (b.total_units || 0),
        0
      );
      occupiedUnits = Math.round(totalUnits * 0.7); // estimated for display
    }

    const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
    const occupancyRate =
      totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    // Payments calculations
    let totalVolumeXaf = 0;
    let cashVolumeXaf = 0;
    let digitalVolumeXaf = 0;

    payments.forEach((p) => {
      const amt = Number(p.amount_paid || 0);
      totalVolumeXaf += amt;
      if (p.payment_method === "cash") {
        cashVolumeXaf += amt;
      } else {
        digitalVolumeXaf += amt;
      }
    });

    // Maintenance calculations
    const totalMaintenance = maintenance.length;
    const pendingMaintenance = maintenance.filter(
      (m) => m.status === "pending"
    ).length;
    const emergencyMaintenance = maintenance.filter(
      (m) => m.urgency === "emergency" && m.status !== "resolved"
    ).length;

    // Subscription plan distribution
    const planDistribution: Record<string, number> = {
      free: 0,
      tier_1_30: 0,
      tier_31_60: 0,
      tier_61_100: 0,
      tier_100_plus: 0,
    };

    landlords.forEach((l) => {
      const cfg = resolvePlanConfig(l.plan);
      planDistribution[cfg.id] = (planDistribution[cfg.id] || 0) + 1;
    });

    return {
      total_landlords: landlords.length,
      total_managers: managers.length,
      total_tenants: occupiedUnits,
      total_buildings: totalBuildings,
      total_units: totalUnits,
      occupied_units: occupiedUnits,
      vacant_units: vacantUnits,
      occupancy_rate: occupancyRate,
      total_volume_xaf: totalVolumeXaf,
      total_payments_count: payments.length,
      total_maintenance_requests: totalMaintenance,
      pending_maintenance_requests: pendingMaintenance,
      emergency_maintenance_requests: emergencyMaintenance,
      plan_distribution: planDistribution,
      cash_volume_xaf: cashVolumeXaf,
      digital_volume_xaf: digitalVolumeXaf,
    };
  } catch (err) {
    console.error("Error fetching admin platform stats:", err);
    return {
      total_landlords: 0,
      total_managers: 0,
      total_tenants: 0,
      total_buildings: 0,
      total_units: 0,
      occupied_units: 0,
      vacant_units: 0,
      occupancy_rate: 0,
      total_volume_xaf: 0,
      total_payments_count: 0,
      total_maintenance_requests: 0,
      pending_maintenance_requests: 0,
      emergency_maintenance_requests: 0,
      plan_distribution: { free: 0, tier_1_30: 0, tier_31_60: 0, tier_61_100: 0, tier_100_plus: 0 },
      cash_volume_xaf: 0,
      digital_volume_xaf: 0,
    };
  }
}

/**
 * Fetch all registered landlords with their portfolio summary
 */
export async function getAdminLandlords(): Promise<AdminLandlordSummary[]> {
  const supabase = createClient();

  try {
    // 1. Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .neq("role", "manager")
      .order("created_at", { ascending: false });

    // 2. Fetch all buildings with units
    const { data: buildingsData } = await supabase
      .from("buildings")
      .select("id, landlord_id, total_units, units ( id, status, tenant_name )");

    // 3. Fetch all manager profiles
    const { data: managersData } = await supabase
      .from("profiles")
      .select("id, landlord_id")
      .eq("role", "manager");

    // 4. Fetch payments
    const { data: paymentsData } = await supabase
      .from("rent_payments")
      .select("id, landlord_id, amount_paid");

    let profiles = (profilesData || []) as LandlordProfile[];
    let buildings = (buildingsData || []) as any[];
    let managers = (managersData || []) as any[];
    let payments = (paymentsData || []) as any[];

    // Fallback to local storage if needed
    if (typeof window !== "undefined" && profiles.length === 0) {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          profiles = parsed.filter((p: any) => p.role !== "manager");
        }
      } catch (_) {}
    }

    const summaries: AdminLandlordSummary[] = profiles.map((p) => {
      const landlordBuildings = buildings.filter(
        (b) => b.landlord_id === p.id
      );
      const buildingsCount = landlordBuildings.length;

      let unitsCount = 0;
      let occupiedUnitsCount = 0;

      landlordBuildings.forEach((b) => {
        const bUnits = b.units || [];
        if (bUnits.length > 0) {
          unitsCount += bUnits.length;
          occupiedUnitsCount += bUnits.filter(
            (u: any) => u.status === "occupied" || Boolean(u.tenant_name?.trim())
          ).length;
        } else {
          unitsCount += b.total_units || 0;
        }
      });

      const managersCount = managers.filter(
        (m) => m.landlord_id === p.id
      ).length;

      const landlordPayments = payments.filter((pm) => pm.landlord_id === p.id);
      const totalRevenueCollected = landlordPayments.reduce(
        (sum, pm) => sum + Number(pm.amount_paid || 0),
        0
      );

      return {
        id: p.id,
        full_name: p.full_name || "Bailleur Indépendant",
        email: p.email || "N/A",
        phone: p.phone || "N/A",
        role: p.role,
        plan: p.plan || "free",
        plan_name: p.plan_name || "Free Trial",
        plan_status: p.plan_status || "active",
        plan_unit_limit: p.plan_unit_limit || 5,
        buildings_count: buildingsCount,
        units_count: unitsCount,
        occupied_units_count: occupiedUnitsCount,
        managers_count: managersCount,
        total_revenue_collected_xaf: totalRevenueCollected,
        created_at: p.created_at || new Date().toISOString(),
      };
    });

    return summaries;
  } catch (err) {
    console.error("Error fetching admin landlords:", err);
    return [];
  }
}

/**
 * Fetch all platform-wide rent transactions with enriched property & tenant info
 */
export async function getAdminGlobalTransactions(): Promise<AdminGlobalTransaction[]> {
  const supabase = createClient();

  try {
    const { data: paymentsData } = await supabase
      .from("rent_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    let payments = (paymentsData || []) as any[];

    if (typeof window !== "undefined" && payments.length === 0) {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_PAYMENTS_KEY);
        if (raw) payments = JSON.parse(raw);
      } catch (_) {}
    }

    const transactions: AdminGlobalTransaction[] = payments.map((p) => ({
      id: p.id,
      receipt_number: p.receipt_number || `REC-${p.id.slice(0, 8)}`,
      amount_paid: Number(p.amount_paid || 0),
      rent_month: p.rent_month || "Mois en cours",
      payment_method: p.payment_method || "cash",
      tenant_name: p.tenant_name || "Locataire",
      tenant_phone: p.tenant_phone || "Non renseigné",
      building_name: p.building_name || "Résidence",
      unit_number: p.unit_number || "Lot",
      landlord_name: p.landlord_name || "Bailleur Propriétaire",
      landlord_id: p.landlord_id || "N/A",
      created_at: p.created_at || new Date().toISOString(),
      notes: p.notes,
      months_covered: p.months_covered,
    }));

    return transactions;
  } catch (err) {
    console.error("Error fetching admin transactions:", err);
    return [];
  }
}

/**
 * Fetch all platform maintenance requests across all properties
 */
export async function getAdminAllMaintenance(): Promise<MaintenanceRequest[]> {
  const supabase = createClient();

  try {
    const { data: maintenanceData } = await supabase
      .from("maintenance_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    let list = (maintenanceData || []) as MaintenanceRequest[];

    if (typeof window !== "undefined" && list.length === 0) {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_MAINTENANCE_KEY);
        if (raw) list = JSON.parse(raw);
      } catch (_) {}
    }

    return list;
  } catch (err) {
    console.error("Error fetching admin maintenance:", err);
    return [];
  }
}

/**
 * Generate a unified chronological activity audit trail of all platform events
 */
export async function getAdminActivityStream(): Promise<AdminActivityEvent[]> {
  try {
    const [transactions, maintenance, landlords] = await Promise.all([
      getAdminGlobalTransactions(),
      getAdminAllMaintenance(),
      getAdminLandlords(),
    ]);

    const events: AdminActivityEvent[] = [];

    // Map payments
    transactions.slice(0, 30).forEach((t) => {
      events.push({
        id: `ev-pay-${t.id}`,
        type: "payment",
        title: "Paiement de loyer enregistré",
        description: `Quittance N° ${t.receipt_number} • ${Number(
          t.amount_paid
        ).toLocaleString()} XAF encaissé pour le logement ${t.unit_number} (${
          t.building_name
        })`,
        actor_name: t.tenant_name,
        actor_role: "Locataire",
        timestamp: t.created_at,
        metadata: {
          receipt_number: t.receipt_number,
          amount: t.amount_paid,
          method: t.payment_method,
          landlord: t.landlord_name,
        },
      });
    });

    // Map maintenance
    maintenance.slice(0, 20).forEach((m) => {
      events.push({
        id: `ev-maint-${m.id}`,
        type: "maintenance",
        title: `Panne signalée : ${m.title || m.category}`,
        description: `Urgence [${m.urgency.toUpperCase()}] • ${
          m.unit_number ? `Logement ${m.unit_number}` : ""
        } (${m.building_name || "Immeuble"}) - Statut: ${m.status}`,
        actor_name: m.tenant_name || "Locataire",
        actor_role: "Locataire",
        timestamp: m.created_at,
        metadata: {
          urgency: m.urgency,
          status: m.status,
          category: m.category,
        },
      });
    });

    // Map landlord signups
    landlords.slice(0, 15).forEach((l) => {
      events.push({
        id: `ev-signup-${l.id}`,
        type: "signup",
        title: "Nouveau compte propriétaire actif",
        description: `${l.full_name} (${l.email}) a souscrit à la formule ${l.plan_name} (${l.plan_unit_limit} logements max)`,
        actor_name: l.full_name,
        actor_role: "Bailleur",
        timestamp: l.created_at,
        metadata: {
          plan: l.plan,
          email: l.email,
          phone: l.phone,
        },
      });
    });

    // Sort all events by timestamp descending
    events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    return events;
  } catch (err) {
    console.error("Error generating admin activity stream:", err);
    return [];
  }
}

/**
 * Super-Admin capability: Update a landlord's subscription tier directly
 */
export async function updateLandlordPlanAdmin(
  landlordId: string,
  planId: SubscriptionPlanId,
  durationDays: number = 30
): Promise<boolean> {
  const supabase = createClient();
  const planConfig = resolvePlanConfig(planId);
  const resolvedPlanId = planConfig.id;

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + durationDays * 24 * 60 * 60 * 1000
  );

  const billingCycle = durationDays >= 360 ? "annual" : "monthly";

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        plan: resolvedPlanId,
        plan_name: planConfig.name,
        billing_cycle: billingCycle,
        plan_unit_limit: planConfig.maxUnits,
        unit_limit: planConfig.maxUnits,
        plan_duration_days: durationDays,
        plan_status: "active",
        subscription_status: "active",
        has_used_free_trial: true,
        has_used_trial: true,
        plan_starts_at: now.toISOString(),
        plan_expires_at: expiresAt.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", landlordId);

    if (error) {
      console.warn("Supabase updateLandlordPlanAdmin error:", error);
    }

    // Insert audit record into subscriptions table
    try {
      const receiptNumber = `ADM-SUB-${now.getFullYear()}-${Math.floor(
        100000 + Math.random() * 900000
      )}`;
      await supabase.from("subscriptions").insert([
        {
          receipt_number: receiptNumber,
          landlord_id: landlordId,
          plan_id: resolvedPlanId,
          plan_name: planConfig.name,
          billing_cycle: billingCycle,
          amount_paid:
            billingCycle === "annual"
              ? planConfig.annualPrice || planConfig.monthlyPrice * 12
              : planConfig.monthlyPrice,
          payment_method: "cash",
          transaction_ref: `ADM-ALLOC-${Date.now()}`,
          duration_days: durationDays,
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: "completed",
          notes: "Admin plan assignment",
          created_at: now.toISOString(),
        },
      ]);
    } catch (_) {}

    // Also update local storage if available
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex((p: any) => p.id === landlordId);
          if (idx !== -1) {
            list[idx] = {
              ...list[idx],
              plan: resolvedPlanId,
              plan_name: planConfig.name,
              plan_unit_limit: planConfig.maxUnits,
              unit_limit: planConfig.maxUnits,
              plan_duration_days: durationDays,
              plan_status: "active",
              subscription_status: "active",
              plan_starts_at: now.toISOString(),
              plan_expires_at: expiresAt.toISOString(),
              subscription_expires_at: expiresAt.toISOString(),
            };
            localStorage.setItem(
              LOCAL_STORAGE_PROFILES_KEY,
              JSON.stringify(list)
            );
          }
        }

        // Sync cached dashboard state
        const rawDashboard = localStorage.getItem("leaselink_cached_dashboard");
        if (rawDashboard) {
          try {
            const parsedDash = JSON.parse(rawDashboard);
            if (parsedDash.profile && parsedDash.profile.id === landlordId) {
              parsedDash.profile = {
                ...parsedDash.profile,
                plan: resolvedPlanId,
                plan_name: planConfig.name,
                plan_unit_limit: planConfig.maxUnits,
                unit_limit: planConfig.maxUnits,
                plan_status: "active",
                subscription_status: "active",
                plan_starts_at: now.toISOString(),
                plan_expires_at: expiresAt.toISOString(),
                subscription_expires_at: expiresAt.toISOString(),
              };
              localStorage.setItem("leaselink_cached_dashboard", JSON.stringify(parsedDash));
            }
          } catch (_) {}
        }

        // Broadcast subscription update event
        window.dispatchEvent(
          new CustomEvent("leaselink:subscription_updated", {
            detail: {
              landlordId,
              planId: resolvedPlanId,
              planConfig,
              unitLimit: planConfig.maxUnits,
            },
          })
        );
      } catch (_) {}
    }

    return true;
  } catch (err) {
    console.error("Error updating landlord plan:", err);
    return false;
  }
}

/**
 * Fetch all managers across all landlords on the platform
 */
export async function getAdminManagers(): Promise<AdminManagerSummary[]> {
  const supabase = createClient();
  try {
    const { data: managersData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "manager")
      .order("created_at", { ascending: false });

    const { data: landlordsData } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .neq("role", "manager");

    const { data: buildingsData } = await supabase
      .from("buildings")
      .select("id, name, landlord_id");

    let managers = (managersData || []) as any[];
    let landlords = (landlordsData || []) as any[];
    let buildings = (buildingsData || []) as any[];

    if (typeof window !== "undefined") {
      try {
        const rawProfiles = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
        if (rawProfiles) {
          const parsed = JSON.parse(rawProfiles);
          if (managers.length === 0) {
            managers = parsed.filter((p: any) => p.role === "manager");
          }
          if (landlords.length === 0) {
            landlords = parsed.filter((p: any) => p.role !== "manager");
          }
        }
        // Also check manager-specific local storage keys
        const rawLocalMng1 = localStorage.getItem("leaselink_local_managers");
        const rawLocalMng2 = localStorage.getItem(LOCAL_STORAGE_MANAGERS_KEY);
        const combinedRaw = [rawLocalMng1, rawLocalMng2].filter(Boolean);
        combinedRaw.forEach((raw) => {
          try {
            const parsedLocal = JSON.parse(raw!);
            if (Array.isArray(parsedLocal)) {
              parsedLocal.forEach((lm: any) => {
                if (!managers.some((m) => m.id === lm.id)) {
                  managers.push(lm);
                }
              });
            }
          } catch (_) {}
        });

        if (buildings.length === 0) {
          const rawB = localStorage.getItem(LOCAL_STORAGE_BUILDINGS_KEY);
          if (rawB) buildings = JSON.parse(rawB);
        }
      } catch (_) {}
    }

    const landlordMap = new Map<string, string>();
    landlords.forEach((l) => landlordMap.set(l.id, l.full_name || l.email || "Bailleur"));

    const buildingMap = new Map<string, string>();
    buildings.forEach((b) => buildingMap.set(b.id, b.name || "Immeuble"));

    return managers.map((m) => {
      const assignedIds: string[] = Array.isArray(m.assigned_building_ids)
        ? m.assigned_building_ids
        : [];
      const assignedNames: string[] = assignedIds
        .map((id) => buildingMap.get(id))
        .filter(Boolean) as string[];

      const landlordName = m.landlord_id
        ? landlordMap.get(m.landlord_id) || "Bailleur assigné"
        : "Non assigné";

      return {
        id: m.id,
        full_name: m.full_name || "Gestionnaire",
        email: m.email || "N/A",
        phone: m.phone || "N/A",
        landlord_id: m.landlord_id || "",
        landlord_name: landlordName,
        assigned_building_ids: assignedIds,
        assigned_building_names: assignedNames,
        created_at: m.created_at || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error("Error fetching admin managers:", err);
    return [];
  }
}

/**
 * Fetch all registered tenants across all units on the platform
 */
export async function getAdminTenants(): Promise<AdminTenantSummary[]> {
  const supabase = createClient();
  try {
    const { data: unitsData } = await supabase
      .from("units")
      .select("id, unit_number, rent_amount, status, tenant_name, tenant_phone, tenant_email, building_id, created_at")
      .order("created_at", { ascending: false });

    const { data: buildingsData } = await supabase
      .from("buildings")
      .select("id, name, landlord_id");

    const { data: landlordsData } = await supabase
      .from("profiles")
      .select("id, full_name, email");

    let units = (unitsData || []) as any[];
    let buildings = (buildingsData || []) as any[];
    let landlords = (landlordsData || []) as any[];

    if (typeof window !== "undefined") {
      try {
        if (buildings.length === 0) {
          const rawB = localStorage.getItem(LOCAL_STORAGE_BUILDINGS_KEY);
          if (rawB) buildings = JSON.parse(rawB);
        }
        if (units.length === 0) {
          const embeddedUnits: any[] = [];
          buildings.forEach((b: any) => {
            if (Array.isArray(b.units)) {
              b.units.forEach((u: any) => {
                embeddedUnits.push({ ...u, building_id: u.building_id || b.id });
              });
            }
          });
          const rawUnits = localStorage.getItem("leaselink_mock_units");
          if (rawUnits) {
            try {
              const parsedU = JSON.parse(rawUnits);
              if (Array.isArray(parsedU)) {
                parsedU.forEach((pu: any) => {
                  if (!embeddedUnits.some((eu) => eu.id === pu.id)) {
                    embeddedUnits.push(pu);
                  }
                });
              }
            } catch (_) {}
          }
          if (embeddedUnits.length > 0) units = embeddedUnits;
        }
        if (landlords.length === 0) {
          const rawP = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
          if (rawP) landlords = JSON.parse(rawP);
        }
      } catch (_) {}
    }

    const buildingMap = new Map<string, { name: string; landlord_id: string }>();
    buildings.forEach((b) =>
      buildingMap.set(b.id, {
        name: b.name || "Immeuble",
        landlord_id: b.landlord_id || "",
      })
    );

    const landlordMap = new Map<string, string>();
    landlords.forEach((l) => landlordMap.set(l.id, l.full_name || l.email || "Bailleur"));

    // Filter units that have a tenant or are occupied
    const activeUnits = units.filter(
      (u) => Boolean(u.tenant_name?.trim()) || u.status === "occupied"
    );

    return activeUnits.map((u) => {
      const bInfo = buildingMap.get(u.building_id) || {
        name: "Immeuble non spécifié",
        landlord_id: "",
      };
      const landlordName = bInfo.landlord_id
        ? landlordMap.get(bInfo.landlord_id) || "Bailleur Propriétaire"
        : "Non spécifié";

      return {
        id: u.id,
        tenant_name: u.tenant_name?.trim() || "Locataire Occupant",
        tenant_phone: u.tenant_phone?.trim() || "Non renseigné",
        tenant_email: u.tenant_email?.trim() || "Non renseigné",
        building_id: u.building_id || "",
        building_name: bInfo.name,
        unit_id: u.id,
        unit_number: u.unit_number || "Lot",
        rent_amount: Number(u.rent_amount || 0),
        landlord_id: bInfo.landlord_id,
        landlord_name: landlordName,
        status: u.status || "occupied",
        created_at: u.created_at || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error("Error fetching admin tenants:", err);
    return [];
  }
}

