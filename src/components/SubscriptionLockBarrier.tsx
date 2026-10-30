"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LandlordProfile } from "@/types/database";
import { Lock, ShieldCheck, ShieldAlert, Sparkles, MessageCircle, LogOut, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SubscriptionLockBarrierProps {
  profile: LandlordProfile | null;
  onRenewClick?: () => void;
}

export default function SubscriptionLockBarrier({
  profile,
  onRenewClick,
}: SubscriptionLockBarrierProps) {
  const { isFrench } = useLanguage();
  const router = useRouter();

  if (!profile) return null;
  // Super-admin accounts are never locked
  if (profile.role === "admin") return null;

  const now = Date.now();
  const expTime = profile.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : null;
  const isExpired = Boolean(
    (expTime && expTime < now) ||
    profile.plan_status === "expired" ||
    profile.subscription_status === "expired"
  );

  if (!isExpired) return null;

  const expiryFormatted = profile.plan_expires_at
    ? new Date(profile.plan_expires_at).toLocaleDateString(isFrench ? "fr-FR" : "en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (_) {}
    router.push("/login");
  };

  const isManager = profile.role === "manager";

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Status Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
          {isManager ? (
            <ShieldCheck className="w-10 h-10 text-purple-600 dark:text-purple-400" />
          ) : (
            <Lock className="w-10 h-10 text-amber-600 dark:text-amber-400 animate-bounce" />
          )}
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isFrench ? "Compte en Pause" : "Account On Hold"}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {isManager
              ? isFrench
                ? "Abonnement du Bailleur en Attente de Renouvellement"
                : "Landlord Plan Pending Renewal"
              : isFrench
              ? "Forfait Arrivé à Échéance"
              : "Subscription Plan Expired"}
          </h2>

          {expiryFormatted && (
            <p className="text-xs font-mono text-slate-500">
              {isFrench ? `Échéance dépassée le : ${expiryFormatted}` : `Plan expired on: ${expiryFormatted}`}
            </p>
          )}
        </div>

        {/* Message */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-3">
          {isManager ? (
            <>
              <p>
                {isFrench
                  ? "Le propriétaire bailleur de ce patrimoine n'a pas encore procédé au renouvellement de son forfait LeaseLink."
                  : "The property owner has not yet renewed their LeaseLink platform subscription."}
              </p>
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-900 dark:text-purple-200 text-xs font-medium flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  {isFrench
                    ? "Soyez pleinement rassuré(e) : l'ensemble des données de vos immeubles, lots, quittances et locataires sont précieusement et en toute sécurité conservées. Votre accès complet sera instantanément rétabli dès que le bailleur aura validé son abonnement."
                    : "Rest assured: all property, unit, payment, and tenant records are 100% securely saved. Your full manager access will be immediately restored as soon as the landlord renews."}
                </span>
              </div>
            </>
          ) : (
            <>
              <p>
                {isFrench
                  ? "La durée de validité de votre formule est arrivée à son terme. Les fonctionnalités de gestion ainsi que les accès de vos locataires et de vos gestionnaires délégués sont temporairement suspendus."
                  : "Your subscription validity limit has been reached. Management features and tenant/manager portals are temporarily on hold."}
              </p>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 text-xs font-medium flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {isFrench
                    ? "Vos données, baux, contrats et quittances sont précieusement sauvegardés et protégés. Renouvelez votre forfait dès maintenant pour réactiver immédiatement tous les accès."
                    : "All your tenant records, leases, contracts, and receipts remain completely secure. Renew your plan now to immediately restore access for yourself, your managers, and your tenants."}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {!isManager && onRenewClick && (
            <button
              onClick={onRenewClick}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isFrench ? "Renouveler Mon Forfait Immédiatement" : "Renew My Subscription Now"}</span>
            </button>
          )}

          {isManager && (
            <a
              href="https://wa.me/?text=Bonjour%20Bailleur%2C%20l%27abonnement%20LeaseLink%20du%20patrimoine%20est%20arriv%C3%A9%20%C3%A0%20%C3%A9ch%C3%A9ance.%20Merci%20de%20proc%C3%A9der%20au%20renouvellement%20pour%20r%C3%A9activer%20les%20acc%C3%A8s."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{isFrench ? "Informer le Bailleur via WhatsApp" : "Notify Landlord via WhatsApp"}</span>
            </a>
          )}

          <div className="flex items-center justify-center gap-4 text-xs pt-1">
            <button
              onClick={() => window.location.reload()}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isFrench ? "Vérifier le statut" : "Refresh status"}</span>
            </button>

            <button
              onClick={handleLogout}
              className="text-rose-500 hover:text-rose-600 inline-flex items-center gap-1 font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isFrench ? "Déconnexion" : "Sign Out"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
