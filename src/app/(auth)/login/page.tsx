"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  Lock,
  Mail,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import EmailOtpModal from "@/components/EmailOtpModal";

export default function LoginPage() {
  const router = useRouter();
  const { isFrench } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsEmailUnconfirmed(false);
    setResendSuccess(false);
    setLoading(true);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!supabaseUrl || supabaseUrl.includes("your-project-ref")) {
      setErrorMsg(
        isFrench
          ? "Les identifiants Supabase ne sont pas encore configurés. Veuillez mettre à jour NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans votre fichier .env.local."
          : "Supabase credentials are not configured yet. Please update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file with your real Supabase project details."
      );
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        const code = ((error as { code?: string }).code || "").toLowerCase();

        if (msg.includes("email not confirmed") || code.includes("email_not_confirmed")) {
          setIsEmailUnconfirmed(true);
          setErrorMsg(
            isFrench
              ? "Votre adresse e-mail n'est pas encore confirmée. Veuillez vérifier votre boîte mail ou confirmer l'utilisateur dans votre console Supabase."
              : "Your email address is not confirmed yet. Please verify your email via the confirmation link sent by Supabase, or confirm the user in your Supabase Dashboard."
          );
        } else if (msg.includes("invalid login credentials") || code.includes("invalid_credentials")) {
          setErrorMsg(
            isFrench
              ? "E-mail ou mot de passe invalide. Veuillez vérifier vos identifiants ou créer un nouveau compte si nécessaire."
              : "Invalid email or password. Please verify your credentials or register a new account if you haven't yet."
          );
        } else if (msg.includes("rate limit") || code.includes("rate_limit") || error.status === 422) {
          setErrorMsg(
            isFrench
              ? "Limite de requêtes atteinte. Veuillez patienter quelques secondes avant de réessayer."
              : error.message || "Request rate limit exceeded. Please wait a few seconds before trying to log in again."
          );
        } else {
          setErrorMsg(error.message);
        }

        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : (isFrench ? "Une erreur inattendue est survenue." : "An unexpected error occurred.");
      if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
        message = isFrench
          ? "Impossible de joindre le serveur Supabase. Veuillez vérifier votre connexion internet."
          : "Could not reach Supabase server. Please check your internet connection and verify the Supabase URL in .env.local.";
      }
      setErrorMsg(message);
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setErrorMsg(
        isFrench
          ? "Veuillez entrer votre adresse e-mail pour renvoyer la confirmation."
          : "Please enter your email address to resend the confirmation."
      );
      return;
    }

    setResending(true);
    setResendSuccess(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setResendSuccess(true);
      }
    } catch {
      setErrorMsg(
        isFrench
          ? "Échec de l'envoi de l'e-mail de confirmation."
          : "Failed to resend confirmation email."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Bar Navigation: In natural document flow to prevent any overlap */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2 flex items-center justify-between gap-3 shrink-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm font-semibold shadow-xs backdrop-blur-md transition group cursor-pointer shrink-0"
          title={isFrench ? "Retourner à la page d'accueil" : "Return to landing page"}
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform group-hover:-translate-x-1" />
          <span>{isFrench ? "Retour à l'accueil" : "Back to Home"}</span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher variant="pill" />
          <ThemeSwitcher variant="pill" />
        </div>
      </header>

      {/* Main Login Content */}
      <main className="flex-1 flex flex-col justify-center py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Link href="/" className="inline-flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white group">
            <Image
              src="/brand/leaselink-symbol.png"
              alt="LeaseLink"
              width={44}
              height={44}
              className="w-11 h-11 object-contain group-hover:scale-105 transition-transform"
              priority
            />
            <span className="font-black text-2xl">
              Lease<span className="text-emerald-500 dark:text-emerald-400">Link</span>
            </span>
          </Link>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">
            {isFrench ? "Connexion Espace Bailleur" : "Landlord Portal Login"}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {isFrench
              ? "Gérez vos biens, carnets de quittances et registres de loyers."
              : "Manage your properties, tenant ledgers, and rent logs."}
          </p>
        </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-8 px-6 shadow-xl dark:shadow-2xl rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-rose-800 dark:text-rose-300">
                <p>{errorMsg}</p>

                {isEmailUnconfirmed && (
                  <div className="pt-2 border-t border-rose-200 dark:border-rose-500/20 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowOtpModal(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{isFrench ? "Saisir le Code à 6 Chiffres" : "Enter 6-Digit Code"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resending}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                      >
                        {resending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isFrench ? "Renvoyer l'E-mail" : "Resend Email"}
                        </span>
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>{isFrench ? "Astuce de test :" : "Testing tip:"}</strong>{" "}
                        {isFrench
                          ? "Dans votre tableau de bord Supabase, allez dans Authentication -> Providers -> Email et désactivez « Confirm email » pour vous connecter immédiatement sans validation."
                          : "In your Supabase Dashboard, go to Authentication -> Providers -> Email and turn off \"Confirm email\" to sign in immediately without email confirmation."}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {resendSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                {isFrench
                  ? "E-mail de confirmation renvoyé ! Veuillez vérifier votre boîte de réception et vos spams."
                  : "Confirmation email resent! Please check your inbox and spam folder."}
              </p>
            </div>
          )}

          {/* Google Sign In Option */}
          <div className="mb-6 space-y-3">
            <GoogleAuthButton
              label={isFrench ? "Se connecter avec Google" : "Continue with Google"}
              requireTerms={false}
              onError={(err) => setErrorMsg(err)}
            />

            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
              {isFrench ? "En vous connectant avec Google, vous acceptez nos " : "By signing in with Google, you agree to our "}
              <Link href="/terms" target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                {isFrench ? "Conditions d'Utilisation" : "Terms"}
              </Link>
            </p>

            <div className="relative flex items-center justify-center pt-1">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="bg-white dark:bg-slate-900 px-3 text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase shrink-0">
                {isFrench ? "Ou avec vos identifiants" : "Or with your credentials"}
              </span>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {isFrench ? "Adresse E-mail" : "Email Address"} <span className="text-blue-600 dark:text-blue-400">*</span>
              </label>
              <div className="mt-1.5 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="landlord@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {isFrench ? "Mot de Passe" : "Password"} <span className="text-blue-600 dark:text-blue-400">*</span>
                </label>
              </div>
              <div className="mt-1.5 relative rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title={showPassword ? (isFrench ? "Masquer le mot de passe" : "Hide password") : (isFrench ? "Afficher le mot de passe" : "Show password")}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isFrench ? "Connexion en cours..." : "Signing in..."}</span>
                </>
              ) : (
                <>
                  <span>{isFrench ? "Se Connecter au Tableau de Bord" : "Sign In to Dashboard"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-center space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isFrench ? "Nouveau bailleur ?" : "New landlord?"}{" "}
              <Link
                href="/register"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
              >
                {isFrench ? "Inscrivez-vous et choisissez un abonnement" : "Register and select a plan"}
              </Link>
            </p>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-center gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-400">{isFrench ? "Vous êtes locataire ?" : "Are you a tenant?"}</span>
              <Link
                href="/tenant/login"
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline inline-flex items-center gap-1"
              >
                <span>{isFrench ? "Connexion Espace Locataire" : "Tenant Portal Login"}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 6-Digit Email OTP Verification Modal */}
      <EmailOtpModal
        isOpen={showOtpModal}
        email={email}
        onClose={() => setShowOtpModal(false)}
      />
      </main>
    </div>
  );
}
