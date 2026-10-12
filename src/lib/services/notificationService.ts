import { createClient } from "@/lib/supabase/client";
import {
  AppNotification,
  CreateNotificationInput,
} from "@/types/database";

const LOCAL_STORAGE_KEY_NOTIFICATIONS = "leaselink_notifications";

// Helper to access localStorage safely in browser
function getLocalNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_NOTIFICATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalNotifications(notifications: AppNotification[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
    // Dispatch a browser event so any listening notification bell instantly refreshes
    window.dispatchEvent(new CustomEvent("leaselink:notification_updated"));
  } catch (err) {
    console.error("Error saving local notifications:", err);
  }
}

/**
 * Creates a notification and broadcasts it across the platform.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<AppNotification> {
  const notifId = "ntf_" + Math.random().toString(36).substring(2, 11);
  const now = new Date().toISOString();

  const newNotif: AppNotification = {
    id: notifId,
    type: input.type,
    title: input.title,
    title_fr: input.title_fr,
    message: input.message,
    message_fr: input.message_fr,
    recipient_role: input.recipient_role,
    landlord_id: input.landlord_id || null,
    building_id: input.building_id || null,
    building_name: input.building_name || null,
    unit_id: input.unit_id || null,
    unit_number: input.unit_number || null,
    tenant_name: input.tenant_name || null,
    amount: input.amount ?? null,
    payment_method: input.payment_method || null,
    receipt_number: input.receipt_number || null,
    rent_month: input.rent_month || null,
    is_read: false,
    read_by: [],
    created_at: now,
    metadata: input.metadata || {},
  };

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          type: newNotif.type,
          title: newNotif.title,
          message: newNotif.message,
          recipient_role: newNotif.recipient_role,
          landlord_id: newNotif.landlord_id,
          building_id: newNotif.building_id,
          unit_id: newNotif.unit_id,
          is_read: false,
          metadata: {
            title_fr: newNotif.title_fr,
            message_fr: newNotif.message_fr,
            building_name: newNotif.building_name,
            unit_number: newNotif.unit_number,
            tenant_name: newNotif.tenant_name,
            amount: newNotif.amount,
            payment_method: newNotif.payment_method,
            receipt_number: newNotif.receipt_number,
            rent_month: newNotif.rent_month,
            ...newNotif.metadata,
          },
        })
        .select()
        .single();

      if (!error && data) {
        newNotif.id = data.id;
      }
    } catch (err) {
      console.warn("Supabase notification insert fallback:", err);
    }
  }

  // Always store in local storage cache for offline resilience and instant reactivity
  const localList = getLocalNotifications();
  setLocalNotifications([newNotif, ...localList]);

  return newNotif;
}

/**
 * Retrieve notifications for a landlord (payment alerts, tenant arrivals/departures, etc.)
 */
export async function getNotificationsForLandlord(
  landlordId?: string | null
): Promise<AppNotification[]> {
  const localList = getLocalNotifications();

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  let remoteList: AppNotification[] = [];

  if (!isMockConfig && landlordId) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`landlord_id.eq.${landlordId},recipient_role.eq.landlord,recipient_role.eq.building_community`)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteList = data.map((d: any) => ({
          id: d.id,
          type: d.type,
          title: d.title,
          title_fr: d.metadata?.title_fr || d.title,
          message: d.message,
          message_fr: d.metadata?.message_fr || d.message,
          recipient_role: d.recipient_role,
          landlord_id: d.landlord_id,
          building_id: d.building_id,
          building_name: d.metadata?.building_name,
          unit_id: d.unit_id,
          unit_number: d.metadata?.unit_number,
          tenant_name: d.metadata?.tenant_name,
          amount: d.metadata?.amount,
          payment_method: d.metadata?.payment_method,
          receipt_number: d.metadata?.receipt_number,
          rent_month: d.metadata?.rent_month,
          is_read: d.is_read || false,
          read_by: d.metadata?.read_by || [],
          created_at: d.created_at,
          metadata: d.metadata,
        }));
      }
    } catch (err) {
      console.warn("Error fetching remote notifications:", err);
    }
  }

  // Merge remote and local lists
  const remoteIds = new Set(remoteList.map((n) => n.id));
  const matchedLocal = localList.filter((n) => {
    if (remoteIds.has(n.id)) return false;
    if (!landlordId) return true;
    return (
      n.landlord_id === landlordId ||
      n.recipient_role === "landlord" ||
      n.recipient_role === "building_community"
    );
  });

  return [...remoteList, ...matchedLocal].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Retrieve notifications for a specific tenant in a building (arrival of new neighbor, departure of old neighbor, community alerts)
 */
export async function getNotificationsForTenant(
  buildingId: string,
  unitId?: string | null
): Promise<AppNotification[]> {
  const localList = getLocalNotifications();

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  let remoteList: AppNotification[] = [];

  if (!isMockConfig && buildingId) {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("building_id", buildingId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteList = data.map((d: any) => ({
          id: d.id,
          type: d.type,
          title: d.title,
          title_fr: d.metadata?.title_fr || d.title,
          message: d.message,
          message_fr: d.metadata?.message_fr || d.message,
          recipient_role: d.recipient_role,
          landlord_id: d.landlord_id,
          building_id: d.building_id,
          building_name: d.metadata?.building_name,
          unit_id: d.unit_id,
          unit_number: d.metadata?.unit_number,
          tenant_name: d.metadata?.tenant_name,
          amount: d.metadata?.amount,
          payment_method: d.metadata?.payment_method,
          receipt_number: d.metadata?.receipt_number,
          rent_month: d.metadata?.rent_month,
          is_read: d.is_read || false,
          read_by: d.metadata?.read_by || [],
          created_at: d.created_at,
          metadata: d.metadata,
        }));
      }
    } catch (err) {
      console.warn("Error fetching tenant remote notifications:", err);
    }
  }

  // Filter local list for this building or unit
  const remoteIds = new Set(remoteList.map((n) => n.id));
  const matchedLocal = localList.filter((n) => {
    if (remoteIds.has(n.id)) return false;
    // Notifications intended for all tenants in this building
    if (n.building_id === buildingId && (n.recipient_role === "building_community" || n.recipient_role === "tenant")) {
      return true;
    }
    // Targeted notifications to this specific unit
    if (unitId && n.unit_id === unitId) {
      return true;
    }
    return false;
  });

  return [...remoteList, ...matchedLocal].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Mark a single notification as read by a user or tenant
 */
export async function markNotificationAsRead(
  notificationId: string,
  readerId?: string | null
): Promise<boolean> {
  const localList = getLocalNotifications();
  const idx = localList.findIndex((n) => n.id === notificationId);

  if (idx !== -1) {
    const readBy = new Set(localList[idx].read_by || []);
    if (readerId) readBy.add(readerId);

    localList[idx] = {
      ...localList[idx],
      is_read: true,
      read_by: Array.from(readBy),
    };
    setLocalNotifications(localList);
  }

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
    } catch {
      // Ignore remote error
    }
  }

  return true;
}

/**
 * Mark all notifications as read for a given reader
 */
export async function markAllNotificationsAsRead(
  readerId: string,
  role: "landlord" | "tenant",
  buildingId?: string | null
): Promise<boolean> {
  const localList = getLocalNotifications();
  const updatedList = localList.map((n) => {
    const isTarget =
      role === "landlord"
        ? n.recipient_role === "landlord" || n.landlord_id === readerId
        : n.building_id === buildingId || n.recipient_role === "building_community";

    if (isTarget) {
      const readBy = new Set(n.read_by || []);
      readBy.add(readerId);
      return { ...n, is_read: true, read_by: Array.from(readBy) };
    }
    return n;
  });

  setLocalNotifications(updatedList);

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      if (role === "landlord") {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("landlord_id", readerId);
      } else if (buildingId) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("building_id", buildingId);
      }
    } catch {
      // Ignore remote error
    }
  }

  return true;
}

/**
 * Remove or clear a notification
 */
export async function clearNotification(notificationId: string): Promise<boolean> {
  const localList = getLocalNotifications();
  const filtered = localList.filter((n) => n.id !== notificationId);
  setLocalNotifications(filtered);

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      await supabase.from("notifications").delete().eq("id", notificationId);
    } catch {
      // Ignore remote error
    }
  }

  return true;
}

// ============================================================================
// Specialized Notification Triggers
// ============================================================================

/**
 * Triggered whenever a rent payment is recorded (either mobile money or cash).
 * Notifies the landlord with full payment breakdown and tenant identity.
 */
export async function notifyPaymentReceived(details: {
  landlordId: string;
  buildingId?: string | null;
  buildingName: string;
  unitId?: string | null;
  unitNumber: string;
  tenantName: string;
  amount: number;
  paymentMethod: string;
  receiptNumber: string;
  rentMonth: string;
  isPartial?: boolean;
}): Promise<AppNotification> {
  const formattedAmount = Number(details.amount || 0).toLocaleString();

  const titleEn = `Rent Payment: ${formattedAmount} XAF Received`;
  const titleFr = `Paiement de Loyer : ${formattedAmount} XAF Reçu`;

  const messageEn = `${details.tenantName} completed a payment of ${formattedAmount} XAF for Unit ${details.unitNumber} (${details.buildingName}) covering ${details.rentMonth}. Receipt: ${details.receiptNumber}.`;
  const messageFr = `${details.tenantName} a effectué un paiement de ${formattedAmount} XAF pour le logement ${details.unitNumber} (${details.buildingName}) au titre de ${details.rentMonth}. Reçu n° ${details.receiptNumber}.`;

  return createNotification({
    type: "payment_received",
    recipient_role: "landlord",
    landlord_id: details.landlordId,
    building_id: details.buildingId,
    building_name: details.buildingName,
    unit_id: details.unitId,
    unit_number: details.unitNumber,
    tenant_name: details.tenantName,
    amount: details.amount,
    payment_method: details.paymentMethod,
    receipt_number: details.receiptNumber,
    rent_month: details.rentMonth,
    title: titleEn,
    title_fr: titleFr,
    message: messageEn,
    message_fr: messageFr,
    metadata: {
      isPartial: details.isPartial || false,
    },
  });
}

/**
 * Triggered when a new tenant is assigned to a unit in a specific building.
 * Sends a notification to ALL tenants in that specific building (and the landlord).
 */
export async function notifyTenantArrival(details: {
  buildingId: string;
  buildingName: string;
  unitId?: string | null;
  unitNumber: string;
  tenantName: string;
  landlordId?: string | null;
}): Promise<AppNotification> {
  const titleEn = `New Neighbor Arrival: ${details.tenantName}`;
  const titleFr = `Nouvel Arrivant : ${details.tenantName}`;

  const messageEn = `Welcome ${details.tenantName} who has officially moved into Unit ${details.unitNumber} at ${details.buildingName}!`;
  const messageFr = `Bienvenue à ${details.tenantName} qui a officiellement emménagé au logement ${details.unitNumber} de la résidence ${details.buildingName} !`;

  return createNotification({
    type: "tenant_arrived",
    recipient_role: "building_community",
    landlord_id: details.landlordId,
    building_id: details.buildingId,
    building_name: details.buildingName,
    unit_id: details.unitId,
    unit_number: details.unitNumber,
    tenant_name: details.tenantName,
    title: titleEn,
    title_fr: titleFr,
    message: messageEn,
    message_fr: messageFr,
  });
}

/**
 * Triggered when an old tenant leaves (unassigned/vacated from a unit).
 * Sends a notification to ALL tenants in that specific building (and the landlord).
 */
export async function notifyTenantDeparture(details: {
  buildingId: string;
  buildingName: string;
  unitId?: string | null;
  unitNumber: string;
  tenantName: string;
  landlordId?: string | null;
}): Promise<AppNotification> {
  const titleEn = `Departure Notice: Unit ${details.unitNumber}`;
  const titleFr = `Avis de Départ : Logement ${details.unitNumber}`;

  const messageEn = `Notice to residents: ${details.tenantName} has departed and vacated Unit ${details.unitNumber} at ${details.buildingName}.`;
  const messageFr = `Information aux résidents : ${details.tenantName} a quitté et libéré le logement ${details.unitNumber} de la résidence ${details.buildingName}.`;

  return createNotification({
    type: "tenant_departed",
    recipient_role: "building_community",
    landlord_id: details.landlordId,
    building_id: details.buildingId,
    building_name: details.buildingName,
    unit_id: details.unitId,
    unit_number: details.unitNumber,
    tenant_name: details.tenantName,
    title: titleEn,
    title_fr: titleFr,
    message: messageEn,
    message_fr: messageFr,
  });
}
