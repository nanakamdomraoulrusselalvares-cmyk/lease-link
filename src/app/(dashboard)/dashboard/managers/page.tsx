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
  KeyRound,
  Trash2,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  X,
  Search,
  CheckCircle2,
  Lock,
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

  const [formData, setFormData] = useState<CreateManagerInput>({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

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

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await createManager(user.id, formData);

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

  const handleDeleteManager = async (managerId: string) => {
    if (!user) return;
    const confirmMsg = isFrench
      ? "Êtes-vous sûr de vouloir révoquer l'accès de ce gestionnaire ? Il ne pourra plus se connecter."
      : "Are you sure you want to revoke access for this manager? They will no longer be able to log in.";

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
    const text = isFrench
      ? `Bonjour ${mgr.full_name},\n\nVotre accès de Gestionnaire LeaseLink a été configuré avec succès par votre bailleur.\n\n🔑 Vos identifiants de connexion :\n• Identifiant / Email : ${mgr.email}\n• Mot de passe temporaire : ${pass}\n• Lien de connexion : ${loginUrl}\n\nVous avez accès à la gestion des logements, des fiches locataires, des réparations et au suivi des loyers impayés.`
      : `Hello ${mgr.full_name},\n\nYour LeaseLink Property Manager access has been configured by your landlord.\n\n🔑 Your login credentials:\n• Login / Email: ${mgr.email}\n• Temporary Password: ${pass}\n• Login URL: ${loginUrl}\n\nYou have access to building units, tenant records, repair coordination, and unpaid rent tracking.`;

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
                ? "Déléguez la gestion courante de vos logements, fiches locataires et réparations sans donner accès à votre comptabilité financière globale."
                : "Delegate daily unit management, tenant records, and maintenance coordination without granting access to your overall financial revenue."}
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
                ? "Privilèges & Séparation des Rôles (Manager vs Bailleur)"
                : "Privileges & Role Separation (Manager vs Landlord)"}
            </span>
            <p className="leading-relaxed text-blue-800/90 dark:text-blue-300/80">
              {isFrench
                ? "Vos gestionnaires peuvent configurer les logements, assigner les locataires, envoyer les messages d'accueil WhatsApp, traiter les pannes et voir les locataires avec loyers impayés pour enregistrer les encaissements en espèces. La page financière globale, le chiffre d'affaires et la souscription restent strictement réservés à votre compte bailleur."
                : "Your managers can configure units, assign tenants, send WhatsApp onboarding, coordinate repairs, and view tenants with unpaid rent to record on-site cash collections. Full revenue ledgers and subscription settings remain strictly restricted to your landlord account."}
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
                  ? "Ajoutez un gestionnaire pour lui donner accès à la gestion de vos logements, locataires et réparations."
                  : "Add a property manager to give them operational access to units, tenants, and repair coordination."}
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
              return (
                <div
                  key={mgr.id}
                  className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 space-y-4 shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
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
                      title={isFrench ? "Révoquer l'accès" : "Revoke Access"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{mgr.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{mgr.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>{isFrench ? "Tous les immeubles du portefeuille" : "All portfolio buildings"}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
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
                    {isFrench ? "Accès opérationnel sans comptabilité" : "Operational access without finance"}
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

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
      )}

      {/* ========================================================================= */}
      {/* SUCCESS / ONBOARDING CREDENTIALS MODAL                                     */}
      {/* ========================================================================= */}
      {createdManagerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
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
      )}
    </div>
  );
}
