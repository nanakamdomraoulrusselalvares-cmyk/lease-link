"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  Receipt,
  UserPlus,
  UserMinus,
  Building2,
  DoorOpen,
  X,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Eye,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { AppNotification } from "@/types/database";
import {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotification,
} from "@/lib/services/notificationService";
import {
  PlatformHeadsUpBanner,
  FullNotificationModal,
  AllNotificationsModal,
  playPlatformNotificationChime,
} from "@/components/NotificationModals";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface NotificationBellProps {
  role?: "landlord" | "manager" | "admin" | "tenant";
  userId?: string | null;
  landlordId?: string | null;
  assignedBuildingIds?: string[] | null;
  buildingId?: string | null;
  unitId?: string | null;
  tenantName?: string | null;
  className?: string;
  variant?: "floating" | "navbar";
}

export default function NotificationBell({
  role = "landlord",
  userId,
  landlordId,
  assignedBuildingIds,
  buildingId,
  unitId,
  tenantName,
  className = "",
  variant = "navbar",
}: NotificationBellProps) {
  const { t, isFrench, formatCurrency } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

  // Detailed Modals state
  const [activeBannerNotif, setActiveBannerNotif] = useState<AppNotification | null>(null);
  const [selectedNotifForView, setSelectedNotifForView] = useState<AppNotification | null>(null);
  const [showAllNotifsModal, setShowAllNotifsModal] = useState(false);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  const dropdownRef = useRef<HTMLDivElement>(null);

  const readerId =
    role === "tenant"
      ? unitId || "tenant"
      : userId || landlordId || "management_user";

  // Robust determination of unread status
  const isNotificationUnread = useCallback(
    (notif: AppNotification): boolean => {
      if (notif.is_read) return false;
      if (readerId && Array.isArray(notif.read_by) && notif.read_by.includes(readerId)) {
        return false;
      }
      return true;
    },
    [readerId]
  );

  // Load notifications based on exact role and parameters
  const loadNotifications = useCallback(async () => {
    try {
      const list = await getNotificationsForUser({
        role,
        userId,
        landlordId,
        assignedBuildingIds,
        buildingId,
        unitId,
      });
      setNotifications(list);

      // If tenant has an unread urgent reminder not yet seen in this session, trigger heads-up popup
      if (role === "tenant" && list.length > 0) {
        const topUnreadReminder = list.find(
          (n) =>
            isNotificationUnread(n) &&
            !seenNotifIdsRef.current.has(n.id) &&
            (n.type === "broadcast_reminder" ||
              n.type === "rent_due_reminder" ||
              n.type === "rent_overdue")
        );

        if (topUnreadReminder) {
          seenNotifIdsRef.current.add(topUnreadReminder.id);
          setActiveBannerNotif(topUnreadReminder);
          playPlatformNotificationChime();
        }
      }
    } catch (err) {
      console.warn("Error loading notifications:", err);
    }
  }, [role, userId, landlordId, assignedBuildingIds, buildingId, unitId, isNotificationUnread]);

  useEffect(() => {
    loadNotifications();

    // Check if incoming notification belongs to current context
    const isNotificationForMe = (n: AppNotification): boolean => {
      if (role === "tenant") {
        if (n.recipient_role === "landlord" || n.recipient_role === "management") return false;
        if (unitId && n.unit_id) return n.unit_id === unitId;
        if (buildingId && n.building_id === buildingId) {
          return !n.unit_id || n.recipient_role === "building_community";
        }
        return false;
      }
      if (role === "landlord") {
        const myId = userId || landlordId;
        if (!myId || n.landlord_id !== myId) return false;
        if (n.recipient_role === "admin") return false;
        // The landlord should NOT receive notifications he sends to tenants!
        if (n.recipient_role === "tenant" || n.recipient_role === "building_community") return false;
        if (n.type === "broadcast_reminder" || n.type === "rent_due_reminder" || n.type === "rent_overdue") return false;
        return true;
      }
      if (role === "manager") {
        const parentId = landlordId;
        if (!parentId || n.landlord_id !== parentId) return false;
        if (n.recipient_role === "admin") return false;
        if (n.recipient_role === "tenant" || n.recipient_role === "building_community") return false;
        if (n.type === "broadcast_reminder" || n.type === "rent_due_reminder" || n.type === "rent_overdue") return false;
        if (Array.isArray(assignedBuildingIds) && assignedBuildingIds.length > 0 && n.building_id) {
          return assignedBuildingIds.includes(n.building_id);
        }
        return true;
      }
      if (role === "admin") return true;
      return false;
    };

    const handleIncoming = (incoming: AppNotification) => {
      if (!incoming || !isNotificationForMe(incoming)) return;

      setNotifications((prev) => [
        incoming,
        ...prev.filter((item) => item.id !== incoming.id),
      ]);

      if (!seenNotifIdsRef.current.has(incoming.id)) {
        seenNotifIdsRef.current.add(incoming.id);
        setActiveBannerNotif(incoming);
        playPlatformNotificationChime();
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.([40, 60, 40]);
        }

        // Native System Notification (shows banner + sound even when user is outside this tab)
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          const notifTitle = isFrench ? (incoming.title_fr || incoming.title) : incoming.title;
          const notifBody = isFrench ? (incoming.message_fr || incoming.message) : incoming.message;
          const targetUrl = incoming.metadata?.action_url || (role === "tenant" ? "/tenant/portal" : "/dashboard");

          try {
            if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: "SHOW_NOTIFICATION",
                title: notifTitle,
                body: notifBody,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-192x192.png",
                tag: incoming.id,
                url: targetUrl,
              });
            } else if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(notifTitle, {
                  body: notifBody,
                  icon: "/icons/icon-192x192.png",
                  badge: "/icons/icon-192x192.png",
                  tag: incoming.id,
                  data: { url: targetUrl },
                }).catch(() => {
                  new Notification(notifTitle, {
                    body: notifBody,
                    icon: "/icons/icon-192x192.png",
                    tag: incoming.id,
                  });
                });
              }).catch(() => {
                new Notification(notifTitle, {
                  body: notifBody,
                  icon: "/icons/icon-192x192.png",
                  tag: incoming.id,
                });
              });
            } else {
              new Notification(notifTitle, {
                body: notifBody,
                icon: "/icons/icon-192x192.png",
                tag: incoming.id,
              });
            }
          } catch (_) {}
        }
      }
    };

    const handleNewNotifEvent = (e: Event) => {
      const customEvent = e as CustomEvent<AppNotification>;
      if (customEvent.detail) {
        handleIncoming(customEvent.detail);
      } else {
        loadNotifications();
      }
    };

    const handleBroadcastSent = (e: Event) => {
      loadNotifications();
    };

    // Storage event for cross-tab notification synchronization
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "leaselink_latest_notif_ping" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.notif) {
            handleIncoming(parsed.notif);
          }
        } catch (_) {}
      } else {
        loadNotifications();
      }
    };

    // BroadcastChannel for instant cross-tab communication
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel("leaselink_notifications_channel");
        channel.onmessage = (event) => {
          if (event.data?.notif) {
            handleIncoming(event.data.notif);
          }
        };
      } catch (_) {}
    }

    window.addEventListener("leaselink:notification_updated", loadNotifications);
    window.addEventListener("leaselink:new_notification", handleNewNotifEvent);
    window.addEventListener("leaselink:broadcast_sent", handleBroadcastSent);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("leaselink:notification_updated", loadNotifications);
      window.removeEventListener("leaselink:new_notification", handleNewNotifEvent);
      window.removeEventListener("leaselink:broadcast_sent", handleBroadcastSent);
      window.removeEventListener("storage", handleStorage);
      if (channel) {
        channel.close();
      }
    };
  }, [loadNotifications, role, userId, landlordId, buildingId, unitId]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);


  // Count unread
  const unreadCount = notifications.filter(isNotificationUnread).length;

  const handleMarkAsRead = async (id: string) => {
    // 1. Instantly update React state optimistically
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              is_read: true,
              read_by: readerId
                ? Array.from(new Set([...(n.read_by || []), readerId]))
                : n.read_by || [],
            }
          : n
      )
    );
    // 2. Persist to storage and Supabase
    await markNotificationAsRead(id, readerId);
  };

  const handleMarkAllRead = async () => {
    const allIds = notifications.map((n) => n.id);
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        is_read: true,
        read_by: readerId
          ? Array.from(new Set([...(n.read_by || []), readerId]))
          : n.read_by || [],
      }))
    );
    await markAllNotificationsAsRead(readerId, role, buildingId, allIds);
  };

  const handleClear = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await clearNotification(id);
  };

  // Filter list
  const displayedNotifications = notifications.filter((n) => {
    if (activeTab === "unread") {
      return isNotificationUnread(n);
    }
    return true;
  });

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return t("notifJustNow");
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return isFrench ? `Il y a ${diffMin} min` : `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return isFrench ? `Il y a ${diffHour} h` : `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays === 1) return t("notifYesterday");
    if (diffDays < 7) return isFrench ? `Il y a ${diffDays} j` : `${diffDays}d ago`;
    return date.toLocaleDateString(isFrench ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const isFloating = variant === "floating";

  return (
    <div
      className={
        isFloating
          ? `fixed bottom-20 right-4 xl:bottom-6 xl:right-6 z-40 ${className}`
          : `relative ${className}`
      }
      ref={dropdownRef}
    >
      {/* Trigger Button */}
      {isFloating ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/80 dark:border-slate-800 flex items-center justify-center cursor-pointer group"
          title={isFrench ? "Centre de notifications" : "Notification Center"}
          aria-label="Notifications"
          aria-expanded={isOpen}
        >
          <Bell className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:rotate-12" />

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-black text-white shadow-md ring-2 ring-white dark:ring-slate-900 animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-xs"
          title={t("notifTitle")}
          aria-label="Notifications"
          aria-expanded={isOpen}
        >
          <Bell className="w-4 h-4" />

          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-md animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Flyout / Dropdown Panel */}
      {isOpen && (
        <div
          className={
            isFloating
              ? "fixed bottom-36 right-4 sm:bottom-22 sm:right-6 z-50 w-[92vw] sm:w-[420px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in slide-in-from-bottom-5 duration-200"
              : "absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
          }
          role="dialog"
          aria-label="Notifications Panel"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {t("notifTitle")}
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-bold">
                  {unreadCount} {t("notifNewBadge")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer"
                  title={t("notifMarkAllRead")}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("notifMarkAllRead")}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/60 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t("notifFilterAll")} ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("unread")}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === "unread"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {t("notifFilterUnread")} ({unreadCount})
            </button>
          </div>

          {/* Notification List Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[60vh] select-none">
            {displayedNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-300">
                  {t("notifEmptyNone")}
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  {activeTab === "unread"
                    ? t("notifEmptyAllCaughtUp")
                    : t("notifEmptyDesc")}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const isUnread = isNotificationUnread(notif);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif.id)}
                    className={`p-4 transition flex items-start gap-3.5 group cursor-pointer relative border-l-4 ${
                      isUnread
                        ? "bg-blue-50/70 dark:bg-slate-900 hover:bg-blue-100/60 dark:hover:bg-slate-800 border-l-blue-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-75 hover:opacity-100 border-l-transparent"
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span className="absolute top-4 right-3 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                    )}

                    {/* Icon Avatar by Notification Type */}
                    <div className="shrink-0 mt-0.5">
                      {notif.type === "payment_received" && (
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                          <Receipt className="w-4 h-4" />
                        </div>
                      )}

                      {(notif.type === "broadcast_reminder" ||
                        notif.type === "rent_due_reminder" ||
                        notif.type === "rent_overdue") && (
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      )}

                      {notif.type === "tenant_arrived" && (
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                          <UserPlus className="w-4 h-4" />
                        </div>
                      )}

                      {notif.type === "tenant_departed" && (
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
                          <UserMinus className="w-4 h-4" />
                        </div>
                      )}

                      {notif.type === "landlord_registered" && (
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                      )}

                      {notif.type !== "payment_received" &&
                        notif.type !== "broadcast_reminder" &&
                        notif.type !== "rent_due_reminder" &&
                        notif.type !== "rent_overdue" &&
                        notif.type !== "tenant_arrived" &&
                        notif.type !== "tenant_departed" &&
                        notif.type !== "landlord_registered" && (
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1 pr-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-xs truncate ${
                            isUnread
                              ? "font-extrabold text-slate-900 dark:text-white"
                              : "font-semibold text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isFrench ? notif.title_fr || notif.title : notif.title}
                        </h4>

                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                          {getRelativeTime(notif.created_at)}
                        </span>
                      </div>

                      <p
                        className={`text-xs leading-relaxed line-clamp-2 ${
                          isUnread
                            ? "text-slate-800 dark:text-slate-200"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {isFrench ? notif.message_fr || notif.message : notif.message}
                      </p>

                      {/* Detail Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                        {notif.amount && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold">
                            {formatCurrency(notif.amount)}
                          </span>
                        )}

                        {notif.unit_number && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium flex items-center gap-1">
                            <DoorOpen className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              {isFrench ? "Logement" : "Unit"} {notif.unit_number}
                            </span>
                          </span>
                        )}

                        {notif.building_name && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>{notif.building_name}</span>
                          </span>
                        )}

                        {notif.payment_method && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 font-mono">
                            {notif.payment_method}
                          </span>
                        )}
                      </div>

                      {/* "Voir plus" Action Link */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/60 mt-1">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {notif.rent_month
                            ? `${isFrench ? "Période :" : "Period:"} ${notif.rent_month}`
                            : ""}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                            setSelectedNotifForView(notif);
                          }}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <span>{isFrench ? "Voir plus" : "View more"}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Clear Button */}
                    <div className="shrink-0 flex items-center">
                      <button
                        type="button"
                        onClick={(e) => handleClear(e, notif.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                        title={isFrench ? "Supprimer la notification" : "Delete notification"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky View All Notifications Footer */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowAllNotifsModal(true);
              }}
              className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>
                {isFrench
                  ? `Voir toutes les notifications (${notifications.length})`
                  : `View all notifications (${notifications.length})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Floating LeaseLink Platform Heads-Up Banner */}
      <PlatformHeadsUpBanner
        notification={activeBannerNotif}
        onClose={() => setActiveBannerNotif(null)}
        onViewMore={(n) => {
          setActiveBannerNotif(null);
          handleMarkAsRead(n.id);
          setSelectedNotifForView(n);
        }}
        onMarkRead={handleMarkAsRead}
        isFrench={isFrench}
        formatCurrency={formatCurrency}
      />

      {/* Full Notification Modal Reader */}
      <FullNotificationModal
        notification={selectedNotifForView}
        onClose={() => setSelectedNotifForView(null)}
        onMarkAsRead={handleMarkAsRead}
        role={role}
        isFrench={isFrench}
        formatCurrency={formatCurrency}
      />

      {/* Notification Center: View all notifications */}
      <AllNotificationsModal
        isOpen={showAllNotifsModal}
        onClose={() => setShowAllNotifsModal(false)}
        notifications={notifications}
        onSelectNotification={(n) => {
          setSelectedNotifForView(n);
        }}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllRead}
        onClear={handleClear}
        isNotificationUnread={isNotificationUnread}
        role={role}
        isFrench={isFrench}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
