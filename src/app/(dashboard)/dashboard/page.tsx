"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  LandlordProfile,
  AVAILABLE_PLANS,
  SubscriptionPlanId,
  Building,
  MaintenanceRequest,
} from "@/types/database";
import { getBuildingsWithUnits } from "@/lib/services/buildingService";
import {
  getMaintenanceRequestsForLandlord,
  CATEGORY_LABELS,
  URGENCY_LABELS,
  STATUS_LABELS,
  buildLandlordReplyWhatsAppUrl,
} from "@/lib/services/maintenanceService";
import AudioPlayer from "@/components/AudioPlayer";
import DashboardNav from "@/components/DashboardNav";
import SubscriptionPaymentModal from "@/components/SubscriptionPaymentModal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  LogOut,
  Phone,
  Mail,
  User as UserIcon,
  RefreshCw,
  AlertTriangle,
  Users,
  Home,
  Receipt,
  Wrench,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Database,
  KeyRound,
  DoorOpen,
  UserCheck,
  Camera,
  Video,
  Mic,
  Eye,
  X,
  Flame,
  MessageCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";

export default function LandlordHomePage() {
  const { isFrench, language, t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Load authenticated user and profile
  const fetchSessionAndProfile = async () => {
    const supabase = createClient();

    // Check if credentials are placeholder
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!url || url.includes("your-project-ref")) {
      setIsConfigured(false);
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      // Fetch landlord profile from database
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      let effectiveLandlordId = authUser.id;
      if (!profileError && profileData) {
        setProfile(profileData as LandlordProfile);
        if (profileData.role === "manager" && profileData.landlord_id) {
          effectiveLandlordId = profileData.landlord_id;
        }
      }

      const assignedBuildingIds =
        profileData?.role === "manager" ? profileData.assigned_building_ids : null;

      // Fetch landlord buildings and units portfolio
      try {
        const buildingsData = await getBuildingsWithUnits(effectiveLandlordId, assignedBuildingIds);
        setBuildings(buildingsData);
      } catch (bErr) {
        console.warn("Could not load portfolio buildings on dashboard:", bErr);
      }

      // Fetch landlord maintenance requests
      try {
        const mRequests = await getMaintenanceRequestsForLandlord(effectiveLandlordId, assignedBuildingIds);
        setMaintenanceRequests(mRequests);
      } catch (mErr) {
        console.warn("Could not load maintenance requests on dashboard:", mErr);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessionAndProfile();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login?loggedOut=true");
      router.refresh();
    } catch (err) {
      console.error("Error signing out:", err);
      router.push("/login?loggedOut=true");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchSessionAndProfile();
  };

  // Derive display values from profile or fallback to user metadata
  const fullName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    "New Landlord";

  const email = user?.email || profile?.email || "No email";
  const phone =
    profile?.phone ||
    (user?.user_metadata?.phone as string) ||
    "Not provided";

  const rawPlan = (profile?.plan ||
    user?.user_metadata?.plan ||
    "free") as SubscriptionPlanId;

  const planConfig =
    AVAILABLE_PLANS.find((p) => p.id === rawPlan) || AVAILABLE_PLANS[0];

  const planName = profile?.plan_name || planConfig.name;
  const unitLimit = profile?.plan_unit_limit || planConfig.maxUnits;
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Just now";

  // Portfolio metrics calculations (Occupied vs Vacant)
  const totalBuildings = buildings.length;
  const totalUnits = useMemo(() => {
    return buildings.reduce((acc, b) => acc + (b.units?.length || b.total_units || 0), 0);
  }, [buildings]);

  const occupiedUnits = useMemo(() => {
    return buildings.reduce((acc, b) => {
      const occupied =
        b.units?.filter((u) => u.status === "occupied" || Boolean(u.tenant_name?.trim())).length ?? 0;
      return acc + occupied;
    }, 0);
  }, [buildings]);

  const vacantUnits = useMemo(() => {
    return buildings.reduce((acc, b) => {
      const vacant =
        b.units?.filter((u) => u.status !== "occupied" && !Boolean(u.tenant_name?.trim())).length ??
        (b.total_units || 0);
      return acc + vacant;
    }, 0);
  }, [buildings]);

  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const vacancyRate = totalUnits > 0 ? Math.round((vacantUnits / totalUnits) * 100) : 0;

  // Maintenance metrics calculations
  const pendingRequests = useMemo(
    () => maintenanceRequests.filter((r) => r.status === "pending"),
    [maintenanceRequests]
  );
  const inProgressRequests = useMemo(
    () => maintenanceRequests.filter((r) => r.status === "in_progress"),
    [maintenanceRequests]
  );
  const resolvedRequests = useMemo(
    () => maintenanceRequests.filter((r) => r.status === "resolved"),
    [maintenanceRequests]
  );
  const emergencyRequests = useMemo(
    () => maintenanceRequests.filter((r) => r.urgency === "emergency" && r.status !== "resolved"),
    [maintenanceRequests]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isFrench ? "Vérification de la session bailleur..." : "Verifying landlord session..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Unified SaaS Dashboard Navigation Bar (Desktop Tabs + Mobile Bottom Bar) */}
      <DashboardNav
        user={user}
        profile={profile}
        pendingRepairsCount={pendingRequests.length}
        buildingsCount={buildings.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 lg:pb-12">
        {!isConfigured && (
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-base text-amber-300">
              <AlertTriangle className="w-5 h-5" />
              <span>{isFrench ? "Supabase Non Connecté dans .env.local" : "Supabase Not Connected in .env.local"}</span>
            </div>
            <p className="text-sm text-slate-300">
              {isFrench
                ? "Veuillez renseigner votre véritable URL Supabase et clé anonyme dans .env.local pour sauvegarder les données de façon permanente."
                : "Please provide your real Supabase URL and anon key in .env.local to store records permanently."}
            </p>
          </div>
        )}

        {/* Welcome & Registration Test Success Banner */}
        <div className="bg-gradient-to-r from-blue-50 via-white to-indigo-50/40 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-sm dark:shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
            <Sparkles className="w-48 h-48 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                {profile?.role === "admin"
                  ? isFrench
                    ? "Session Super-Administrateur Active"
                    : "Super-Administrator Session Active"
                  : profile?.role === "manager"
                  ? isFrench
                    ? "Session Gestionnaire Délégué Active"
                    : "Manager Session Verified & Active"
                  : isFrench
                  ? "Session Bailleur Vérifiée & Active"
                  : "Registration Successful & Session Verified"}
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {isFrench ? `Bienvenue sur LeaseLink, ${fullName} !` : `Welcome to LeaseLink, ${fullName}!`}
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {profile?.role === "admin"
                  ? isFrench
                    ? "Votre compte dispose des pleins privilèges administrateur. Vous supervisez tous les bailleurs, immeubles, transactions et tickets de maintenance de la plateforme."
                    : "Your account has full administrative privileges. You can supervise all landlords, properties, transactions, and maintenance requests across LeaseLink."
                  : profile?.role === "manager"
                  ? isFrench
                    ? "Votre compte gestionnaire est opérationnel. Vous disposez des accès délégués pour la gestion des immeubles, locataires, pannes et impayés."
                    : "Your manager account is active. You have operational access to manage buildings, tenants, repairs, and unpaid rent tracking."
                  : isFrench
                  ? "Votre compte propriétaire est opérationnel. Vous êtes connecté à l'espace de gestion LeaseLink. Voici le récapitulatif de votre portefeuille."
                  : "Your landlord account was created successfully. You are now logged into the LeaseLink landlord portal. Below are the details captured during registration."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {profile?.role === "admin" && (
                <Link
                  href="/dashboard/admin"
                  id="banner-admin-hub-btn"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/25 transition cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{isFrench ? "Console d'Administration" : "Admin Command Center"}</span>
                </Link>
              )}

              <Link
                href="/dashboard/buildings"
                id="banner-manage-buildings-btn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{isFrench ? "Gérer les Immeubles & Logements" : "Manage Buildings & Units"}</span>
              </Link>

              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-600 dark:text-blue-400" : ""}`} />
                <span>{refreshing ? (isFrench ? "Actualisation..." : "Refreshing...") : (isFrench ? "Actualiser la Session" : "Refresh Session")}</span>
              </button>

              <button
                id="logout-banner-btn"
                onClick={() => setShowLogoutConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isFrench ? "Se Déconnecter" : "Log Out Now"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Registered Identity */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {profile?.role === "admin"
                    ? isFrench ? "Profil Super-Admin" : "Super-Admin Profile"
                    : profile?.role === "manager"
                    ? isFrench ? "Profil Gestionnaire" : "Manager Profile"
                    : isFrench ? "Profil Bailleur" : "Landlord Profile"}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 font-medium">
                <ShieldCheck className="w-3 h-3" />
                {profile?.role === "admin"
                  ? isFrench ? "Super Administrateur" : "Platform Admin"
                  : profile?.role === "manager"
                  ? isFrench ? "Gestionnaire Délégué" : "Delegated Manager"
                  : isFrench ? "Authentifié" : "Authenticated"}
              </span>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isFrench ? "Nom Complet" : "Full Name"}</span>
                <span className="font-semibold text-slate-900 dark:text-white text-base">{fullName}</span>
              </div>

              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isFrench ? "Adresse E-mail" : "Email Address"}</span>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-mono text-xs">{email}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isFrench ? "Numéro de Téléphone" : "Phone Number"}</span>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{phone}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">{isFrench ? "Inscrit le" : "Registered On"}</span>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{joinedDate}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
              <span className="block mb-1">{isFrench ? "Identifiant Utilisateur (UID Supabase) :" : "User ID (Supabase Auth UID):"}</span>
              <span className="font-mono text-slate-600 dark:text-slate-400 block truncate bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                {user?.id || "N/A"}
              </span>
            </div>
          </div>

          {/* Card 2: Subscription & Unit Capacity */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {isFrench ? "Abonnement & Capacité" : "Subscription Tier"}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                {profile?.plan_status || (isFrench ? "Actif" : "Active")}
              </span>
            </div>

            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">{planName}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{planConfig.tagline}</p>
            </div>

            {/* Occupied vs Vacant Units Portfolio Breakdown */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-blue-50/70 dark:bg-slate-950/70 p-3.5 rounded-xl border-2 border-blue-200 dark:border-blue-500/20">
                <div className="flex items-center justify-between text-xs text-blue-800 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{isFrench ? "Occupés" : "Occupied"}</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-800 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                    {occupancyRate}%
                  </span>
                </div>
                <div className="mt-1.5 text-lg font-black text-blue-950 dark:text-blue-400">
                  {occupiedUnits} <span className="text-xs text-blue-700 dark:text-slate-500 font-normal">{isFrench ? "Logements" : "Units"}</span>
                </div>
              </div>

              <div className="bg-emerald-50/70 dark:bg-slate-950/70 p-3.5 rounded-xl border-2 border-emerald-200 dark:border-emerald-500/20">
                <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <DoorOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{isFrench ? "Vacants" : "Vacant"}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {vacancyRate}%
                  </span>
                </div>
                <div className="mt-1.5 text-lg font-black text-emerald-950 dark:text-emerald-400">
                  {vacantUnits} <span className="text-xs text-emerald-700 dark:text-slate-500 font-normal">{isFrench ? "Logements" : "Units"}</span>
                </div>
              </div>
            </div>

            {/* Capacity & Progress */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>{isFrench ? "Capacité du Forfait :" : "Unit Capacity:"}</span>
                <span className="font-semibold text-slate-900 dark:text-white font-mono">
                  {totalUnits} / {unitLimit} {isFrench ? "Logements" : "Units"}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 flex">
                <div
                  style={{ width: `${unitLimit > 0 ? (occupiedUnits / unitLimit) * 100 : 0}%` }}
                  className="bg-blue-500 h-full transition-all"
                  title={`${occupiedUnits} ${isFrench ? "Occupés" : "Occupied"}`}
                />
                <div
                  style={{ width: `${unitLimit > 0 ? (vacantUnits / unitLimit) * 100 : 0}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`${vacantUnits} ${isFrench ? "Vacants" : "Vacant"}`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {occupiedUnits} {isFrench ? "Occupés" : "Occupied"}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {vacantUnits} {isFrench ? "Vacants" : "Vacant"}
                </span>
                <span className="text-slate-500">{Math.max(0, unitLimit - totalUnits)} {isFrench ? "Restants" : "Left"}</span>
              </div>
            </div>

            {/* Billing Term & Upgrade / Renew Action */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  {profile?.billing_cycle === "annual"
                    ? isFrench ? "Facturation Annuelle (365 jours)" : "Annual Billing (365 days)"
                    : isFrench ? "Facturation Mensuelle (30 jours)" : "Monthly Billing (30 days)"}
                </span>
                <span>
                  {profile?.plan_expires_at
                    ? isFrench
                      ? `Expire le ${new Date(profile.plan_expires_at).toLocaleDateString()}`
                      : `Expires on ${new Date(profile.plan_expires_at).toLocaleDateString()}`
                    : ""}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSubscriptionModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                <span>{isFrench ? "Changer / Payer l'Abonnement" : "Upgrade / Pay Subscription"}</span>
              </button>
            </div>
          </div>

          {/* Card 3: Registration Test Checklist */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {isFrench ? "Diagnostic & État du Compte" : "Registration Diagnostics"}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {isFrench ? "Compte Auth Supabase" : "Supabase Auth Record"}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {isFrench
                      ? "Utilisateur créé avec hash de mot de passe sécurisé."
                      : "User created in auth.users with secure password hash."}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {isFrench ? "Métadonnées Enregistrées" : "User Metadata Saved"}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {isFrench
                      ? "Nom, téléphone et formule stockés avec succès."
                      : "Name, phone, and plan stored in raw_user_meta_data."}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {isFrench ? "Profil Public du Propriétaire" : "Public Profile Record"}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {profile
                      ? (isFrench ? "Ligne de profil chargée avec succès." : "Profile table row loaded successfully.")
                      : (isFrench ? "Exécution en attente (repli sur métadonnées actif)." : "Pending SQL trigger execution (metadata fallback active).")}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="logout-test-btn"
                onClick={() => setShowLogoutConfirm(true)}
                disabled={loggingOut}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-600/10 dark:hover:bg-rose-600/20 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:text-rose-800 dark:hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>
                  {isFrench ? "Tester la Déconnexion" : "Test Logout & Return to Login"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Operational Modules Preview */}
        <div className="space-y-4 pt-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isFrench ? "Modules de Gestion Opérationnelle" : "Next Step: Operational Modules"}
            </h2>
            <p className="text-xs text-slate-400">
              {isFrench
                ? "Gérez votre patrimoine, générez les accès locataires et suivez les paiements."
                : "The registration flow is confirmed working. These modules will manage your buildings and tenant ledgers."}
            </p>
          </div>

          <div className={`grid grid-cols-2 sm:grid-cols-3 ${profile?.role === "manager" ? "lg:grid-cols-5" : "lg:grid-cols-3 xl:grid-cols-6"} gap-3 sm:gap-4`}>
            <Link
              href="/dashboard/buildings"
              className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500/50 hover:shadow-md rounded-xl p-4 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-600/10 group-hover:bg-blue-600 border border-blue-200 dark:border-blue-500/20 group-hover:border-blue-500 text-blue-600 dark:text-blue-400 group-hover:text-white flex items-center justify-center mb-2.5 transition">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  {isFrench ? "Immeubles" : "Buildings"}
                </h3>
                <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/20">
                  {isFrench ? "Prêt" : "Ready"}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {isFrench ? "Gérer & créer des logements →" : "Manage & create units →"}
              </p>
            </Link>

            <Link
              href="/dashboard/buildings"
              className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500/50 hover:shadow-md rounded-xl p-4 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-600/10 group-hover:bg-purple-600 border border-purple-200 dark:border-purple-500/20 group-hover:border-purple-500 text-purple-600 dark:text-purple-400 group-hover:text-white flex items-center justify-center mb-2.5 transition">
                <Home className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                  {isFrench ? "Logements" : "Units"}
                </h3>
                <span className="text-[10px] text-purple-800 dark:text-purple-400 font-bold bg-purple-100 dark:bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-300 dark:border-purple-500/20">
                  {totalUnits} {isFrench ? "Total" : "Total"}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {occupiedUnits} {isFrench ? "Occupés" : "Occupied"} • {vacantUnits} {isFrench ? "Vacants" : "Vacant"} &rarr;
              </p>
            </Link>

            <Link
              href="/dashboard/credentials"
              id="dashboard-tenants-credentials-card"
              className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 hover:shadow-md rounded-xl p-4 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-600/10 group-hover:bg-emerald-600 border border-emerald-200 dark:border-emerald-500/20 group-hover:border-emerald-500 text-emerald-600 dark:text-emerald-400 group-hover:text-white flex items-center justify-center mb-2.5 transition">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                  {isFrench ? "Locataires" : "Tenants"}
                </h3>
                <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/20">
                  {occupiedUnits} {isFrench ? "Actifs" : "Active"}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {isFrench ? "Baux & codes d'accès →" : "Lease & credentials →"}
              </p>
            </Link>

            {profile?.role === "manager" ? (
              <Link
                href="/dashboard/unpaid-rents"
                id="dashboard-unpaid-rents-card"
                className="bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-900/50 hover:border-rose-500 dark:hover:border-rose-500/50 hover:shadow-md rounded-xl p-4 transition group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-600/10 group-hover:bg-rose-600 border border-rose-200 dark:border-rose-500/20 group-hover:border-rose-500 text-rose-600 dark:text-rose-400 group-hover:text-white flex items-center justify-center mb-2.5 transition">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                    {isFrench ? "Loyers Impayés" : "Unpaid Rents"}
                  </h3>
                  <span className="text-[10px] text-rose-800 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-500/20">
                    {isFrench ? "Relances" : "Overdue"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  {isFrench ? "Alertes WhatsApp & encaissements →" : "Overdue alerts & cash records →"}
                </p>
              </Link>
            ) : (
              <>
                <Link
                  href="/dashboard/payments"
                  id="dashboard-payments-card"
                  className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500/50 hover:shadow-md rounded-xl p-4 transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-600/10 group-hover:bg-blue-600 border border-blue-200 dark:border-blue-500/20 group-hover:border-blue-500 text-blue-600 dark:text-blue-400 group-hover:text-white flex items-center justify-center mb-2.5 transition">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      {isFrench ? "Paiements" : "Payments"}
                    </h3>
                    <span className="text-[10px] text-blue-800 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-500/20">
                      {isFrench ? "Quittances" : "Ledgers"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {isFrench ? "Suivi loyers & quittances →" : "Rent status & receipts →"}
                  </p>
                </Link>

                <Link
                  href="/dashboard/managers"
                  id="dashboard-managers-card"
                  className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500/50 hover:shadow-md rounded-xl p-4 transition group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-600/10 group-hover:bg-indigo-600 border border-indigo-200 dark:border-indigo-500/20 group-hover:border-indigo-500 text-indigo-600 dark:text-indigo-400 group-hover:text-white flex items-center justify-center mb-2.5 transition">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {isFrench ? "Gestionnaires" : "Managers"}
                    </h3>
                    <span className="text-[10px] text-indigo-800 dark:text-indigo-400 font-bold bg-indigo-100 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-500/20">
                      {isFrench ? "Délégation" : "Delegates"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {isFrench ? "Comptes & accès délégués →" : "Delegate team access →"}
                  </p>
                </Link>
              </>
            )}

            <Link
              href="/dashboard/maintenance"
              id="dashboard-repairs-card"
              className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500/50 hover:shadow-md rounded-xl p-4 transition group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-600/10 group-hover:bg-amber-600 border border-amber-200 dark:border-amber-500/20 group-hover:border-amber-500 text-amber-600 dark:text-amber-400 group-hover:text-white flex items-center justify-center mb-2.5 transition">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                  {isFrench ? "Réparations" : "Repairs"}
                </h3>
                {pendingRequests.length > 0 ? (
                  <span className="text-[10px] text-amber-900 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 px-2 py-0.5 rounded-full animate-pulse">
                    {pendingRequests.length} {isFrench ? "En Attente" : "Pending"}
                  </span>
                ) : maintenanceRequests.length > 0 ? (
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {maintenanceRequests.length} {isFrench ? "Total" : "Total"}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    0 {isFrench ? "Ticket" : "Tickets"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {pendingRequests.length > 0
                  ? isFrench
                    ? `${pendingRequests.length} panne${pendingRequests.length > 1 ? "s" : ""} à traiter →`
                    : `${pendingRequests.length} issue${pendingRequests.length > 1 ? "s" : ""} need attention →`
                  : isFrench
                  ? "Tickets & notes vocales →"
                  : "Tickets & voice notes →"}
              </p>
            </Link>

            {profile?.role === "admin" && (
              <Link
                href="/dashboard/admin"
                id="dashboard-admin-card"
                className="bg-white dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-900/50 hover:border-purple-500 dark:hover:border-purple-500/50 hover:shadow-md rounded-xl p-4 transition group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-600/10 group-hover:bg-purple-600 border border-purple-200 dark:border-purple-500/20 group-hover:border-purple-500 text-purple-600 dark:text-purple-400 group-hover:text-white flex items-center justify-center mb-2.5 transition">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                    {isFrench ? "Administration" : "Admin Hub"}
                  </h3>
                  <span className="text-[10px] text-purple-800 dark:text-purple-400 font-bold bg-purple-100 dark:bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-300 dark:border-purple-500/20">
                    {isFrench ? "Global" : "Master"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  {isFrench ? "Supervision multi-bailleurs →" : "Platform-wide oversight →"}
                </p>
              </Link>
            )}
          </div>
        </div>

        {/* Active Maintenance & Repair Requests Section */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{isFrench ? "Demandes de maintenance & réparations" : "Maintenance & Repair Requests"}</span>
                  {pendingRequests.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold animate-pulse">
                      {pendingRequests.length} {isFrench ? "En attente" : "Pending"}
                    </span>
                  )}
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {isFrench
                  ? "Pannes signalées par vos locataires. Inspectez photos, notes vocales et mettez à jour le statut."
                  : "Issues reported by your tenants. Inspect photos, voice recordings, and update status."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/maintenance"
                id="view-all-repairs-btn"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-600/15 dark:hover:bg-amber-600/25 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <span>{isFrench ? "Centre de réparations" : "Repairs Hub"} ({maintenanceRequests.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">{isFrench ? "Total Demandes" : "Total Requests"}</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">{maintenanceRequests.length}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[11px] text-amber-700 dark:text-amber-400/90 block font-medium">{isFrench ? "En Attente" : "Pending Review"}</span>
                <span className="text-xl font-bold text-amber-800 dark:text-amber-300">{pendingRequests.length}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[11px] text-blue-700 dark:text-blue-400/90 block font-medium">{isFrench ? "En Cours" : "In Progress"}</span>
                <span className="text-xl font-bold text-blue-800 dark:text-blue-300">{inProgressRequests.length}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <RefreshCw className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400/90 block font-medium">{isFrench ? "Résolu" : "Resolved"}</span>
                <span className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{resolvedRequests.length}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Requests List */}
          {maintenanceRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
                <Wrench className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                  {isFrench ? "Aucune demande de maintenance pour le moment" : "No Maintenance Requests Yet"}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isFrench
                    ? "Lorsqu'un locataire signale une fuite de plomberie, un problème électrique ou un défaut avec des photos et des notes vocales, sa demande apparaîtra directement sur ce tableau de bord."
                    : "When a tenant reports a plumbing leak, electrical problem, or defect with photos and voice notes, their request will appear directly on this dashboard."}
                </p>
              </div>
              <Link
                href="/dashboard/maintenance"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold border border-slate-300 dark:border-slate-700 transition"
              >
                <span>{isFrench ? "Consulter le centre de réparations" : "Visit Maintenance Center"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {maintenanceRequests.slice(0, 4).map((req) => {
                  const urgencyConfig = URGENCY_LABELS[req.urgency] || URGENCY_LABELS.medium;
                  const statusConfig = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
                  const categoryConfig = CATEGORY_LABELS[req.category] || CATEGORY_LABELS.other;
                  const whatsappReply = buildLandlordReplyWhatsAppUrl(req, language);

                  return (
                    <div
                      key={req.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-lg space-y-4 transition flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Header: Location & Status */}
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white">
                              <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>{req.building_name} • {req.unit_number}</span>
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              {isFrench ? categoryConfig.fr : categoryConfig.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${urgencyConfig.badgeClass}`}>
                              {isFrench ? urgencyConfig.fr : urgencyConfig.label}
                            </span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusConfig.badgeClass}`}>
                              {isFrench ? statusConfig.fr : statusConfig.label}
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-base tracking-tight capitalize">
                            {req.title}
                          </h4>
                          {req.description && (
                            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800/60 italic">
                              "{req.description}"
                            </p>
                          )}
                        </div>

                        {/* Attachments (Photo, Voice, Video) */}
                        {(req.photo_url || req.voice_url || req.video_url) && (
                          <div className="space-y-2 pt-1">
                            {req.photo_url && (
                              <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 max-w-xs">
                                <img
                                  src={req.photo_url}
                                  alt={isFrench ? "Photo de la panne" : "Tenant damage photo"}
                                  className="w-full h-36 object-cover cursor-pointer hover:scale-105 transition duration-300"
                                  onClick={() => setPreviewPhoto(req.photo_url || null)}
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhoto(req.photo_url || null)}
                                  className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/80 backdrop-blur text-slate-900 dark:text-white text-[11px] font-medium flex items-center gap-1.5 border border-slate-200 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer shadow-xs"
                                >
                                  <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  <span>{isFrench ? "Inspecter la photo" : "Inspect Photo"}</span>
                                </button>
                              </div>
                            )}

                            {req.voice_url && (
                              <div className="space-y-1">
                                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                                  <Mic className="w-3.5 h-3.5" />
                                  <span>
                                    {isFrench ? "Note vocale" : "Voice Note"} ({req.voice_duration_seconds ? `${req.voice_duration_seconds}s` : isFrench ? "Enregistrée" : "Recorded"})
                                  </span>
                                </span>
                                <AudioPlayer
                                  src={req.voice_url}
                                  durationSeconds={req.voice_duration_seconds}
                                  label={`${isFrench ? "Note vocale" : "Voice Note"} - ${req.tenant_name}`}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer: Tenant Details & Actions */}
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-900 dark:text-slate-200 font-semibold">{req.tenant_name}</span>
                          <span className="text-slate-300 dark:text-slate-500">•</span>
                          <span>{req.tenant_phone}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {req.tenant_phone && (
                            <a
                              href={whatsappReply.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/15 dark:hover:bg-emerald-600/25 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition cursor-pointer shadow-xs"
                              title={isFrench ? "Discuter sur WhatsApp" : "Chat on WhatsApp"}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}

                          <Link
                            href="/dashboard/maintenance"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-semibold border border-slate-300 dark:border-slate-700 transition cursor-pointer shadow-xs"
                          >
                            <span>{isFrench ? "Gérer" : "Manage"}</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {maintenanceRequests.length > 4 && (
                <div className="text-center pt-2">
                  <Link
                    href="/dashboard/maintenance"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
                  >
                    <span>
                      {isFrench
                        ? `Voir toutes les ${maintenanceRequests.length} demandes dans le centre de réparations →`
                        : `View all ${maintenanceRequests.length} requests in Repairs Hub →`}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Lightbox Modal for Photo Inspection */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>{isFrench ? "Inspection de la photo de la panne" : "Damage Photo Inspection"}</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center">
              <img
                src={previewPhoto}
                alt={isFrench ? "Photo agrandie" : "Enlarged photo"}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => !loggingOut && setShowLogoutConfirm(false)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-xs">
                <LogOut className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isFrench ? "Confirmer la déconnexion" : "Confirm Sign Out"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isFrench
                    ? "Êtes-vous sûr de vouloir vous déconnecter de votre compte LeaseLink ?"
                    : "Are you sure you want to sign out of your LeaseLink account?"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isFrench ? "Déconnexion..." : "Signing Out..."}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>{isFrench ? "Oui, se déconnecter" : "Yes, Sign Out"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Payment & Upgrade Modal */}
      <SubscriptionPaymentModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        profile={profile}
        onSubscriptionUpdated={() => {
          fetchSessionAndProfile();
        }}
      />
    </div>
  );
}
