"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Building,
  LandlordProfile,
  AVAILABLE_PLANS,
  PropertyType,
  CreateBuildingFormInput,
} from "@/types/database";
import {
  createBuildingWithUnits,
  getBuildingsWithUnits,
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
  KeyRound,
  ShieldCheck,
  DoorOpen,
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

  // Form toggle & creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<CreateBuildingFormInput>({
    name: "",
    address: "",
    city: "Douala",
    state_region: "Littoral",
    property_type: "apartment",
    total_floors: 2,
    total_units: 4,
    unit_prefix: "Unit",
    default_rent: 100000,
    default_bedrooms: 1,
    default_bathrooms: 1,
    description: "",
  });

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

      // Expand all buildings by default for clear inspection
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

  // Live Unit Generator Preview calculations
  const unitPreviewList = useMemo(() => {
    const count = Math.min(Math.max(1, Number(formData.total_units) || 1), 50);
    const floors = Math.max(1, Number(formData.total_floors) || 1);
    const unitsPerFloor = Math.max(1, Math.ceil(count / floors));
    const prefix = formData.unit_prefix.trim() || "Unit";

    const list = [];
    for (let i = 1; i <= count; i++) {
      const floor = Math.min(floors, Math.floor((i - 1) / unitsPerFloor) + 1);
      list.push({
        unitNumber: `${prefix} ${i}`,
        floor,
      });
    }
    return list;
  }, [formData.total_units, formData.total_floors, formData.unit_prefix]);

  // Handle form submission
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
        `Building "${formData.name}" created successfully with ${unitsCount} vacant units!`
      );

      // Reset form
      setFormData({
        name: "",
        address: "",
        city: "Douala",
        state_region: "Littoral",
        property_type: "apartment",
        total_floors: 2,
        total_units: 4,
        unit_prefix: "Unit",
        default_rent: 100000,
        default_bedrooms: 1,
        default_bathrooms: 1,
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
              Register your physical buildings and instantly generate vacant units ready for tenant assignment.
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
              <span className="font-bold block">Creation Success!</span>
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
            <p className="mt-1 text-[11px] text-slate-500">Ready for tenant leases</p>
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

        {/* SECTION: Building Creation Form */}
        {showCreateForm && (
          <section className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Register New Building</h2>
                  <p className="text-xs text-slate-400">
                    Fill in the building details. The system will automatically create the building and generate all units as <strong className="text-emerald-400">Vacant</strong>.
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

              {/* Part 2: Structure & Automatic Unit Generation */}
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                    Structure & Automatic Unit Creation
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Number of Floors
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={formData.total_floors}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          total_floors: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Floors in structure
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Total Units to Create</span>
                      <span className="text-[11px] text-blue-400">
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
                      Generated as <strong>Vacant</strong>
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

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Default Monthly Rent
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      placeholder="e.g. 100000"
                      value={formData.default_rent}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_rent: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Base rent (editable per unit later)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Bedrooms per Unit
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={formData.default_bedrooms}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_bedrooms: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Bathrooms per Unit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.5}
                      value={formData.default_bathrooms}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          default_bathrooms: Math.max(1, parseFloat(e.target.value) || 1),
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Description / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Gated compound, backup borehole"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Part 3: Live Automatic Units Preview Box */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <Info className="w-4 h-4 text-blue-400" />
                    <span>Automatic Generation Preview: {unitPreviewList.length} Units</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    All Initialized as VACANT
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  The system will automatically initialize the building and simultaneously provision the following units:
                </p>

                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                  {unitPreviewList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <span className="font-semibold text-white">{item.unitNumber}</span>
                      <span className="text-[11px] text-slate-500">Floor {item.floor}</span>
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

        {/* SECTION: Created Buildings & Vacant Units Display */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Your Buildings Portfolio</h2>
              <p className="text-xs text-slate-400">
                Inspect your registered properties and the vacant units created inside them.
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
                  Start by adding your first building. LeaseLink will automatically generate the number of units you enter with a <strong>Vacant</strong> status.
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

                          <div className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{building.total_floors} Floor(s)</span>
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

                    {/* Expandable Vacant Units Table / Grid */}
                    {isExpanded && (
                      <div className="p-5 sm:p-6 bg-slate-950/60 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            <DoorOpen className="w-4 h-4 text-blue-400" />
                            <span>Generated Units for {building.name}</span>
                          </div>

                          <span className="text-xs text-slate-400">
                            Status: <strong className="text-emerald-400">{vacantCount} Vacant</strong> by default
                          </span>
                        </div>

                        {building.units && building.units.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {building.units.map((unit) => (
                              <div
                                key={unit.id}
                                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-white text-sm">
                                    {unit.unit_number}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Vacant
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                                  <div>
                                    <span className="text-slate-500 block">Level</span>
                                    <span className="text-slate-300 font-medium">
                                      Floor {unit.floor}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block">Monthly Rent</span>
                                    <span className="text-white font-medium">
                                      {unit.rent_amount > 0
                                        ? `${Number(unit.rent_amount).toLocaleString()} XAF`
                                        : "Not set"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                                  <div className="flex items-center gap-1">
                                    <Bed className="w-3 h-3 text-slate-500" />
                                    <span>{unit.bedrooms} Bed</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Bath className="w-3 h-3 text-slate-500" />
                                    <span>{unit.bathrooms} Bath</span>
                                  </div>
                                </div>

                                {/* Placeholder modification button ready for next prompt */}
                                <div className="pt-1">
                                  <button
                                    disabled
                                    className="w-full text-center py-1 rounded-lg bg-slate-950/70 text-[10px] text-slate-500 font-medium border border-slate-800 cursor-not-allowed"
                                    title="Modifications will be enabled per specifications in the next prompt"
                                  >
                                    Vacant • Ready for modification
                                  </button>
                                </div>
                              </div>
                            ))}
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
    </div>
  );
}
