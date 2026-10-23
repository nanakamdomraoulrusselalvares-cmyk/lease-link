"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LandlordProfile } from "@/types/database";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Phone,
  MessageSquare,
  Receipt,
  X,
} from "lucide-react";

export function isMissingPhone(phone: string | null | undefined): boolean {
  if (!phone) return true;
  const trimmed = phone.trim().toLowerCase();
  return (
    trimmed === "" ||
    trimmed === "not provided" ||
    trimmed === "non renseigné" ||
    trimmed === "non renseigne" ||
    trimmed === "null" ||
    trimmed === "undefined"
  );
}

interface AttachPhoneModalProps {
  isOpen: boolean;
  profile?: LandlordProfile | null;
  user?: SupabaseUser | null;
  onPhoneSaved?: (newPhone: string) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

const COUNTRY_DIAL_CODES = [
  { code: "+237", country: "Cameroun (Cameroon)", flag: "🇨🇲" },
  { code: "+241", country: "Gabon", flag: "🇬🇦" },
  { code: "+225", country: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "+221", country: "Sénégal", flag: "🇸🇳" },
  { code: "+242", country: "Congo", flag: "🇨🇬" },
  { code: "+235", country: "Tchad (Chad)", flag: "🇹🇩" },
  { code: "+243", country: "RDC (DR Congo)", flag: "🇨🇩" },
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+1", country: "USA / Canada", flag: "🇺🇸" },
  { code: "+32", country: "Belgique", flag: "🇧🇪" },
  { code: "", country: "Autre / Other (Custom)", flag: "🌐" },
];

export default function AttachPhoneModal({
  isOpen,
  profile,
  user,
  onPhoneSaved,
  onClose,
  canDismiss = false,
}: AttachPhoneModalProps) {
  const { isFrench } = useLanguage();

  const [countryCode, setCountryCode] = useState("+237");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const effectiveUserId = profile?.id || user?.id;

  if (!isOpen || !effectiveUserId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanDigits = phoneNumber.replace(/[\s\-\(\)\.]/g, "");

    if (!cleanDigits) {
      setErrorMsg(
        isFrench
          ? "Veuillez renseigner un numéro de téléphone valide."
          : "Please enter a valid telephone number."
      );
      return;
    }

    if (cleanDigits.length < 8 || cleanDigits.length > 15) {
      setErrorMsg(
        isFrench
          ? "Le numéro doit comporter entre 8 et 15 chiffres."
          : "Phone number must be between 8 and 15 digits long."
      );
      return;
    }

    const fullPhoneNumber = countryCode
      ? `${countryCode} ${cleanDigits}`.trim()
      : cleanDigits;

    setIsSaving(true);

    try {
      const supabase = createClient();

      // 1. Update Supabase profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          phone: fullPhoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", effectiveUserId);

      if (profileError) {
        throw new Error(profileError.message);
      }

      // 2. Update Supabase Auth user metadata
      try {
        await supabase.auth.updateUser({
          data: {
            phone: fullPhoneNumber,
          },
        });
      } catch (authErr) {
        console.warn("Could not sync phone into auth metadata:", authErr);
      }

      // 3. Update cached dashboard state
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("leaselink_cached_dashboard");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.profile && parsed.profile.id === effectiveUserId) {
              parsed.profile.phone = fullPhoneNumber;
              localStorage.setItem("leaselink_cached_dashboard", JSON.stringify(parsed));
            }
          }
        } catch (_) {}

        try {
          const rawProfiles = localStorage.getItem("leaselink_local_profiles");
          if (rawProfiles) {
            const list = JSON.parse(rawProfiles);
            const idx = list.findIndex((p: any) => p.id === effectiveUserId);
            if (idx >= 0) {
              list[idx].phone = fullPhoneNumber;
              localStorage.setItem("leaselink_local_profiles", JSON.stringify(list));
            }
          }
        } catch (_) {}

        try {
          const rawMock = localStorage.getItem("leaselink_mock_profiles");
          if (rawMock) {
            const list = JSON.parse(rawMock);
            const idx = list.findIndex((p: any) => p.id === effectiveUserId);
            if (idx >= 0) {
              list[idx].phone = fullPhoneNumber;
              localStorage.setItem("leaselink_mock_profiles", JSON.stringify(list));
            }
          }
        } catch (_) {}

        // Broadcast phone update
        window.dispatchEvent(
          new CustomEvent("leaselink:phone_updated", {
            detail: { phone: fullPhoneNumber, landlordId: effectiveUserId },
          })
        );
      }

      setSuccess(true);

      setTimeout(() => {
        if (onPhoneSaved) {
          onPhoneSaved(fullPhoneNumber);
        }
        if (onClose) {
          onClose();
        }
      }, 700);
    } catch (err: any) {
      console.error("Error saving phone number:", err);
      setErrorMsg(
        err?.message ||
          (isFrench
            ? "Impossible d'enregistrer le numéro de téléphone."
            : "Could not save phone number.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl dark:shadow-blue-950/50 space-y-6">
        {/* Optional close button if dismissible */}
        {canDismiss && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header with Icon Badge */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Smartphone className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>{isFrench ? "Finalisation du Compte" : "Account Setup"}</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {isFrench
              ? "Associez votre Numéro de Téléphone"
              : "Attach Your Telephone Number"}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {isFrench
              ? "Vous vous êtes inscrit avec Google. Renseignez votre numéro WhatsApp pour émettre vos quittances et gérer vos locataires en toute sérénité."
              : "You signed up with Google. Please attach your phone / WhatsApp contact to emit certified rent receipts and reach your tenants."}
          </p>
        </div>

        {/* Why this is required - 3 key reasons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-center space-y-1">
            <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <span className="block text-[11px] font-bold text-slate-900 dark:text-white">
              {isFrench ? "Quittances" : "Rent Receipts"}
            </span>
            <span className="block text-[10px] text-slate-500 leading-tight">
              {isFrench ? "Coordonnées bailleur" : "Landlord details"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-center space-y-1">
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <span className="block text-[11px] font-bold text-slate-900 dark:text-white">
              {isFrench ? "WhatsApp Direct" : "WhatsApp Chat"}
            </span>
            <span className="block text-[10px] text-slate-500 leading-tight">
              {isFrench ? "Relances loyers 1-clic" : "1-click rent reminders"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-center space-y-1">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto" />
            <span className="block text-[11px] font-bold text-slate-900 dark:text-white">
              {isFrench ? "Sécurité" : "Security"}
            </span>
            <span className="block text-[10px] text-slate-500 leading-tight">
              {isFrench ? "Paiements MoMo vérifiés" : "Verified MoMo payouts"}
            </span>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {isFrench
                ? "Numéro enregistré avec succès !"
                : "Phone number saved successfully!"}
            </span>
          </div>
        )}

        {/* Phone Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-500" />
              <span>
                {isFrench
                  ? "Numéro de Téléphone (WhatsApp de préférence)"
                  : "Telephone Number (WhatsApp preferred)"}
              </span>
            </label>

            <div className="flex gap-2">
              {/* Country Code Select */}
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-36 px-2.5 py-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shrink-0"
              >
                {COUNTRY_DIAL_CODES.map((item, idx) => (
                  <option key={idx} value={item.code}>
                    {item.flag} {item.code || "+..."} {item.country.split(" ")[0]}
                  </option>
                ))}
              </select>

              {/* Number Input */}
              <input
                type="tel"
                required
                autoFocus
                placeholder="6XX XXX XXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-mono tracking-wider bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isFrench
                ? "Exemple Cameroun : 670 12 34 56 (Orange ou MTN MoMo)"
                : "Example: 670 12 34 56 (Orange or MTN Mobile Money)"}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || success}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white shadow-lg shadow-blue-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isFrench ? "Enregistrement..." : "Saving..."}</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isFrench ? "Numéro Associé !" : "Phone Attached!"}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {isFrench
                      ? "Confirmer & Associer à Mon Compte"
                      : "Confirm & Attach to Account"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
