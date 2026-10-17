"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  X,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface EmailOtpModalProps {
  isOpen: boolean;
  email: string;
  onClose: () => void;
  onSuccess?: () => void;
  autoRedirect?: boolean;
}

export default function EmailOtpModal({
  isOpen,
  email,
  onClose,
  onSuccess,
  autoRedirect = true,
}: EmailOtpModalProps) {
  const router = useRouter();
  const { isFrench } = useLanguage();

  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendNotif, setResendNotif] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setOtpCode("");
      setErrorMsg(null);
      setIsSuccess(false);
      setCooldown(60);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (!isOpen || cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, cooldown]);

  // Live listener: if the user clicks the verification link in their email,
  // Supabase updates the auth state and this modal auto-detects it!
  useEffect(() => {
    if (!isOpen) return;

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        if (!email || session.user.email?.toLowerCase() === email.toLowerCase()) {
          setIsSuccess(true);
          setTimeout(() => {
            if (onSuccess) onSuccess();
            if (autoRedirect) {
              router.push("/dashboard");
              router.refresh();
            }
          }, 1200);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isOpen, email, onSuccess, autoRedirect, router]);

  if (!isOpen) return null;

  const handleVerify = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (code.length < 6) {
      setErrorMsg(
        isFrench
          ? "Veuillez saisir le code complet à 6 chiffres."
          : "Please enter the full 6-digit code."
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();

      // Attempt verification with signup type
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: code,
        type: "signup",
      });

      // If signup type fails, fallback to email token type
      if (error) {
        const fallback = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: code,
          type: "email",
        });
        if (!fallback.error) {
          data = fallback.data;
          error = null;
        }
      }

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("expired") || msg.includes("invalid") || msg.includes("token")) {
          setErrorMsg(
            isFrench
              ? "Code de vérification incorrect ou expiré. Veuillez vérifier votre boîte mail ou en demander un nouveau."
              : "Invalid or expired verification code. Please check your inbox or request a new code."
          );
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      // Success
      setIsSuccess(true);
      setLoading(false);

      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (autoRedirect) {
          router.push("/dashboard");
          router.refresh();
        }
      }, 1000);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : isFrench
          ? "Échec de la validation du code."
          : "Failed to verify code.";
      setErrorMsg(message);
      setLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, "").slice(0, 6);
    setOtpCode(digitsOnly);
    setErrorMsg(null);

    // Auto-submit when user reaches 6 digits (either by typing or keyboard autofill)
    if (digitsOnly.length === 6) {
      handleVerify(digitsOnly);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setErrorMsg(null);
    setResendNotif(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setResendNotif(true);
        setCooldown(60);
      }
    } catch {
      setErrorMsg(
        isFrench
          ? "Impossible d'envoyer un nouveau code pour le moment."
          : "Could not send a new code at this time."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {isFrench ? "E-mail Vérifié !" : "Email Verified!"}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isFrench
                ? "Connexion automatique en cours vers votre tableau de bord..."
                : "Redirecting you to your dashboard..."}
            </p>
            <div className="flex justify-center pt-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header Icon */}
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-blue-100 dark:border-blue-500/20">
              <Mail className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {isFrench ? "Vérification de l'E-mail" : "Email Verification"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                {isFrench
                  ? "Un code de confirmation à 6 chiffres a été envoyé à :"
                  : "A 6-digit confirmation code was sent to:"}
                <br />
                <span className="font-semibold text-slate-900 dark:text-white break-all">
                  {email}
                </span>
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2.5 text-left">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                  {errorMsg}
                </p>
              </div>
            )}

            {resendNotif && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2 text-left">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  {isFrench
                    ? "Nouveau code envoyé dans votre boîte de réception !"
                    : "New code sent to your inbox!"}
                </p>
              </div>
            )}

            {/* 6 Digit Input with Keyboard One-Time-Code AutoFill */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isFrench ? "Code à 6 chiffres" : "6-digit code"}
              </label>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otpCode.length === 6) {
                      e.preventDefault();
                      handleVerify();
                    }
                  }}
                  placeholder="• • • • • •"
                  className="w-full text-center text-3xl sm:text-4xl font-mono font-bold tracking-[0.4em] py-3.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 rounded-2xl text-slate-900 dark:text-white outline-none transition shadow-inner selection:bg-blue-500 selection:text-white"
                />
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isFrench
                  ? "💡 Astuce : Sur mobile, le clavier Android ou iPhone vous suggère automatiquement le code dès réception !"
                  : "💡 Tip: On mobile, your Android or iPhone keyboard will suggest the code automatically!"}
              </p>
            </div>

            {/* Validate Button */}
            <button
              type="button"
              onClick={() => handleVerify()}
              disabled={loading || otpCode.length !== 6}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isFrench ? "Validation en cours..." : "Verifying code..."}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isFrench ? "Valider le Code" : "Verify Code"}</span>
                </>
              )}
            </button>

            {/* Quick Link to Gmail and Resend */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-slate-100 dark:border-slate-800">
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                <span>{isFrench ? "Ouvrir Gmail" : "Open Gmail"}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                <span>
                  {cooldown > 0
                    ? isFrench
                      ? `Renvoyer (${cooldown}s)`
                      : `Resend (${cooldown}s)`
                    : isFrench
                    ? "Renvoyer le code"
                    : "Resend code"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
