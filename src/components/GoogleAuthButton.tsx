"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ShieldCheck,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface GoogleAuthButtonProps {
  mode?: "login" | "signup";
  label?: string;
  nextUrl?: string;
  className?: string;
  onError?: (error: string) => void;
  requireTerms?: boolean;
  acceptedTerms?: boolean;
  onTermsChange?: (accepted: boolean) => void;
  onTermsRequired?: () => void;
}

export default function GoogleAuthButton({
  mode = "login",
  label,
  nextUrl = "/dashboard",
  className = "",
  onError,
  requireTerms,
  acceptedTerms = false,
  onTermsChange,
  onTermsRequired,
}: GoogleAuthButtonProps) {
  const { isFrench } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [modalAccepted, setModalAccepted] = useState(false);
  const [modalError, setModalError] = useState(false);

  // By default, terms are required on signup, but not strictly needed repeatedly on login
  const shouldRequireTerms =
    requireTerms !== undefined ? requireTerms : mode === "signup";

  const executeGoogleSignIn = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "";

      // Store flow mode in a short-lived cookie for fallback in callback route
      if (typeof document !== "undefined") {
        document.cookie = `sb_oauth_flow=${mode}; path=/; max-age=300; samesite=lax`;
      }

      const redirectTo = `${origin}/auth/callback?mode=${mode}&next=${encodeURIComponent(nextUrl)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setLoading(false);
        const raw = error.message || "";
        let friendly = raw;
        if (raw.toLowerCase().includes("provider is not enabled") || raw.toLowerCase().includes("unsupported provider")) {
          friendly = isFrench
            ? "L'authentification Google n'est pas encore activée dans votre projet Supabase. Rendez-vous dans votre tableau de bord Supabase (Authentication -> Providers -> Google) et activez-le avec votre Client ID & Secret Google."
            : "Google authentication is not yet enabled in your Supabase project. Go to your Supabase Dashboard (Authentication -> Providers -> Google) and enable it with your Google Client ID & Secret.";
        }
        if (onError) onError(friendly);
      }
    } catch (err: unknown) {
      setLoading(false);
      const raw = err instanceof Error ? err.message : "";
      let msg = isFrench
        ? "Impossible de démarrer la connexion avec Google."
        : "Failed to initiate Google Sign In.";
      if (raw.toLowerCase().includes("provider is not enabled") || raw.toLowerCase().includes("unsupported provider")) {
        msg = isFrench
          ? "L'authentification Google n'est pas encore activée dans votre projet Supabase (Authentication -> Providers -> Google)."
          : "Google authentication is not yet enabled in your Supabase project (Authentication -> Providers -> Google).";
      } else if (raw) {
        msg = raw;
      }
      if (onError) onError(msg);
    }
  };

  const handleButtonClick = () => {
    // If terms acceptance is enforced and not yet agreed to:
    if (shouldRequireTerms && !acceptedTerms) {
      if (onTermsRequired) onTermsRequired();
      setModalAccepted(false);
      setModalError(false);
      setShowTermsModal(true);
      return;
    }

    executeGoogleSignIn();
  };

  const handleModalConfirm = () => {
    if (!modalAccepted) {
      setModalError(true);
      return;
    }

    if (onTermsChange) {
      onTermsChange(true);
    }

    setShowTermsModal(false);
    executeGoogleSignIn();
  };

  const defaultLabel =
    mode === "signup"
      ? isFrench
        ? "Créer mon compte avec Google"
        : "Sign up with Google"
      : isFrench
      ? "Se connecter avec Google"
      : "Sign in with Google";

  return (
    <>
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm transition shadow-xs hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${className}`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        ) : (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{label || defaultLabel}</span>
      </button>

      {/* Terms & Conditions Acceptance Modal for Google Sign-In */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 relative text-left">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isFrench ? "Conditions d'Utilisation" : "Terms & Conditions"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isFrench ? "Requis avant de continuer avec Google" : "Required before continuing with Google"}
                </p>
              </div>
            </div>

            {/* Explanatory Body */}
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              {isFrench
                ? "Pour utiliser LeaseLink et gérer votre patrimoine locatif, vous devez lire et accepter nos règles d'utilisation et de protection des données."
                : "To use LeaseLink and manage your rental portfolio, you must review and agree to our terms of service and data protection policies."}
            </p>

            {/* Interactive Checkbox */}
            <div className={`p-4 rounded-2xl border transition ${
              modalError
                ? "bg-rose-50/80 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40"
                : modalAccepted
                ? "bg-blue-50/60 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            }`}>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={modalAccepted}
                  onChange={(e) => {
                    setModalAccepted(e.target.checked);
                    if (e.target.checked) setModalError(false);
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {isFrench
                    ? "J'ai lu et j'accepte sans réserve les "
                    : "I have read and agree to the "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>{isFrench ? "Conditions Générales" : "Terms of Service"}</span>
                    <ExternalLink className="w-3 h-3 inline" />
                  </Link>
                  {isFrench ? " et la " : " and "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>{isFrench ? "Politique de Confidentialité" : "Privacy Policy"}</span>
                    <ExternalLink className="w-3 h-3 inline" />
                  </Link>
                  {isFrench
                    ? " de LeaseLink. Je consens au traitement sécurisé de mes données."
                    : " of LeaseLink. I consent to the secure processing of my data."}
                </span>
              </label>

              {modalError && (
                <div className="mt-2.5 pt-2 border-t border-rose-200 dark:border-rose-500/20 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isFrench
                      ? "Veuillez cocher cette case pour continuer avec Google."
                      : "Please check this box to continue with Google."}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleModalConfirm}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isFrench ? "Accepter et Continuer avec Google" : "Accept & Continue with Google"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
