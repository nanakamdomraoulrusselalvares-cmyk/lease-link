import { createClient } from "@/lib/supabase/client";
import {
  MaintenanceRequest,
  CreateMaintenanceInput,
  UpdateMaintenanceStatusInput,
  MaintenanceCategory,
  MaintenanceUrgency,
  MaintenanceStatus,
} from "@/types/database";
import { formatWhatsAppPhoneNumber } from "./tenantService";

const LOCAL_STORAGE_KEY_MAINTENANCE = "leaselink_local_maintenance_requests";

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

export const CATEGORY_LABELS: Record<MaintenanceCategory, { label: string; icon: string; fr: string }> = {
  plumbing: { label: "Plumbing", icon: "Droplets", fr: "Plomberie & Fuites" },
  electrical: { label: "Electrical", icon: "Zap", fr: "Électricité & Éclairage" },
  structural: { label: "Structural & Walls", icon: "Home", fr: "Structure & Murs" },
  appliances: { label: "Appliances & AC", icon: "Cpu", fr: "Équipements & Climatisation" },
  carpentry_locks: { label: "Doors & Locks", icon: "Key", fr: "Portes, Serrures & Menuiserie" },
  other: { label: "Other Issue", icon: "AlertCircle", fr: "Autre Réparation" },
};

export const URGENCY_LABELS: Record<
  MaintenanceUrgency,
  { label: string; badgeClass: string; icon: string; fr: string }
> = {
  low: {
    label: "Low (Convenience)",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: "Info",
    fr: "Faible (Amélioration)",
  },
  medium: {
    label: "Medium (Standard)",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: "AlertTriangle",
    fr: "Moyen (Standard)",
  },
  high: {
    label: "High (Urgent)",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    icon: "Flame",
    fr: "Élevé (Urgent)",
  },
  emergency: {
    label: "Emergency (Immediate Hazard)",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse",
    icon: "AlertOctagon",
    fr: "Urgence Critique (Danger)",
  },
};

export const STATUS_LABELS: Record<
  MaintenanceStatus,
  { label: string; badgeClass: string; fr: string }
> = {
  pending: {
    label: "Pending Review",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    fr: "En attente d'examen",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    fr: "Intervention en cours",
  },
  resolved: {
    label: "Resolved",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    fr: "Problème résolu",
  },
  rejected: {
    label: "Rejected / Closed",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    fr: "Non retenu / Fermé",
  },
};

/**
 * Submit a maintenance request with photos, video, or voice message.
 */
export async function submitMaintenanceRequest(
  input: CreateMaintenanceInput
): Promise<{ success: boolean; request?: MaintenanceRequest; error?: string }> {
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  const requestId = "mnt_" + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();

  const newRequest: MaintenanceRequest = {
    id: requestId,
    unit_id: input.unit_id,
    building_id: input.building_id,
    landlord_id: input.landlord_id,
    tenant_name: input.tenant_name.trim(),
    tenant_phone: input.tenant_phone.trim(),
    tenant_email: input.tenant_email?.trim() || null,
    unit_number: input.unit_number.trim(),
    building_name: input.building_name.trim(),
    category: input.category,
    urgency: input.urgency,
    title: input.title.trim(),
    description: input.description.trim(),
    status: "pending",
    photo_url: input.photo_url || null,
    video_url: input.video_url || null,
    voice_url: input.voice_url || null,
    voice_duration_seconds: input.voice_duration_seconds || null,
    landlord_notes: null,
    created_at: now,
    updated_at: now,
  };

  if (!isMockConfig) {
    try {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .insert({
          unit_id: newRequest.unit_id,
          building_id: newRequest.building_id,
          landlord_id: newRequest.landlord_id,
          tenant_name: newRequest.tenant_name,
          tenant_phone: newRequest.tenant_phone,
          tenant_email: newRequest.tenant_email,
          unit_number: newRequest.unit_number,
          building_name: newRequest.building_name,
          category: newRequest.category,
          urgency: newRequest.urgency,
          title: newRequest.title,
          description: newRequest.description,
          status: newRequest.status,
          photo_url: newRequest.photo_url,
          video_url: newRequest.video_url,
          voice_url: newRequest.voice_url,
          voice_duration_seconds: newRequest.voice_duration_seconds,
        })
        .select()
        .single();

      if (!error && data) {
        const savedRequest = data as MaintenanceRequest;
        // Also sync local storage
        const localList = getLocalData<MaintenanceRequest>(LOCAL_STORAGE_KEY_MAINTENANCE);
        setLocalData(LOCAL_STORAGE_KEY_MAINTENANCE, [savedRequest, ...localList]);
        return { success: true, request: savedRequest };
      }
    } catch (err) {
      console.warn("Supabase maintenance insert failed, using local store:", err);
    }
  }

  // Local fallback
  const localList = getLocalData<MaintenanceRequest>(LOCAL_STORAGE_KEY_MAINTENANCE);
  setLocalData(LOCAL_STORAGE_KEY_MAINTENANCE, [newRequest, ...localList]);
  return { success: true, request: newRequest };
}

/**
 * Retrieve maintenance requests for a specific unit (tenant portal view).
 */
export async function getMaintenanceRequestsForUnit(
  unitId: string
): Promise<MaintenanceRequest[]> {
  if (!unitId) return [];

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");
  const localList = getLocalData<MaintenanceRequest>(LOCAL_STORAGE_KEY_MAINTENANCE);

  if (!isMockConfig) {
    try {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Merge Supabase data with local entries for smooth offline resilience
        const remoteIds = new Set(data.map((r: MaintenanceRequest) => r.id));
        const localOnly = localList.filter((r) => r.unit_id === unitId && !remoteIds.has(r.id));
        return [...data, ...localOnly].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    } catch (err) {
      console.warn("Could not fetch remote maintenance requests:", err);
    }
  }

  return localList
    .filter((r) => r.unit_id === unitId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

const LOCAL_STORAGE_KEY_BUILDINGS = "leaselink_buildings";
const LOCAL_STORAGE_KEY_UNITS = "leaselink_units";

/**
 * Retrieve maintenance requests for a landlord (landlord dashboard view).
 * Highly resilient: matches by landlord_id, owned building IDs, owned unit IDs, or property names,
 * and seamlessly unifies Supabase remote records with local offline storage.
 */
export async function getMaintenanceRequestsForLandlord(
  landlordId: string,
  assignedBuildingIds?: string[] | null
): Promise<MaintenanceRequest[]> {
  if (!landlordId) return [];

  // If restricted to an empty list of buildings, return empty immediately
  if (Array.isArray(assignedBuildingIds) && assignedBuildingIds.length === 0) {
    return [];
  }
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");
  const localList = getLocalData<MaintenanceRequest>(LOCAL_STORAGE_KEY_MAINTENANCE);
  const b1 = getLocalData<{ id: string; landlord_id: string; name: string }>("leaselink_local_buildings");
  const b2 = getLocalData<{ id: string; landlord_id: string; name: string }>("leaselink_buildings");
  const localBuildings = [...b1, ...b2.filter((x) => !b1.some((y) => y.id === x.id))];

  const u1 = getLocalData<{ id: string; landlord_id: string; building_id: string }>("leaselink_local_units");
  const u2 = getLocalData<{ id: string; landlord_id: string; building_id: string }>("leaselink_units");
  const localUnits = [...u1, ...u2.filter((x) => !u1.some((y) => y.id === x.id))];

  // Collect building IDs, unit IDs, and building names associated with this landlord
  const myBuildingIds = new Set(
    localBuildings.filter((b) => !landlordId || b.landlord_id === landlordId).map((b) => b.id)
  );
  const myUnitIds = new Set(
    localUnits
      .filter((u) => !landlordId || u.landlord_id === landlordId || myBuildingIds.has(u.building_id))
      .map((u) => u.id)
  );
  const myBuildingNames = new Set(
    localBuildings
      .filter((b) => !landlordId || b.landlord_id === landlordId)
      .map((b) => b.name?.trim().toLowerCase())
      .filter(Boolean)
  );

  let remoteData: MaintenanceRequest[] = [];

  if (!isMockConfig && landlordId) {
    try {
      // Fetch ONLY maintenance requests belonging to this specific landlord
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteData = data as MaintenanceRequest[];
      }
    } catch (err) {
      console.warn("Could not fetch remote landlord maintenance requests:", err);
    }
  }

  // Filter remote items strictly by landlord ownership
  const matchedRemote = remoteData.filter((r) => {
    if (!landlordId) return false;
    return (
      r.landlord_id === landlordId ||
      (r.building_id && myBuildingIds.has(r.building_id)) ||
      (r.unit_id && myUnitIds.has(r.unit_id))
    );
  });

  const remoteIds = new Set(matchedRemote.map((r) => r.id));

  // Filter local items strictly by landlord ownership
  const matchedLocal = localList.filter((r) => {
    if (remoteIds.has(r.id)) return false;
    if (!landlordId) return false;
    return (
      r.landlord_id === landlordId ||
      (r.building_id && myBuildingIds.has(r.building_id)) ||
      (r.unit_id && myUnitIds.has(r.unit_id))
    );
  });

  const combined = [...matchedRemote, ...matchedLocal];

  // Also sync the local cache with matched remote items so offline mode has them
  if (matchedRemote.length > 0) {
    try {
      const existingLocalMap = new Map(localList.map((m) => [m.id, m]));
      let hasNew = false;
      matchedRemote.forEach((r) => {
        if (!existingLocalMap.has(r.id)) {
          existingLocalMap.set(r.id, r);
          hasNew = true;
        }
      });
      if (hasNew) {
        setLocalData(LOCAL_STORAGE_KEY_MAINTENANCE, Array.from(existingLocalMap.values()));
      }
    } catch {
      // Ignore cache sync error
    }
  }

  let filtered = combined;
  if (Array.isArray(assignedBuildingIds)) {
    const assignedSet = new Set(assignedBuildingIds);
    filtered = combined.filter((r) => {
      if (r.building_id && assignedSet.has(r.building_id)) return true;
      if (r.unit_id) {
        const matchingUnit = localUnits.find((u) => u.id === r.unit_id);
        if (matchingUnit && matchingUnit.building_id && assignedSet.has(matchingUnit.building_id)) {
          return true;
        }
      }
      return false;
    });
  }

  return filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Helper to sync local maintenance store
 */
function syncLocalMaintenanceStatus(
  requestId: string,
  newStatus: MaintenanceStatus,
  notes?: string | null,
  updatedAt: string = new Date().toISOString()
) {
  try {
    const localList = getLocalData<MaintenanceRequest>(LOCAL_STORAGE_KEY_MAINTENANCE);
    const idx = localList.findIndex((r) => r.id === requestId);
    if (idx !== -1) {
      localList[idx] = {
        ...localList[idx],
        status: newStatus,
        ...(notes !== undefined ? { landlord_notes: notes } : {}),
        updated_at: updatedAt,
      };
      setLocalData(LOCAL_STORAGE_KEY_MAINTENANCE, localList);
    }
  } catch (err) {
    console.warn("Could not sync local maintenance store:", err);
  }
}

/**
 * Update maintenance request status and landlord notes (Called by Landlord / Manager).
 * NOTE: As per system business rules, only the TENANT can set status to 'resolved'!
 */
export async function updateMaintenanceRequestStatus(
  requestId: string,
  input: UpdateMaintenanceStatusInput
): Promise<{ success: boolean; error?: string }> {
  // Enforce rule: Landlords/Managers CANNOT resolve repair tickets
  if (input.status === "resolved") {
    return {
      success: false,
      error:
        "Seul le locataire peut marquer cette demande de réparation comme résolue (Only the tenant can mark this repair request as resolved).",
    };
  }

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");
  const now = new Date().toISOString();

  if (!isMockConfig) {
    try {
      const { error } = await supabase
        .from("maintenance_requests")
        .update({
          status: input.status,
          landlord_notes: input.landlord_notes?.trim() || null,
          updated_at: now,
        })
        .eq("id", requestId);

      if (!error) {
        syncLocalMaintenanceStatus(requestId, input.status, input.landlord_notes?.trim() || null, now);
        return { success: true };
      }
    } catch (err) {
      console.warn("Error updating Supabase maintenance status:", err);
    }
  }

  // Local fallback
  syncLocalMaintenanceStatus(requestId, input.status, input.landlord_notes?.trim() || null, now);
  return { success: true };
}

/**
 * Mark a maintenance request as RESOLVED.
 * Strictly reserved for the tenant who lives in the unit and filed the ticket.
 */
export async function resolveMaintenanceRequestByTenant(
  requestId: string,
  tenantToken?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");
  const now = new Date().toISOString();

  if (!isMockConfig) {
    try {
      // 1. Try atomic security definer RPC function first if token is available
      if (tenantToken && tenantToken.trim()) {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "resolve_tenant_maintenance_request",
          {
            p_request_id: requestId,
            p_token: tenantToken.trim(),
          }
        );

        if (!rpcError && rpcData && rpcData.success) {
          syncLocalMaintenanceStatus(requestId, "resolved", undefined, now);
          return { success: true };
        }
      }

      // 2. Direct Supabase update fallback
      const { error } = await supabase
        .from("maintenance_requests")
        .update({
          status: "resolved",
          updated_at: now,
        })
        .eq("id", requestId);

      if (!error) {
        syncLocalMaintenanceStatus(requestId, "resolved", undefined, now);
        return { success: true };
      }
    } catch (err: any) {
      console.warn("Error resolving maintenance request via Supabase:", err);
    }
  }

  // Local fallback
  syncLocalMaintenanceStatus(requestId, "resolved", undefined, now);
  return { success: true };
}

/**
 * Generate a WhatsApp URL pre-filled with the maintenance request details
 * so the tenant can directly notify the landlord in 1 click!
 */
export function buildMaintenanceWhatsAppUrl(
  request: MaintenanceRequest,
  landlordPhone: string,
  language: "en" | "fr" = "fr"
): { url: string; cleanPhone: string; message: string } {
  const cleanPhone = formatWhatsAppPhoneNumber(landlordPhone);
  const isEn = language === "en";
  const categoryInfo = isEn ? (CATEGORY_LABELS[request.category]?.label || request.category) : (CATEGORY_LABELS[request.category]?.fr || request.category);
  const urgencyInfo = isEn ? (URGENCY_LABELS[request.urgency]?.label || request.urgency) : (URGENCY_LABELS[request.urgency]?.fr || request.urgency);

  const attachmentsList = [];
  if (request.photo_url) attachmentsList.push(isEn ? "📷 Photo attached" : "📷 Photo jointe");
  if (request.video_url) attachmentsList.push(isEn ? "🎥 Video clip attached" : "🎥 Vidéo jointe");
  if (request.voice_url) {
    attachmentsList.push(
      isEn
        ? `🎙️ Voice Note (${request.voice_duration_seconds ? `${request.voice_duration_seconds}s` : "recorded"})`
        : `🎙️ Message vocal (${request.voice_duration_seconds ? `${request.voice_duration_seconds}s` : "enregistré"})`
    );
  }

  const attachmentsStr = attachmentsList.length > 0
    ? (isEn ? `\n• *Attachments:* ${attachmentsList.join(", ")}` : `\n• *Pièces Jointes :* ${attachmentsList.join(", ")}`)
    : "";

  const message = isEn
    ? `Hello Landlord / Property Manager! 👋
I have submitted a repair/maintenance request on *LeaseLink* for my apartment.

🔧 *Issue Report:*
• Residence: *${request.building_name}*
• Unit: *${request.unit_number}*
• Tenant: *${request.tenant_name}*
• Phone: ${request.tenant_phone}
• Category: *${categoryInfo}*
• Urgency: *${urgencyInfo}*

📝 *Problem Details:*
*${request.title}*
${request.description ? `"${request.description}"` : ""}${attachmentsStr}

Thank you for scheduling an inspection as soon as possible.`
    : `Bonjour Bailleur / Gestionnaire ! 👋
J'ai soumis une demande d'intervention / réparation sur *LeaseLink* pour mon logement.

🔧 *Signalement du Problème :*
• Résidence : *${request.building_name}*
• Logement : *${request.unit_number}*
• Locataire : *${request.tenant_name}*
• Téléphone : ${request.tenant_phone}
• Catégorie : *${categoryInfo}*
• Urgence : *${urgencyInfo}*

📝 *Détails du Problème :*
*${request.title}*
${request.description ? `"${request.description}"` : ""}${attachmentsStr}

Merci de bien vouloir planifier l'intervention dès que possible.`;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  return { url, cleanPhone, message };
}

/**
 * Generate a WhatsApp URL so the landlord can immediately reply to the tenant about the maintenance ticket in 1 click!
 */
export function buildLandlordReplyWhatsAppUrl(
  request: MaintenanceRequest,
  language: "en" | "fr" = "fr"
): { url: string; cleanPhone: string; message: string } {
  const cleanPhone = formatWhatsAppPhoneNumber(request.tenant_phone);
  const isEn = language === "en";
  const message = isEn
    ? `Hello ${request.tenant_name.trim()}! 👋
Regarding your repair request on *LeaseLink* for: *"${request.title}"* in unit *${request.unit_number}* (${request.building_name}).
We are taking charge of your ticket and scheduling the intervention.`
    : `Bonjour ${request.tenant_name.trim()} ! 👋
Je fais suite à votre demande de réparation sur *LeaseLink* pour le problème : *"${request.title}"* au logement *${request.unit_number}* (${request.building_name}).
Nous prenons en charge votre dossier.`;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  return { url, cleanPhone, message };
}

