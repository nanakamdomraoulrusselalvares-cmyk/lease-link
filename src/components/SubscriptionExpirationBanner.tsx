"use client";

import React, { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LandlordProfile } from "@/types/database";
import { getSubscriptionExpirationMilestone, getWhatsAppReminderLink } from "@/lib/services/adminService";
import { createNotification } from "@/lib/services/notificationService";
import { AlertTriangle, Clock, Sparkles, MessageCircle, X } from "lucide-react";

interface SubscriptionExpirationBannerProps {
  profile: LandlordProfile | null;
  onRenewClick?: () => void;
}

export default function SubscriptionExpirationBanner({
  profile,
  onRenewClick,
}: SubscriptionExpirationBannerProps) {
  const { isFrench } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!profile || !profile.plan_expires_at || profile.role !== "landlord") return;

    const milestoneInfo = getSubscriptionExpirationMilestone(profile.plan_expires_at);
    if (milestoneInfo.milestone === "none") return;

    // Dispatch in-app notification for the active milestone if not yet sent this period
    const notificationKey = `leaselink_notified_${profile.id}_${milestoneInfo.milestone}_${profile.plan_expires_at}`;
    if (typeof window !== "undefined") {
      const alreadySent = sessionStorage.getItem(notificationKey);
      if (!alreadySent) {
        try {
          sessionStorage.setItem(notificationKey, "true");
          createNotification({
            type: "system",
            title: isFrench
              ? `Abonnement : Échéance dans ${milestoneInfo.daysLeft} jour(s)`
              : `Subscription: Expires in ${milestoneInfo.daysLeft} day(s)`,
            title_fr: `Abonnement : Échéance dans ${milestoneInfo.daysLeft} jour(s)`,
            message: isFrench
              ? `Votre formule LeaseLink (${profile.plan_name}) arrive à terme le ${new Date(profile.plan_expires_at).toLocaleDateString()}. Renouvelez dès maintenant pour éviter l'interruption des accès locataires.`
              : `Your LeaseLink subscription (${profile.plan_name}) will expire on ${new Date(profile.plan_expires_at).toLocaleDateString()}. Please renew to prevent portal access interruption.`,
            message_fr: `Votre formule LeaseLink (${profile.plan_name}) arrive à terme le ${new Date(profile.plan_expires_at).toLocaleDateString()}. Renouvelez dès maintenant pour éviter l'interruption des accès locataires.`,
            recipient_role: "landlord",
            landlord_id: profile.id,
            metadata: {
              milestone: milestoneInfo.milestone,
              daysLeft: milestoneInfo.daysLeft,
              planExpiresAt: profile.plan_expires_at,
            },
          });
        } catch (_) {}
      }
    }
  }, [profile, isFrench]);

  if (!profile || !profile.plan_expires_at || dismissed) return null;
  if (profile.role !== "landlord") return null;

  const milestoneInfo = getSubscriptionExpirationMilestone(profile.plan_expires_at);
  // Only show banner for <= 7 days remaining
  if (milestoneInfo.milestone === "none" || milestoneInfo.isExpired) return null;

  const expiryFormatted = new Date(profile.plan_expires_at).toLocaleDateString(isFrench ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const whatsappUrl = getWhatsAppReminderLink(
    {
      full_name: profile.full_name,
      phone: profile.phone,
      plan_name: profile.plan_name,
      plan_expires_at: profile.plan_expires_at,
      plan_unit_limit: profile.plan_unit_limit,
    },
    isFrench
  );

  const isUrgent = milestoneInfo.daysLeft <= 3;

  return (
    <div
      className={`w-full py-2.5 px-4 sm:px-6 text-xs transition-colors shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isUrgent
          ? "bg-rose-500/10 dark:bg-rose-500/20 border-b border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200"
          : "bg-amber-500/10 dark:bg-amber-500/20 border-b border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`p-1.5 rounded-lg shrink-0 ${
            isUrgent ? "bg-rose-500 text-white animate-pulse" : "bg-amber-500 text-white"
          }`}
        >
          {isUrgent ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
        </div>

        <div className="min-w-0">
          <span className="font-extrabold uppercase tracking-wide mr-1.5">
            {isFrench
              ? `Rappel J-${milestoneInfo.daysLeft} :`
              : `Reminder J-${milestoneInfo.daysLeft}:`}
          </span>
          <span className="truncate">
            {isFrench
              ? `Votre formule arrive à échéance dans ${milestoneInfo.daysLeft} jour(s) (${expiryFormatted}). Pensez à renouveler pour éviter toute coupure de service.`
              : `Your subscription expires in ${milestoneInfo.daysLeft} day(s) on ${expiryFormatted}. Renew now to avoid service interruption.`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRenewClick && (
          <button
            onClick={onRenewClick}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>{isFrench ? "Renouveler" : "Renew Plan"}</span>
          </button>
        )}

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 transition"
          title={isFrench ? "M'envoyer une alerte WhatsApp" : "Send WhatsApp Alert"}
        >
          <MessageCircle className="w-3 h-3" />
          <span className="hidden md:inline">{isFrench ? "Alerte WhatsApp" : "WhatsApp Alert"}</span>
        </a>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 transition cursor-pointer"
          aria-label="Fermer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
