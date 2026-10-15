"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AdminStats,
  AdminLandlordSummary,
  AdminManagerSummary,
  AdminTenantSummary,
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
  getAdminManagers,
  getAdminTenants,
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
  ArrowUpDown,
} from "lucide-react";

type AdminTab = "overview" | "landlords" | "managers" | "tenants" | "transactions" | "maintenance" | "activity";

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
  const [managers, setManagers] = useState<AdminManagerSummary[]>([]);
  const [tenants, setTenants] = useState<AdminTenantSummary[]>([]);
  const [transactions, setTransactions] = useState<AdminGlobalTransaction[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [activity, setActivity] = useState<AdminActivityEvent[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter States
  const [landlordSearch, setLandlordSearch] = useState("");
  const [landlordPlanFilter, setLandlordPlanFilter] = useState<string>("all");
  const [landlordSort, setLandlordSort] = useState<"name_asc" | "name_desc" | "buildings_desc" | "units_desc" | "revenue_desc">("name_asc");

  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionMethodFilter, setTransactionMethodFilter] = useState<string>("all");
  const [transactionBuildingFilter, setTransactionBuildingFilter] = useState<string>("all");
  const [transactionLandlordFilter, setTransactionLandlordFilter] = useState<string>("all");
  const [transactionSort, setTransactionSort] = useState<
    "date_desc" | "date_asc" | "building_asc" | "building_desc" | "landlord_asc" | "landlord_desc" | "amount_desc" | "amount_asc"
  >("date_desc");

  const [managerSearch, setManagerSearch] = useState("");
  const [managerLandlordFilter, setManagerLandlordFilter] = useState<string>("all");
  const [managerBuildingFilter, setManagerBuildingFilter] = useState<string>("all");
  const [managerSort, setManagerSort] = useState<
    "landlord_asc" | "landlord_desc" | "building_asc" | "building_desc" | "name_asc" | "name_desc" | "date_desc"
  >("landlord_asc");

  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantLandlordFilter, setTenantLandlordFilter] = useState<string>("all");
  const [tenantBuildingFilter, setTenantBuildingFilter] = useState<string>("all");
  const [tenantSort, setTenantSort] = useState<
    "building_asc" | "building_desc" | "landlord_asc" | "landlord_desc" | "name_asc" | "name_desc" | "rent_desc" | "rent_asc" | "date_desc"
  >("building_asc");

  const [maintenanceUrgencyFilter, setMaintenanceUrgencyFilter] = useState<string>("all");
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState<string>("all");
  const [maintenanceBuildingFilter, setMaintenanceBuildingFilter] = useState<string>("all");
  const [maintenanceSort, setMaintenanceSort] = useState<"date_desc" | "building_asc" | "urgency_desc">("date_desc");

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
      const [statsData, landlordsData, managersData, tenantsData, txData, maintData, activityData] = await Promise.all([
        getAdminPlatformStats(),
        getAdminLandlords(),
        getAdminManagers(),
        getAdminTenants(),
        getAdminGlobalTransactions(),
        getAdminAllMaintenance(),
        getAdminActivityStream(),
      ]);

      setStats(statsData);
      setLandlords(landlordsData);
      setManagers(managersData);
      setTenants(tenantsData);
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

  // Unique Building Names across all records (for building dropdown filter)
  const availableBuildingNames = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => t.building_name && set.add(t.building_name.trim()));
    tenants.forEach((t) => t.building_name && set.add(t.building_name.trim()));
    managers.forEach((m) =>
      m.assigned_building_names?.forEach((bn) => bn && set.add(bn.trim()))
    );
    maintenance.forEach((m) => m.building_name && set.add(m.building_name.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions, tenants, managers, maintenance]);

  // Unique Landlord Names across all records (for landlord dropdown filter)
  const availableLandlordNames = useMemo(() => {
    const set = new Set<string>();
    landlords.forEach((l) => l.full_name && set.add(l.full_name.trim()));
    transactions.forEach((t) => t.landlord_name && set.add(t.landlord_name.trim()));
    tenants.forEach((t) => t.landlord_name && set.add(t.landlord_name.trim()));
    managers.forEach((m) => m.landlord_name && set.add(m.landlord_name.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [landlords, transactions, tenants, managers]);

  // Filtered & Sorted Landlords
  const filteredLandlords = useMemo(() => {
    const filtered = landlords.filter((l) => {
      const matchesSearch =
        l.full_name.toLowerCase().includes(landlordSearch.toLowerCase()) ||
        l.email.toLowerCase().includes(landlordSearch.toLowerCase()) ||
        l.phone.includes(landlordSearch);
      const matchesPlan =
        landlordPlanFilter === "all" || l.plan === landlordPlanFilter;
      return matchesSearch && matchesPlan;
    });

    return filtered.sort((a, b) => {
      if (landlordSort === "name_asc") return a.full_name.localeCompare(b.full_name);
      if (landlordSort === "name_desc") return b.full_name.localeCompare(a.full_name);
      if (landlordSort === "buildings_desc") return b.buildings_count - a.buildings_count;
      if (landlordSort === "units_desc") return b.units_count - a.units_count;
      if (landlordSort === "revenue_desc")
        return (b.total_revenue_collected_xaf || 0) - (a.total_revenue_collected_xaf || 0);
      return 0;
    });
  }, [landlords, landlordSearch, landlordPlanFilter, landlordSort]);

  // Filtered & Sorted Managers
  const filteredManagers = useMemo(() => {
    const filtered = managers.filter((m) => {
      const q = managerSearch.toLowerCase();
      const matchesSearch =
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.landlord_name.toLowerCase().includes(q);

      const matchesLandlord =
        managerLandlordFilter === "all" || m.landlord_name === managerLandlordFilter;

      const matchesBuilding =
        managerBuildingFilter === "all" ||
        m.assigned_building_names?.some((bn) => bn === managerBuildingFilter);

      return matchesSearch && matchesLandlord && matchesBuilding;
    });

    return filtered.sort((a, b) => {
      if (managerSort === "landlord_asc")
        return a.landlord_name.localeCompare(b.landlord_name);
      if (managerSort === "landlord_desc")
        return b.landlord_name.localeCompare(a.landlord_name);
      if (managerSort === "building_asc") {
        const bA = a.assigned_building_names[0] || "";
        const bB = b.assigned_building_names[0] || "";
        return bA.localeCompare(bB);
      }
      if (managerSort === "building_desc") {
        const bA = a.assigned_building_names[0] || "";
        const bB = b.assigned_building_names[0] || "";
        return bB.localeCompare(bA);
      }
      if (managerSort === "name_asc") return a.full_name.localeCompare(b.full_name);
      if (managerSort === "name_desc") return b.full_name.localeCompare(a.full_name);
      if (managerSort === "date_desc")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });
  }, [managers, managerSearch, managerLandlordFilter, managerBuildingFilter, managerSort]);

  // Filtered & Sorted Tenants
  const filteredTenants = useMemo(() => {
    const filtered = tenants.filter((t) => {
      const q = tenantSearch.toLowerCase();
      const matchesSearch =
        t.tenant_name.toLowerCase().includes(q) ||
        t.tenant_phone.includes(q) ||
        t.tenant_email.toLowerCase().includes(q) ||
        t.building_name.toLowerCase().includes(q) ||
        t.unit_number.toLowerCase().includes(q) ||
        t.landlord_name.toLowerCase().includes(q);

      const matchesLandlord =
        tenantLandlordFilter === "all" || t.landlord_name === tenantLandlordFilter;

      const matchesBuilding =
        tenantBuildingFilter === "all" || t.building_name === tenantBuildingFilter;

      return matchesSearch && matchesLandlord && matchesBuilding;
    });

    return filtered.sort((a, b) => {
      if (tenantSort === "building_asc")
        return a.building_name.localeCompare(b.building_name);
      if (tenantSort === "building_desc")
        return b.building_name.localeCompare(a.building_name);
      if (tenantSort === "landlord_asc")
        return a.landlord_name.localeCompare(b.landlord_name);
      if (tenantSort === "landlord_desc")
        return b.landlord_name.localeCompare(a.landlord_name);
      if (tenantSort === "name_asc")
        return a.tenant_name.localeCompare(b.tenant_name);
      if (tenantSort === "name_desc")
        return b.tenant_name.localeCompare(a.tenant_name);
      if (tenantSort === "rent_desc")
        return b.rent_amount - a.rent_amount;
      if (tenantSort === "rent_asc")
        return a.rent_amount - b.rent_amount;
      if (tenantSort === "date_desc")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return 0;
    });
  }, [tenants, tenantSearch, tenantLandlordFilter, tenantBuildingFilter, tenantSort]);

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    const filtered = transactions.filter((t) => {
      const q = transactionSearch.toLowerCase();
      const matchesSearch =
        t.tenant_name.toLowerCase().includes(q) ||
        t.receipt_number.toLowerCase().includes(q) ||
        t.building_name.toLowerCase().includes(q) ||
        t.unit_number.toLowerCase().includes(q) ||
        t.landlord_name.toLowerCase().includes(q);
      const matchesMethod =
        transactionMethodFilter === "all" || t.payment_method === transactionMethodFilter;
      const matchesBuilding =
        transactionBuildingFilter === "all" || t.building_name === transactionBuildingFilter;
      const matchesLandlord =
        transactionLandlordFilter === "all" || t.landlord_name === transactionLandlordFilter;

      return matchesSearch && matchesMethod && matchesBuilding && matchesLandlord;
    });

    return filtered.sort((a, b) => {
      if (transactionSort === "date_desc")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (transactionSort === "date_asc")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (transactionSort === "building_asc")
        return a.building_name.localeCompare(b.building_name);
      if (transactionSort === "building_desc")
        return b.building_name.localeCompare(a.building_name);
      if (transactionSort === "landlord_asc")
        return a.landlord_name.localeCompare(b.landlord_name);
      if (transactionSort === "landlord_desc")
        return b.landlord_name.localeCompare(a.landlord_name);
      if (transactionSort === "amount_desc")
        return b.amount_paid - a.amount_paid;
      if (transactionSort === "amount_asc")
        return a.amount_paid - b.amount_paid;
      return 0;
    });
  }, [
    transactions,
    transactionSearch,
    transactionMethodFilter,
    transactionBuildingFilter,
    transactionLandlordFilter,
    transactionSort,
  ]);

  // Filtered & Sorted Maintenance
  const filteredMaintenance = useMemo(() => {
    const filtered = maintenance.filter((m) => {
      const matchesUrgency =
        maintenanceUrgencyFilter === "all" || m.urgency === maintenanceUrgencyFilter;
      const matchesStatus =
        maintenanceStatusFilter === "all" || m.status === maintenanceStatusFilter;
      const matchesBuilding =
        maintenanceBuildingFilter === "all" || m.building_name === maintenanceBuildingFilter;
      return matchesUrgency && matchesStatus && matchesBuilding;
    });

    return filtered.sort((a, b) => {
      if (maintenanceSort === "building_asc")
        return (a.building_name || "").localeCompare(b.building_name || "");
      if (maintenanceSort === "urgency_desc") {
        const order: Record<string, number> = { emergency: 4, high: 3, medium: 2, low: 1 };
        return (order[b.urgency] || 0) - (order[a.urgency] || 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [
    maintenance,
    maintenanceUrgencyFilter,
    maintenanceStatusFilter,
    maintenanceBuildingFilter,
    maintenanceSort,
  ]);

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
        {/* NAVIGATION TABS: 7 CORE PLATFORM VIEWS                                */}
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
            onClick={() => setActiveTab("managers")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === "managers"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isFrench ? "Gestionnaires" : "Managers"} ({managers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("tenants")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === "tenants"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <DoorOpen className="w-4 h-4" />
            <span>{isFrench ? "Locataires" : "Tenants"} ({tenants.length})</span>
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
        </div>

        {/* ===================================================================== */}
        {/* TAB 1: OVERVIEW & PLATFORM METRICS                                    */}
        {/* ===================================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Top-Level KPI Cards: 7 Core Ecosystem Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div
                onClick={() => setActiveTab("landlords")}
                className="bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-500/30 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl p-5 shadow-sm space-y-3 cursor-pointer transition group"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Bailleurs Inscrits" : "Total Landlords"}</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{stats?.total_landlords || 0}</span>
                    <ArrowRight className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{isFrench ? "Propriétaires actifs" : "Active accounts"}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{isFrench ? "Voir répertoire →" : "View directory →"}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Registered Managers */}
              <div
                onClick={() => setActiveTab("managers")}
                className="bg-white dark:bg-slate-900 border-2 border-purple-200 dark:border-purple-500/30 hover:border-purple-400 dark:hover:border-purple-500 rounded-2xl p-5 shadow-sm space-y-3 cursor-pointer transition group"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Gestionnaires Délégués" : "Delegated Managers"}</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{stats?.total_managers || 0}</span>
                    <ArrowRight className="w-4 h-4 text-purple-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{isFrench ? "Délégués par bailleur" : "Delegated to estates"}</span>
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">{isFrench ? "Voir répertoire →" : "View managers →"}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Registered Tenants */}
              <div
                onClick={() => setActiveTab("tenants")}
                className="bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl p-5 shadow-sm space-y-3 cursor-pointer transition group"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Locataires Résidents" : "Active Tenants"}</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition">
                    <DoorOpen className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{stats?.total_tenants || stats?.occupied_units || 0}</span>
                    <ArrowRight className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{stats?.occupied_units || 0} {isFrench ? "lots occupés" : "units leased"}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{isFrench ? "Voir registre →" : "View registry →"}</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Buildings & Units */}
              <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Parc Immobilier Global" : "Buildings & Units"}</span>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
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

              {/* Card 6: Occupancy Ratio */}
              <div className="bg-white dark:bg-slate-900 border-2 border-teal-200 dark:border-teal-500/30 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Taux d'Occupation" : "Occupancy Rate"}</span>
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
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

              {/* Card 7: Maintenance & Incidents */}
              <div
                onClick={() => setActiveTab("maintenance")}
                className="bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl p-5 shadow-sm space-y-3 cursor-pointer transition group sm:col-span-2 lg:col-span-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{isFrench ? "Incidents Maintenance & Interventions" : "Repairs & Maintenance"}</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
                    <Wrench className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{stats?.total_maintenance_requests || 0}</span>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition flex items-center gap-1">
                      {isFrench ? "Voir tous les tickets →" : "View tickets →"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">
                      {stats?.pending_maintenance_requests || 0} {isFrench ? "en attente de traitement" : "pending resolution"}
                    </span>
                    {stats && stats.emergency_maintenance_requests > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold animate-pulse">
                        {stats.emergency_maintenance_requests} {isFrench ? "urgences vitales" : "emergencies"}
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
                    onClick={() => setActiveTab("managers")}
                    className="w-full p-3 rounded-xl bg-slate-50 hover:bg-purple-50 dark:bg-slate-800/60 dark:hover:bg-purple-900/20 border border-slate-200 dark:border-slate-700 text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        {isFrench ? "Gérer les Gestionnaires Délégués" : "Manage Delegated Managers"}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition" />
                  </button>

                  <button
                    onClick={() => setActiveTab("tenants")}
                    className="w-full p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/60 dark:hover:bg-indigo-900/20 border border-slate-200 dark:border-slate-700 text-left flex items-center justify-between transition group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <DoorOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {isFrench ? "Consulter la Base des Locataires" : "Inspect Tenant Registry"}
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
                    className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 w-48 sm:w-60"
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

                {/* Sort Landlords */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={landlordSort}
                    onChange={(e) => setLandlordSort(e.target.value as any)}
                    className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer py-1"
                  >
                    <option value="name_asc">{isFrench ? "Nom (A → Z)" : "Name (A → Z)"}</option>
                    <option value="name_desc">{isFrench ? "Nom (Z → A)" : "Name (Z → A)"}</option>
                    <option value="buildings_desc">{isFrench ? "Immeubles (Plus au moins)" : "Most Buildings"}</option>
                    <option value="units_desc">{isFrench ? "Logements (Plus au moins)" : "Most Units"}</option>
                    <option value="revenue_desc">{isFrench ? "Volume Encaissé (Max)" : "Highest Revenue"}</option>
                  </select>
                </div>
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
        {/* TAB 3: MANAGERS DIRECTORY (NEW)                                       */}
        {/* ===================================================================== */}
        {activeTab === "managers" && (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>{isFrench ? "Répertoire des Gestionnaires Délégués" : "Delegated Managers Directory"}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-mono font-bold">
                    {filteredManagers.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFrench
                    ? "Gestionnaires habilités par les propriétaires pour administrer les immeubles et percevoir les loyers."
                    : "Managers authorized by landlords to administer buildings, collect rents, and log repairs."}
                </p>
              </div>

              {/* Filters & Sorting */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isFrench ? "Nom, email, bailleur..." : "Name, email, landlord..."}
                    value={managerSearch}
                    onChange={(e) => setManagerSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 w-44 sm:w-56"
                  />
                </div>

                {/* Filter by Landlord */}
                <select
                  value={managerLandlordFilter}
                  onChange={(e) => setManagerLandlordFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[170px]"
                >
                  <option value="all">{isFrench ? "Tous les Bailleurs" : "All Landlords"}</option>
                  {availableLandlordNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                {/* Filter by Building */}
                <select
                  value={managerBuildingFilter}
                  onChange={(e) => setManagerBuildingFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[170px]"
                >
                  <option value="all">{isFrench ? "Tous les Immeubles" : "All Buildings"}</option>
                  {availableBuildingNames.map((bName) => (
                    <option key={bName} value={bName}>{bName}</option>
                  ))}
                </select>

                {/* Sort dropdown */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={managerSort}
                    onChange={(e) => setManagerSort(e.target.value as any)}
                    className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer py-1"
                  >
                    <option value="landlord_asc">{isFrench ? "Trier par Bailleur (A → Z)" : "Sort by Landlord (A → Z)"}</option>
                    <option value="landlord_desc">{isFrench ? "Trier par Bailleur (Z → A)" : "Sort by Landlord (Z → A)"}</option>
                    <option value="building_asc">{isFrench ? "Trier par Immeuble (A → Z)" : "Sort by Building (A → Z)"}</option>
                    <option value="building_desc">{isFrench ? "Trier par Immeuble (Z → A)" : "Sort by Building (Z → A)"}</option>
                    <option value="name_asc">{isFrench ? "Trier par Nom (A → Z)" : "Sort by Name (A → Z)"}</option>
                    <option value="date_desc">{isFrench ? "Plus récents" : "Recently Added"}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Managers Cards Grid */}
            {filteredManagers.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto opacity-40" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {isFrench ? "Aucun gestionnaire trouvé" : "No managers found"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {isFrench
                    ? "Aucun compte gestionnaire ne correspond aux critères de recherche ou de filtre sélectionnés."
                    : "No manager account matches the specified search and filter criteria."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredManagers.map((m) => (
                  <div
                    key={m.id}
                    className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-500/50 rounded-2xl p-5 space-y-4 shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-600/20 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-sm shrink-0">
                          {m.full_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {m.full_name}
                          </h3>
                          <span className="text-[11px] text-slate-500 truncate block">
                            {m.email}
                          </span>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20 shrink-0">
                        {isFrench ? "Gestionnaire" : "Manager"}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{isFrench ? "Bailleur Responsable :" : "Parent Landlord:"}</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{m.landlord_name}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-slate-500 block mb-1">{isFrench ? "Immeubles assignés :" : "Assigned Properties:"}</span>
                        {m.assigned_building_names.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {m.assigned_building_names.map((bName, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                              >
                                {bName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium italic">
                            {isFrench ? "Aucun immeuble assigné" : "No property assigned"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="text-[11px] text-slate-500 font-mono">
                        {isFrench ? "Inscrit le " : "Created "} {new Date(m.created_at).toLocaleDateString()}
                      </span>
                      {m.phone && m.phone !== "N/A" && (
                        <a
                          href={`https://wa.me/${m.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:underline font-mono"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{m.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: TENANTS REGISTRY (NEW)                                         */}
        {/* ===================================================================== */}
        {activeTab === "tenants" && (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <DoorOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>{isFrench ? "Registre Central des Locataires" : "Platform-Wide Tenant Registry"}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                    {filteredTenants.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFrench
                    ? "Ensemble des locataires résidents sur la plateforme, leurs lots occupés, loyers et bailleurs respectifs."
                    : "Comprehensive list of all tenants across properties, units leased, rent obligations, and landlords."}
                </p>
              </div>

              {/* Filters & Sorting */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isFrench ? "Locataire, téléphone, lot..." : "Tenant, phone, unit..."}
                    value={tenantSearch}
                    onChange={(e) => setTenantSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56"
                  />
                </div>

                {/* Filter by Landlord */}
                <select
                  value={tenantLandlordFilter}
                  onChange={(e) => setTenantLandlordFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[170px]"
                >
                  <option value="all">{isFrench ? "Tous les Bailleurs" : "All Landlords"}</option>
                  {availableLandlordNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                {/* Filter by Building */}
                <select
                  value={tenantBuildingFilter}
                  onChange={(e) => setTenantBuildingFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[170px]"
                >
                  <option value="all">{isFrench ? "Tous les Immeubles" : "All Buildings"}</option>
                  {availableBuildingNames.map((bName) => (
                    <option key={bName} value={bName}>{bName}</option>
                  ))}
                </select>

                {/* Sort dropdown */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={tenantSort}
                    onChange={(e) => setTenantSort(e.target.value as any)}
                    className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer py-1"
                  >
                    <option value="building_asc">{isFrench ? "Trier par Immeuble (A → Z)" : "Sort by Building (A → Z)"}</option>
                    <option value="building_desc">{isFrench ? "Trier par Immeuble (Z → A)" : "Sort by Building (Z → A)"}</option>
                    <option value="landlord_asc">{isFrench ? "Trier par Bailleur (A → Z)" : "Sort by Landlord (A → Z)"}</option>
                    <option value="landlord_desc">{isFrench ? "Trier par Bailleur (Z → A)" : "Sort by Landlord (Z → A)"}</option>
                    <option value="name_asc">{isFrench ? "Trier par Locataire (A → Z)" : "Sort by Tenant (A → Z)"}</option>
                    <option value="rent_desc">{isFrench ? "Loyer (Décroissant)" : "Highest Rent"}</option>
                    <option value="date_desc">{isFrench ? "Date d'entrée (Récente)" : "Newest Lease"}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tenants Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th
                        onClick={() => setTenantSort(tenantSort === "name_asc" ? "name_desc" : "name_asc")}
                        className="px-4 py-3.5 cursor-pointer hover:text-indigo-600 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{isFrench ? "Locataire" : "Tenant"}</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setTenantSort(tenantSort === "building_asc" ? "building_desc" : "building_asc")}
                        className="px-4 py-3.5 cursor-pointer hover:text-indigo-600 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{isFrench ? "Immeuble & Lot" : "Building & Unit"}</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setTenantSort(tenantSort === "landlord_asc" ? "landlord_desc" : "landlord_asc")}
                        className="px-4 py-3.5 cursor-pointer hover:text-indigo-600 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{isFrench ? "Propriétaire Bailleur" : "Landlord"}</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => setTenantSort(tenantSort === "rent_desc" ? "rent_asc" : "rent_desc")}
                        className="px-4 py-3.5 cursor-pointer hover:text-indigo-600 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{isFrench ? "Loyer Mensuel" : "Monthly Rent"}</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5">{isFrench ? "Statut" : "Status"}</th>
                      <th className="px-4 py-3.5 text-right">{isFrench ? "Contact" : "Contact"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          {isFrench ? "Aucun locataire trouvé." : "No tenants found."}
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                                {t.tenant_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-white block">
                                  {t.tenant_name}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {t.tenant_phone}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800 dark:text-slate-200 block">
                              {t.building_name}
                            </span>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mt-0.5">
                              {isFrench ? "Lot" : "Unit"} {t.unit_number}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                            {t.landlord_name}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {Number(t.rent_amount).toLocaleString()} XAF
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                              {isFrench ? "Occupé" : "Occupied"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {t.tenant_phone && t.tenant_phone !== "Non renseigné" ? (
                              <a
                                href={`https://wa.me/${t.tenant_phone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: PLATFORM-WIDE TRANSACTIONS                                     */}
        {/* ===================================================================== */}
        {activeTab === "transactions" && (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={isFrench ? "Locataire, reçu, lot..." : "Tenant, receipt, unit..."}
                    value={transactionSearch}
                    onChange={(e) => setTransactionSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 w-44 sm:w-56"
                  />
                </div>

                {/* Filter by Landlord */}
                <select
                  value={transactionLandlordFilter}
                  onChange={(e) => setTransactionLandlordFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[170px]"
                >
                  <option value="all">{isFrench ? "Tous les Bailleurs" : "All Landlords"}</option>
                  {availableLandlordNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                {/* Filter by Building */}
                <select
                  value={transactionBuildingFilter}
                  onChange={(e) => setTransactionBuildingFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[170px]"
                >
                  <option value="all">{isFrench ? "Tous les Immeubles" : "All Buildings"}</option>
                  {availableBuildingNames.map((bName) => (
                    <option key={bName} value={bName}>{bName}</option>
                  ))}
                </select>

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

                {/* Sort Transactions */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={transactionSort}
                    onChange={(e) => setTransactionSort(e.target.value as any)}
                    className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer py-1"
                  >
                    <option value="date_desc">{isFrench ? "Plus récents" : "Newest First"}</option>
                    <option value="date_asc">{isFrench ? "Plus anciens" : "Oldest First"}</option>
                    <option value="building_asc">{isFrench ? "Immeuble (A → Z)" : "Building (A → Z)"}</option>
                    <option value="building_desc">{isFrench ? "Immeuble (Z → A)" : "Building (Z → A)"}</option>
                    <option value="landlord_asc">{isFrench ? "Bailleur (A → Z)" : "Landlord (A → Z)"}</option>
                    <option value="landlord_desc">{isFrench ? "Bailleur (Z → A)" : "Landlord (Z → A)"}</option>
                    <option value="amount_desc">{isFrench ? "Montant (Décroissant)" : "Highest Amount"}</option>
                    <option value="amount_asc">{isFrench ? "Montant (Croissant)" : "Lowest Amount"}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3.5">{isFrench ? "Reçu N°" : "Receipt N°"}</th>
                      <th
                        onClick={() =>
                          setTransactionSort(
                            transactionSort === "building_asc" ? "building_desc" : "building_asc"
                          )
                        }
                        className="px-4 py-3.5 cursor-pointer hover:text-purple-600 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{isFrench ? "Locataire & Logement" : "Tenant & Unit"}</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() =>
                          setTransactionSort(
                            transactionSort === "landlord_asc" ? "landlord_desc" : "landlord_asc"
                          )
                        }
                        className="px-4 py-3.5 cursor-pointer hover:text-purple-600 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{isFrench ? "Propriétaire Bailleur" : "Landlord"}</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5">{isFrench ? "Période" : "Period"}</th>
                      <th
                        onClick={() =>
                          setTransactionSort(
                            transactionSort === "amount_desc" ? "amount_asc" : "amount_desc"
                          )
                        }
                        className="px-4 py-3.5 cursor-pointer hover:text-purple-600 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{isFrench ? "Montant" : "Amount"}</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5">{isFrench ? "Mode" : "Method"}</th>
                      <th
                        onClick={() =>
                          setTransactionSort(
                            transactionSort === "date_desc" ? "date_asc" : "date_desc"
                          )
                        }
                        className="px-4 py-3.5 cursor-pointer hover:text-purple-600 transition"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{isFrench ? "Date" : "Date"}</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5 text-right">{isFrench ? "Action" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          {isFrench ? "Aucune transaction trouvée." : "No transactions found."}
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
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
                              {tx.unit_number} • <strong className="text-slate-700 dark:text-slate-300">{tx.building_name}</strong>
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
                      ))
                    )}
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
        {/* TAB 6: GLOBAL MAINTENANCE HUB                                         */}
        {/* ===================================================================== */}
        {activeTab === "maintenance" && (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filter by Building */}
                <select
                  value={maintenanceBuildingFilter}
                  onChange={(e) => setMaintenanceBuildingFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[170px]"
                >
                  <option value="all">{isFrench ? "Tous les Immeubles" : "All Buildings"}</option>
                  {availableBuildingNames.map((bName) => (
                    <option key={bName} value={bName}>{bName}</option>
                  ))}
                </select>

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

                {/* Sort Maintenance */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={maintenanceSort}
                    onChange={(e) => setMaintenanceSort(e.target.value as any)}
                    className="bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer py-1"
                  >
                    <option value="date_desc">{isFrench ? "Plus récents" : "Newest"}</option>
                    <option value="building_asc">{isFrench ? "Immeuble (A → Z)" : "Building (A → Z)"}</option>
                    <option value="urgency_desc">{isFrench ? "Priorité Urgence" : "Urgency Priority"}</option>
                  </select>
                </div>
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
