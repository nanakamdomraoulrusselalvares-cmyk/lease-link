"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AVAILABLE_PLANS,
  SubscriptionPlanId,
  BillingCycle,
} from "@/types/database";
import { notifyNewLandlordRegistered } from "@/lib/services/notificationService";
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";

export default function RegisterPage() {
  const router = useRouter();
  const { isFrench } = useLanguage();

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>("free");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");

  // Read URL query params (?plan=...&cycle=...)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const planParam = params.get("plan") as SubscriptionPlanId | null;
      const cycleParam = params.get("cycle") as BillingCycle | null;

      if (cycleParam === "monthly" || cycleParam === "annual") {
        setBillingCycle(cycleParam);
      }
      if (planParam && AVAILABLE_PLANS.some((p) => p.id === planParam)) {
        if (cycleParam === "annual" && planParam === "free") {
          setSelectedPlan("tier_1_30");
        } else {
          setSelectedPlan(planParam);
        }
      }
    }
  }, []);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isEmailDuplicate, setIsEmailDuplicate] = useState(false);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);

  // Real-time check on blur to inform user immediately
  const handleEmailBlur = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    try {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (existing) {
        setEmailWarning(
          isFrench
            ? "Cette adresse e-mail est déjà associée à un compte LeaseLink. Un utilisateur ne peut s'inscrire qu'une seule fois avec la même adresse e-mail."
            : "An account with this email address already exists. A person can only register once with an email."
        );
      } else {
        // Also check local mock store if offline
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("leaselink_mock_profiles");
            if (raw) {
              const list = JSON.parse(raw);
              if (list.some((p: any) => p.email?.toLowerCase() === cleanEmail)) {
                setEmailWarning(
                  isFrench
                    ? "Cette adresse e-mail est déjà associée à un compte LeaseLink."
                    : "An account with this email address already exists."
                );
                return;
              }
            }
          } catch (_) {}
        }
        setEmailWarning(null);
      }
    } catch (_) {}
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEmailDuplicate(false);

    // Strict validation
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setErrorMsg(
        isFrench
          ? "Tous les champs sont obligatoires. Veuillez renseigner toutes les informations."
          : "All fields are mandatory. Please fill in all information."
      );
      return;
    }

    if (password.length < 6) {
      setErrorMsg(
        isFrench
          ? "Le mot de passe doit contenir au moins 6 caractères."
          : "Password must be at least 6 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(
        isFrench
          ? "Les mots de passe ne correspondent pas. Veuillez réessayer."
          : "Passwords do not match. Please re-enter."
      );
      return;
    }

    setLoading(true);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!supabaseUrl || supabaseUrl.includes("your-project-ref")) {
      setErrorMsg(
        isFrench
          ? "Les identifiants Supabase ne sont pas configurés. Veuillez vérifier les variables d'environnement dans .env.local."
          : "Supabase credentials are not configured yet. Please update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file with your real Supabase project details."
      );
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();

      // 1. Strict pre-check in profiles table to guarantee an email is used only once
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, email")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (existingProfile) {
        setErrorMsg(
          isFrench
            ? "Cette adresse e-mail est déjà associée à un compte LeaseLink. Un utilisateur ne peut s'inscrire qu'une seule fois avec la même adresse e-mail. Veuillez vous connecter."
            : "An account with this email address already exists on LeaseLink. A person can only register once with an email. Please sign in instead."
        );
        setIsEmailDuplicate(true);
        setLoading(false);
        return;
      }

      // Check local mock store if offline
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("leaselink_mock_profiles");
          if (raw) {
            const list = JSON.parse(raw);
            if (list.some((p: any) => p.email?.toLowerCase() === cleanEmail)) {
              setErrorMsg(
                isFrench
                  ? "Cette adresse e-mail est déjà associée à un compte LeaseLink. Un utilisateur ne peut s'inscrire qu'une seule fois avec la même adresse e-mail. Veuillez vous connecter."
                  : "An account with this email address already exists on LeaseLink. A person can only register once with an email. Please sign in instead."
              );
              setIsEmailDuplicate(true);
              setLoading(false);
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Sign up with Supabase Auth including metadata for the landlord profile trigger
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            plan: selectedPlan,
            billing_cycle: billingCycle,
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("already registered") ||
          msg.includes("already in use") ||
          msg.includes("user already") ||
          msg.includes("duplicate key") ||
          (error as any).code === "user_already_exists"
        ) {
          setErrorMsg(
            isFrench
              ? "Cette adresse e-mail est déjà associée à un compte LeaseLink. Un utilisateur ne peut s'inscrire qu'une seule fois avec la même adresse e-mail. Veuillez vous connecter."
              : "An account with this email address already exists. A person can only register once with an email. Please sign in instead."
          );
          setIsEmailDuplicate(true);
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      // Supabase email obfuscation check: if identities is empty array, email is already registered
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrorMsg(
          isFrench
            ? "Cette adresse e-mail est déjà associée à un compte LeaseLink. Un utilisateur ne peut s'inscrire qu'une seule fois avec la même adresse e-mail. Veuillez vous connecter."
            : "An account with this email address already exists. A person can only register once with an email. Please sign in instead."
        );
        setIsEmailDuplicate(true);
        setLoading(false);
        return;
      }

      // Notify administrators about the new landlord registration (Rule 3)
      if (data.user) {
        try {
          const selectedPlanConfig = AVAILABLE_PLANS.find((p) => p.id === selectedPlan);
          await notifyNewLandlordRegistered({
            landlordId: data.user.id,
            landlordName: fullName.trim() || cleanEmail,
            email: cleanEmail,
            phone: phone.trim(),
            plan: selectedPlanConfig?.name || selectedPlan,
          });
        } catch (notifErr) {
          console.warn("Could not dispatch admin registration notification:", notifErr);
        }
      }

      // Check if session was returned directly (e.g. email confirmations disabled)
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        // Email confirmation is required
        setSuccessMsg(
          isFrench
            ? `Inscription réussie ! Un e-mail de confirmation a été envoyé à ${cleanEmail}. Veuillez valider votre e-mail avant de vous connecter.`
            : `Registration successful! Supabase sent a verification email to ${cleanEmail}. Please verify your email before logging in. (Tip: You can disable 'Confirm email' in Supabase Dashboard -> Auth -> Providers -> Email for instant testing without email links).`
        );
        setLoading(false);
      }
    } catch (err: unknown) {
      let message = err instanceof Error ? err.message : (isFrench ? "Échec de l'inscription." : "Failed to register account.");
      if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
        message = isFrench
          ? "Impossible de contacter le serveur Supabase. Veuillez vérifier votre connexion internet."
          : "Could not reach Supabase server. Please check your internet connection and verify the Supabase URL in .env.local.";
      }
      setErrorMsg(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative selection:bg-blue-500 selection:text-white">
      {/* Top Bar Navigation: Go Back button & switches */}
      <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 z-20 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm font-semibold shadow-xs backdrop-blur-md transition group cursor-pointer"
          title={isFrench ? "Retourner à la page d'accueil" : "Return to landing page"}
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-transform group-hover:-translate-x-1" />
          <span>{isFrench ? "Retour à l'accueil" : "Back to Home"}</span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="pill" />
          <ThemeSwitcher variant="pill" />
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span>Lease<span className="text-blue-600 dark:text-blue-500">Link</span></span>
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {isFrench ? "Inscription Compte Bailleur" : "Register Landlord Account"}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {isFrench
            ? "Créez votre portefeuille immobilier. Gérez immeubles, logements, locataires et encaissements de loyers."
            : "Create your digital property portfolio. Manage buildings, units, tenants, and rent collections."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-8 px-6 shadow-xl dark:shadow-2xl rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-rose-800 dark:text-rose-300 font-medium">{errorMsg}</p>
                {isEmailDuplicate && (
                  <div>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
                    >
                      <span>{isFrench ? "Se connecter à mon compte" : "Log in to my account"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {successMsg ? (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Compte Créé avec Succès" : "Account Created Successfully"}
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{successMsg}</p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-md"
                >
                  <span>{isFrench ? "Aller à la Connexion" : "Go to Login"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleRegister}>
              {/* Landlord Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  {isFrench ? "Informations Personnelles du Bailleur (Obligatoire)" : "Landlord Personal Information (Mandatory)"}
                </h3>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {isFrench ? "Nom Complet" : "Full Name"} <span className="text-rose-500">*</span>
                  </label>
                  <div className="mt-1 relative rounded-lg">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={isFrench ? "ex: Jean Dupont" : "e.g. Johnathan Vance"}
                      className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        {isFrench ? "Adresse E-mail" : "Email Address"} <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {isFrench ? "1 compte par e-mail" : "1 account per email"}
                      </span>
                    </div>
                    <div className="mt-1 relative rounded-lg">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailWarning) setEmailWarning(null);
                        }}
                        onBlur={handleEmailBlur}
                        placeholder="john@example.com"
                        className={`block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition ${
                          emailWarning
                            ? "border-amber-400 dark:border-amber-500/50"
                            : "border-slate-300 dark:border-slate-700"
                        }`}
                      />
                    </div>
                    {emailWarning && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          {emailWarning}{" "}
                          <Link href="/login" className="underline font-bold text-blue-600 dark:text-blue-400">
                            {isFrench ? "Se connecter →" : "Sign in →"}
                          </Link>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Telephone */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {isFrench ? "Numéro de Téléphone" : "Telephone Number"} <span className="text-rose-500">*</span>
                    </label>
                    <div className="mt-1 relative rounded-lg">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+237 6..."
                        className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Plan Selection */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    {isFrench ? "Sélectionnez votre Formule (Obligatoire)" : "Select Portfolio Plan (Mandatory)"}
                  </h3>

                  {/* Monthly vs Annual Toggle */}
                  <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        billingCycle === "monthly"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {isFrench ? "Mensuel" : "Monthly"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBillingCycle("annual");
                        if (selectedPlan === "free") {
                          setSelectedPlan("tier_1_30");
                        }
                      }}
                      className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                        billingCycle === "annual"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span>{isFrench ? "Annuel" : "Annual"}</span>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950">
                        {isFrench ? "-15%" : "Save"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 ${billingCycle === "annual" ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-3`}>
                  {AVAILABLE_PLANS.filter((p) => billingCycle === "monthly" || !p.isFreeTrial).map((plan) => {
                    const isSelected = selectedPlan === plan.id;
                    const priceDisplay =
                      billingCycle === "annual" ? plan.annualPriceDisplay : plan.monthlyPriceDisplay;
                    const savingsDisplay =
                      billingCycle === "annual"
                        ? isFrench && plan.annualSavingsFr
                          ? plan.annualSavingsFr
                          : plan.annualSavings
                        : null;

                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`relative p-3.5 rounded-xl border cursor-pointer transition text-left flex flex-col justify-between ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-600/10 border-blue-500 ring-2 ring-blue-500/50"
                            : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-950"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {isFrench && plan.nameFr ? plan.nameFr : plan.name}
                            </span>
                            {plan.badge && (
                              <span
                                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                  plan.isFreeTrial
                                    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30"
                                    : "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30"
                                }`}
                              >
                                {isFrench && plan.badgeFr ? plan.badgeFr : plan.badge}
                              </span>
                            )}
                          </div>

                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-base font-extrabold text-slate-900 dark:text-white">
                              {priceDisplay}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {plan.isFreeTrial
                                ? ""
                                : billingCycle === "annual"
                                ? (isFrench ? "/ an" : "/ yr")
                                : (isFrench ? "/ mois" : "/ mo")}
                            </span>
                          </div>

                          {savingsDisplay && (
                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {savingsDisplay}
                            </div>
                          )}

                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                            {isFrench ? plan.unitRangeFr : plan.unitRange}
                          </p>

                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                            <span className="font-semibold text-slate-800 dark:text-slate-300">
                              {isFrench ? "Cible : " : "Target: "}
                            </span>
                            {isFrench ? plan.targetFr : plan.target}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                          <span>
                            {plan.isFreeTrial
                              ? (isFrench ? "30 jours" : "30 days")
                              : billingCycle === "annual"
                              ? (isFrench ? "365 jours" : "365 days")
                              : (isFrench ? "30 jours" : "30 days")}
                          </span>
                          {isSelected ? (
                            <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {isFrench ? "Sélectionné" : "Selected"}
                            </span>
                          ) : (
                            <span className="text-slate-400">{isFrench ? "Choisir" : "Select"}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isFrench
                    ? "* Remarque : L'offre d'essai gratuite ne peut être réclamée qu'une seule fois par utilisateur. Les formules payantes sont disponibles en règlement mensuel ou annuel renouvelable."
                    : "* Note: Free trial can only be claimed once per user. Paid plans are available with monthly or annual terms."}
                </p>
              </div>

              {/* Passwords */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  {isFrench ? "Identifiants de Sécurité" : "Security Credentials"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {isFrench ? "Mot de Passe" : "Password"} <span className="text-rose-500">*</span>
                    </label>
                    <div className="mt-1 relative rounded-lg">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isFrench ? "6 caractères min." : "Min. 6 characters"}
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

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      {isFrench ? "Confirmer le Mot de Passe" : "Confirm Password"} <span className="text-rose-500">*</span>
                    </label>
                    <div className="mt-1 relative rounded-lg">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={isFrench ? "Retapez le mot de passe" : "Re-type password"}
                        className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                        title={showConfirmPassword ? (isFrench ? "Masquer le mot de passe" : "Hide password") : (isFrench ? "Afficher le mot de passe" : "Show password")}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isFrench ? "Création du compte..." : "Creating Landlord Account..."}</span>
                  </>
                ) : (
                  <>
                    <span>{isFrench ? "Finaliser l'Inscription" : "Complete Registration"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isFrench ? "Déjà inscrit ?" : "Already registered?"}{" "}
              <Link
                href="/login"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
              >
                {isFrench ? "Connectez-vous à votre tableau de bord" : "Sign into your landlord dashboard"}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
