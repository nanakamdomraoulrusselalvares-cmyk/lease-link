"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Building,
  Unit,
  LandlordProfile,
  AVAILABLE_PLANS,
  PropertyType,
  CreateBuildingFormInput,
  UpdateUnitInput,
} from "@/types/database";
import {
  createBuildingWithUnits,
  getBuildingsWithUnits,
  updateUnitConfiguration,
} from "@/lib/services/buildingService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import DashboardNav from "@/components/DashboardNav";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Building2,
  Plus,
  Home,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  MapPin,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  LogOut,
  Bed,
  Bath,
  Search,
  ShieldCheck,
  DoorOpen,
  Edit3,
  Utensils,
  Sofa,
  DollarSign,
  X,
  Save,
  UserPlus,
  Users,
  Phone,
  Mail,
  KeyRound,
  MessageCircle,
  UserCheck,
  UserMinus,
  Wrench,
  Filter,
} from "lucide-react";

export default function BuildingsManagementPage() {
  const router = useRouter();
  const { isFrench, language, formatCurrency, formatDate } = useLanguage();

  // Auth & Profile state
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Buildings data state
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBuildingIds, setExpandedBuildingIds] = useState<Record<string, boolean>>({});

  // Building creation form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Building Form Fields (Floors and default specs removed)
  const [formData, setFormData] = useState<CreateBuildingFormInput>({
    name: "",
    address: "",
    city: "Douala",
    state_region: "Littoral",
    property_type: "apartment",
    total_units: 4,
    unit_prefix: "Unit",
    description: "",
  });

  // Unit Modification Modal state
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingBuildingName, setEditingBuildingName] = useState<string>("");
  const [unitForm, setUnitForm] = useState<UpdateUnitInput>({
    unit_number: "",
    rent_amount: 0,
    parlors: 1,
    rooms: 2,
    bathrooms: 1,
    kitchens: 1,
    notes: "",
    tenant_name: "",
    tenant_phone: "",
    tenant_email: "",
    status: "vacant",
  });
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitEditError, setUnitEditError] = useState<string | null>(null);

  // Unit occupancy status filter ("all" | "occupied" | "vacant")
  const [portfolioStatusFilter, setPortfolioStatusFilter] = useState<"all" | "occupied" | "vacant">("all");
  const [buildingUnitFilters, setBuildingUnitFilters] = useState<Record<string, "all" | "occupied" | "vacant">>({});

  // Dedicated ref for modal scroll body to ensure isolated, smooth scrolling
  const modalScrollBodyRef = useRef<HTMLDivElement>(null);

  // Lock document/body scroll completely when modal is active so background never scrolls
  useEffect(() => {
    if (editingUnit) {
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
      return () => {
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
      };
    }
  }, [editingUnit]);

  // Handle ESC key to dismiss modal cleanly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingUnit && !savingUnit) {
        setEditingUnit(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingUnit, savingUnit]);

  // Route any wheel events on backdrop, header, or footer directly to the scrollable form body
  const handleModalWheel = (e: React.WheelEvent) => {
    if (modalScrollBodyRef.current) {
      if (!modalScrollBodyRef.current.contains(e.target as Node)) {
        modalScrollBodyRef.current.scrollBy({
          top: e.deltaY,
          behavior: "auto",
        });
      }
    }
  };

  // Load Session and Buildings
  const loadData = async () => {
    const supabase = createClient();
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      // Load Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as LandlordProfile);
      }

      // Load Buildings & Units
      const fetchedBuildings = await getBuildingsWithUnits(authUser.id);
      setBuildings(fetchedBuildings);

      // Expand all buildings by default for direct inspection
      const initialExpanded: Record<string, boolean> = {};
      fetchedBuildings.forEach((b) => {
        initialExpanded[b.id] = true;
      });
      setExpandedBuildingIds(initialExpanded);
    } catch (err) {
      console.error("Error loading buildings data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute landlord capacity stats
  const planUnitLimit = useMemo(() => {
    if (profile?.plan_unit_limit) return profile.plan_unit_limit;
    const rawPlan = (user?.user_metadata?.plan || "free") as string;
    const matched = AVAILABLE_PLANS.find((p) => p.id === rawPlan);
    return matched ? matched.maxUnits : 5;
  }, [profile, user]);

  const totalUnitsInPortfolio = useMemo(() => {
    return buildings.reduce((acc, b) => acc + (b.units?.length || b.total_units || 0), 0);
  }, [buildings]);

  const totalOccupiedUnits = useMemo(() => {
    return buildings.reduce((acc, b) => {
      const occupiedInBuilding =
        b.units?.filter((u) => u.status === "occupied" || Boolean(u.tenant_name?.trim())).length ?? 0;
      return acc + occupiedInBuilding;
    }, 0);
  }, [buildings]);

  const totalVacantUnits = useMemo(() => {
    return buildings.reduce((acc, b) => {
      const vacantInBuilding =
        b.units?.filter((u) => u.status !== "occupied" && !Boolean(u.tenant_name?.trim())).length ??
        (b.total_units || 0);
      return acc + vacantInBuilding;
    }, 0);
  }, [buildings]);

  const occupancyRate = useMemo(() => {
    if (totalUnitsInPortfolio === 0) return 0;
    return Math.round((totalOccupiedUnits / totalUnitsInPortfolio) * 100);
  }, [totalOccupiedUnits, totalUnitsInPortfolio]);

  const vacancyRate = useMemo(() => {
    if (totalUnitsInPortfolio === 0) return 0;
    return Math.round((totalVacantUnits / totalUnitsInPortfolio) * 100);
  }, [totalVacantUnits, totalUnitsInPortfolio]);

  const remainingQuota = Math.max(0, planUnitLimit - totalUnitsInPortfolio);
  const quotaPercentage = Math.min(100, Math.round((totalUnitsInPortfolio / planUnitLimit) * 100));

  // Toggle building card expansion
  const toggleExpand = (buildingId: string) => {
    setExpandedBuildingIds((prev) => ({
      ...prev,
      [buildingId]: !prev[buildingId],
    }));
  };

  // Live Unit Generator Preview (simple unit naming preview, no floors)
  const unitPreviewList = useMemo(() => {
    const count = Math.min(Math.max(1, Number(formData.total_units) || 1), 50);
    const prefix = formData.unit_prefix.trim() || "Unit";

    const list = [];
    for (let i = 1; i <= count; i++) {
      list.push(`${prefix} ${i}`);
    }
    return list;
  }, [formData.total_units, formData.unit_prefix]);

  // Handle building creation form submission
  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!user) {
      setFormError("Landlord session not found. Please log in again.");
      return;
    }

    if (!formData.name.trim()) {
      setFormError("Please enter a building name.");
      return;
    }

    if (!formData.address.trim()) {
      setFormError("Please enter the street address or location.");
      return;
    }

    const unitsCount = Math.max(1, Number(formData.total_units) || 1);

    if (unitsCount > remainingQuota) {
      setFormError(
        `Unit limit reached! You have ${remainingQuota} units available on your plan. Requested: ${unitsCount} units.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const result = await createBuildingWithUnits(user.id, formData, planUnitLimit);

      if (!result.success) {
        setFormError(
          result.error ||
            (isFrench
              ? "Échec de création du bâtiment. Veuillez réessayer."
              : "Failed to create building. Please try again.")
        );
        setSubmitting(false);
        return;
      }

      setFormSuccess(
        isFrench
          ? `Bâtiment "${formData.name}" créé avec succès avec ${unitsCount} logements vacants ! Vous pouvez maintenant configurer le loyer, salons, chambres, salles de bain et cuisines de chaque logement ci-dessous.`
          : `Building "${formData.name}" created successfully with ${unitsCount} vacant units! You can now configure each unit's rent, parlors, rooms, bathrooms, and kitchens below.`
      );

      // Reset form
      setFormData({
        name: "",
        address: "",
        city: "Douala",
        state_region: "Littoral",
        property_type: "apartment",
        total_units: 4,
        unit_prefix: "Unit",
        description: "",
      });

      // Reload list
      await loadData();
      setShowCreateForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Unit Modification Modal
  const handleOpenEditUnit = (unit: Unit, buildingName: string) => {
    setEditingUnit(unit);
    setEditingBuildingName(buildingName);
    setUnitEditError(null);
    setUnitForm({
      unit_number: unit.unit_number,
      rent_amount: unit.rent_amount || 0,
      parlors: unit.parlors ?? 0,
      rooms: unit.rooms ?? unit.bedrooms ?? 0,
      bathrooms: unit.bathrooms ?? 0,
      kitchens: unit.kitchens ?? 0,
      notes: unit.notes || "",
      tenant_name: unit.tenant_name || "",
      tenant_phone: unit.tenant_phone || "",
      tenant_email: unit.tenant_email || "",
      status: unit.status || "vacant",
    });
  };

  // Clear tenant fields in modal
  const handleUnassignTenantInModal = () => {
    setUnitForm((prev) => ({
      ...prev,
      tenant_name: "",
      tenant_phone: "",
      tenant_email: "",
      status: "vacant",
    }));
  };

  // Save Unit Modification
  const handleSaveUnitModification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingUnit) return;

    setSavingUnit(true);
    setUnitEditError(null);

    const hasTenantInput = Boolean(
      unitForm.tenant_name?.trim() || unitForm.tenant_phone?.trim() || unitForm.tenant_email?.trim()
    );

    // Validate if landlord started filling tenant information
    if (hasTenantInput) {
      if (!unitForm.tenant_name?.trim()) {
        setUnitEditError(
          isFrench
            ? "Veuillez entrer le nom complet du locataire."
            : "Please enter the tenant's full name."
        );
        setSavingUnit(false);
        return;
      }
      if (!unitForm.tenant_phone?.trim()) {
        setUnitEditError(
          isFrench
            ? "Veuillez entrer le numéro WhatsApp du locataire."
            : "Please enter the tenant's WhatsApp phone number."
        );
        setSavingUnit(false);
        return;
      }
      if (!unitForm.tenant_email?.trim()) {
        setUnitEditError(
          isFrench
            ? "Veuillez entrer l'adresse email du locataire pour la connexion au portail."
            : "Please enter the tenant's email address for portal login."
        );
        setSavingUnit(false);
        return;
      }
    }

    try {
      const result = await updateUnitConfiguration(user.id, editingUnit.id, unitForm);

      if (!result.success) {
        setUnitEditError(
          result.error ||
            (isFrench ? "Échec de la mise à jour du logement." : "Failed to update unit.")
        );
        setSavingUnit(false);
        return;
      }

      // If assigning a tenant, automatically redirect to the tenant credential creation page
      if (hasTenantInput) {
        const targetUnitId = editingUnit.id;
        setEditingUnit(null);
        router.push(`/dashboard/credentials?unitId=${targetUnitId}&created=true`);
        return;
      }

      // If standard specs update or unassignment
      await loadData();
      setFormSuccess(
        isFrench
          ? `Logement "${unitForm.unit_number || editingUnit.unit_number}" mis à jour avec succès !`
          : `Unit "${unitForm.unit_number || editingUnit.unit_number}" updated successfully!`
      );
      setEditingUnit(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isFrench
          ? "Erreur lors de l'enregistrement du logement."
          : "Error saving unit modification.";
      setUnitEditError(msg);
    } finally {
      setSavingUnit(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  // Filter buildings by search and portfolio status filter
  const filteredBuildings = useMemo(() => {
    let result = buildings;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.address.toLowerCase().includes(query) ||
          (b.city && b.city.toLowerCase().includes(query)) ||
          (b.state_region && b.state_region.toLowerCase().includes(query))
      );
    }
    if (portfolioStatusFilter === "occupied") {
      result = result.filter((b) =>
        b.units?.some((u) => u.status === "occupied" || Boolean(u.tenant_name?.trim()))
      );
    } else if (portfolioStatusFilter === "vacant") {
      result = result.filter((b) =>
        (b.units?.length || 0) === 0 ||
        b.units?.some((u) => u.status !== "occupied" && !Boolean(u.tenant_name?.trim()))
      );
    }
    return result;
  }, [buildings, searchQuery, portfolioStatusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-400">
            {isFrench ? "Chargement du portefeuille immobilier..." : "Loading building portfolio..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Unified SaaS Dashboard Navigation Bar */}
      <DashboardNav
        user={user}
        profile={profile}
        buildingsCount={buildings.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 lg:pb-12">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isFrench ? "Tableau de Bord" : "Dashboard"}</span>
              </Link>
              <span>/</span>
              <span className="text-slate-200 font-medium">
                {isFrench ? "Bâtiments & Logements" : "Buildings & Units"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {isFrench ? "Gestion des Bâtiments & Logements" : "Buildings & Units Management"}
            </h1>
            <p className="text-sm text-slate-400">
              {isFrench
                ? "Créez des bâtiments avec des logements vacants, puis personnalisez le loyer, salons, chambres, salles de bain et cuisines de chaque logement."
                : "Create buildings with vacant units, then customize each unit's rent price, parlors, rooms, bathrooms, and kitchens."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/maintenance"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition"
              title={isFrench ? "Voir les tickets de réparations & maintenance" : "View Repairs & Maintenance Tickets"}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{isFrench ? "Réparations" : "Repairs"}</span>
            </Link>

            <button
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs transition cursor-pointer"
              title={isFrench ? "Actualiser la liste des bâtiments" : "Refresh Buildings List"}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-400" : ""}`} />
            </button>

            <button
              id="toggle-create-building-btn"
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {showCreateForm
                  ? isFrench ? "Fermer le Formulaire" : "Close Form"
                  : isFrench ? "Créer un Bâtiment" : "Create New Building"}
              </span>
            </button>
          </div>
        </div>

        {/* Global Feedback Messages */}
        {formSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-bold block">{isFrench ? "Opération Réussie !" : "Action Completed!"}</span>
              <span>{formSuccess}</span>
            </div>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Card 1: Total Buildings */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-400 font-bold">
              <span>{isFrench ? "Total Bâtiments" : "Total Buildings"}</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {buildings.length}
            </div>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-500 font-medium">
              {isFrench ? "Propriétés du portefeuille" : "Properties in portfolio"}
            </p>
          </div>

          {/* Card 2: Total Units */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-400 font-bold">
              <span>{isFrench ? "Total Logements" : "Total Units"}</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Home className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {totalUnitsInPortfolio}
            </div>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-500 font-medium">
              {isFrench ? `Quota : ${planUnitLimit} logements max` : `Allowance: ${planUnitLimit} max units`}
            </p>
          </div>

          {/* Card 3: Occupied Units */}
          <div
            onClick={() =>
              setPortfolioStatusFilter(portfolioStatusFilter === "occupied" ? "all" : "occupied")
            }
            className={`bg-blue-50/70 dark:bg-slate-900 border-2 rounded-2xl p-4 sm:p-5 shadow-md border-l-4 border-l-blue-600 transition cursor-pointer hover:border-blue-400 ${
              portfolioStatusFilter === "occupied"
                ? "ring-2 ring-blue-500/50 bg-blue-100/80 border-blue-400"
                : "border-blue-200 dark:border-slate-800"
            }`}
            title={isFrench ? "Cliquer pour filtrer par logements occupés" : "Click to filter by occupied units"}
          >
            <div className="flex items-center justify-between text-xs text-blue-800 dark:text-slate-400 font-bold">
              <span>{isFrench ? "Logements Occupés" : "Occupied Units"}</span>
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-blue-950 dark:text-blue-400 font-mono">
                {totalOccupiedUnits}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                {occupancyRate}%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-blue-700 dark:text-slate-400 font-semibold">
              {isFrench ? `${totalOccupiedUnits} avec locataire assigné` : `${totalOccupiedUnits} with assigned tenant`}
            </p>
          </div>

          {/* Card 4: Vacant Units */}
          <div
            onClick={() =>
              setPortfolioStatusFilter(portfolioStatusFilter === "vacant" ? "all" : "vacant")
            }
            className={`bg-emerald-50/70 dark:bg-slate-900 border-2 rounded-2xl p-4 sm:p-5 shadow-md border-l-4 border-l-emerald-600 transition cursor-pointer hover:border-emerald-400 ${
              portfolioStatusFilter === "vacant"
                ? "ring-2 ring-emerald-500/50 bg-emerald-100/80 border-emerald-400"
                : "border-emerald-200 dark:border-slate-800"
            }`}
            title={isFrench ? "Cliquer pour filtrer par logements vacants" : "Click to filter by vacant units"}
          >
            <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-slate-400 font-bold">
              <span>{isFrench ? "Logements Vacants" : "Vacant Units"}</span>
              <DoorOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-950 dark:text-emerald-400 font-mono">
                {totalVacantUnits}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                {vacancyRate}%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-700 dark:text-slate-400 font-semibold">
              {isFrench ? `${totalVacantUnits} disponibles à la location` : `${totalVacantUnits} available for lease`}
            </p>
          </div>

          {/* Card 5: Quota Remaining */}
          <div className="bg-amber-50/70 dark:bg-slate-900 border-2 border-amber-300 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-xs text-amber-900 dark:text-slate-400 font-bold">
              <span>{isFrench ? "Quota Restant" : "Quota Remaining"}</span>
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-amber-950 dark:text-white font-mono">
                {remainingQuota}
              </span>
              <span className="text-xs text-amber-800 dark:text-slate-400 font-mono font-bold">
                {totalUnitsInPortfolio}/{planUnitLimit}
              </span>
            </div>
            <div className="mt-2 w-full bg-amber-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  quotaPercentage > 85
                    ? "bg-rose-500"
                    : quotaPercentage > 60
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${quotaPercentage}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-amber-800 dark:text-slate-500 font-semibold">
              {isFrench ? `${quotaPercentage}% du forfait utilisé` : `${quotaPercentage}% of plan allowance used`}
            </p>
          </div>
        </div>

        {/* SECTION: Building Creation Form (Floors & default specs removed) */}
        {showCreateForm && (
          <section className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {isFrench ? "Créer un Nouveau Bâtiment" : "Create New Building"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isFrench ? (
                      <>
                        Entrez les détails du bâtiment et le nombre de logements. Tous les logements seront créés comme{" "}
                        <strong className="text-emerald-400">Vacants</strong>. Vous pourrez configurer le loyer individuel et les pièces immédiatement après.
                      </>
                    ) : (
                      <>
                        Enter the building details and number of units. All units will be created as{" "}
                        <strong className="text-emerald-400">Vacant</strong>. You can configure individual rent and room specs right after creation.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>
            </div>

            {formError && (
              <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <span className="font-bold block">{isFrench ? "Erreur" : "Error"}</span>
                  <span>{formError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateBuilding} className="mt-6 space-y-6">
              {/* Part 1: Building Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isFrench ? "Nom du Bâtiment / Propriété" : "Building / Property Name"}{" "}
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      isFrench
                        ? "ex. Résidence Les Palmiers, Sunrise Apartments"
                        : "e.g. Résidence Les Palmiers, Sunrise Apartments"
                    }
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isFrench ? "Type de Propriété" : "Property Type"} <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.property_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        property_type: e.target.value as PropertyType,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition cursor-pointer"
                  >
                    <option value="apartment">
                      {isFrench ? "🏢 Immeuble d'Appartements" : "🏢 Apartment Complex"}
                    </option>
                    <option value="residential">
                      {isFrench ? "🏘️ Résidentiel Multifamilial" : "🏘️ Multi-Family Residential"}
                    </option>
                    <option value="duplex">
                      {isFrench ? "🏠 Duplex / Triplex" : "🏠 Duplex / Triplex"}
                    </option>
                    <option value="commercial">
                      {isFrench ? "🏬 Bâtiment Commercial" : "🏬 Commercial Building"}
                    </option>
                    <option value="mixed_use">
                      {isFrench ? "🏗️ Complexe Mixte" : "🏗️ Mixed-Use Complex"}
                    </option>
                    <option value="other">
                      {isFrench ? "📌 Autre Propriété" : "📌 Other Property"}
                    </option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isFrench ? "Adresse / Quartier" : "Street Address / Quarter"}{" "}
                    <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      isFrench ? "ex. 45 Rue Joss, Bonanjo" : "e.g. 45 Rue Joss, Bonanjo"
                    }
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {isFrench ? "Ville" : "City"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Douala"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {isFrench ? "Région / État" : "Region / State"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Littoral"
                      value={formData.state_region}
                      onChange={(e) =>
                        setFormData({ ...formData, state_region: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Part 2: Number of Units & Custom Naming (Floor removed) */}
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                    {isFrench
                      ? "Génération des Logements (Tous Générés Vacants)"
                      : "Units Provisioning (All Generated Vacant)"}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>
                        {isFrench ? "Nombre de Logements à Générer" : "Number of Units to Generate"}
                      </span>
                      <span className="text-[11px] text-blue-400 font-semibold">
                        {isFrench ? `${remainingQuota} quota restant` : `${remainingQuota} quota left`}
                      </span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={remainingQuota || 50}
                      value={formData.total_units}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          total_units: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {isFrench ? (
                        <>
                          Générés comme <strong className="text-emerald-400">Vacants</strong>
                        </>
                      ) : (
                        <>
                          Generated as <strong className="text-emerald-400">Vacant</strong>
                        </>
                      )}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {isFrench ? "Préfixe de Nom des Logements" : "Unit Naming Prefix"}
                    </label>
                    <input
                      type="text"
                      placeholder={isFrench ? "ex. Porte, Appt, Studio" : "e.g. Unit, Apt, Porte, Studio"}
                      value={formData.unit_prefix}
                      onChange={(e) =>
                        setFormData({ ...formData, unit_prefix: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {isFrench
                        ? `ex. "${formData.unit_prefix || "Porte"} 1", "${formData.unit_prefix || "Porte"} 2"`
                        : `e.g. "${formData.unit_prefix || "Unit"} 1", "${formData.unit_prefix || "Unit"} 2"`}
                    </span>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {isFrench
                        ? "Notes / Équipements du Bâtiment (Facultatif)"
                        : "Building Notes / Amenities (Optional)"}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        isFrench
                          ? "ex. Sécurité 24/7, forage d'eau, parking"
                          : "e.g. Gated security, borehole water"
                      }
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Part 3: Units Generation Preview Box */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span>
                      {isFrench
                        ? `Aperçu de la Génération Automatique : ${unitPreviewList.length} Logements`
                        : `Automatic Generation Preview: ${unitPreviewList.length} Units`}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {isFrench
                      ? "Initialisé comme VACANT (Specs non configurées)"
                      : "Initialized as VACANT (Specs unconfigured)"}
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  {isFrench
                    ? "Les logements vacants suivants seront créés. Vous pourrez configurer le loyer, salons, chambres, salles de bain et cuisines de chaque logement après création :"
                    : "The following vacant units will be created. You can customize rent, parlors, rooms, bathrooms, and kitchens for each unit after creation:"}
                </p>

                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {unitPreviewList.map((unitName, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <span className="font-semibold text-white">{unitName}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] uppercase font-bold text-emerald-400">
                        {isFrench ? "Vacant" : "Vacant"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Action */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  {isFrench ? "Annuler" : "Cancel"}
                </button>

                <button
                  id="submit-building-btn"
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>
                        {isFrench ? "Création du Bâtiment & des Logements..." : "Creating Building & Units..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>
                        {isFrench
                          ? `Créer le Bâtiment & Générer ${formData.total_units} Logements Vacants`
                          : `Create Building & Generate ${formData.total_units} Vacant Units`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* SECTION: Created Buildings & Units Display */}
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isFrench ? "Votre Portefeuille Immobilier" : "Your Buildings Portfolio"}
              </h2>
              <p className="text-xs text-slate-400">
                {isFrench
                  ? "Consultez vos bâtiments, inspectez les logements occupés & vacants et personnalisez le loyer & l'agencement des pièces."
                  : "View your buildings, inspect occupied & vacant units, and customize unit rent & room configurations."}
              </p>
            </div>

            {buildings.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Global Status Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setPortfolioStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      portfolioStatusFilter === "all"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isFrench
                      ? `Tous les Logements (${totalUnitsInPortfolio})`
                      : `All Units (${totalUnitsInPortfolio})`}
                  </button>
                  <button
                    onClick={() => setPortfolioStatusFilter("occupied")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      portfolioStatusFilter === "occupied"
                        ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm"
                        : "text-slate-400 hover:text-blue-300"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>
                      {isFrench ? `Occupés (${totalOccupiedUnits})` : `Occupied (${totalOccupiedUnits})`}
                    </span>
                  </button>
                  <button
                    onClick={() => setPortfolioStatusFilter("vacant")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      portfolioStatusFilter === "vacant"
                        ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm"
                        : "text-slate-400 hover:text-emerald-300"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>
                      {isFrench ? `Vacants (${totalVacantUnits})` : `Vacant (${totalVacantUnits})`}
                    </span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={isFrench ? "Filtrer par nom ou ville..." : "Filter by name or city..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            )}
          </div>

          {buildings.length === 0 ? (
            /* Empty State */
            <div className="bg-slate-900/60 border border-slate-800 border-dashed rounded-2xl p-10 sm:p-14 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                <Building2 className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-white">
                  {isFrench ? "Aucun Bâtiment Créé Pour l'Instant" : "No Buildings Created Yet"}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isFrench ? (
                    <>
                      Commencez par ajouter votre premier bâtiment. LeaseLink générera automatiquement les logements avec un statut <strong>Vacant</strong>, prêts à être configurés et assignés à des locataires.
                    </>
                  ) : (
                    <>
                      Start by adding your first building. LeaseLink will automatically generate the units with a <strong>Vacant</strong> status, ready for you to customize specs and assign tenants.
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isFrench ? "Créer Votre Premier Bâtiment" : "Create Your First Building"}</span>
              </button>
            </div>
          ) : filteredBuildings.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 rounded-xl border border-slate-800">
              {isFrench
                ? `Aucun bâtiment ne correspond à "${searchQuery}" avec ${portfolioStatusFilter !== "all" ? `des logements ${portfolioStatusFilter === "occupied" ? "occupés" : "vacants"}` : "les critères actuels"}. Essayez d'effacer vos filtres.`
                : `No buildings match "${searchQuery}" with ${portfolioStatusFilter !== "all" ? `${portfolioStatusFilter} units` : "current criteria"}. Try clearing your filters.`}
            </div>
          ) : (
            /* Buildings Cards List */
            <div className="space-y-6">
              {filteredBuildings.map((building) => {
                const isExpanded = !!expandedBuildingIds[building.id];
                const unitCount = building.units?.length || building.total_units || 0;
                const occupiedCount =
                  building.units?.filter((u) => u.status === "occupied" || Boolean(u.tenant_name?.trim())).length ?? 0;
                const vacantCount =
                  building.units?.filter((u) => u.status !== "occupied" && !Boolean(u.tenant_name?.trim())).length ?? (unitCount - occupiedCount);
                const currentFilter = buildingUnitFilters[building.id] || portfolioStatusFilter;

                const displayedUnits = (building.units || []).filter((u) => {
                  const isOccupied = u.status === "occupied" || Boolean(u.tenant_name?.trim());
                  if (currentFilter === "occupied") return isOccupied;
                  if (currentFilter === "vacant") return !isOccupied;
                  return true;
                });

                return (
                  <div
                    key={building.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden transition"
                  >
                    {/* Building Card Header */}
                    <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-900/90">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-lg sm:text-xl font-bold text-white">
                            {building.name}
                          </h3>
                          <span className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {building.property_type}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>
                              {building.address}
                              {building.city ? `, ${building.city}` : ""}
                              {building.state_region ? ` (${building.state_region})` : ""}
                            </span>
                          </div>
                        </div>

                        {building.description && (
                          <p className="text-xs text-slate-400 italic">
                            &quot;{building.description}&quot;
                          </p>
                        )}
                      </div>

                      {/* Right stats and expand button */}
                      <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">
                              {isFrench ? "Logements" : "Units"}
                            </span>
                            <span className="text-sm font-extrabold text-white">
                              {unitCount}
                            </span>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                            <span className="block text-[10px] text-blue-400 uppercase font-bold">
                              {isFrench ? "Occupés" : "Occupied"}
                            </span>
                            <span className="text-sm font-extrabold text-blue-400">
                              {occupiedCount}
                            </span>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                            <span className="block text-[10px] text-emerald-400 uppercase font-bold">
                              {isFrench ? "Vacants" : "Vacant"}
                            </span>
                            <span className="text-sm font-extrabold text-emerald-400">
                              {vacantCount}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleExpand(building.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                        >
                          <span>
                            {isExpanded
                              ? isFrench ? "Masquer les Logements" : "Hide Units"
                              : isFrench ? `Voir les Logements (${unitCount})` : `View Units (${unitCount})`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Units Grid */}
                    {isExpanded && (
                      <div className="p-5 sm:p-6 bg-slate-950/60 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                              <DoorOpen className="w-4 h-4 text-blue-400" />
                              <span>{isFrench ? `Logements dans ${building.name}` : `Units in ${building.name}`}</span>
                              <span className="text-slate-400 normal-case font-medium text-xs">
                                ({occupiedCount} {isFrench ? "Occupés" : "Occupied"} • {vacantCount} {isFrench ? "Vacants" : "Vacant"})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {isFrench ? (
                                <>
                                  Cliquez sur <strong className="text-blue-400">"Modifier Pièces & Locataire"</strong> pour définir les caractéristiques ou assigner des locataires aux logements vacants.
                                </>
                              ) : (
                                <>
                                  Click <strong className="text-blue-400">&quot;Modify Specs & Tenant&quot;</strong> to set specs or assign tenants to vacant units.
                                </>
                              )}
                            </p>
                          </div>

                          {/* Building Unit Filter Tabs */}
                          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shrink-0">
                            <button
                              onClick={() =>
                                setBuildingUnitFilters((prev) => ({ ...prev, [building.id]: "all" }))
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                currentFilter === "all"
                                  ? "bg-slate-800 text-white shadow-sm"
                                  : "text-slate-400 hover:text-white"
                              }`}
                            >
                              {isFrench ? `Tous (${unitCount})` : `All (${unitCount})`}
                            </button>
                            <button
                              onClick={() =>
                                setBuildingUnitFilters((prev) => ({ ...prev, [building.id]: "occupied" }))
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                currentFilter === "occupied"
                                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm"
                                  : "text-slate-400 hover:text-blue-300"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              <span>{isFrench ? `Occupés (${occupiedCount})` : `Occupied (${occupiedCount})`}</span>
                            </button>
                            <button
                              onClick={() =>
                                setBuildingUnitFilters((prev) => ({ ...prev, [building.id]: "vacant" }))
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                currentFilter === "vacant"
                                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm"
                                  : "text-slate-400 hover:text-emerald-300"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>{isFrench ? `Vacants (${vacantCount})` : `Vacant (${vacantCount})`}</span>
                            </button>
                          </div>
                        </div>

                        {displayedUnits.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                            {displayedUnits.map((unit) => {
                              const isOccupied = unit.status === "occupied" || Boolean(unit.tenant_name?.trim());
                              const hasConfiguredSpecs =
                                (unit.parlors && unit.parlors > 0) ||
                                (unit.rooms && unit.rooms > 0) ||
                                (unit.bedrooms && unit.bedrooms > 0) ||
                                (unit.bathrooms && unit.bathrooms > 0) ||
                                (unit.kitchens && unit.kitchens > 0) ||
                                unit.rent_amount > 0;

                              return (
                                <div
                                  key={unit.id}
                                  className={`bg-slate-900 border rounded-xl p-4 space-y-3 transition flex flex-col justify-between ${
                                    isOccupied
                                      ? "border-blue-500/30 hover:border-blue-500/60 shadow-lg shadow-blue-950/20"
                                      : "border-slate-800 hover:border-slate-700/80"
                                  }`}
                                >
                                  <div className="space-y-2.5">
                                    {/* Top Row: Unit Name & Status */}
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-white text-sm">
                                        {unit.unit_number}
                                      </span>
                                      {isOccupied ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                          {isFrench ? "Occupé" : "Occupied"}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                          {isFrench ? "Vacant" : "Vacant"}
                                        </span>
                                      )}
                                    </div>

                                    {/* Occupancy Details Box */}
                                    {isOccupied && unit.tenant_name ? (
                                      <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/20 space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 truncate">
                                            <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                            <span className="font-semibold text-white truncate text-[11px]">
                                              {unit.tenant_name}
                                            </span>
                                          </div>
                                          <Link
                                            href={`/dashboard/credentials?unitId=${unit.id}`}
                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 transition shrink-0"
                                            title={isFrench ? "Voir les identifiants & partager sur WhatsApp" : "View credentials & WhatsApp share"}
                                          >
                                            <KeyRound className="w-3 h-3" />
                                            <span>{isFrench ? "Identifiants" : "Credentials"}</span>
                                          </Link>
                                        </div>
                                        {unit.tenant_phone && (
                                          <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                                            <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                                            <span className="truncate">{unit.tenant_phone}</span>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs">
                                        <div className="flex items-center gap-1.5 text-emerald-400/90 truncate">
                                          <DoorOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                          <span className="text-[11px] font-medium truncate">
                                            {isFrench ? "Vacant • Disponible à la Location" : "Vacant • Available for Lease"}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => handleOpenEditUnit(unit, building.name)}
                                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 transition shrink-0 cursor-pointer"
                                          title={isFrench ? "Assigner un locataire à ce logement" : "Assign a tenant to this unit"}
                                        >
                                          <UserPlus className="w-3 h-3" />
                                          <span>{isFrench ? "Assigner" : "Assign"}</span>
                                        </button>
                                      </div>
                                    )}

                                    {/* Rent Amount */}
                                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                                        {isFrench ? "Prix du Loyer" : "Rent Price"}
                                      </span>
                                      {unit.rent_amount > 0 ? (
                                        <span className="text-sm font-extrabold text-emerald-400">
                                          {Number(unit.rent_amount).toLocaleString()} XAF
                                          <span className="text-[11px] text-slate-500 font-normal">
                                            {isFrench ? " / mois" : " / mo"}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-xs text-amber-400/90 font-medium italic">
                                          {isFrench ? "Loyer non défini" : "Rent not set"}
                                        </span>
                                      )}
                                    </div>

                                    {/* Specifications Grid */}
                                    {hasConfiguredSpecs ? (
                                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                                          <Sofa className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                          <span>
                                            {unit.parlors ?? 0} {isFrench ? "Salon(s)" : "Parlor(s)"}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                                          <Bed className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                          <span>
                                            {unit.rooms ?? unit.bedrooms ?? 0} {isFrench ? "Chambre(s)" : "Room(s)"}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                                          <Bath className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                          <span>
                                            {unit.bathrooms ?? 0} {isFrench ? "Douche(s)" : "Bath(s)"}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                                          <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                          <span>
                                            {unit.kitchens ?? 0} {isFrench ? "Cuisine(s)" : "Kitchen(s)"}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-[11px] text-slate-500 italic text-center">
                                        {isFrench
                                          ? "Caractéristiques non définies (0 salon, chambre, douche, cuisine)"
                                          : "Specs not set yet (0 parlors, rooms, baths, kitchens)"}
                                      </div>
                                    )}

                                    {unit.notes && (
                                      <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                                        &quot;{unit.notes}&quot;
                                      </p>
                                    )}
                                  </div>

                                  {/* Actions: Modify Unit & Credentials Buttons */}
                                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                                    <button
                                      onClick={() => handleOpenEditUnit(unit, building.name)}
                                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                        isOccupied
                                          ? "bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20"
                                          : "bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20"
                                      }`}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>
                                        {isOccupied ? (isFrench ? "Modifier Pièces & Locataire" : "Modify Specs & Tenant") : hasConfiguredSpecs ? (isFrench ? "Modifier Pièces / Assigner" : "Modify Specs / Assign Tenant") : (isFrench ? "Configurer & Assigner Locataire" : "Configure & Assign Tenant")}
                                      </span>
                                    </button>

                                    {isOccupied && unit.tenant_name && (
                                      <Link
                                        href={`/dashboard/credentials?unitId=${unit.id}`}
                                        className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 text-xs font-semibold transition shrink-0"
                                        title={isFrench ? "Partager sur WhatsApp" : "Share on WhatsApp"}
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        <span>WhatsApp</span>
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-2">
                            <p className="text-xs text-slate-400">
                              {isFrench
                                ? `Aucun logement ${currentFilter === "occupied" ? "occupé" : currentFilter === "vacant" ? "vacant" : ""} trouvé dans ${building.name}.`
                                : `No ${currentFilter} units found in ${building.name}.`}
                            </p>
                            <button
                              onClick={() =>
                                setBuildingUnitFilters((prev) => ({ ...prev, [building.id]: "all" }))
                              }
                              className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
                            >
                              {isFrench ? `Afficher tous les ${unitCount} logements` : `Show all ${unitCount} units`}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* MODAL: Unit Modification Modal */}
      {editingUnit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingUnit) {
              setEditingUnit(null);
            }
          }}
          onWheel={handleModalWheel}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] h-auto min-h-0 select-text"
            onWheel={handleModalWheel}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isFrench
                      ? `Modifier le Logement : ${editingUnit.unit_number}`
                      : `Modify Unit: ${editingUnit.unit_number}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isFrench ? "Propriété :" : "Property:"} <strong className="text-slate-200">{editingBuildingName}</strong> • {isFrench ? "Statut :" : "Status:"}{" "}
                    {unitForm.tenant_name?.trim() ? (
                      <span className="font-bold text-blue-400">
                        {isFrench
                          ? `Occupé (${unitForm.tenant_name.trim()})`
                          : `Occupied (${unitForm.tenant_name.trim()})`}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-400">
                        {isFrench ? "Vacant (Disponible)" : "Vacant (Available)"}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingUnit(null)}
                disabled={savingUnit}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title={isFrench ? "Fermer (Échap)" : "Close (Esc)"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {unitEditError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{unitEditError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveUnitModification} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div
                ref={modalScrollBodyRef}
                className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain"
                style={{
                  overscrollBehavior: "contain",
                }}
              >
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isFrench ? "Identifiant / Nom du Logement" : "Unit Identifier / Name"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isFrench ? "ex. Porte 1, Appt 101" : "e.g. Unit 1, Apt 101"}
                    value={unitForm.unit_number}
                    onChange={(e) =>
                      setUnitForm({ ...unitForm, unit_number: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {isFrench ? "Loyer Mensuel (XAF)" : "Monthly Rent (XAF)"}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      placeholder={isFrench ? "ex. 150000" : "e.g. 150000"}
                      value={unitForm.rent_amount ? unitForm.rent_amount : ""}
                      onChange={(e) =>
                        setUnitForm({
                          ...unitForm,
                          rent_amount: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Number of Palors, Rooms, Bathrooms, Kitchens */}
              <div className="pt-2">
                <span className="block text-xs font-semibold text-white uppercase tracking-wider mb-2.5">
                  {isFrench ? "Agencement & Caractéristiques" : "Unit Layout & Specs"}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Parlors */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-purple-400 font-medium">
                      <Sofa className="w-3.5 h-3.5" />
                      <span>{isFrench ? "Salons" : "Parlors"}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={unitForm.parlors}
                      onChange={(e) =>
                        setUnitForm({
                          ...unitForm,
                          parlors: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 block text-center">
                      {isFrench ? "Salons" : "Salons"}
                    </span>
                  </div>

                  {/* Rooms */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
                      <Bed className="w-3.5 h-3.5" />
                      <span>{isFrench ? "Chambres" : "Rooms"}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={unitForm.rooms}
                      onChange={(e) =>
                        setUnitForm({
                          ...unitForm,
                          rooms: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 block text-center">
                      {isFrench ? "Chambres" : "Bedrooms"}
                    </span>
                  </div>

                  {/* Bathrooms */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
                      <Bath className="w-3.5 h-3.5" />
                      <span>{isFrench ? "Douches" : "Bathrooms"}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={unitForm.bathrooms}
                      onChange={(e) =>
                        setUnitForm({
                          ...unitForm,
                          bathrooms: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 block text-center">
                      {isFrench ? "Salles de bain" : "Baths"}
                    </span>
                  </div>

                  {/* Kitchens */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                      <Utensils className="w-3.5 h-3.5" />
                      <span>{isFrench ? "Cuisines" : "Kitchens"}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={unitForm.kitchens}
                      onChange={(e) =>
                        setUnitForm({
                          ...unitForm,
                          kitchens: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 block text-center">
                      {isFrench ? "Cuisines" : "Kitchens"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isFrench ? "Notes / Particularités du Logement (Facultatif)" : "Unit Notes / Particularities (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder={
                    isFrench
                      ? "ex. Chambre parentale avec salle d'eau, balcon avec vue dégagée"
                      : "e.g. Master bedroom ensuite, balcony facing street"
                  }
                  value={unitForm.notes || ""}
                  onChange={(e) => setUnitForm({ ...unitForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* ASSIGN TENANT SECTION */}
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        {isFrench ? "Assigner le Logement à un Locataire" : "Assign Unit to Tenant"}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {isFrench
                          ? "Laisser vide si vacant. Remplissez pour générer les identifiants et le lien WhatsApp."
                          : "Default empty for vacant units. Fill details to generate credentials & WhatsApp link."}
                      </p>
                    </div>
                  </div>

                  {Boolean(unitForm.tenant_name || editingUnit.tenant_name) && (
                    <button
                      type="button"
                      onClick={handleUnassignTenantInModal}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded-lg border border-rose-500/30 transition cursor-pointer"
                      title={isFrench ? "Effacer les données du locataire et rendre le logement vacant" : "Clear tenant information and make unit vacant"}
                    >
                      <UserMinus className="w-3 h-3" />
                      <span>{isFrench ? "Libérer le Logement" : "Vacate Unit"}</span>
                    </button>
                  )}
                </div>

                <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 space-y-3.5">
                  {/* Tenant Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {isFrench ? "Nom Complet du Locataire" : "Tenant Full Name"}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Users className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Jean-Paul Mbarga"
                        value={unitForm.tenant_name || ""}
                        onChange={(e) =>
                          setUnitForm({ ...unitForm, tenant_name: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tenant WhatsApp Phone */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {isFrench ? "Numéro de Téléphone WhatsApp" : "WhatsApp Phone Number"}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          placeholder="e.g. +237 671 23 45 67"
                          value={unitForm.tenant_phone || ""}
                          onChange={(e) =>
                            setUnitForm({ ...unitForm, tenant_phone: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {isFrench ? "Utilisé pour le partage automatique sur WhatsApp" : "Used for WhatsApp auto-fill sharing"}
                      </span>
                    </div>

                    {/* Tenant Email */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {isFrench ? "E-mail de Connexion du Locataire" : "Tenant Login E-mail"}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          placeholder="e.g. jeanpaul@gmail.com"
                          value={unitForm.tenant_email || ""}
                          onChange={(e) =>
                            setUnitForm({ ...unitForm, tenant_email: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {isFrench ? "Utilisé pour la connexion au portail locataire" : "Used for tenant portal login"}
                      </span>
                    </div>
                  </div>

                  {Boolean(unitForm.tenant_name?.trim() || unitForm.tenant_phone?.trim()) && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span>
                        {isFrench
                          ? "L'enregistrement générera automatiquement les identifiants et vous redirigera vers le partage WhatsApp !"
                          : "Saving will automatically generate credentials and redirect you to WhatsApp share!"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Pill Preview */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span>{isFrench ? "Résumé :" : "Summary:"}</span>
                <span className="font-semibold text-blue-400">
                  {unitForm.parlors} {isFrench ? "Salon(s)" : "Parlor(s)"} • {unitForm.rooms} {isFrench ? "Chambre(s)" : "Room(s)"} • {unitForm.bathrooms} {isFrench ? "Douche(s)" : "Bath(s)"} • {unitForm.kitchens} {isFrench ? "Cuisine(s)" : "Kitchen(s)"}
                  {unitForm.rent_amount > 0 ? ` • ${Number(unitForm.rent_amount).toLocaleString()} XAF` : ""}
                  {unitForm.tenant_name?.trim()
                    ? isFrench ? ` • Statut : Occupé (${unitForm.tenant_name.trim()})` : ` • Status: Occupied (${unitForm.tenant_name.trim()})`
                    : isFrench ? " • Statut : Vacant (Disponible)" : " • Status: Vacant (Available)"}
                </span>
              </div>

              </div>

              {/* Actions Footer (Pinned at bottom of modal) */}
              <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-900/95">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  disabled={savingUnit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  {isFrench ? "Annuler" : "Cancel"}
                </button>

                <button
                  type="submit"
                  disabled={savingUnit}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-semibold shadow-lg transition disabled:opacity-50 cursor-pointer ${
                    unitForm.tenant_name?.trim()
                      ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                      : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30"
                  }`}
                >
                  {savingUnit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        {unitForm.tenant_name?.trim()
                          ? isFrench ? "Génération des Identifiants..." : "Generating Credentials..."
                          : isFrench ? "Enregistrement..." : "Saving..."}
                      </span>
                    </>
                  ) : unitForm.tenant_name?.trim() ? (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>
                        {isFrench
                          ? "Enregistrer & Générer les Identifiants"
                          : "Save & Generate Tenant Credentials"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {isFrench ? "Enregistrer les Modifications" : "Save Unit Modifications"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
