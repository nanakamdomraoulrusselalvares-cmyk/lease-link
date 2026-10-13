"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  UserCheck,
} from "lucide-react";
import { authenticateTenant, setTenantSession } from "@/lib/services/tenantService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";

function TenantLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wasLoggedOut = searchParams.get("loggedOut") === "true";
  const { isFrench } = useLanguage();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await authenticateTenant(identifier, password);

      if (!res.success || !res.data) {
        setErrorMsg(
          res.error ||
            (isFrench
              ? "Identifiants invalides. Veuillez vérifier l'e-mail et le mot de passe d'accès transmis par votre bailleur sur WhatsApp."
              : "Invalid credentials. Please verify the email and access password provided by your landlord on WhatsApp.")
        );
        setLoading(false);
        return;
      }

      // Save tenant session
      setTenantSession(res.data);

      // Redirect to tenant portal
      router.push("/tenant/portal");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isFrench ? "Une erreur est survenue lors de l'authentification." : "An error occurred during authentication.");
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-blue-500 selection:text-white relative">
      {/* Top right language & theme switches */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-2">
        <LanguageSwitcher variant="pill" />
        <ThemeSwitcher variant="pill" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span>Lease<span className="text-blue-600 dark:text-blue-500">Link</span></span>
        </Link>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-semibold mt-4">
          <UserCheck className="w-3.5 h-3.5" />
          <span>{isFrench ? "Portail Espace Locataire" : "Tenant Portal Access"}</span>
        </div>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          {isFrench ? "Connexion à votre Espace Locataire" : "Sign In to Your Tenant Space"}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {isFrench
            ? "Entrez votre e-mail ou numéro de téléphone et le mot de passe d'accès remis par votre bailleur."
            : "Enter your login email or phone number and the access password provided by your landlord."}
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-8 px-6 shadow-xl dark:shadow-2xl rounded-2xl sm:px-10 space-y-6">
          {wasLoggedOut && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                {isFrench
                  ? "Vous avez été déconnecté en toute sécurité. Vous pouvez vous reconnecter ci-dessous."
                  : "You have been signed out securely. You can log back in below."}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                <p className="font-semibold text-rose-900 dark:text-rose-200">
                  {isFrench ? "Échec de l'Authentification" : "Authentication Failed"}
                </p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isFrench ? "E-mail ou Téléphone de Connexion" : "Login E-mail or Phone Number"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder={isFrench ? "ex: jean@gmail.com ou +237 6..." : "e.g. jean@gmail.com or +237 6..."}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isFrench ? "Mot de Passe d'Accès / Code" : "Access Password / Code"}
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer font-semibold"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPassword ? (isFrench ? "Masquer" : "Hide") : (isFrench ? "Afficher" : "Show")}</span>
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="e.g. LL-7K9P-4M"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isFrench ? "Vérification des Identifiants..." : "Verifying Credentials..."}</span>
                </>
              ) : (
                <>
                  <span>{isFrench ? "Se Connecter à l'Espace Locataire" : "Sign In to Tenant Space"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Help box */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center space-y-3">
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {isFrench ? "Votre bailleur vous a envoyé un lien WhatsApp ?" : "Did your landlord send you a WhatsApp link?"} <br />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {isFrench
                  ? "Vous pouvez simplement cliquer sur le lien direct en 1-clic reçu par message pour vous connecter sans mot de passe !"
                  : "You can simply click the 1-click link in your WhatsApp message to enter directly without typing your password!"}
              </span>
            </p>

            <div className="pt-2 flex items-center justify-center gap-4 text-xs font-semibold">
              <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                {isFrench ? "Espace Propriétaire / Bailleur" : "Landlord Portal Login"}
              </Link>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <Link href="/" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                {isFrench ? "Retour à l'Accueil" : "Back to Home"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TenantLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-500" />
        </div>
      }
    >
      <TenantLoginForm />
    </Suspense>
  );
}
