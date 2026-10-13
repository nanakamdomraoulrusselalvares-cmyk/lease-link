"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import {
  Bell,
  CheckCheck,
  Receipt,
  UserPlus,
  UserMinus,
  AlertCircle,
  Building2,
  DoorOpen,
  DollarSign,
  X,
  Clock,
  Sparkles,
} from "lucide-react";
import { AppNotification } from "@/types/database";
import {
  getNotificationsForLandlord,
  getNotificationsForTenant,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotification,
} from "@/lib/services/notificationService";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface NotificationBellProps {
  role: "landlord" | "tenant";
  landlordId?: string | null;
  buildingId?: string | null;
  unitId?: string | null;
  tenantName?: string | null;
  className?: string;
}

export default function NotificationBell({
  role,
  landlordId,
  buildingId,
  unitId,
  tenantName,
  className = "",
}: NotificationBellProps) {
  const { t, isFrench, formatCurrency } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [isPending, startTransition] = useTransition();

  const dropdownRef = useRef<HTMLDivElement>(null);

  const readerId = role === "landlord" ? landlordId || "landlord" : unitId || "tenant";

  // Load notifications based on role
  const loadNotifications = async () => {
    try {
      if (role === "landlord") {
        const list = await getNotificationsForLandlord(landlordId);
        setNotifications(list);
      } else if (buildingId) {
        const list = await getNotificationsForTenant(buildingId, unitId);
        setNotifications(list);
      }
    } catch (err) {
      console.warn("Error loading notifications:", err);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Listen to custom notification broadcast event
    const handleUpdate = () => {
      loadNotifications();
    };

    window.addEventListener("leaselink:notification_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("leaselink:notification_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [role, landlordId, buildingId, unitId]);

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
  const unreadCount = notifications.filter((n) => {
    if (!n.is_read) return true;
    if (readerId && n.read_by && !n.read_by.includes(readerId)) return true;
    return false;
  }).length;

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id, readerId);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              is_read: true,
              read_by: Array.from(new Set([...(n.read_by || []), readerId])),
            }
          : n
      )
    );
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead(readerId, role, buildingId);
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        is_read: true,
        read_by: Array.from(new Set([...(n.read_by || []), readerId])),
      }))
    );
  };

  const handleClear = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await clearNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Filter list
  const displayedNotifications = notifications.filter((n) => {
    if (activeTab === "unread") {
      return !n.is_read || (readerId && n.read_by && !n.read_by.includes(readerId));
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

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-xs"
        title={t("notifTitle")}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {t("notifTitle")}
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 text-[11px] font-bold">
                  {unreadCount} {t("notifNewBadge")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer"
                  title={t("notifMarkAllRead")}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{t("notifMarkAllRead")}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
                const isUnread =
                  !notif.is_read ||
                  (readerId && notif.read_by && !notif.read_by.includes(readerId));

                return (
                  <div
                    key={notif.id}
                    onClick={() => isUnread && handleMarkAsRead(notif.id)}
                    className={`p-4 transition flex items-start gap-3.5 group cursor-pointer ${
                      isUnread
                        ? "bg-blue-50/50 dark:bg-gradient-to-r dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 hover:bg-blue-50 dark:hover:bg-slate-850"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {/* Icon Avatar by Notification Type */}
                    <div className="shrink-0 mt-0.5">
                      {notif.type === "payment_received" && (
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                          <Receipt className="w-4 h-4" />
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

                      {notif.type !== "payment_received" &&
                        notif.type !== "tenant_arrived" &&
                        notif.type !== "tenant_departed" && (
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-xs">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-xs font-bold truncate ${
                            isUnread ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isFrench ? notif.title_fr || notif.title : notif.title}
                        </h4>

                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                          {getRelativeTime(notif.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
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
                    </div>

                    {/* Quick Clear Button */}
                    <div className="shrink-0 flex items-center">
                      <button
                        type="button"
                        onClick={(e) => handleClear(e, notif.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition"
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

          {/* Footer */}
          {displayedNotifications.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {role === "landlord"
                ? t("notifLandlordFooter")
                : t("notifTenantFooter")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
