"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface EmailOtpModalProps {
  isOpen: boolean;
  email: string;
  password?: string;
  initialOtpToken?: string;
  initialDevCode?: string;
  onClose: () => void;
  onSuccess?: () => void;
  autoRedirect?: boolean;
}

export default function EmailOtpModal({
  isOpen,
  email,
  password,
  initialOtpToken,
  initialDevCode,
  onClose,
  onSuccess,
  autoRedirect = true,
}: EmailOtpModalProps) {
  const router = useRouter();
  const { isFrench } = useLanguage();

  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState<string>(initialOtpToken || "");
  const [devCode, setDevCode] = useState<string | null>(initialDevCode || null);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendNotif, setResendNotif] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Send or request OTP from server
  const requestOtpCode = useCallback(async () => {
    if (!email) return;
    setSendingCode(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (data.success && data.otpToken) {
        setOtpToken(data.otpToken);
        setDevCode(data.devCode || null);
      } else if (!data.success && data.error) {
        // If rate-limited or error, still allow user to enter existing code
        console.warn("[EmailOtpModal] send-otp returned:", data.error);
      }
    } catch (err) {
      console.warn("[EmailOtpModal] Could not reach send-otp API:", err);
    } finally {
      setSendingCode(false);
    }
  }, [email]);

  // Reset state and focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setOtpCode("");
      setErrorMsg(null);
      setIsSuccess(false);
      setCooldown(60);

      if (initialOtpToken) {
        setOtpToken(initialOtpToken);
      }
      if (initialDevCode) {
        setDevCode(initialDevCode);
      }

      // If no initial token provided, dispatch send-otp automatically
      if (!initialOtpToken && email) {
        requestOtpCode();
      }

      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, email, initialOtpToken, initialDevCode, requestOtpCode]);

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
    if (code.length < 6 || code.length > 8) {
      setErrorMsg(
        isFrench
          ? "Veuillez saisir un code valide (6 à 8 chiffres)."
          : "Please enter a valid code (6 to 8 digits)."
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    let verified = false;

    try {
      // Execute both verification routes in parallel for lightning-fast sub-second response!
      const supabase = createClient();
      let supabaseVerified = false;

      const verifySupabase = async (): Promise<boolean> => {
        try {
          const { error: sbSignupErr } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: code,
            type: "signup",
          });
          if (!sbSignupErr) return true;

          const { error: sbEmailErr } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: code,
            type: "email",
          });
          return !sbEmailErr;
        } catch {
          return false;
        }
      };

      const verifyCustomApi = async (): Promise<boolean> => {
        if (!otpToken) return false;
        try {
          const res = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: cleanEmail,
              code,
              otpToken,
            }),
          });
          const result = await res.json();
          return Boolean(result.success);
        } catch {
          return false;
        }
      };

      const [sbResult, apiResult] = await Promise.all([
        verifySupabase(),
        verifyCustomApi(),
      ]);

      supabaseVerified = sbResult;
      verified = sbResult || apiResult;

      if (!verified) {
        setErrorMsg(
          isFrench
            ? "Code de vérification incorrect ou expiré. Veuillez vérifier votre boîte mail ou demander un nouveau code."
            : "Invalid or expired verification code. Please check your inbox or request a new code."
        );
        setLoading(false);
        return;
      }

      // 3. If password was provided and user not yet signed in via Supabase native OTP, sign them in
      if (!supabaseVerified && password) {
        try {
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
        } catch (loginErr) {
          console.warn("[EmailOtpModal] Post-verification signin notice:", loginErr);
        }
      }

      // Success! Instant snappy feedback
      setIsSuccess(true);
      setLoading(false);

      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (autoRedirect) {
          router.push("/dashboard");
        }
      }, 250);
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
    const digitsOnly = val.replace(/\D/g, "").slice(0, 8);
    setOtpCode(digitsOnly);
    setErrorMsg(null);

    // Auto-submit when user reaches 8 digits
    if (digitsOnly.length === 8) {
      handleVerify(digitsOnly);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setErrorMsg(null);
    setResendNotif(false);

    try {
      // 1. Resend via our LeaseLink OTP API
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (data.success && data.otpToken) {
        setOtpToken(data.otpToken);
        setDevCode(data.devCode || null);
        setResendNotif(true);
        setCooldown(60);
      } else {
        setErrorMsg(data.error || "Failed to resend code.");
      }

      // 2. Also trigger Supabase native resend in parallel
      try {
        const supabase = createClient();
        await supabase.auth.resend({
          type: "signup",
          email: email.trim().toLowerCase(),
        });
      } catch {
        // ignore
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
                  ? "Un code de confirmation a été envoyé à :"
                  : "A confirmation code was sent to:"}
                <br />
                <span className="font-semibold text-slate-900 dark:text-white break-all">
                  {email}
                </span>
              </p>
            </div>

            {/* Test / Dev Mode Notice (when no Resend API key is configured in .env.local) */}
            {devCode && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-bold text-amber-900 dark:text-amber-200">
                      {isFrench ? "Mode Test (Clé Resend non configurée)" : "Dev Mode (No Resend API Key)"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInputChange(devCode)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition shadow-xs cursor-pointer shrink-0"
                  >
                    {isFrench ? "Insérer le code" : "Fill code"}
                  </button>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-amber-500/20">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isFrench ? "Code à saisir :" : "Access code:"}
                  </span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm tracking-widest">
                    {devCode}
                  </span>
                </div>
                <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  {isFrench
                    ? "Pour envoyer de vrais e-mails sur votre messagerie, ajoutez votre clé Resend (RESEND_API_KEY=re_...) dans .env.local."
                    : "To send live emails to your inbox, add your Resend key (RESEND_API_KEY=re_...) in .env.local."}
                </p>
              </div>
            )}

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

            {/* 6 to 8 Digit Input with Keyboard One-Time-Code AutoFill */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isFrench ? "Code de vérification (6 ou 8 chiffres)" : "Verification code (6 or 8 digits)"}
              </label>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otpCode.length >= 6) {
                      e.preventDefault();
                      handleVerify();
                    }
                  }}
                  placeholder="• • • • • • • •"
                  className="w-full text-center text-2xl sm:text-3xl font-mono font-bold tracking-[0.25em] sm:tracking-[0.35em] py-3.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 rounded-2xl text-slate-900 dark:text-white outline-none transition shadow-inner selection:bg-blue-500 selection:text-white"
                />
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isFrench
                  ? "💡 Astuce : Sur mobile, votre clavier vous suggère automatiquement le code dès réception !"
                  : "💡 Tip: On mobile, your keyboard will suggest the code automatically!"}
              </p>
            </div>

            {/* Validate Button */}
            <button
              type="button"
              onClick={() => handleVerify()}
              disabled={loading || sendingCode || otpCode.length < 6 || otpCode.length > 8}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isFrench ? "Validation en cours..." : "Verifying code..."}</span>
                </>
              ) : sendingCode ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isFrench ? "Envoi du code..." : "Sending code..."}</span>
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
