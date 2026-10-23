"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  Lock,
  Wrench,
  X,
  Phone,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Building2,
} from "lucide-react";

interface RentPaymentUnderWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  landlordName?: string;
  landlordPhone?: string;
  buildingName?: string;
  unitNumber?: string;
}

export default function RentPaymentUnderWorkModal({
  isOpen,
  onClose,
  landlordName,
  landlordPhone,
  buildingName,
  unitNumber,
}: RentPaymentUnderWorkModalProps) {
  const { isFrench } = useLanguage();

  if (!isOpen) return null;

  const cleanPhone = landlordPhone ? landlordPhone.replace(/[^0-9+]/g, "") : "";
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(
        isFrench
          ? `Bonjour, je suis le locataire du logement ${unitNumber || ""} (${buildingName || ""}). Je vous contacte concernant le règlement de mon loyer.`
          : `Hello, I am the tenant of unit ${unitNumber || ""} (${buildingName || ""}). I am contacting you regarding my rent payment.`
      )}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 z-10 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Lock & Maintenance Graphic */}
        <div className="flex items-start gap-4 pr-6">
          <div className="relative w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            <Lock className="w-6 h-6" />
            <span className="absolute -bottom-1 -right-1 p-1 bg-amber-500 text-slate-950 rounded-full shadow-xs">
              <Wrench className="w-2.5 h-2.5" />
            </span>
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>{isFrench ? "Paiement en travaux" : "Work in progress"}</span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
              {isFrench
                ? "Paiement en Ligne Temporairement Indisponible"
                : "Online Payment Temporarily Unavailable"}
            </h3>
          </div>
        </div>

        {/* Explanation Message */}
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
          <p className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <span>🔒</span>
            {isFrench
              ? "Le paiement automatique du loyer est en cours de finalisation."
              : "Automated rent payment is currently under development."}
          </p>
          <p className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-200/80">
            {isFrench
              ? "L'intégration technique de la passerelle de règlement direct (Mobile Money et Carte bancaire) est en cours de déploiement et de tests de sécurité. Pour le moment, aucun règlement ne peut être débité via cette interface."
              : "The technical integration of the direct payment gateway (Mobile Money & Card) is currently undergoing final deployment and security testing. No payments can be processed via this interface at this time."}
          </p>
        </div>

        {/* What to do next instructions */}
        <div className="space-y-2.5 text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {isFrench
              ? "Comment régler votre loyer actuellement ?"
              : "How to pay your rent currently?"}
          </p>
          <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                {isFrench
                  ? "Réglez directement auprès de votre bailleur ou gestionnaire (en espèces ou par transfert Mobile Money direct)."
                  : "Pay directly to your landlord or property manager (in cash or direct Mobile Money transfer)."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                {isFrench
                  ? "Votre bailleur enregistrera votre versement et votre quittance officielle sera disponible immédiatement dans l'onglet Quittances."
                  : "Your landlord will register your payment, and your official receipt will appear immediately under the Receipts tab."}
              </span>
            </li>
          </ul>
        </div>

        {/* Landlord Contact Card if available */}
        {(landlordName || landlordPhone) && (
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {isFrench ? "Votre Contact Bailleur" : "Your Landlord Contact"}
              </p>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {landlordName || (isFrench ? "Bailleur" : "Landlord")}
              </p>
              {landlordPhone && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                  {landlordPhone}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {cleanPhone && (
                <a
                  href={`tel:${cleanPhone}`}
                  className="p-2 rounded-xl bg-blue-50 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
                  title={isFrench ? "Appeler" : "Call"}
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Dismiss Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold shadow-md transition cursor-pointer"
          >
            {isFrench ? "Compris / Fermer" : "Got it / Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
