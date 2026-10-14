"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AdminStats,
  AdminLandlordSummary,
  AdminActivityEvent,
  AdminGlobalTransaction,
  LandlordProfile,
  MaintenanceRequest,
  SubscriptionPlanId,
  AVAILABLE_PLANS,
  RentPayment,
} from "@/types/database";
import {
  getAdminPlatformStats,
  getAdminLandlords,
  getAdminGlobalTransactions,
  getAdminAllMaintenance,
  getAdminActivityStream,
  updateLandlordPlanAdmin,
} from "@/lib/services/adminService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import DashboardNav from "@/components/DashboardNav";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import AudioPlayer from "@/components/AudioPlayer";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  ShieldAlert,
  Users,
  Building2,
  DollarSign,
  Receipt,
  Wrench,
  Clock,
  Activity,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  Phone,
  Mail,
  Calendar,
  Sliders,
  Eye,
  Edit3,
  Check,
  X,
  ExternalLink,
  MessageCircle,
  FileText,
  Layers,
  Lock,
  Copy,
  TrendingUp,
  DoorOpen,
  UserCheck,
  ShieldCheck,
  ArrowUpRight,
  Radio,
} from "lucide-react";

type AdminTab = "overview" | "landlords" | "transactions" | "activity" | "maintenance";

export default function AdminDashboardPage() {
  const { isFrench, language, formatDate } = useLanguage();
  const router = useRouter();

  // Authentication & Profile
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [landlords, setLandlords] = useState<AdminLandlordSummary[]>([]);
  const [transactions, setTransactions] = useState<AdminGlobalTransaction[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [activity, setActivity] = useState<AdminActivityEvent[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter States
  const [landlordSearch, setLandlordSearch] = useState("");
  const [landlordPlanFilter, setLandlordPlanFilter] = useState<string>("all");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionMethodFilter, setTransactionMethodFilter] = useState<string>("all");
  const [maintenanceUrgencyFilter, setMaintenanceUrgencyFilter] = useState<string>("all");
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState<string>("all");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");

  // Plan Edit Modal State
  const [selectedLandlordForPlan, setSelectedLandlordForPlan] = useState<AdminLandlordSummary | null>(null);
  const [newPlanSelection, setNewPlanSelection] = useState<SubscriptionPlanId>("tier_1_30");
  const [newPlanDuration, setNewPlanDuration] = useState<number>(30);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [planSuccessNotice, setPlanSuccessNotice] = useState(false);

  // Quittance Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<RentPayment | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Photo Lightbox
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Copy SQL State
  const [copiedSql, setCopiedSql] = useState(false);

  // 1. Check Authentication & Verify Admin Role
  useEffect(() => {
    async function initAdminAuth() {
      setCheckingAuth(true);
      const supabase = createClient();

      try {
        const {
          data: { user: authUser },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !authUser) {
          router.push("/login");
          return;
        }

        setUser(authUser);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData as LandlordProfile);
        }
      } catch (err) {
        console.error("Error verifying admin role:", err);
      } finally {
        setCheckingAuth(false);
      }
    }

    initAdminAuth();
  }, [router]);

  // 2. Load all platform-wide administrative data
  const loadAdminData = async () => {
    setLoadingData(true);
    try {
      const [statsData, landlordsData, txData, maintData, activityData] = await Promise.all([
        getAdminPlatformStats(),
        getAdminLandlords(),
        getAdminGlobalTransactions(),
        getAdminAllMaintenance(),
        getAdminActivityStream(),
      ]);

      setStats(statsData);
      setLandlords(landlordsData);
      setTransactions(txData);
      setMaintenance(maintData);
      setActivity(activityData);
    } catch (err) {
      console.error("Error loading admin platform data:", err);
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (profile?.role === "admin") {
      loadAdminData();
    }
  }, [profile]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAdminData();
  };

  // Plan adjustment submission
  const handleSavePlanChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLandlordForPlan) return;

    setIsUpdatingPlan(true);
    try {
      const success = await updateLandlordPlanAdmin(
        selectedLandlordForPlan.id,
        newPlanSelection,
        newPlanDuration
      );

      if (success) {
        setPlanSuccessNotice(true);
        setTimeout(() => {
          setPlanSuccessNotice(false);
          setSelectedLandlordForPlan(null);
          loadAdminData();
        }, 1200);
      }
    } catch (err) {
      console.error("Error updating landlord plan:", err);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // Filtered Landlords
  const filteredLandlords = useMemo(() => {
    return landlords.filter((l) => {
      const matchesSearch =
        l.full_name.toLowerCase().includes(landlordSearch.toLowerCase()) ||
        l.email.toLowerCase().includes(landlordSearch.toLowerCase()) ||
        l.phone.includes(landlordSearch);
      const matchesPlan =
        landlordPlanFilter === "all" || l.plan === landlordPlanFilter;
      return matchesSearch && matchesPlan;
    });
  }, [landlords, landlordSearch, landlordPlanFilter]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = transactionSearch.toLowerCase();
      const matchesSearch =
        t.tenant_name.toLowerCase().includes(q) ||
        t.receipt_number.toLowerCase().includes(q) ||
        t.building_name.toLowerCase().includes(q) ||
        t.unit_number.toLowerCase().includes(q) ||
        t.landlord_name.toLowerCase().includes(q);
      const matchesMethod =
        transactionMethodFilter === "all" || t.payment_method === transactionMethodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [transactions, transactionSearch, transactionMethodFilter]);

  // Filtered Maintenance
  const filteredMaintenance = useMemo(() => {
    return maintenance.filter((m) => {
      const matchesUrgency =
        maintenanceUrgencyFilter === "all" || m.urgency === maintenanceUrgencyFilter;
      const matchesStatus =
        maintenanceStatusFilter === "all" || m.status === maintenanceStatusFilter;
      return matchesUrgency && matchesStatus;
    });
  }, [maintenance, maintenanceUrgencyFilter, maintenanceStatusFilter]);

  // Filtered Activity
  const filteredActivity = useMemo(() => {
    if (activityTypeFilter === "all") return activity;
    return activity.filter((a) => a.type === activityTypeFilter);
  }, [activity, activityTypeFilter]);

  // View Receipt helper
  const handleOpenReceiptModal = (tx: AdminGlobalTransaction) => {
    const mockPayment: RentPayment = {
      id: tx.id,
      receipt_number: tx.receipt_number,
      unit_id: "preview-unit",
      building_id: "preview-bld",
      landlord_id: tx.landlord_id,
      tenant_name: tx.tenant_name,
      tenant_phone: tx.tenant_phone,
      tenant_email: null,
      unit_number: tx.unit_number,
      building_name: tx.building_name,
      landlord_name: tx.landlord_name,
      rent_month: tx.rent_month,
      monthly_rent_amount: tx.amount_paid,
      amount_paid: tx.amount_paid,
      balance_remaining: 0,
      payment_method: tx.payment_method,
      payment_type: "full",
      transaction_ref: tx.receipt_number,
      status: "completed",
      notes: tx.notes || null,
      months_covered: tx.months_covered || [tx.rent_month],
      created_at: tx.created_at,
      updated_at: tx.created_at,
    };
    setSelectedReceipt(mockPayment);
    setShowReceiptModal(true);
  };

  // Copy SQL helper for unauthorized users
  const handleCopySql = () => {
    if (!user) return;
    const sql = `UPDATE public.profiles SET role = 'admin' WHERE id = '${user.id}';`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // ---------------------------------------------------------------------------
  // LOADING STATE
  // ---------------------------------------------------------------------------
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            {isFrench ? "Vérification des droits administrateur..." : "Verifying administrator permissions..."}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STRICT ACCESS DENIED SCREEN (when user is logged in but role !== 'admin')
  // ---------------------------------------------------------------------------
  if (profile?.role !== "admin") {
    const userEmail = user?.email || "votre-compte@example.com";
    const promoSql = `UPDATE public.profiles SET role = 'admin' WHERE email = '${userEmail}';`;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-xl w-full bg-slate-900 border-2 border-purple-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 space-y-6 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mx-auto shadow-lg shadow-purple-600/20">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {isFrench ? "Accès Super-Administrateur Restreint" : "Super-Admin Access Restricted"}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {isFrench ? "Espace Réservé à l'Administration" : "Administrator Hub Protected"}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              {isFrench
                ? "Ce tableau de bord offre une visibilité totale sur tous les bailleurs, immeubles, flux financiers et tickets de maintenance de la plateforme LeaseLink."
                : "This command center grants platform-wide visibility across all landlords, buildings, transactions, and maintenance requests."}
            </p>
          </div>

          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-left space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>{isFrench ? "Élévation des privilèges SQL :" : "Grant admin role in Supabase :"}</span>
              <button
                onClick={handleCopySql}
                className="text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? (isFrench ? "Copié !" : "Copied!") : (isFrench ? "Copier SQL" : "Copy SQL")}</span>
              </button>
            </div>
            <pre className="font-mono text-xs text-purple-300 bg-slate-900/90 p-3 rounded-xl overflow-x-auto border border-purple-500/20">
              {promoSql}
            </pre>
            <p className="text-[11px] text-slate-500">
              {isFrench
                ? "Exécutez cette commande dans l'éditeur SQL de votre console Supabase pour promouvoir votre compte, puis actualisez la page."
                : "Run this command in your Supabase SQL editor to promote this account, then refresh this page."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isFrench ? "Vérifier & Actualiser" : "Verify & Refresh"}</span>
            </button>

            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-2"
            >
              <span>{isFrench ? "Retourner à mon Espace Bailleur" : "Return to Landlord Dashboard"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // AUTHORIZED SUPER-ADMIN COMMAND CENTER
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Navigation Bar with Super-Admin Pill */}
      <DashboardNav
        user={user}
        profile={profile}
        pendingRepairsCount={stats?.pending_maintenance_requests || 0}
        buildingsCount={stats?.total_buildings || 0}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 lg:pb-12">
        {/* ===================================================================== */}
        {/* HERO BANNER: SUPER-ADMIN COMMAND CENTER                                */}
        {/* ===================================================================== */}
        <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/80 to-slate-900 border-2 border-purple-500/30 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
            <ShieldAlert className="w-56 h-56 text-purple-400" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>
                  {isFrench
                    ? "Plateforme En Ligne • Tous les Systèmes Opérationnels"
                    : "Platform Live • All Systems Operational"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {isFrench
                  ? "Console d'Administration Globale LeaseLink"
                  : "LeaseLink Master Administrator Command Center"}
              </h1>

              <p className="text-xs sm:text-sm text-purple-200/90 leading-relaxed">
                {isFrench
                  ? "Surveillance centralisée de l'ensemble des activités : bailleurs inscrits, encaissements de loyers, logements occupés, gestionnaires et demandes d'intervention."
                  : "Centralized operational oversight: registered landlords, gross transaction volume, occupancy metrics, delegated managers, and maintenance requests."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-md transition cursor-pointer shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-purple-300" : ""}`} />
                <span>{refreshing ? (isFrench ? "Synchronisation..." : "Syncing...") : (isFrench ? "Actualiser les Données" : "Refresh Metrics")}</span>
              </button>

              <div className="px-3.5 py-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-[11px] text-purple-300 font-mono">
                {isFrench ? "Connecté en Super-Admin" : "Super-Admin Mode Active"}
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* NAVIGATION TABS: 5 CORE VIEWS                                         */}
        {/* ===================================================================== */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === "overview"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{isFrench ? "Vue d'ensemble & KPIs" : "Overview & KPIs"}</span>
          </button>

          <button
            onClick={() => setActiveTab("landlords")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === "landlords"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isFrench ? "Bailleurs" : "Landlords"} ({landlords.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("transactions")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === "transactions"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>{isFrench ? "Transactions & Quittances" : "Transactions"} ({transactions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === "activity"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{isFrench ? "Journal d'Audit" : "Activity Stream"} ({activity.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("maintenance")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === "maintenance"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>{isFrench ? "Maintenance Globale" : "Maintenance Hub"} ({maintenance.length})</span>
            {stats && stats.emergency_maintenance_requests > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: OVERVIEW & PLATFORM METRICS                                    */}
        {/* ===================================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* 5 Core Top-Level KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card 1: Gross Volume */}
              <div className="bg-white dark:bg-slate-900 border-2 border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Volume Financier Global" : "Total Volume (GMV)"}</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {Number(stats?.total_volume_xaf || 0).toLocaleString()} <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">XAF</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{stats?.total_payments_count || 0} {isFrench ? "paiements" : "receipts"}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">100% Certifiés</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Registered Landlords */}
              <div className="bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-500/30 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Bailleurs Inscrits" : "Total Landlords"}</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats?.total_landlords || 0}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{stats?.total_managers || 0} {isFrench ? "gestionnaires" : "managers"}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">{isFrench ? "Comptes Actifs" : "Active"}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Buildings & Units */}
              <div className="bg-white dark:bg-slate-900 border-2 border-purple-200 dark:border-purple-500/30 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Parc Immobilier Global" : "Buildings & Units"}</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats?.total_units || 0} <span className="text-xs font-normal text-purple-600 dark:text-purple-400">{isFrench ? "logements" : "units"}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{stats?.total_buildings || 0} {isFrench ? "immeubles" : "buildings"}</span>
                    <span className="text-purple-600 dark:text-purple-400 font-medium">{stats?.occupancy_rate || 0}% {isFrench ? "occupés" : "occupied"}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Occupancy Ratio */}
              <div className="bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Taux d'Occupation" : "Occupancy Rate"}</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats?.occupancy_rate || 0}%
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{stats?.occupied_units || 0} {isFrench ? "occupés" : "occupied"}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats?.vacant_units || 0} {isFrench ? "vacants" : "vacant"}</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Maintenance & Incidents */}
              <div className="bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-500/30 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Incidents Maintenance" : "Repairs & Urgency"}</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats?.total_maintenance_requests || 0}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">
                      {stats?.pending_maintenance_requests || 0} {isFrench ? "en attente" : "pending"}
                    </span>
                    {stats && stats.emergency_maintenance_requests > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold animate-pulse">
                        {stats.emergency_maintenance_requests} {isFrench ? "urgences" : "urgents"}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">0 urgence</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Breakdown Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Card 1: Subscription Tier Distribution */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {isFrench ? "Répartition des Abonnements" : "Subscription Distribution"}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {landlords.length} {isFrench ? "Bailleurs" : "Total"}
                  </span>
                </div>

                <div className="space-y-3.5">
                  {AVAILABLE_PLANS.map((plan) => {
                    const count = stats?.plan_distribution[plan.id] || 0;
                    const pct = landlords.length > 0 ? Math.round((count / landlords.length) * 100) : 0;
                    return (
                      <div key={plan.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {isFrench && plan.nameFr ? plan.nameFr : plan.name}
                          </span>
                          <span className="font-mono text-slate-600 dark:text-slate-400">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full rounded-full transition-all ${
                              plan.id === "free"
                                ? "bg-slate-400"
                                : plan.id === "tier_1_30"
                                ? "bg-blue-500"
                                : plan.id === "tier_31_60"
                                ? "bg-purple-500"
                                : "bg-emerald-500"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Cash vs Digital Volume */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {isFrench ? "Modes d'Encaissement" : "Payment Methods"}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {transactions.length} {isFrench ? "Opérations" : "Txns"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 space-y-1">
                    <span className="text-xs text-emerald-800 dark:text-emerald-400 font-bold block">
                      {isFrench ? "Espèces (Main Propre)" : "Physical Cash"}
                    </span>
                    <span className="text-lg font-black text-slate-900 dark:text-white block">
                      {Number(stats?.cash_volume_xaf || 0).toLocaleString()} <span className="text-xs font-normal">XAF</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {isFrench ? "Encaissé par bailleur/gestionnaire" : "Collected on-site"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 space-y-1">
                    <span className="text-xs text-blue-800 dark:text-blue-400 font-bold block">
                      {isFrench ? "Mobile Money (MTN/Orange)" : "Mobile Money"}
                    </span>
                    <span className="text-lg font-black text-slate-900 dark:text-white block">
                      {Number(stats?.digital_volume_xaf || 0).toLocaleString()} <span className="text-xs font-normal">XAF</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {isFrench ? "Paiements digitaux enregistrés" : "Digital settlement"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isFrench
                    ? "Toutes les transactions génèrent automatiquement une quittance numérotée certifiée disponible pour le locataire et le propriétaire."
                    : "All transactions generate certified receipts available to both tenant and landlord in their portals."}
                </div>
              </div>

              {/* Card 3: Quick Action Navigation */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {isFrench ? "Raccourcis Administrateur" : "Administrator Actions"}
                  </h3>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab("landlords")}
                    className="w-full p-3 rounded-xl bg-slate-50 hover:bg-purple-50 dark:bg-slate-800/60 dark:hover:bg-purple-900/20 border border-slate-200 dark:border-slate-700 text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        {isFrench ? "Gérer les Comptes Bailleurs" : "Manage Landlord Accounts"}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
                  </button>

                  <button
                    onClick={() => setActiveTab("transactions")}
                    className="w-full p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/60 dark:hover:bg-emerald-900/20 border border-slate-200 dark:border-slate-700 text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {isFrench ? "Inspecter le Flux des Loyers" : "Inspect Rent Payments Feed"}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
                  </button>

                  <button
                    onClick={() => setActiveTab("maintenance")}
                    className="w-full p-3 rounded-xl bg-slate-50 hover:bg-amber-50 dark:bg-slate-800/60 dark:hover:bg-amber-900/20 border border-slate-200 dark:border-slate-700 text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        {isFrench ? "Centre Global des Réparations" : "Global Maintenance Hub"}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
                  </button>

                  <button
                    onClick={() => setActiveTab("activity")}
                    className="w-full p-3 rounded-xl bg-slate-50 hover:bg-blue-50 dark:bg-slate-800/60 dark:hover:bg-blue-900/20 border border-slate-200 dark:border-slate-700 text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {isFrench ? "Consulter le Journal d'Audit" : "View Realtime Audit Trail"}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: LANDLORDS MANAGEMENT DIRECTORY                                 */}
        {/* ===================================================================== */}
        {activeTab === "landlords" && (
          <div className="space-y-5">
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isFrench ? "Répertoire des Propriétaires Bailleurs" : "Registered Landlords Directory"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFrench
                    ? "Gestion des comptes, forfaits souscrits, parcs immobiliers et gestionnaires délégués."
                    : "Manage landlord accounts, subscription plans, property volume, and delegated managers."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isFrench ? "Rechercher un bailleur..." : "Search landlord..."}
                    value={landlordSearch}
                    onChange={(e) => setLandlordSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 w-48 sm:w-64"
                  />
                </div>

                <select
                  value={landlordPlanFilter}
                  onChange={(e) => setLandlordPlanFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">{isFrench ? "Tous les Forfaits" : "All Plans"}</option>
                  <option value="free">{isFrench ? "Essai Gratuit" : "Free Trial"}</option>
                  <option value="tier_1_30">Starter (1-30)</option>
                  <option value="tier_31_60">Growth (31-60)</option>
                  <option value="tier_61_100">Pro (61-100)</option>
                </select>
              </div>
            </div>

            {/* Landlords Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLandlords.map((landlord) => {
                const planInfo = AVAILABLE_PLANS.find((p) => p.id === landlord.plan);
                return (
                  <div
                    key={landlord.id}
                    className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-500/50 rounded-2xl p-5 space-y-4 shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-600/20 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm shrink-0">
                          {landlord.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {landlord.full_name}
                          </h3>
                          <span className="text-[11px] text-slate-500 truncate block">
                            {landlord.email}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 shrink-0">
                        {isFrench && planInfo?.nameFr ? planInfo.nameFr : landlord.plan_name}
                      </span>
                    </div>

                    {/* Stats Strip */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">{isFrench ? "Immeubles" : "Buildings"}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{landlord.buildings_count}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">{isFrench ? "Logements" : "Units"}</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {landlord.occupied_units_count}/{landlord.units_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">{isFrench ? "Gestionnaires" : "Managers"}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{landlord.managers_count}</span>
                      </div>
                    </div>

                    {/* Contact & Actions */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <a
                        href={`https://wa.me/${landlord.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-mono"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{landlord.phone}</span>
                      </a>

                      <button
                        onClick={() => {
                          setSelectedLandlordForPlan(landlord);
                          setNewPlanSelection(landlord.plan);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-600/20 dark:hover:bg-purple-600/30 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 font-semibold text-[11px] transition cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isFrench ? "Changer Forfait" : "Edit Plan"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: PLATFORM-WIDE TRANSACTIONS                                     */}
        {/* ===================================================================== */}
        {activeTab === "transactions" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isFrench ? "Flux Financier & Quittances Délivrées" : "Platform-Wide Transactions & Certified Receipts"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFrench
                    ? "Historique de tous les encaissements de loyers enregistrés sur la plateforme."
                    : "Complete audit log of all rent payments processed across all landlords."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isFrench ? "Locataire, reçu, immeuble..." : "Tenant, receipt, property..."}
                    value={transactionSearch}
                    onChange={(e) => setTransactionSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 w-48 sm:w-64"
                  />
                </div>

                <select
                  value={transactionMethodFilter}
                  onChange={(e) => setTransactionMethodFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">{isFrench ? "Tous les Modes" : "All Methods"}</option>
                  <option value="cash">{isFrench ? "Espèces (Cash)" : "Cash"}</option>
                  <option value="mtn_momo">MTN Mobile Money</option>
                  <option value="orange_money">Orange Money</option>
                </select>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3.5">{isFrench ? "Reçu N°" : "Receipt N°"}</th>
                      <th className="px-4 py-3.5">{isFrench ? "Locataire & Logement" : "Tenant & Unit"}</th>
                      <th className="px-4 py-3.5">{isFrench ? "Propriétaire Bailleur" : "Landlord"}</th>
                      <th className="px-4 py-3.5">{isFrench ? "Période" : "Period"}</th>
                      <th className="px-4 py-3.5">{isFrench ? "Montant" : "Amount"}</th>
                      <th className="px-4 py-3.5">{isFrench ? "Mode" : "Method"}</th>
                      <th className="px-4 py-3.5">{isFrench ? "Date" : "Date"}</th>
                      <th className="px-4 py-3.5 text-right">{isFrench ? "Action" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-blue-500" />
                          <span>{tx.receipt_number}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {tx.tenant_name}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {tx.unit_number} • {tx.building_name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                          {tx.landlord_name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {tx.rent_month}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(tx.amount_paid).toLocaleString()} XAF
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.payment_method === "cash"
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                                : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                            }`}
                          >
                            {tx.payment_method === "cash" ? (isFrench ? "Espèces" : "Cash") : tx.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500 font-mono">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenReceiptModal(tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-700 dark:text-blue-300 font-semibold text-[11px] transition cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{isFrench ? "Quittance" : "Receipt"}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: LIVE ACTIVITY AUDIT STREAM                                     */}
        {/* ===================================================================== */}
        {activeTab === "activity" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isFrench ? "Journal d'Audit des Événements Plateforme" : "Platform Realtime Activity Stream"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFrench
                    ? "Flux chronologique en direct de toutes les interactions sur LeaseLink."
                    : "Real-time chronological audit trail of all platform events."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={activityTypeFilter}
                  onChange={(e) => setActivityTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">{isFrench ? "Tous les Événements" : "All Events"}</option>
                  <option value="payment">{isFrench ? "Paiements" : "Payments"}</option>
                  <option value="signup">{isFrench ? "Inscriptions Bailleurs" : "Landlord Signups"}</option>
                  <option value="maintenance">{isFrench ? "Demandes de Réparation" : "Maintenance Requests"}</option>
                </select>
              </div>
            </div>

            {/* Event Timeline */}
            <div className="space-y-3">
              {filteredActivity.map((ev) => {
                const isPayment = ev.type === "payment";
                const isSignup = ev.type === "signup";
                const isMaint = ev.type === "maintenance";

                return (
                  <div
                    key={ev.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm hover:border-purple-300 dark:hover:border-purple-500/40 transition"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isPayment
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                          : isSignup
                          ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                          : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                      }`}
                    >
                      {isPayment ? (
                        <DollarSign className="w-4 h-4" />
                      ) : isSignup ? (
                        <Users className="w-4 h-4" />
                      ) : (
                        <Wrench className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                          {ev.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {ev.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {ev.actor_role}: {ev.actor_name}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: GLOBAL MAINTENANCE HUB                                         */}
        {/* ===================================================================== */}
        {activeTab === "maintenance" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isFrench ? "Centre Global de Maintenance & Réparations" : "Platform-Wide Maintenance & Incidents"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFrench
                    ? "Toutes les demandes de réparations signalées par les locataires à travers tous les immeubles."
                    : "All repair tickets reported by tenants across all properties."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={maintenanceUrgencyFilter}
                  onChange={(e) => setMaintenanceUrgencyFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">{isFrench ? "Toutes les Urgences" : "All Urgencies"}</option>
                  <option value="emergency">{isFrench ? "Urgence Vitale" : "Emergency"}</option>
                  <option value="high">{isFrench ? "Élevée" : "High"}</option>
                  <option value="medium">{isFrench ? "Moyenne" : "Medium"}</option>
                  <option value="low">{isFrench ? "Faible" : "Low"}</option>
                </select>

                <select
                  value={maintenanceStatusFilter}
                  onChange={(e) => setMaintenanceStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">{isFrench ? "Tous les Statuts" : "All Statuses"}</option>
                  <option value="pending">{isFrench ? "En attente" : "Pending"}</option>
                  <option value="in_progress">{isFrench ? "En cours" : "In Progress"}</option>
                  <option value="resolved">{isFrench ? "Résolue" : "Resolved"}</option>
                </select>
              </div>
            </div>

            {/* Maintenance Tickets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMaintenance.map((m) => {
                const isEmergency = m.urgency === "emergency";
                return (
                  <div
                    key={m.id}
                    className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-5 space-y-3 shadow-sm transition ${
                      isEmergency
                        ? "border-rose-400 dark:border-rose-500/50"
                        : "border-slate-200 dark:border-slate-800 hover:border-amber-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isEmergency
                                ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300"
                                : m.urgency === "high"
                                ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300"
                                : "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300"
                            }`}
                          >
                            {m.urgency}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(m.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                          {m.title || m.category}
                        </h4>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          m.status === "pending"
                            ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300"
                            : m.status === "in_progress"
                            ? "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300"
                            : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {m.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1 border-t border-slate-100 dark:divide-slate-800">
                      <span>Logement: <strong className="text-slate-800 dark:text-slate-200">{m.unit_number}</strong></span>
                      <span>•</span>
                      <span>Immeuble: <strong className="text-slate-800 dark:text-slate-200">{m.building_name}</strong></span>
                      <span>•</span>
                      <span>Locataire: <strong className="text-slate-800 dark:text-slate-200">{m.tenant_name}</strong></span>
                    </div>

                    {/* Media preview (voice / photo) */}
                    <div className="flex items-center gap-2 pt-1">
                      {m.voice_url && (
                        <div className="flex-1">
                          <AudioPlayer src={m.voice_url} durationSeconds={m.voice_duration_seconds} />
                        </div>
                      )}
                      {m.photo_url && (
                        <button
                          onClick={() => setPreviewPhoto(m.photo_url!)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-200 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isFrench ? "Photo" : "Photo"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ======================================================================= */}
      {/* MODAL: ADMIN SUBSCRIPTION PLAN ADJUSTER                                  */}
      {/* ======================================================================= */}
      {selectedLandlordForPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  {isFrench ? "Action Super-Administrateur" : "Super-Admin Action"}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isFrench ? "Modifier le Forfait du Bailleur" : "Adjust Landlord Subscription Tier"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedLandlordForPlan.full_name} ({selectedLandlordForPlan.email})
                </p>
              </div>

              <button
                onClick={() => setSelectedLandlordForPlan(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {planSuccessNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{isFrench ? "Forfait mis à jour avec succès !" : "Subscription updated successfully!"}</span>
              </div>
            )}

            <form onSubmit={handleSavePlanChange} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isFrench ? "Choisir la Formule" : "Select Subscription Plan"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PLANS.map((plan) => (
                    <button
                      type="button"
                      key={plan.id}
                      onClick={() => setNewPlanSelection(plan.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        newPlanSelection === plan.id
                          ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300 font-bold"
                          : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-xs font-bold">{isFrench && plan.nameFr ? plan.nameFr : plan.name}</div>
                      <div className="text-[10px] text-slate-500">{plan.unitRange}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isFrench ? "Durée de validité (Jours)" : "Validity Duration (Days)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newPlanDuration}
                  onChange={(e) => setNewPlanDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLandlordForPlan(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  {isFrench ? "Annuler" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPlan}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingPlan
                    ? isFrench ? "Mise à jour..." : "Updating..."
                    : isFrench ? "Confirmer la Modification" : "Confirm Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Certified Receipt Modal */}
      {showReceiptModal && selectedReceipt && (
        <PaymentReceiptModal
          payment={selectedReceipt}
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedReceipt(null);
          }}
        />
      )}

      {/* Photo Lightbox */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhoto}
              alt="Photo preview"
              className="rounded-2xl max-h-[85vh] w-auto shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
