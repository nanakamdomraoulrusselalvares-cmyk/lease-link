"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
  ExternalLink,
  MessageSquare,
  Search,
  Check,
  Calendar,
  DollarSign,
  AlertTriangle,
  Send,
  Phone,
  Eye,
  CreditCard,
  MessageCircle,
} from "lucide-react";
import { AppNotification } from "@/types/database";

// Synthesized acoustic chime tuned to LeaseLink's clean platform frequency (C5 ~523.25Hz -> G5 ~783.99Hz)
export function playPlatformNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First harmonious tone (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // Second elegant resonance (G5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now + 0.09);
    gain2.gain.setValueAtTime(0.1, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.45);
  } catch (_) {
    // Silently ignore if audio context requires prior user interaction
  }
}

// Backwards-compatible export alias
export const playWhatsAppChime = playPlatformNotificationChime;

// ============================================================================
// 1. LeaseLink Platform Heads-Up Floating Banner Notification
// ============================================================================
interface PlatformHeadsUpBannerProps {
  notification: AppNotification | null;
  onClose: () => void;
  onViewMore: (notif: AppNotification) => void;
  onMarkRead?: (id: string) => void;
  isFrench: boolean;
  formatCurrency?: (val: number) => string;
}

export function PlatformHeadsUpBanner({
  notification,
  onClose,
  onViewMore,
  onMarkRead,
  isFrench,
  formatCurrency = (n) => `${n.toLocaleString()} FCFA`,
}: PlatformHeadsUpBannerProps) {
  if (!notification) return null;

  const senderName =
    (notification.metadata?.sender_name as string) ||
    (isFrench ? "Bailleur LeaseLink" : "LeaseLink Property Manager");

  const title = isFrench
    ? notification.title_fr || notification.title
    : notification.title;

  const message = isFrench
    ? notification.message_fr || notification.message
    : notification.message;

  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[95%] max-w-lg animate-in fade-in slide-in-from-top-6 duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-blue-500/30 text-white shadow-2xl shadow-blue-950/60 p-4 ring-1 ring-blue-400/20">
        {/* LeaseLink signature blue gradient top bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

        {/* Header row: LeaseLink logo, Sender, "Now", and Close */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* LeaseLink Official App Badge */}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30 shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-tight text-white truncate">
                  Lease<span className="text-blue-400">Link</span> • {senderName}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 animate-ping" />
              </div>
              <span className="text-[10px] text-blue-300 font-semibold block">
                {isFrench ? "Notification Plateforme LeaseLink" : "LeaseLink Property Notification"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400 font-medium">
              {isFrench ? "à l'instant" : "just now"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              title={isFrench ? "Fermer" : "Dismiss"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message body */}
        <div className="space-y-1.5 pr-1">
          <h4 className="text-xs font-bold text-blue-200 leading-snug">
            {title}
          </h4>
          <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">
            {message}
          </p>

          {/* Metadata pill: amount / unit */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {notification.amount && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-200 text-[11px] font-bold font-mono">
                {isFrench ? "Solde dû :" : "Due :"} {formatCurrency(notification.amount)}
              </span>
            )}
            {notification.unit_number && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-semibold flex items-center gap-1">
                <DoorOpen className="w-3 h-3 text-blue-400" />
                <span>
                  {isFrench ? "Logement" : "Unit"} {notification.unit_number}
                </span>
              </span>
            )}
            {notification.building_name && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-medium truncate max-w-[150px]">
                {notification.building_name}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons row */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          {onMarkRead && (
            <button
              type="button"
              onClick={() => {
                onMarkRead(notification.id);
                onClose();
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-blue-400" />
              <span>{isFrench ? "Marquer comme lu" : "Mark as read"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onViewMore(notification)}
            className="ml-auto px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-bold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <span>{isFrench ? "Voir plus" : "View more"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Backwards-compatible export alias so existing references keep working
export const WhatsAppHeadsUpBanner = PlatformHeadsUpBanner;

// ============================================================================
// 2. Full Notification Reader Modal ("Voir Plus")
// ============================================================================
interface FullNotificationModalProps {
  notification: AppNotification | null;
  onClose: () => void;
  onMarkAsRead?: (id: string) => void;
  role?: "landlord" | "manager" | "admin" | "tenant";
  isFrench: boolean;
  formatCurrency?: (val: number) => string;
}

export function FullNotificationModal({
  notification,
  onClose,
  onMarkAsRead,
  role = "tenant",
  isFrench,
  formatCurrency = (n) => `${n.toLocaleString()} FCFA`,
}: FullNotificationModalProps) {
  if (!notification) return null;

  const title = isFrench
    ? notification.title_fr || notification.title
    : notification.title;

  const message = isFrench
    ? notification.message_fr || notification.message
    : notification.message;

  const senderName =
    (notification.metadata?.sender_name as string) ||
    (isFrench ? "Bailleur LeaseLink" : "LeaseLink Landlord");

  const formattedDate = new Date(notification.created_at).toLocaleDateString(
    isFrench ? "fr-FR" : "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return (
    <div className="fixed inset-0 z-[100000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 mb-3">
            <Bell className="w-3.5 h-3.5" />
            <span>
              {notification.type === "broadcast_reminder"
                ? isFrench ? "Rappel Groupé de Loyer" : "Broadcast Rent Reminder"
                : notification.type === "rent_due_reminder" || notification.type === "rent_overdue"
                ? isFrench ? "Échéance de Loyer" : "Rent Due Notice"
                : notification.type === "payment_received"
                ? isFrench ? "Quittance & Paiement" : "Payment Receipt"
                : isFrench ? "Notification Officielle" : "Official Notice"}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
            {title}
          </h3>

          <p className="text-xs text-slate-300 mt-1 capitalize font-medium">
            {formattedDate}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Key info pill strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {notification.amount && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <span className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-400 block">
                  {isFrench ? "Montant concerné" : "Amount"}
                </span>
                <span className="text-sm font-black text-emerald-950 dark:text-emerald-300 font-mono">
                  {formatCurrency(notification.amount)}
                </span>
              </div>
            )}

            {notification.unit_number && (
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                <span className="text-[10px] font-bold uppercase text-blue-800 dark:text-blue-400 block">
                  {isFrench ? "Logement" : "Unit"}
                </span>
                <span className="text-sm font-black text-blue-950 dark:text-blue-300">
                  {notification.unit_number}
                </span>
              </div>
            )}

            {notification.building_name && (
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 block truncate">
                  {isFrench ? "Immeuble" : "Property"}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">
                  {notification.building_name}
                </span>
              </div>
            )}
          </div>

          {/* Full Message Text */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              {isFrench ? "Message complet" : "Full message content"}
            </span>
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">
              {message}
            </p>
          </div>

          {/* Sender info */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
            <span>{isFrench ? "Émis par :" : "Sent by:"} <strong className="text-slate-800 dark:text-slate-200">{senderName}</strong></span>
            {notification.rent_month && (
              <span>{isFrench ? "Mois :" : "Month:"} <strong className="text-slate-800 dark:text-slate-200">{notification.rent_month}</strong></span>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {onMarkAsRead && (
            <button
              type="button"
              onClick={() => {
                onMarkAsRead(notification.id);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <Check className="w-4 h-4 text-emerald-500" />
              <span>{isFrench ? "Marquer comme lu" : "Mark as read"}</span>
            </button>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
            {role === "tenant" && (notification.type === "broadcast_reminder" || notification.type === "rent_due_reminder" || notification.type === "rent_overdue") && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  isFrench
                    ? `Bonjour, je vous contacte au sujet de la notification de loyer pour le logement ${notification.unit_number || ""}.`
                    : `Hello, contacting you regarding the rent notice for unit ${notification.unit_number || ""}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/25"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isFrench ? "Écrire au bailleur" : "Message Landlord"}</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition text-center"
            >
              {isFrench ? "Fermer" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. Notification Center Modal ("Voir Toutes les Notifications")
// ============================================================================
interface AllNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onSelectNotification: (notif: AppNotification) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClear: (e: React.MouseEvent, id: string) => void;
  isNotificationUnread: (notif: AppNotification) => boolean;
  role?: "landlord" | "manager" | "admin" | "tenant";
  isFrench: boolean;
  formatCurrency?: (val: number) => string;
}

export function AllNotificationsModal({
  isOpen,
  onClose,
  notifications,
  onSelectNotification,
  onMarkAsRead,
  onMarkAllAsRead,
  onClear,
  isNotificationUnread,
  role = "tenant",
  isFrench,
  formatCurrency = (n) => `${n.toLocaleString()} FCFA`,
}: AllNotificationsModalProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "unread" | "rent" | "receipts">("all");

  const filtered = useMemo(() => {
    return notifications.filter((notif) => {
      // Category filter
      if (categoryFilter === "unread" && !isNotificationUnread(notif)) return false;
      if (
        categoryFilter === "rent" &&
        notif.type !== "broadcast_reminder" &&
        notif.type !== "rent_due_reminder" &&
        notif.type !== "rent_overdue"
      )
        return false;
      if (categoryFilter === "receipts" && notif.type !== "payment_received") return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (notif.title || "").toLowerCase().includes(q) || (notif.title_fr || "").toLowerCase().includes(q);
        const matchMsg = (notif.message || "").toLowerCase().includes(q) || (notif.message_fr || "").toLowerCase().includes(q);
        const matchUnit = (notif.unit_number || "").toLowerCase().includes(q);
        const matchBld = (notif.building_name || "").toLowerCase().includes(q);
        return matchTitle || matchMsg || matchUnit || matchBld;
      }

      return true;
    });
  }, [notifications, categoryFilter, search, isNotificationUnread]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {isFrench ? "Centre de Notifications" : "Notification Center"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFrench
                  ? `Consultez l'historique complet de vos alertes (${notifications.length})`
                  : `Review all historical alerts & messages (${notifications.length})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
              title={isFrench ? "Tout marquer comme lu" : "Mark all as read"}
            >
              <CheckCheck className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">{isFrench ? "Tout marquer lu" : "Mark all read"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Filter Tabs */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isFrench
                  ? "Rechercher une notification par texte, logement, immeuble..."
                  : "Search notifications by text, unit, building..."
              }
              className="w-full pl-9.5 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                categoryFilter === "all"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              {isFrench ? "Toutes" : "All"} ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("unread")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                categoryFilter === "unread"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              {isFrench ? "Non lues" : "Unread"} ({notifications.filter(isNotificationUnread).length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("rent")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                categoryFilter === "rent"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              {isFrench ? "Rappels & Loyers" : "Rent Notices"}
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("receipts")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                categoryFilter === "receipts"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              {isFrench ? "Quittances" : "Receipts"}
            </button>
          </div>
        </div>

        {/* List of Notifications */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-2 sm:p-4">
          {filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                {isFrench ? "Aucune notification trouvée" : "No notifications found"}
              </p>
            </div>
          ) : (
            filtered.map((notif) => {
              const isUnread = isNotificationUnread(notif);
              return (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-2xl transition flex items-start gap-3 group ${
                    isUnread
                      ? "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {/* Type icon */}
                  <div className="shrink-0 mt-0.5">
                    {notif.type === "broadcast_reminder" || notif.type === "rent_due_reminder" || notif.type === "rent_overdue" ? (
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    ) : notif.type === "payment_received" ? (
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Receipt className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Bell className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`text-xs truncate ${
                          isUnread
                            ? "font-black text-slate-900 dark:text-white"
                            : "font-bold text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {isFrench ? notif.title_fr || notif.title : notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {new Date(notif.created_at).toLocaleDateString(isFrench ? "fr-FR" : "en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                      {isFrench ? notif.message_fr || notif.message : notif.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {notif.amount && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          {formatCurrency(notif.amount)}
                        </span>
                      )}
                      {notif.unit_number && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium">
                          {isFrench ? "Logement" : "Unit"} {notif.unit_number}
                        </span>
                      )}
                      {notif.building_name && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium truncate max-w-[150px]">
                          {notif.building_name}
                        </span>
                      )}

                      {/* "Voir plus" Action Link */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectNotification(notif);
                          if (isUnread) onMarkAsRead(notif.id);
                        }}
                        className="ml-auto text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isFrench ? "Voir détails" : "View details"}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Clear button */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={(e) => onClear(e, notif.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded-lg transition"
                      title={isFrench ? "Supprimer" : "Delete"}
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
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {filtered.length} {isFrench ? "notifications affichées" : "notifications shown"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition"
          >
            {isFrench ? "Fermer" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
