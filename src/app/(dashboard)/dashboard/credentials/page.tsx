"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Unit, Building, LandlordProfile } from "@/types/database";
import {
  buildTenantWhatsAppUrl,
  generateTenantPassword,
  generateAccessToken,
} from "@/lib/services/tenantService";
import { getBuildingsWithUnits } from "@/lib/services/buildingService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import DashboardNav from "@/components/DashboardNav";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Building2,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Mail,
  Phone,
  UserCheck,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  DoorOpen,
  DollarSign,
  Search,
  Filter,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface EnrichedCredential {
  unit: Unit;
  building: Building;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  tenantPassword: string;
  tenantToken: string;
  directAccessUrl: string;
  whatsAppUrl: string;
  whatsAppMessage: string;
}

function CredentialsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUnitId = searchParams.get("unitId");
  const isNewlyCreated = searchParams.get("created") === "true";
  const { isFrench, language, formatCurrency, formatDate } = useLanguage();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");

  // Per-card UI states
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [expandedPreviews, setExpandedPreviews] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [portalOrigin, setPortalOrigin] = useState("");

  // Determine current window origin for direct magic links
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPortalOrigin(window.location.origin);
    }
  }, []);

  // Fetch session, profile, buildings and occupied units
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setUser(authUser);
        let effectiveLandlordId = authUser.id;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profileData) {
          setProfile(profileData as LandlordProfile);
          if (profileData.role === "manager" && profileData.landlord_id) {
            effectiveLandlordId = profileData.landlord_id;
          }
        }

        try {
          const buildingsData = await getBuildingsWithUnits(effectiveLandlordId);
          setBuildings(buildingsData);
        } catch (err) {
          console.error("Error loading buildings for credentials page:", err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Landlord display name for WhatsApp message
  const landlordName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    "LeaseLink Property Manager";

  // Build the list of all occupied units with their generated credentials
  const allCredentials: EnrichedCredential[] = useMemo(() => {
    const list: EnrichedCredential[] = [];

    buildings.forEach((building) => {
      (building.units || []).forEach((unit) => {
        const hasTenant =
          unit.status === "occupied" ||
          Boolean(unit.tenant_name && unit.tenant_name.trim());

        if (hasTenant) {
          const tenantName = unit.tenant_name?.trim() || "Valued Tenant";
          const tenantPhone = unit.tenant_phone?.trim() || "";
          const tenantEmail = unit.tenant_email?.trim() || "";
          const tenantPassword =
            unit.tenant_password?.trim() || generateTenantPassword();
          const tenantToken =
            unit.tenant_access_token?.trim() || generateAccessToken();

          const directAccessUrl = `${portalOrigin}/tenant/portal?token=${tenantToken}`;

          const { url: whatsAppUrl, message: whatsAppMessage } =
            buildTenantWhatsAppUrl({
              tenantName,
              tenantPhone,
              buildingName: building.name,
              unitNumber: unit.unit_number,
              rentAmount: Number(unit.rent_amount || 0),
              email: tenantEmail,
              password: tenantPassword,
              directAccessUrl,
              landlordName,
              language,
            });

          list.push({
            unit,
            building,
            tenantName,
            tenantPhone,
            tenantEmail,
            tenantPassword,
            tenantToken,
            directAccessUrl,
            whatsAppUrl,
            whatsAppMessage,
          });
        }
      });
    });

    return list;
  }, [buildings, portalOrigin, landlordName, language]);

  // Filtered credentials list based on search and building filter
  const filteredCredentials = useMemo(() => {
    let result = allCredentials;

    if (selectedBuildingId !== "all") {
      result = result.filter((c) => c.building.id === selectedBuildingId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.tenantName.toLowerCase().includes(q) ||
          c.tenantPhone.toLowerCase().includes(q) ||
          c.tenantEmail.toLowerCase().includes(q) ||
          c.unit.unit_number.toLowerCase().includes(q) ||
          c.building.name.toLowerCase().includes(q)
      );
    }

    // If a target unit ID was requested in URL query, place that unit at the top
    if (targetUnitId) {
      result = [...result].sort((a, b) => {
        if (a.unit.id === targetUnitId) return -1;
        if (b.unit.id === targetUnitId) return 1;
        return 0;
      });
    }

    return result;
  }, [allCredentials, selectedBuildingId, searchQuery, targetUnitId]);

  // Total portfolio stats
  const totalOccupiedCount = allCredentials.length;
  const totalMonthlyRent = allCredentials.reduce(
    (sum, c) => sum + Number(c.unit.rent_amount || 0),
    0
  );

  // Toggle helpers
  const togglePasswordVisibility = (unitId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const togglePreview = (unitId: string) => {
    setExpandedPreviews((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const handleCopy = (text: string, identifier: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(identifier);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isFrench ? "Chargement des identifiants locataires générés..." : "Loading generated tenant credentials..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Unified SaaS Dashboard Navigation Bar */}
      <DashboardNav
        user={user}
        buildingsCount={buildings.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24 lg:pb-12">
        {/* Banner if redirected after assigning a tenant */}
        {isNewlyCreated && targetUnitId && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                {isFrench
                  ? "Locataire assigné & identifiants générés avec succès !"
                  : "Tenant Assigned & Credentials Generated Successfully!"}
              </h3>
              <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-200/80 leading-relaxed">
                {isFrench ? (
                  <>
                    Le logement a été marqué comme <strong>Occupé</strong> et les identifiants d'accès sécurisés ont été créés automatiquement. Vous pouvez les partager sur le WhatsApp du locataire en 1 clic ci-dessous.
                  </>
                ) : (
                  <>
                    The unit has been marked as <strong>Occupied</strong> and secure access credentials were automatically created. You can share them to the tenant&apos;s WhatsApp with 1 click below.
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Page Title & KPI Summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-2">
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isFrench ? "Centre d'Accès & Accueil Locataires" : "Tenant Access & Onboarding Hub"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {isFrench ? "Identifiants Locataires Générés" : "Generated Tenant Credentials"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
              {isFrench
                ? "Consultez et partagez les mots de passe, liens d'accès direct en 1 clic et messages d'intégration WhatsApp pré-rédigés pour tous vos locataires actifs."
                : "View and share encrypted passwords, 1-click magic access links, and pre-composed WhatsApp onboarding messages for all your active tenants."}
            </p>
          </div>

          {/* Quick Portfolio Stats */}
          <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                  {isFrench ? "Locataires Actifs" : "Active Tenants"}
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">{totalOccupiedCount}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  {isFrench ? "Loyer Total" : "Total Rent"}
                </span>
                <span className="text-lg font-bold text-emerald-400">
                  {totalMonthlyRent.toLocaleString()} <span className="text-xs text-slate-400 font-normal">XAF</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        {totalOccupiedCount > 0 && (
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm dark:shadow-lg">
            {/* Live Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isFrench ? "Rechercher locataire, logement, tél, email..." : "Search tenant, unit, phone, email..."}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9.5 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Building Filter Dropdown */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                <option value="all">
                  {isFrench
                    ? `Toutes les Propriétés (${totalOccupiedCount} Locataires)`
                    : `All Properties (${totalOccupiedCount} Tenants)`}
                </option>
                {buildings
                  .filter((b) =>
                    b.units?.some((u) => u.status === "occupied" || Boolean(u.tenant_name))
                  )
                  .map((b) => {
                    const count = (b.units || []).filter(
                      (u) => u.status === "occupied" || Boolean(u.tenant_name)
                    ).length;
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} ({count} {isFrench ? `actif${count > 1 ? "s" : ""}` : "active"})
                      </option>
                    );
                  })}
              </select>

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  {isFrench ? "Effacer" : "Clear"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty State when NO occupied units exist in portfolio */}
        {totalOccupiedCount === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4 max-w-xl mx-auto my-12 shadow-sm dark:shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <KeyRound className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Aucun Identifiant Locataire Généré Pour l'Instant" : "No Tenant Credentials Generated Yet"}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {isFrench
                  ? "Lorsque vous assignez un locataire à un logement vacant dans vos bâtiments, LeaseLink génère automatiquement des mots de passe sécurisés, des liens d'accès direct en 1 clic et des messages WhatsApp prêts à l'envoi."
                  : "When you assign a tenant to any vacant unit in your buildings, LeaseLink automatically generates secure passwords, 1-click magic access links, and ready-to-send WhatsApp messages for them."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/dashboard/buildings"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <DoorOpen className="w-4 h-4" />
                <span>{isFrench ? "Aller aux Bâtiments & Assigner un Locataire" : "Go to Buildings & Assign a Tenant"}</span>
              </Link>
            </div>
          </div>
        ) : filteredCredentials.length === 0 ? (
          /* Filter/Search No Match */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-sm">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isFrench ? "Aucun identifiant ne correspond à votre filtre" : "No Credentials Match Your Filter"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isFrench
                ? `Aucun locataire actif trouvé pour "${searchQuery}". Essayez de réinitialiser vos filtres.`
                : `No active tenant found matching "${searchQuery}". Try clearing your search query.`}
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedBuildingId("all");
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-800 dark:text-white font-medium border border-slate-200 dark:border-slate-700 transition"
            >
              {isFrench ? "Réinitialiser les Filtres" : "Reset Filters"}
            </button>
          </div>
        ) : (
          /* Credentials Directory Grid */
          <div className="space-y-6">
            {filteredCredentials.map((cred) => {
              const isTargeted = cred.unit.id === targetUnitId;
              const isPasswordVisible = visiblePasswords[cred.unit.id] || false;
              const isPreviewExpanded = expandedPreviews[cred.unit.id] || false;

              return (
                <div
                  key={cred.unit.id}
                  id={`tenant-credential-card-${cred.unit.id}`}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 sm:p-7 shadow-sm dark:shadow-xl transition space-y-6 ${
                    isTargeted
                      ? "border-emerald-500/70 bg-gradient-to-br from-emerald-50/50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 ring-2 ring-emerald-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80"
                  }`}
                >
                  {/* Card Header: Tenant & Unit Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
                    <div className="flex items-start sm:items-center gap-3.5">
                      {/* Initials Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md shadow-emerald-700/20">
                        {cred.tenantName.substring(0, 2).toUpperCase()}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                            {cred.tenantName}
                          </h2>
                          {isTargeted && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                              {isFrench ? "Logement Sélectionné" : "Selected Unit"}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                            {isFrench ? "Locataire Actif" : "Active Tenant"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            {cred.building.name}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                            <DoorOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            {cred.unit.unit_number}
                          </span>
                          {cred.building.city && (
                            <>
                              <span>•</span>
                              <span>{cred.building.city}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rent & Fast Edit Button */}
                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                          {isFrench ? "Loyer Mensuel" : "Monthly Rent"}
                        </span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(Number(cred.unit.rent_amount || 0))}
                        </span>
                      </div>

                      <Link
                        href={`/dashboard/buildings`}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700/80 transition"
                        title={isFrench ? "Voir le logement dans Immeubles" : "View Unit in Buildings"}
                      >
                        {isFrench ? "Modifier Logement" : "Edit Unit"}
                      </Link>
                    </div>
                  </div>

                  {/* Primary WhatsApp Action Bar */}
                  <div className="bg-emerald-50/60 dark:bg-gradient-to-r dark:from-emerald-950/40 dark:via-slate-950 dark:to-slate-950 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-600/20 dark:fill-emerald-400/20" />
                        <span>{isFrench ? "Accueil WhatsApp Prêt à l'Envoi" : "Direct WhatsApp Onboarding Ready"}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
                        {isFrench
                          ? "Envoyez les identifiants, caractéristiques du logement et le lien direct en 1-clic à "
                          : "Send credentials, apartment specs, and the direct 1-click magic link directly to "}
                        <strong className="text-slate-900 dark:text-white">{cred.tenantPhone || (isFrench ? "le locataire" : "the tenant")}</strong>.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <a
                        href={cred.whatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 fill-white" />
                        <span>{isFrench ? "Partager sur WhatsApp" : "Share on WhatsApp"}</span>
                      </a>

                      <button
                        onClick={() => handleCopy(cred.whatsAppMessage, `full_msg_${cred.unit.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      >
                        {copiedField === `full_msg_${cred.unit.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400">{isFrench ? "Message Copié !" : "Message Copied!"}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{isFrench ? "Copier le Texte" : "Copy Full Text"}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => togglePreview(cred.unit.id)}
                        className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl bg-white/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                      >
                        <span>{isPreviewExpanded ? (isFrench ? "Masquer l'Aperçu" : "Hide Preview") : (isFrench ? "Aperçu" : "Preview")}</span>
                        {isPreviewExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expandable WhatsApp Message Preview */}
                  {isPreviewExpanded && (
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto selection:bg-emerald-600">
                      {cred.whatsAppMessage}
                    </div>
                  )}

                  {/* Generated Credentials Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                    {/* Login Username / Email */}
                    <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate">{isFrench ? "Identifiant / E-mail" : "Tenant Login ID / E-mail"}</span>
                        </span>
                        <button
                          onClick={() => handleCopy(cred.tenantEmail || cred.tenantPhone, `email_${cred.unit.id}`)}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition shrink-0"
                          title={isFrench ? "Copier l'identifiant" : "Copy login ID"}
                        >
                          {copiedField === `email_${cred.unit.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white block truncate">
                        {cred.tenantEmail || cred.tenantPhone || (isFrench ? "Aucun e-mail assigné" : "No email assigned")}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {isFrench ? "Tél : " : "Phone: "}{cred.tenantPhone || (isFrench ? "Aucun" : "None")}
                      </span>
                    </div>

                    {/* Access Password */}
                    <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="truncate">{isFrench ? "Mot de Passe d'Accès" : "Access Password"}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(cred.unit.id)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                            title={isPasswordVisible ? (isFrench ? "Masquer mot de passe" : "Hide password") : (isFrench ? "Afficher mot de passe" : "Show password")}
                          >
                            {isPasswordVisible ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleCopy(cred.tenantPassword, `pass_${cred.unit.id}`)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                            title={isFrench ? "Copier mot de passe" : "Copy password"}
                          >
                            {copiedField === `pass_${cred.unit.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 block tracking-wider truncate">
                        {isPasswordVisible ? cred.tenantPassword : "••••••••••••"}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {isFrench ? "Connexion sur /tenant/login" : "Used for standard login at /tenant/login"}
                      </span>
                    </div>

                    {/* 1-Click Direct Magic Link */}
                    <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="truncate">{isFrench ? "Lien Direct en 1-Clic" : "1-Click Magic Link"}</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={cred.directAccessUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                            title={isFrench ? "Tester la vue portail dans un nouvel onglet" : "Test Portal View in new tab"}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleCopy(cred.directAccessUrl, `link_${cred.unit.id}`)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                            title={isFrench ? "Copier le Lien Magique" : "Copy Magic Link"}
                          >
                            {copiedField === `link_${cred.unit.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-blue-600 dark:text-blue-400 block truncate max-w-full">
                        {cred.directAccessUrl}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {isFrench ? "Accès direct sans mot de passe pour le locataire" : "Direct passwordless login for tenant"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Security & Guarantee Footer Notice */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>{isFrench ? "Sécurité & Contrôle d'Accès :" : "Security & Access Control:"}</strong>{" "}
            {isFrench
              ? "Chaque jeton locataire est généré de manière sécurisée et rattaché au logement du locataire. Les locataires peuvent utiliser le lien magique en 1-clic sur mobile ou ordinateur pour consulter leur bail, signaler des réparations avec photos et notes vocales, et suivre leurs paiements de loyer."
              : "Each tenant token is securely generated and bound to that tenant's unit. Tenants can use the 1-click magic link on mobile or desktop to inspect their lease, submit repairs with photos and voice recordings, and review rent details."}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function TenantCredentialsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <CredentialsContent />
    </Suspense>
  );
}
