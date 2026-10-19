import { createClient } from "@/lib/supabase/client";
import {
  AppNotification,
  CreateNotificationInput,
  NotificationRecipientRole,
  NotificationType,
} from "@/types/database";

const LOCAL_STORAGE_KEY_NOTIFICATIONS = "leaselink_notifications";
const LOCAL_STORAGE_READ_IDS_KEY = "leaselink_read_notification_ids";

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

export function getLocalReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_READ_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function addLocalReadId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getLocalReadIds();
    set.add(id);
    localStorage.setItem(LOCAL_STORAGE_READ_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function addMultipleLocalReadIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const set = getLocalReadIds();
    ids.forEach((id) => set.add(id));
    localStorage.setItem(LOCAL_STORAGE_READ_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
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
 * Creates a notification and broadcasts it across the platform with strict routing metadata.
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
          title_fr: newNotif.title_fr,
          message: newNotif.message,
          message_fr: newNotif.message_fr,
          recipient_role: newNotif.recipient_role,
          landlord_id: newNotif.landlord_id,
          building_id: newNotif.building_id,
          building_name: newNotif.building_name,
          unit_id: newNotif.unit_id,
          unit_number: newNotif.unit_number,
          tenant_name: newNotif.tenant_name,
          amount: newNotif.amount,
          payment_method: newNotif.payment_method,
          receipt_number: newNotif.receipt_number,
          rent_month: newNotif.rent_month,
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

  // Dispatch cross-tab and cross-window events so WhatsApp-style popup triggers in any tab
  if (typeof window !== "undefined") {
    try {
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("leaselink_notifications_channel");
        channel.postMessage({ notif: newNotif, timestamp: Date.now() });
        channel.close();
      }
    } catch (_) {}

    try {
      localStorage.setItem(
        "leaselink_latest_notif_ping",
        JSON.stringify({ notif: newNotif, timestamp: Date.now() })
      );
    } catch (_) {}

    window.dispatchEvent(
      new CustomEvent("leaselink:new_notification", { detail: newNotif })
    );
  }

  return newNotif;
}

export interface GetNotificationsParams {
  role?: "landlord" | "manager" | "admin" | "tenant";
  userId?: string | null;
  landlordId?: string | null;
  assignedBuildingIds?: string[] | null;
  buildingId?: string | null;
  unitId?: string | null;
  tenantName?: string | null;
}

/**
 * Filter a notification locally based on strict routing requirements:
 * 1. Rent payment: Only manager, admins, and the landlord managing that specific building/unit can receive it.
 * 2. Tenant arrival/departure: ONLY admins and OTHER tenants in the same building. Landlords/managers and the arriving tenant themselves NEVER receive it.
 * 3. New landlord registers: ONLY the admins are notified.
 */
function isNotificationPermittedForUser(
  n: AppNotification,
  params: GetNotificationsParams
): boolean {
  const role = params.role || "landlord";

  // RULE 3: New landlord registration
  if (n.type === "landlord_registered" || n.recipient_role === "admin") {
    // ONLY admins receive this
    return role === "admin";
  }

  // Admin has visibility on all notifications
  if (role === "admin") {
    return true;
  }

  // RULE 1: Rent Payment received
  if (n.type === "payment_received") {
    // Tenants can NEVER see rent payment notifications
    if (role === "tenant") {
      return false;
    }

    // Landlord: must be the landlord of this specific building/unit
    if (role === "landlord") {
      const currentLandlordId = params.userId || params.landlordId;
      return Boolean(currentLandlordId && n.landlord_id === currentLandlordId);
    }

    // Manager: must manage this landlord and specifically this building
    if (role === "manager") {
      const parentLandlordId = params.landlordId;
      if (!parentLandlordId || n.landlord_id !== parentLandlordId) {
        return false;
      }
      // If manager has specific building assignments, check building match
      const assigned = params.assignedBuildingIds;
      if (Array.isArray(assigned)) {
        if (assigned.length === 0) return false;
        return Boolean(n.building_id && assigned.includes(n.building_id));
      }
      return true;
    }

    return false;
  }

  // RULE 2: Tenant arrival or departure
  // Landlords must NOT be notified of tenant arrival or departure.
  // ONLY admins and OTHER tenants sharing the same building can receive it.
  // The tenant who arrived or departed must NEVER receive their own arrival/departure notice!
  if (n.type === "tenant_arrived" || n.type === "tenant_departed") {
    // Landlords and managers are excluded
    if (role === "landlord" || role === "manager") {
      return false;
    }

    // Tenants in the same building, excluding the arriving/departing tenant themselves
    if (role === "tenant") {
      if (!params.buildingId || !n.building_id || n.building_id !== params.buildingId) {
        return false;
      }
      // Exclude if this tenant is in the same unit as the arrived/departed tenant
      if (params.unitId && n.unit_id && params.unitId === n.unit_id) {
        return false;
      }
      // Exclude if the tenant's name matches
      if (
        params.tenantName &&
        n.tenant_name &&
        params.tenantName.trim().toLowerCase() === n.tenant_name.trim().toLowerCase()
      ) {
        return false;
      }
      return true;
    }

    return false;
  }

  // LANDLORD & MANAGER EXCLUSION:
  // Landlords and property managers send rent reminders and notices TO tenants.
  // The landlord and manager must NEVER receive notifications sent to tenants or building communities!
  if (role === "landlord" || role === "manager") {
    if (n.recipient_role === "tenant" || n.recipient_role === "building_community") {
      return false;
    }
    if (
      n.type === "broadcast_reminder" ||
      n.type === "rent_due_reminder" ||
      n.type === "rent_overdue"
    ) {
      return false;
    }
  }

  // Tenant routing: tenants receive reminders, community alerts, and unit-specific notices
  if (role === "tenant") {
    if (n.recipient_role === "landlord" || n.recipient_role === "management") {
      return false;
    }
    // If notification is explicitly targeted to a specific unit, ONLY that unit may see it!
    if (n.unit_id) {
      return Boolean(params.unitId && n.unit_id === params.unitId);
    }
    if (params.buildingId && n.building_id === params.buildingId) {
      return true;
    }
    if (params.unitId && n.unit_id === params.unitId) {
      return true;
    }
    return false;
  }

  // Landlord general notifications (maintenance tickets, tenant payment receipts, tenant requests)
  if (role === "landlord") {
    const currentLandlordId = params.userId || params.landlordId;
    return Boolean(currentLandlordId && n.landlord_id === currentLandlordId);
  }

  // Manager general notifications
  if (role === "manager") {
    const parentLandlordId = params.landlordId;
    if (!parentLandlordId || n.landlord_id !== parentLandlordId) return false;
    const assigned = params.assignedBuildingIds;
    if (Array.isArray(assigned) && assigned.length > 0 && n.building_id) {
      return assigned.includes(n.building_id);
    }
    return true;
  }

  return false;
}

/**
 * Universal, role-aware notification retrieval function
 */
export async function getNotificationsForUser(
  params: GetNotificationsParams
): Promise<AppNotification[]> {
  const localList = getLocalNotifications();
  const role = params.role || "landlord";

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  let remoteList: AppNotification[] = [];

  if (!isMockConfig) {
    try {
      let query = supabase.from("notifications").select("*");

      if (role === "admin") {
        // Admin sees all notifications
        query = query.order("created_at", { ascending: false });
      } else if (role === "tenant") {
        // Tenant only sees their specific building community, never payment_received or landlord_registered
        if (!params.buildingId) {
          return localList;
        }
        query = query
          .eq("building_id", params.buildingId)
          .neq("type", "payment_received")
          .neq("type", "landlord_registered")
          .in("recipient_role", ["tenant", "building_community"])
          .order("created_at", { ascending: false });
      } else if (role === "manager") {
        const parentLandlordId = params.landlordId;
        if (!parentLandlordId) {
          return localList;
        }
        query = query
          .eq("landlord_id", parentLandlordId)
          .neq("recipient_role", "admin")
          .neq("recipient_role", "tenant")
          .neq("recipient_role", "building_community")
          .neq("type", "landlord_registered")
          .neq("type", "broadcast_reminder")
          .neq("type", "rent_due_reminder")
          .neq("type", "rent_overdue")
          .neq("type", "tenant_arrived")
          .neq("type", "tenant_departed")
          .order("created_at", { ascending: false });
      } else {
        // Landlord: exclusively fetch notifications for the landlord, never tenant reminders or arrival/departures
        const landlordId = params.userId || params.landlordId;
        if (!landlordId) {
          return localList;
        }
        query = query
          .eq("landlord_id", landlordId)
          .neq("recipient_role", "admin")
          .neq("recipient_role", "tenant")
          .neq("recipient_role", "building_community")
          .neq("type", "landlord_registered")
          .neq("type", "broadcast_reminder")
          .neq("type", "rent_due_reminder")
          .neq("type", "rent_overdue")
          .neq("type", "tenant_arrived")
          .neq("type", "tenant_departed")
          .order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data)) {
        remoteList = data.map((d: any) => ({
          id: d.id,
          type: d.type,
          title: d.title,
          title_fr: d.title_fr || d.metadata?.title_fr || d.title,
          message: d.message,
          message_fr: d.message_fr || d.metadata?.message_fr || d.message,
          recipient_role: d.recipient_role,
          landlord_id: d.landlord_id,
          building_id: d.building_id,
          building_name: d.building_name || d.metadata?.building_name,
          unit_id: d.unit_id,
          unit_number: d.unit_number || d.metadata?.unit_number,
          tenant_name: d.tenant_name || d.metadata?.tenant_name,
          amount: d.amount ?? d.metadata?.amount,
          payment_method: d.payment_method || d.metadata?.payment_method,
          receipt_number: d.receipt_number || d.metadata?.receipt_number,
          rent_month: d.rent_month || d.metadata?.rent_month,
          is_read: d.is_read || false,
          read_by: d.read_by || d.metadata?.read_by || [],
          created_at: d.created_at,
          metadata: d.metadata || {},
        }));
      }
    } catch (err) {
      console.warn("Error fetching remote notifications:", err);
    }
  }

  // Merge remote and local lists using strict permission filter
  const localReadIds = getLocalReadIds();
  const remoteIds = new Set(remoteList.map((n) => n.id));
  const matchedLocal = localList.filter((n) => {
    if (remoteIds.has(n.id)) return false;
    return isNotificationPermittedForUser(n, params);
  });

  // Filter remote list as well to guarantee client-side consistency
  const permittedRemote = remoteList.filter((n) => isNotificationPermittedForUser(n, params));

  const readerId = params.userId || params.landlordId || params.unitId;
  const merged = [...permittedRemote, ...matchedLocal].map((n) => {
    if (localReadIds.has(n.id)) {
      return {
        ...n,
        is_read: true,
        read_by: readerId && n.read_by && !n.read_by.includes(readerId)
          ? [...n.read_by, readerId]
          : n.read_by || (readerId ? [readerId] : []),
      };
    }
    return n;
  });

  return merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Retrieve notifications for a landlord (payment alerts, tenant arrivals/departures in their properties)
 */
export async function getNotificationsForLandlord(
  landlordId?: string | null
): Promise<AppNotification[]> {
  return getNotificationsForUser({
    role: "landlord",
    userId: landlordId,
    landlordId: landlordId,
  });
}

/**
 * Retrieve notifications for a manager (payment alerts and tenant movements in their assigned buildings)
 */
export async function getNotificationsForManager(
  managerId: string,
  parentLandlordId: string,
  assignedBuildingIds?: string[] | null
): Promise<AppNotification[]> {
  return getNotificationsForUser({
    role: "manager",
    userId: managerId,
    landlordId: parentLandlordId,
    assignedBuildingIds: assignedBuildingIds,
  });
}

/**
 * Retrieve notifications for platform admins (all platform activities, payments, movements, and new landlord registrations)
 */
export async function getNotificationsForAdmin(
  adminId?: string | null
): Promise<AppNotification[]> {
  return getNotificationsForUser({
    role: "admin",
    userId: adminId,
  });
}

/**
 * Retrieve notifications for a specific tenant in a building (arrival of new neighbor, departure of old neighbor in THEIR SAME BUILDING ONLY)
 */
export async function getNotificationsForTenant(
  buildingId: string,
  unitId?: string | null
): Promise<AppNotification[]> {
  return getNotificationsForUser({
    role: "tenant",
    buildingId,
    unitId,
  });
}

/**
 * Mark a single notification as read by a user or tenant
 */
export async function markNotificationAsRead(
  notificationId: string,
  readerId?: string | null
): Promise<boolean> {
  // 1. Immediately record in persistent read set
  addLocalReadId(notificationId);

  // 2. Update local notifications list
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
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_NOTIFICATIONS, JSON.stringify(localList));
    } catch {}
  }

  // 3. Update Supabase
  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      // First fetch current read_by so we don't clobber other readers
      const { data: currentNotif } = await supabase
        .from("notifications")
        .select("read_by")
        .eq("id", notificationId)
        .maybeSingle();

      const existingReadBy: string[] = currentNotif?.read_by || [];
      const updatedReadBy = readerId
        ? Array.from(new Set([...existingReadBy, readerId]))
        : existingReadBy;

      await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_by: updatedReadBy,
        })
        .eq("id", notificationId);
    } catch (err) {
      console.warn("Could not update remote notification:", err);
    }
  }

  return true;
}

/**
 * Mark all notifications as read for a given reader
 */
export async function markAllNotificationsAsRead(
  readerId: string,
  role: "landlord" | "manager" | "admin" | "tenant",
  buildingId?: string | null,
  activeNotificationIds?: string[]
): Promise<boolean> {
  if (Array.isArray(activeNotificationIds) && activeNotificationIds.length > 0) {
    addMultipleLocalReadIds(activeNotificationIds);
  }

  const localList = getLocalNotifications();
  const updatedList = localList.map((n) => {
    const isTarget =
      role === "tenant"
        ? n.building_id === buildingId || n.recipient_role === "building_community"
        : n.landlord_id === readerId || role === "admin" || n.recipient_role === "management";

    if (isTarget) {
      addLocalReadId(n.id);
      const readBy = new Set(n.read_by || []);
      readBy.add(readerId);
      return { ...n, is_read: true, read_by: Array.from(readBy) };
    }
    return n;
  });

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updatedList));
  } catch {}

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMockConfig = !url || url.includes("your-project-ref");

  if (!isMockConfig) {
    try {
      if (role === "admin") {
        await supabase.from("notifications").update({ is_read: true });
      } else if (role === "tenant" && buildingId) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("building_id", buildingId);
      } else {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("landlord_id", readerId);
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
 * RULE 1: Triggered whenever a rent payment is recorded.
 * ONLY the manager, admins, and the landlord managing that specific building and unit can receive this notification.
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
    recipient_role: "management",
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
 * RULE 2: Triggered when a new tenant arrives/moves into a unit.
 * ONLY admins, landlord, manager, and the different tenants sharing the SAME building receive this notification.
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
 * RULE 2: Triggered when a tenant departs/vacates a unit.
 * ONLY admins, landlord, manager, and the different tenants sharing the SAME building receive this notification.
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

/**
 * RULE 3: Triggered when a new landlord registers on LeaseLink.
 * ONLY the platform admins are notified of this.
 */
export async function notifyNewLandlordRegistered(details: {
  landlordId: string;
  landlordName: string;
  email: string;
  phone?: string;
  plan?: string;
}): Promise<AppNotification> {
  const planLabel = details.plan || "Free Trial";
  const titleEn = `New Landlord Registered: ${details.landlordName}`;
  const titleFr = `Nouveau Bailleur Inscrit : ${details.landlordName}`;

  const messageEn = `Landlord "${details.landlordName}" (${details.email}) has registered on LeaseLink with plan ${planLabel}.`;
  const messageFr = `Le bailleur "${details.landlordName}" (${details.email}) s'est inscrit sur LeaseLink avec la formule ${planLabel}.`;

  return createNotification({
    type: "landlord_registered",
    recipient_role: "admin",
    landlord_id: details.landlordId,
    title: titleEn,
    title_fr: titleFr,
    message: messageEn,
    message_fr: messageFr,
    metadata: {
      email: details.email,
      phone: details.phone,
      plan: details.plan,
      landlord_name: details.landlordName,
    },
  });
}

export interface UnpaidTenantTarget {
  unitId: string;
  unitNumber: string;
  buildingId: string;
  buildingName: string;
  tenantName: string;
  tenantPhone?: string;
  balanceOwing: number;
  currentMonth: string;
}

export interface BroadcastReminderParams {
  landlordId: string;
  landlordName?: string;
  customMessage?: string;
  customTitle?: string;
  tenants: UnpaidTenantTarget[];
}

/**
 * Broadcasts an official payment reminder to all tenants with unpaid/owing dues for a specific landlord.
 * Triggers instant in-app WhatsApp-style heads-up notifications for each targeted tenant.
 */
export async function broadcastRentReminderToUnpaidTenants(
  params: BroadcastReminderParams
): Promise<{ success: boolean; sentCount: number; notifications: AppNotification[] }> {
  const { landlordId, landlordName, customMessage, customTitle, tenants } = params;

  if (!tenants || tenants.length === 0) {
    return { success: true, sentCount: 0, notifications: [] };
  }

  const createdNotifications: AppNotification[] = [];

  for (const tenant of tenants) {
    const formattedAmount = (tenant.balanceOwing || 0).toLocaleString();
    const defaultMsgFr = customMessage
      ? customMessage
          .replace(/\{tenant\}/gi, tenant.tenantName)
          .replace(/\{unit\}/gi, tenant.unitNumber)
          .replace(/\{building\}/gi, tenant.buildingName)
          .replace(/\{amount\}/gi, formattedAmount)
          .replace(/\{month\}/gi, tenant.currentMonth)
      : `Bonjour ${tenant.tenantName}, rappel amical de votre bailleur : votre loyer pour le logement ${tenant.unitNumber} (${tenant.buildingName}) présente un solde impayé de ${formattedAmount} FCFA au titre du mois de ${tenant.currentMonth}. Merci de régulariser rapidement via Mobile Money ou auprès du gestionnaire.`;

    const defaultMsgEn = customMessage
      ? customMessage
          .replace(/\{tenant\}/gi, tenant.tenantName)
          .replace(/\{unit\}/gi, tenant.unitNumber)
          .replace(/\{building\}/gi, tenant.buildingName)
          .replace(/\{amount\}/gi, formattedAmount)
          .replace(/\{month\}/gi, tenant.currentMonth)
      : `Hello ${tenant.tenantName}, friendly reminder from your landlord: your rent for unit ${tenant.unitNumber} (${tenant.buildingName}) has an unpaid balance of ${formattedAmount} FCFA for ${tenant.currentMonth}. Please settle promptly via Mobile Money or with property management.`;

    const titleFr = customTitle || `📢 Rappel de loyer : Solde impayé (${tenant.unitNumber})`;
    const titleEn = customTitle || `📢 Rent Reminder: Pending Balance (${tenant.unitNumber})`;

    try {
      const notif = await createNotification({
        type: "broadcast_reminder",
        title: titleEn,
        title_fr: titleFr,
        message: defaultMsgEn,
        message_fr: defaultMsgFr,
        recipient_role: "tenant",
        landlord_id: landlordId,
        building_id: tenant.buildingId,
        building_name: tenant.buildingName,
        unit_id: tenant.unitId,
        unit_number: tenant.unitNumber,
        tenant_name: tenant.tenantName,
        amount: tenant.balanceOwing,
        rent_month: tenant.currentMonth,
        metadata: {
          broadcast: true,
          sender_name: landlordName || "Bailleur",
          tenant_phone: tenant.tenantPhone,
          sent_at: new Date().toISOString(),
          action_url: "/tenant/portal",
        },
      });

      createdNotifications.push(notif);
    } catch (err) {
      console.warn("Error creating broadcast notification for tenant:", tenant.tenantName, err);
    }
  }

  // Trigger high-priority window broadcast event
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("leaselink:broadcast_sent", {
        detail: { count: createdNotifications.length, notifications: createdNotifications },
      })
    );
  }

  return {
    success: true,
    sentCount: createdNotifications.length,
    notifications: createdNotifications,
  };
}
