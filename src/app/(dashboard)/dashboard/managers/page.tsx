"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LandlordProfile, Building, ManagerProfile, CreateManagerInput } from "@/types/database";
import { getBuildingsWithUnits } from "@/lib/services/buildingService";
import {
  getManagersForLandlord,
  createManager,
  updateManagerAssignedBuildings,
  deleteManager,
  generateManagerPassword,
} from "@/lib/services/managerService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import DashboardNav from "@/components/DashboardNav";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  Mail,
  Phone,
  Trash2,
  Check,
  Copy,
  MessageCircle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  X,
  Search,
  CheckCircle2,
  Lock,
  SlidersHorizontal,
  CheckSquare,
  Square,
  RotateCcw,
} from "lucide-react";

export default function LandlordManagersPage() {
  const router = useRouter();
  const { isFrench } = useLanguage();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Create Manager Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Building Assignment scope in Creation
  const [createScope, setCreateScope] = useState<"all" | "specific">("all");
  const [createSelectedBuildingIds, setCreateSelectedBuildingIds] = useState<string[]>([]);

  const [formData, setFormData] = useState<CreateManagerInput>({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

  // Edit / Revoke Building Assignment Modal
  const [editingManager, setEditingManager] = useState<ManagerProfile | null>(null);
  const [editScope, setEditScope] = useState<"all" | "specific">("all");
  const [editSelectedBuildingIds, setEditSelectedBuildingIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Success / Sharing Modal
  const [createdManagerData, setCreatedManagerData] = useState<{
    manager: ManagerProfile;
    password: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileData) {
        // If logged in as manager, redirect away from manager management
        if (profileData.role === "manager") {
          router.replace("/dashboard");
          return;
        }
        setProfile(profileData as LandlordProfile);
      }

      const [buildingsData, managersList] = await Promise.all([
        getBuildingsWithUnits(authUser.id),
        getManagersForLandlord(authUser.id),
      ]);

      setBuildings(buildingsData);
      setManagers(managersList);
    } catch (err) {
      console.error("Error loading managers:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setFormError(null);
    setCreateScope("all");
    setCreateSelectedBuildingIds(buildings.map((b) => b.id));
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      password: generateManagerPassword(),
    });
    setShowAddModal(true);
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.full_name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setFormError(
        isFrench
          ? "Veuillez renseigner le nom complet, l'email et le téléphone du gestionnaire."
          : "Please fill in the manager's full name, email, and phone number."
      );
      return;
    }

    if (createScope === "specific" && createSelectedBuildingIds.length === 0) {
      setFormError(
        isFrench
          ? "Veuillez cocher au moins un immeuble à assigner, ou choisissez 'Tous les immeubles'."
          : "Please select at least one building to assign, or choose 'All buildings'."
      );
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload: CreateManagerInput = {
        ...formData,
        assigned_building_ids: createScope === "all" ? null : createSelectedBuildingIds,
      };

      const res = await createManager(user.id, payload);

      if (!res.success || !res.manager) {
        setFormError(res.error || (isFrench ? "Échec de création du gestionnaire." : "Failed to create manager."));
        setSubmitting(false);
        return;
      }

      setShowAddModal(false);
      setCreatedManagerData({
        manager: res.manager,
        password: res.initialPassword || formData.password || "Mng#12345",
      });
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating manager";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit / Revoke Assignments Modal
  const handleOpenEditAssignments = (mgr: ManagerProfile) => {
    setEditingManager(mgr);
    setAssignmentFeedback(null);
    if (Array.isArray(mgr.assigned_building_ids)) {
      setEditScope("specific");
      setEditSelectedBuildingIds([...mgr.assigned_building_ids]);
    } else {
      setEditScope("all");
      setEditSelectedBuildingIds(buildings.map((b) => b.id));
    }
  };

  // Save updated or revoked building assignments
  const handleSaveAssignments = async () => {
    if (!user || !editingManager) return;
    setSavingAssignments(true);
    setAssignmentFeedback(null);

    const targetIds = editScope === "all" ? null : editSelectedBuildingIds;

    try {
      const res = await updateManagerAssignedBuildings(editingManager.id, user.id, targetIds);
      if (!res.success) {
        setAssignmentFeedback({
          type: "error",
          text: res.error || (isFrench ? "Erreur lors de la mise à jour." : "Update failed."),
        });
        setSavingAssignments(false);
        return;
      }

      // Update local state directly for instant responsiveness
      setManagers((prev) =>
        prev.map((m) =>
          m.id === editingManager.id
            ? { ...m, assigned_building_ids: targetIds, updated_at: new Date().toISOString() }
            : m
        )
      );

      setAssignmentFeedback({
        type: "success",
        text: isFrench
          ? "Périmètre des immeubles mis à jour avec succès !"
          : "Building assignments updated successfully!",
      });

      setTimeout(() => {
        setEditingManager(null);
        setAssignmentFeedback(null);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating assignments";
      setAssignmentFeedback({ type: "error", text: msg });
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleDeleteManager = async (managerId: string) => {
    if (!user) return;
    const confirmMsg = isFrench
      ? "Êtes-vous sûr de vouloir supprimer définitivement ce gestionnaire ? Il ne pourra plus se connecter."
      : "Are you sure you want to permanently remove this manager? They will no longer be able to log in.";

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(managerId);
    try {
      await deleteManager(managerId, user.id);
      await loadData();
    } catch (err) {
      console.error("Error deleting manager:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (text: string, fieldKey: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  // Build WhatsApp Share Message for newly created manager
  const getManagerWhatsAppUrl = (mgr: ManagerProfile, pass: string) => {
    const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "https://leaselink.app/login";

    let buildingScopeText = "";
    if (Array.isArray(mgr.assigned_building_ids)) {
      if (mgr.assigned_building_ids.length === 0) {
        buildingScopeText = isFrench
          ? "🏢 Périmètre assigné : Aucun immeuble pour le moment (accès temporairement restreint)."
          : "🏢 Assigned Scope: No buildings assigned yet (temporarily restricted).";
      } else {
        const assignedNames = buildings
          .filter((b) => mgr.assigned_building_ids?.includes(b.id))
          .map((b) => b.name);
        const displayList =
          assignedNames.length > 0 ? assignedNames.join(", ") : `${mgr.assigned_building_ids.length} immeuble(s)`;
        buildingScopeText = isFrench
          ? `🏢 Immeubles sous votre responsabilité (${mgr.assigned_building_ids.length}) :\n• ${displayList}`
          : `🏢 Buildings under your responsibility (${mgr.assigned_building_ids.length}):\n• ${displayList}`;
      }
    } else {
      buildingScopeText = isFrench
        ? "🏢 Périmètre assigné : Tous les immeubles du portefeuille."
        : "🏢 Assigned Scope: All portfolio buildings.";
    }

    const text = isFrench
      ? `Bonjour ${mgr.full_name},\n\nVotre accès de Gestionnaire LeaseLink a été configuré avec succès par votre bailleur.\n\n🔑 Vos identifiants de connexion :\n• Identifiant / Email : ${mgr.email}\n• Mot de passe temporaire : ${pass}\n• Lien de connexion : ${loginUrl}\n\n${buildingScopeText}\n\nVous avez accès à la gestion des logements, des fiches locataires, des réparations et au suivi des loyers impayés.`
      : `Hello ${mgr.full_name},\n\nYour LeaseLink Property Manager access has been configured by your landlord.\n\n🔑 Your login credentials:\n• Login / Email: ${mgr.email}\n• Temporary Password: ${pass}\n• Login URL: ${loginUrl}\n\n${buildingScopeText}\n\nYou have access to building units, tenant records, repair coordination, and unpaid rent tracking.`;

    const cleanPhone = mgr.phone.replace(/\D/g, "");
    const targetPhone = cleanPhone.length === 9 && cleanPhone.startsWith("6") ? `237${cleanPhone}` : cleanPhone;
    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
  };

  const filteredManagers = useMemo(() => {
    if (!searchQuery.trim()) return managers;
    const q = searchQuery.toLowerCase().trim();
    return managers.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.includes(q)
    );
  }, [managers, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isFrench ? "Chargement des gestionnaires..." : "Loading property managers..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <DashboardNav
        user={user}
        profile={profile}
        buildingsCount={buildings.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 lg:pb-12 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isFrench ? "Tableau de Bord" : "Dashboard"}</span>
              </Link>
              <span>/</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                {isFrench ? "Gestionnaires & Équipe" : "Managers & Team"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {isFrench ? "Gestionnaires Immobiliers Délégués" : "Delegated Property Managers"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              {isFrench
                ? "Déléguez la gestion de vos immeubles, logements, locataires et réparations avec un contrôle strict des accès par bâtiment."
                : "Delegate daily unit management, tenant records, and maintenance coordination with strict per-building access control."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs transition cursor-pointer shadow-xs"
              title={isFrench ? "Actualiser" : "Refresh"}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
            </button>

            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isFrench ? "Ajouter un Gestionnaire" : "Add Manager"}</span>
            </button>
          </div>
        </div>

        {/* Feature Notice Box */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-3.5 text-xs text-blue-900 dark:text-blue-300">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">
              {isFrench
                ? "Cloisonnement des Rôles & Ségrégation par Immeuble"
                : "Role Segregation & Building-Level Access Isolation"}
            </span>
            <p className="leading-relaxed text-blue-800/90 dark:text-blue-300/80">
              {isFrench
                ? "Vous pouvez assigner un gestionnaire à un seul immeuble, à plusieurs immeubles choisis, ou à l'ensemble de votre portefeuille. Un gestionnaire restreint n'a AUCUN accès aux autres immeubles non autorisés. Vous pouvez à tout moment révoquer l'accès d'un gestionnaire à un immeuble spécifique."
                : "You can assign a manager to a single building, multiple chosen buildings, or your entire portfolio. A restricted manager has ZERO access to unauthorized buildings. You can revoke a manager's access to any specific building at any time."}
            </p>
          </div>
        </div>

        {/* Search & Stats Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isFrench ? "Rechercher par nom, email ou téléphone..." : "Search by name, email, or phone..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition shadow-xs"
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {managers.length} {isFrench ? "gestionnaire(s) configuré(s)" : "manager(s) configured"}
          </div>
        </div>

        {/* Managers List */}
        {filteredManagers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Users className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isFrench ? "Aucun gestionnaire enregistré" : "No managers registered yet"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {isFrench
                  ? "Ajoutez un gestionnaire et définissez les immeubles auxquels il a le droit d'accéder."
                  : "Add a property manager and choose which buildings they are authorized to manage."}
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isFrench ? "Créer le Premier Gestionnaire" : "Create First Manager"}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredManagers.map((mgr) => {
              const isDeleting = deletingId === mgr.id;
              const isAllBuildings = mgr.assigned_building_ids === null || mgr.assigned_building_ids === undefined;
              const isRestrictedEmpty = Array.isArray(mgr.assigned_building_ids) && mgr.assigned_building_ids.length === 0;
              const assignedIds = Array.isArray(mgr.assigned_building_ids) ? mgr.assigned_building_ids : [];

              return (
                <div
                  key={mgr.id}
                  className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-sm transition flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-blue-600/20 shrink-0">
                          {mgr.full_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {mgr.full_name}
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-[10px] font-semibold mt-0.5">
                            <ShieldCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>{isFrench ? "Gestionnaire Délégué" : "Property Manager"}</span>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteManager(mgr.id)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                        title={isFrench ? "Supprimer le compte" : "Delete Account"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="truncate">{mgr.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{mgr.phone}</span>
                      </div>
                    </div>

                    {/* Assigned Buildings Perimeter Block */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          {isFrench ? "Périmètre Assigné" : "Assigned Scope"}
                        </span>
                        <button
                          onClick={() => handleOpenEditAssignments(mgr)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                          title={isFrench ? "Modifier ou révoquer les accès" : "Modify or revoke assignments"}
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>{isFrench ? "Gérer les accès" : "Manage Scope"}</span>
                        </button>
                      </div>

                      {isAllBuildings ? (
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-300 text-xs">
                          <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{isFrench ? "Tous les immeubles" : "All portfolio buildings"}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 font-medium">
                                {buildings.length} {isFrench ? "immeubles" : "buildings"}
                              </span>
                            </div>
                            <p className="text-[10px] text-blue-700/80 dark:text-blue-400/80 leading-tight mt-0.5">
                              {isFrench
                                ? "Accès complet à l'ensemble du parc immobilier"
                                : "Full access across all portfolio properties"}
                            </p>
                          </div>
                        </div>
                      ) : isRestrictedEmpty ? (
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-300 text-xs">
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-bold">{isFrench ? "Accès Révoqué (0 Immeuble)" : "Access Revoked (0 Buildings)"}</div>
                            <p className="text-[10px] text-rose-700/80 dark:text-rose-400/80 leading-tight mt-0.5">
                              {isFrench
                                ? "Ce gestionnaire ne peut accéder à aucun immeuble ni logement."
                                : "This manager cannot view or manage any buildings or units."}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-purple-700 dark:text-purple-300 font-semibold">
                            <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                            <span>
                              {assignedIds.length} {isFrench ? "immeuble(s) assigné(s) uniquement" : "specific building(s) only"}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                            {assignedIds.map((bId) => {
                              const b = buildings.find((bld) => bld.id === bId);
                              return (
                                <span
                                  key={bId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-[11px] font-medium text-purple-800 dark:text-purple-300"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                  <span className="truncate max-w-[130px]">
                                    {b?.name || (isFrench ? "Immeuble" : "Building")}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {isFrench ? "Créé le : " : "Added: "}
                      {new Date(mgr.created_at).toLocaleDateString()}
                    </span>

                    <a
                      href={getManagerWhatsAppUrl(mgr, "••••••••")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{isFrench ? "WhatsApp" : "WhatsApp"}</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* ADD MANAGER MODAL                                                         */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setShowAddModal(false);
            }
          }}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto my-auto select-text">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {isFrench ? "Créer un Gestionnaire" : "Create Property Manager"}
                  </h3>
                  <span className="text-[11px] text-slate-500 block">
                    {isFrench ? "Configuration des accès et assignation des immeubles" : "Access configuration and building scoping"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateManager} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isFrench ? "Nom Complet du Gestionnaire *" : "Manager Full Name *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isFrench ? "ex. Jean Dupont" : "e.g. John Doe"}
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isFrench ? "Adresse E-mail de Connexion *" : "Login Email Address *"}
                </label>
                <input
                  type="email"
                  required
                  placeholder={isFrench ? "ex. jean.dupont@gmail.com" : "e.g. john.doe@gmail.com"}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isFrench ? "Numéro de Téléphone (WhatsApp) *" : "Phone Number (WhatsApp) *"}
                </label>
                <input
                  type="tel"
                  required
                  placeholder={isFrench ? "ex. 671234567" : "e.g. 671234567"}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {isFrench ? "Mot de Passe Initial" : "Initial Password"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: generateManagerPassword() })}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {isFrench ? "Régénérer" : "Regenerate"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Building Assignment Scope Selector */}
              <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
                    {isFrench ? "Périmètre des Immeubles Assignés *" : "Assigned Buildings Scope *"}
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {createScope === "all"
                      ? isFrench ? "Tous les immeubles" : "All buildings"
                      : `${createSelectedBuildingIds.length} / ${buildings.length} ${isFrench ? "sélectionné(s)" : "selected"}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCreateScope("all")}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      createScope === "all"
                        ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Building2 className={`w-4 h-4 shrink-0 mt-0.5 ${createScope === "all" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                    <div>
                      <div className="font-bold text-xs">{isFrench ? "Tous les immeubles" : "All buildings"}</div>
                      <p className="text-[10px] opacity-80 mt-0.5 leading-snug">
                        {isFrench ? "Accès à l'ensemble du portefeuille" : "Access to full portfolio"}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreateScope("specific");
                      if (createSelectedBuildingIds.length === 0 && buildings.length > 0) {
                        setCreateSelectedBuildingIds([buildings[0].id]);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      createScope === "specific"
                        ? "border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 ring-2 ring-purple-500/20"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <SlidersHorizontal className={`w-4 h-4 shrink-0 mt-0.5 ${createScope === "specific" ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`} />
                    <div>
                      <div className="font-bold text-xs">{isFrench ? "Immeubles spécifiques" : "Specific buildings"}</div>
                      <p className="text-[10px] opacity-80 mt-0.5 leading-snug">
                        {isFrench ? "Restreindre à 1 ou plusieurs immeubles" : "Restrict to selected buildings"}
                      </p>
                    </div>
                  </button>
                </div>

                {createScope === "specific" && (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {isFrench ? "Cochez les immeubles autorisés :" : "Select authorized buildings:"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCreateSelectedBuildingIds(buildings.map((b) => b.id))}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                        >
                          {isFrench ? "Tout cocher" : "Select all"}
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setCreateSelectedBuildingIds([])}
                          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline font-semibold"
                        >
                          {isFrench ? "Tout décocher" : "Deselect all"}
                        </button>
                      </div>
                    </div>

                    {buildings.length === 0 ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 py-1">
                        {isFrench
                          ? "Vous n'avez aucun immeuble pour l'instant. Le gestionnaire sera configuré pour tous les futurs immeubles."
                          : "No buildings available. Manager will be assigned to all future properties."}
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {buildings.map((bld) => {
                          const isChecked = createSelectedBuildingIds.includes(bld.id);
                          return (
                            <div
                              key={bld.id}
                              onClick={() => {
                                setCreateSelectedBuildingIds((prev) =>
                                  isChecked ? prev.filter((id) => id !== bld.id) : [...prev, bld.id]
                                );
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                                isChecked
                                  ? "bg-purple-50/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-200"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center transition border shrink-0 ${
                                    isChecked
                                      ? "bg-purple-600 border-purple-600 text-white"
                                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                  }`}
                                >
                                  {isChecked && <Check className="w-3 h-3" />}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-semibold block truncate">{bld.name}</span>
                                  <span className="text-[10px] text-slate-500 block truncate">
                                    {bld.address}{bld.city ? `, ${bld.city}` : ""}
                                  </span>
                                </div>
                              </div>

                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 font-medium">
                                {bld.units?.length || bld.total_units || 0} {isFrench ? "logements" : "units"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {isFrench ? "Annuler" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition shadow-md shadow-blue-600/25 disabled:opacity-50 cursor-pointer"
                >
                  {submitting
                    ? isFrench ? "Création en cours..." : "Creating..."
                    : isFrench ? "Créer l'Accès" : "Create Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT / REVOKE BUILDING ASSIGNMENTS MODAL                                   */}
      {/* ========================================================================= */}
      {editingManager && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingAssignments) {
              setEditingManager(null);
            }
          }}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto my-auto select-text">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                    {isFrench ? "Gérer les Accès Immeubles" : "Manage Building Scope"}
                  </h3>
                  <span className="text-[11px] text-slate-500 truncate block">
                    {editingManager.full_name} ({editingManager.email})
                  </span>
                </div>
              </div>

              <button
                onClick={() => setEditingManager(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback notification */}
            {assignmentFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  assignmentFeedback.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                }`}
              >
                {assignmentFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{assignmentFeedback.text}</span>
              </div>
            )}

            {/* Scope selection cards */}
            <div className="space-y-3">
              <label className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
                {isFrench ? "Niveau d'Autorisation :" : "Authorization Level:"}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditScope("all")}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                    editScope === "all"
                      ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 mt-0.5 ${editScope === "all" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                  <div>
                    <div className="font-bold text-xs">{isFrench ? "Tous les immeubles" : "All portfolio buildings"}</div>
                    <p className="text-[10px] opacity-80 mt-0.5 leading-snug">
                      {isFrench
                        ? "Donne accès à tous les immeubles actuels et futurs"
                        : "Grants access to all current and future buildings"}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEditScope("specific")}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                    editScope === "specific"
                      ? "border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 ring-2 ring-purple-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <SlidersHorizontal className={`w-4 h-4 shrink-0 mt-0.5 ${editScope === "specific" ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`} />
                  <div>
                    <div className="font-bold text-xs">{isFrench ? "Immeubles spécifiques uniquement" : "Specific buildings only"}</div>
                    <p className="text-[10px] opacity-80 mt-0.5 leading-snug">
                      {isFrench
                        ? "Restreint l'accès aux seuls immeubles cochés ci-dessous"
                        : "Restricts access strictly to checked buildings below"}
                    </p>
                  </div>
                </button>
              </div>

              {/* Specific buildings list with granular REVOKE buttons */}
              {editScope === "specific" && (
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {isFrench ? "Gestion par Immeuble :" : "Per-Building Management:"}{" "}
                      <span className="text-purple-600 dark:text-purple-400 font-bold">
                        ({editSelectedBuildingIds.length} / {buildings.length} {isFrench ? "autorisé(s)" : "authorized"})
                      </span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditSelectedBuildingIds(buildings.map((b) => b.id))}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                      >
                        {isFrench ? "Tout autoriser" : "Authorize all"}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setEditSelectedBuildingIds([])}
                        className="text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                      >
                        {isFrench ? "Révoquer tous les immeubles" : "Revoke all buildings"}
                      </button>
                    </div>
                  </div>

                  {buildings.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">
                      {isFrench ? "Aucun immeuble enregistré." : "No buildings registered."}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {buildings.map((bld) => {
                        const isAuthorized = editSelectedBuildingIds.includes(bld.id);

                        return (
                          <div
                            key={bld.id}
                            className={`flex items-center justify-between p-3 rounded-xl border transition ${
                              isAuthorized
                                ? "bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-800/80 shadow-xs"
                                : "bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-75"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditSelectedBuildingIds((prev) =>
                                    isAuthorized ? prev.filter((id) => id !== bld.id) : [...prev, bld.id]
                                  );
                                }}
                                className={`w-5 h-5 rounded-md flex items-center justify-center transition border cursor-pointer shrink-0 ${
                                  isAuthorized
                                    ? "bg-purple-600 border-purple-600 text-white"
                                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                }`}
                                title={isAuthorized ? (isFrench ? "Décocher" : "Uncheck") : (isFrench ? "Cocher" : "Check")}
                              >
                                {isAuthorized && <Check className="w-3.5 h-3.5" />}
                              </button>

                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {bld.name}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {bld.address}{bld.city ? `, ${bld.city}` : ""} • {bld.units?.length || bld.total_units || 0} {isFrench ? "logements" : "units"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isAuthorized ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditSelectedBuildingIds((prev) => prev.filter((id) => id !== bld.id));
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 text-[10px] font-bold text-rose-700 dark:text-rose-300 transition cursor-pointer"
                                  title={isFrench ? "Révoquer l'accès à cet immeuble" : "Revoke access to this building"}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{isFrench ? "Révoquer l'accès" : "Revoke"}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditSelectedBuildingIds((prev) => [...prev, bld.id]);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                                  title={isFrench ? "Autoriser l'accès à cet immeuble" : "Authorize access to this building"}
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{isFrench ? "Autoriser" : "Authorize"}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingManager(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-xs"
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={savingAssignments}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition shadow-md shadow-purple-600/25 disabled:opacity-50 cursor-pointer text-xs"
              >
                {savingAssignments ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isFrench ? "Enregistrement..." : "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isFrench ? "Enregistrer les modifications" : "Save Changes"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* SUCCESS / ONBOARDING CREDENTIALS MODAL                                     */}
      {/* ========================================================================= */}
      {createdManagerData && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCreatedManagerData(null);
            }
          }}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto my-auto select-text">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {isFrench ? "Gestionnaire Créé avec Succès !" : "Manager Created Successfully!"}
                  </h3>
                  <span className="text-[11px] text-slate-500 block">
                    {isFrench ? "Partagez les identifiants d'accès ci-dessous" : "Share the login credentials below"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setCreatedManagerData(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">{isFrench ? "Nom :" : "Name:"}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {createdManagerData.manager.full_name}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">{isFrench ? "E-mail de connexion :" : "Login Email:"}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {createdManagerData.manager.email}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">{isFrench ? "Mot de passe :" : "Password:"}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  {createdManagerData.password}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">{isFrench ? "Périmètre :" : "Assigned Scope:"}</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {createdManagerData.manager.assigned_building_ids === null || createdManagerData.manager.assigned_building_ids === undefined
                    ? isFrench ? "Tous les immeubles" : "All buildings"
                    : `${createdManagerData.manager.assigned_building_ids.length} ${isFrench ? "immeuble(s) spécifique(s)" : "specific building(s)"}`}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500 font-medium">{isFrench ? "Page de connexion :" : "Login Page:"}</span>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 font-mono">/login</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <a
                href={getManagerWhatsAppUrl(createdManagerData.manager, createdManagerData.password)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>{isFrench ? "Envoyer sur WhatsApp" : "Send via WhatsApp"}</span>
              </a>

              <button
                onClick={() => {
                  const summary = `Email: ${createdManagerData.manager.email} | Mot de passe: ${createdManagerData.password}`;
                  handleCopy(summary, "new_manager_creds");
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {copiedField === "new_manager_creds" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isFrench ? "Copié !" : "Copied!"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isFrench ? "Copier" : "Copy"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
