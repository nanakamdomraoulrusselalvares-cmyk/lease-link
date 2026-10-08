"use client";

import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";

export default function BuildingsManagementPage() {
  const router = useRouter();

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
  });
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitEditError, setUnitEditError] = useState<string | null>(null);

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

  const totalVacantUnits = useMemo(() => {
    return buildings.reduce((acc, b) => {
      const vacantInBuilding = b.units?.filter((u) => u.status === "vacant").length ?? 0;
      return acc + vacantInBuilding;
    }, 0);
  }, [buildings]);

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
        setFormError(result.error || "Failed to create building. Please try again.");
        setSubmitting(false);
        return;
      }

      setFormSuccess(
        `Building "${formData.name}" created successfully with ${unitsCount} vacant units! You can now configure each unit's rent, parlors, rooms, bathrooms, and kitchens below.`
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
    });
  };

  // Save Unit Modification
  const handleSaveUnitModification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingUnit) return;

    setSavingUnit(true);
    setUnitEditError(null);

    try {
      const result = await updateUnitConfiguration(user.id, editingUnit.id, unitForm);

      if (!result.success) {
        setUnitEditError(result.error || "Failed to update unit.");
        setSavingUnit(false);
        return;
      }

      // Update in local state for instantaneous feedback
      setBuildings((prevBuildings) =>
        prevBuildings.map((b) => ({
          ...b,
          units: b.units?.map((u) =>
            u.id === editingUnit.id
              ? {
                  ...u,
                  unit_number: unitForm.unit_number?.trim() || u.unit_number,
                  rent_amount: Number(unitForm.rent_amount) || 0,
                  parlors: Number(unitForm.parlors) || 0,
                  rooms: Number(unitForm.rooms) || 0,
                  bedrooms: Number(unitForm.rooms) || 0,
                  bathrooms: Number(unitForm.bathrooms) || 0,
                  kitchens: Number(unitForm.kitchens) || 0,
                  notes: unitForm.notes || null,
                }
              : u
          ),
        }))
      );

      setFormSuccess(
        `Unit "${unitForm.unit_number || editingUnit.unit_number}" updated successfully!`
      );
      setEditingUnit(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving unit modification.";
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

  // Filter buildings by search
  const filteredBuildings = useMemo(() => {
    if (!searchQuery.trim()) return buildings;
    const query = searchQuery.toLowerCase();
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.address.toLowerCase().includes(query) ||
        (b.city && b.city.toLowerCase().includes(query)) ||
        (b.state_region && b.state_region.toLowerCase().includes(query))
    );
  }, [buildings, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-400">Loading building portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white">
                Lease<span className="text-blue-500">Link</span>
              </span>
            </Link>

            <nav className="hidden sm:flex items-center gap-2">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Dashboard Overview
              </Link>
              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/10 text-blue-400 border border-blue-500/30">
                Buildings & Units
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="truncate max-w-[160px]">{user?.email}</span>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <LogOut className={`w-3.5 h-3.5 ${loggingOut ? "animate-spin" : ""}`} />
              <span>{loggingOut ? "Exiting..." : "Sign Out"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              <span>/</span>
              <span className="text-slate-200 font-medium">Buildings & Units</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Buildings & Units Management
            </h1>
            <p className="text-sm text-slate-400">
              Create buildings with vacant units, then customize each unit&apos;s rent price, parlors, rooms, bathrooms, and kitchens.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs transition cursor-pointer"
              title="Refresh Buildings List"
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
              <span>{showCreateForm ? "Close Form" : "Create New Building"}</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Messages */}
        {formSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-bold block">Action Completed!</span>
              <span>{formSuccess}</span>
            </div>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Total Buildings</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-white">
              {buildings.length}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Properties in portfolio</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Total Units</span>
              <Home className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-white">
              {totalUnitsInPortfolio}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Capacity: {planUnitLimit} max units
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Vacant Units</span>
              <DoorOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                {totalVacantUnits}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                100% Vacant
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Ready for configuration</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Quota Remaining</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {remainingQuota}
              </span>
              <span className="text-xs text-slate-400">
                {totalUnitsInPortfolio} / {planUnitLimit}
              </span>
            </div>
            <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  quotaPercentage > 85
                    ? "bg-rose-500"
                    : quotaPercentage > 60
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${quotaPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* SECTION: Building Creation Form (Floors & default specs removed) */}
        {showCreateForm && (
          <section className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Create New Building</h2>
                  <p className="text-xs text-slate-400">
                    Enter the building details and number of units. All units will be created as <strong className="text-emerald-400">Vacant</strong>. You can configure individual rent and room specs right after creation.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <span className="font-bold block">Error</span>
                  <span>{formError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateBuilding} className="mt-6 space-y-6">
              {/* Part 1: Building Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Building / Property Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Résidence Les Palmiers, Sunrise Apartments"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Property Type <span className="text-rose-400">*</span>
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
                    <option value="apartment">🏢 Apartment Complex</option>
                    <option value="residential">🏘️ Multi-Family Residential</option>
                    <option value="duplex">🏠 Duplex / Triplex</option>
                    <option value="commercial">🏬 Commercial Building</option>
                    <option value="mixed_use">🏗️ Mixed-Use Complex</option>
                    <option value="other">📌 Other Property</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Street Address / Quarter <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 45 Rue Joss, Bonanjo"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      City
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
                      Region / State
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
                    Units Provisioning (All Generated Vacant)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Number of Units to Generate</span>
                      <span className="text-[11px] text-blue-400 font-semibold">
                        {remainingQuota} quota left
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
                      Generated as <strong className="text-emerald-400">Vacant</strong>
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Unit Naming Prefix
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Unit, Apt, Porte, Studio"
                      value={formData.unit_prefix}
                      onChange={(e) =>
                        setFormData({ ...formData, unit_prefix: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      e.g. &quot;{formData.unit_prefix || "Unit"} 1&quot;, &quot;{formData.unit_prefix || "Unit"} 2&quot;
                    </span>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Building Notes / Amenities (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Gated security, borehole water"
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
                    <span>Automatic Generation Preview: {unitPreviewList.length} Units</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Initialized as VACANT (Specs unconfigured)
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  The following vacant units will be created. You can customize rent, parlors, rooms, bathrooms, and kitchens for each unit after creation:
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
                        Vacant
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
                  Cancel
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
                      <span>Creating Building & Units...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>
                        Create Building & Generate {formData.total_units} Vacant Units
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Your Buildings Portfolio</h2>
              <p className="text-xs text-slate-400">
                View your buildings, inspect vacant units, and customize unit rent & room configurations.
              </p>
            </div>

            {buildings.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by name or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
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
                <h3 className="text-lg font-bold text-white">No Buildings Created Yet</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Start by adding your first building. LeaseLink will automatically generate the number of units you enter with a <strong>Vacant</strong> status, ready for you to customize.
                </p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Building</span>
              </button>
            </div>
          ) : filteredBuildings.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 rounded-xl border border-slate-800">
              No buildings match &quot;{searchQuery}&quot;. Try a different search keyword.
            </div>
          ) : (
            /* Buildings Cards List */
            <div className="space-y-6">
              {filteredBuildings.map((building) => {
                const isExpanded = !!expandedBuildingIds[building.id];
                const unitCount = building.units?.length || building.total_units || 0;
                const vacantCount =
                  building.units?.filter((u) => u.status === "vacant").length ?? unitCount;

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
                              Units
                            </span>
                            <span className="text-sm font-extrabold text-white">
                              {unitCount}
                            </span>
                          </div>

                          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                            <span className="block text-[10px] text-emerald-400 uppercase font-bold">
                              Vacant
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
                          <span>{isExpanded ? "Hide Units" : `View Units (${unitCount})`}</span>
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            <DoorOpen className="w-4 h-4 text-blue-400" />
                            <span>Units in {building.name}</span>
                          </div>

                          <span className="text-xs text-slate-400">
                            Click <strong className="text-blue-400">&quot;Modify Unit&quot;</strong> on any unit to set rent price, parlors, rooms, bathrooms, and kitchens.
                          </span>
                        </div>

                        {building.units && building.units.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                            {building.units.map((unit) => {
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
                                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-3 transition flex flex-col justify-between"
                                >
                                  <div className="space-y-2.5">
                                    {/* Top Row: Unit Name & Status */}
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-white text-sm">
                                        {unit.unit_number}
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Vacant
                                      </span>
                                    </div>

                                    {/* Rent Amount */}
                                    <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                                        Rent Price
                                      </span>
                                      {unit.rent_amount > 0 ? (
                                        <span className="text-sm font-extrabold text-emerald-400">
                                          {Number(unit.rent_amount).toLocaleString()} XAF
                                          <span className="text-[11px] text-slate-500 font-normal"> / mo</span>
                                        </span>
                                      ) : (
                                        <span className="text-xs text-amber-400/90 font-medium italic">
                                          Rent not set
                                        </span>
                                      )}
                                    </div>

                                    {/* Specifications Grid */}
                                    {hasConfiguredSpecs ? (
                                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                                          <Sofa className="w-3 h-3 text-purple-400 shrink-0" />
                                          <span>{unit.parlors ?? 0} Parlor(s)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                                          <Bed className="w-3 h-3 text-blue-400 shrink-0" />
                                          <span>{unit.rooms ?? unit.bedrooms ?? 0} Room(s)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                                          <Bath className="w-3 h-3 text-cyan-400 shrink-0" />
                                          <span>{unit.bathrooms ?? 0} Bath(s)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded">
                                          <Utensils className="w-3 h-3 text-amber-400 shrink-0" />
                                          <span>{unit.kitchens ?? 0} Kitchen(s)</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-[11px] text-slate-500 italic text-center">
                                        Specs not set yet (0 parlors, rooms, baths, kitchens)
                                      </div>
                                    )}

                                    {unit.notes && (
                                      <p className="text-[11px] text-slate-400 line-clamp-1 italic">
                                        &quot;{unit.notes}&quot;
                                      </p>
                                    )}
                                  </div>

                                  {/* Action: Modify Unit Button */}
                                  <div className="pt-2 border-t border-slate-800/80">
                                    <button
                                      onClick={() => handleOpenEditUnit(unit, building.name)}
                                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-xs font-semibold transition cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>
                                        {hasConfiguredSpecs ? "Modify Unit Specs" : "Configure Unit & Rent"}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 text-center">
                            Units not loaded. Click refresh above to load unit listings.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Modify Unit: {editingUnit.unit_number}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Property: <strong className="text-slate-200">{editingBuildingName}</strong> • Status: <strong className="text-emerald-400">Vacant</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingUnit(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {unitEditError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{unitEditError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveUnitModification} className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Unit Identifier / Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unit 1, Apt 101"
                    value={unitForm.unit_number}
                    onChange={(e) =>
                      setUnitForm({ ...unitForm, unit_number: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Monthly Rent (XAF)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      placeholder="e.g. 150000"
                      value={unitForm.rent_amount}
                      onChange={(e) =>
                        setUnitForm({
                          ...unitForm,
                          rent_amount: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Number of Palors, Rooms, Bathrooms, Kitchens */}
              <div className="pt-2">
                <span className="block text-xs font-semibold text-white uppercase tracking-wider mb-2.5">
                  Unit Layout & Specs
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Parlors */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-purple-400 font-medium">
                      <Sofa className="w-3.5 h-3.5" />
                      <span>Parlors</span>
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
                    <span className="text-[10px] text-slate-500 block text-center">Salons</span>
                  </div>

                  {/* Rooms */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
                      <Bed className="w-3.5 h-3.5" />
                      <span>Rooms</span>
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
                    <span className="text-[10px] text-slate-500 block text-center">Bedrooms</span>
                  </div>

                  {/* Bathrooms */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium">
                      <Bath className="w-3.5 h-3.5" />
                      <span>Bathrooms</span>
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
                    <span className="text-[10px] text-slate-500 block text-center">Baths</span>
                  </div>

                  {/* Kitchens */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                      <Utensils className="w-3.5 h-3.5" />
                      <span>Kitchens</span>
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
                    <span className="text-[10px] text-slate-500 block text-center">Kitchens</span>
                  </div>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Unit Notes / Particularities (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master bedroom ensuite, balcony facing street"
                  value={unitForm.notes || ""}
                  onChange={(e) => setUnitForm({ ...unitForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* Summary Pill Preview */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span>Summary:</span>
                <span className="font-semibold text-blue-400">
                  {unitForm.parlors} Parlor(s) • {unitForm.rooms} Room(s) • {unitForm.bathrooms} Bath(s) • {unitForm.kitchens} Kitchen(s)
                  {unitForm.rent_amount > 0 ? ` • ${Number(unitForm.rent_amount).toLocaleString()} XAF` : ""}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  disabled={savingUnit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingUnit}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {savingUnit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Unit Modifications</span>
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
