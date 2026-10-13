"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenanceCategory,
  MaintenanceUrgency,
  LandlordProfile,
} from "@/types/database";
import {
  getMaintenanceRequestsForLandlord,
  updateMaintenanceRequestStatus,
  buildLandlordReplyWhatsAppUrl,
  CATEGORY_LABELS,
  URGENCY_LABELS,
  STATUS_LABELS,
} from "@/lib/services/maintenanceService";
import { formatWhatsAppPhoneNumber } from "@/lib/services/tenantService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import DashboardNav from "@/components/DashboardNav";
import AudioPlayer from "@/components/AudioPlayer";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Building2,
  Receipt,
  Wrench,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Phone,
  MessageCircle,
  Mail,
  Camera,
  Video,
  Home,
  ArrowLeft,
  RefreshCw,
  X,
  Check,
  Info,
  Droplets,
  Zap,
} from "lucide-react";

export default function LandlordMaintenancePage() {
  const router = useRouter();
  const { isFrench, language, formatDate } = useLanguage();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Updating ticket state
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);

  // Photo Lightbox modal
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

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
        setProfile(profileData as LandlordProfile);
      }

      const list = await getMaintenanceRequestsForLandlord(authUser.id);
      setRequests(list);

      // Initialize notes state
      const notesMap: Record<string, string> = {};
      list.forEach((r) => {
        notesMap[r.id] = r.landlord_notes || "";
      });
      setEditingNotes(notesMap);
    } catch (err) {
      console.error("Error loading maintenance tickets:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleStatusChange = async (requestId: string, newStatus: MaintenanceStatus) => {
    setSavingRequestId(requestId);
    const currentNotes = editingNotes[requestId] || "";

    const res = await updateMaintenanceRequestStatus(requestId, {
      status: newStatus,
      landlord_notes: currentNotes,
    });

    if (res.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
      );
      setSaveSuccessId(requestId);
      setTimeout(() => setSaveSuccessId(null), 3000);
    }
    setSavingRequestId(null);
  };

  const handleSaveNotes = async (requestId: string) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    setSavingRequestId(requestId);
    const notesToSave = editingNotes[requestId] || "";

    const res = await updateMaintenanceRequestStatus(requestId, {
      status: req.status,
      landlord_notes: notesToSave,
    });

    if (res.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, landlord_notes: notesToSave } : r))
      );
      setSaveSuccessId(requestId);
      setTimeout(() => setSaveSuccessId(null), 3000);
    }
    setSavingRequestId(null);
  };

  // KPIs
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === "pending").length;
    const inProgress = requests.filter((r) => r.status === "in_progress").length;
    const resolved = requests.filter((r) => r.status === "resolved").length;
    const emergency = requests.filter((r) => r.urgency === "emergency" && r.status !== "resolved").length;
    return { total, pending, inProgress, resolved, emergency };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(query);
        const matchDesc = (r.description || "").toLowerCase().includes(query);
        const matchTenant = r.tenant_name.toLowerCase().includes(query);
        const matchUnit = r.unit_number.toLowerCase().includes(query);
        const matchBuilding = r.building_name.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchTenant && !matchUnit && !matchBuilding) {
          return false;
        }
      }

      // Status
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }

      // Urgency
      if (urgencyFilter !== "all" && r.urgency !== urgencyFilter) {
        return false;
      }

      // Category
      if (categoryFilter !== "all" && r.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [requests, searchQuery, statusFilter, urgencyFilter, categoryFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-xs font-semibold text-slate-400">
            {isFrench ? "Chargement des tickets d'entretien..." : "Loading maintenance tickets..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-white">
      {/* Unified SaaS Dashboard Navigation Bar */}
      <DashboardNav
        user={user}
        pendingRepairsCount={stats.pending}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24 lg:pb-12">
        {/* Emergency Alert Banner if any open critical tickets */}
        {stats.emergency > 0 && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-rose-300 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 shrink-0 text-rose-400" />
              <span className="text-xs font-bold">
                {isFrench
                  ? `Attention : Vous avez ${stats.emergency} ticket${stats.emergency > 1 ? "s" : ""} d'urgence nécessitant une intervention immédiate !`
                  : `Attention: You have ${stats.emergency} emergency maintenance ${stats.emergency === 1 ? "ticket" : "tickets"} requiring immediate intervention!`}
              </span>
            </div>
            <button
              onClick={() => setUrgencyFilter("emergency")}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold shrink-0 hover:bg-rose-500 transition cursor-pointer"
            >
              {isFrench ? "Voir Urgents" : "View Critical"}
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{isFrench ? "Total Demandes" : "Total Requests"}</span>
              <Wrench className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-white">{stats.total}</div>
            <span className="text-[10px] text-slate-500 block">
              {isFrench ? "Tous les signalements" : "All recorded issues"}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter("pending")}
            className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-1 cursor-pointer transition"
          >
            <div className="flex items-center justify-between text-xs text-amber-400">
              <span>{isFrench ? "En Attente" : "Pending Review"}</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">{stats.pending}</div>
            <span className="text-[10px] text-slate-500 block">
              {isFrench ? "Nécessite votre attention" : "Needs your attention"}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter("in_progress")}
            className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-1 cursor-pointer transition"
          >
            <div className="flex items-center justify-between text-xs text-blue-400">
              <span>{isFrench ? "En Cours" : "In Progress"}</span>
              <RefreshCw className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400">{stats.inProgress}</div>
            <span className="text-[10px] text-slate-500 block">
              {isFrench ? "Intervention en cours" : "Technician on site"}
            </span>
          </div>

          <div
            onClick={() => setStatusFilter("resolved")}
            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-1 cursor-pointer transition"
          >
            <div className="flex items-center justify-between text-xs text-emerald-400">
              <span>{isFrench ? "Résolu" : "Resolved"}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">{stats.resolved}</div>
            <span className="text-[10px] text-slate-500 block">
              {isFrench ? "Réparé et clôturé" : "Fixed and closed"}
            </span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  isFrench
                    ? "Rechercher par nom de locataire, numéro de logement, immeuble ou titre..."
                    : "Search by tenant name, unit number, property, or issue title..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 transition cursor-pointer"
              >
                <option value="all">{isFrench ? "Tous les statuts" : "All Statuses"}</option>
                <option value="pending">{isFrench ? "En attente d'examen" : "Pending Review"}</option>
                <option value="in_progress">{isFrench ? "En cours d'intervention" : "In Progress"}</option>
                <option value="resolved">{isFrench ? "Résolu" : "Resolved"}</option>
                <option value="rejected">{isFrench ? "Rejeté / Fermé" : "Rejected"}</option>
              </select>

              {/* Urgency Filter */}
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 transition cursor-pointer"
              >
                <option value="all">{isFrench ? "Toutes les urgences" : "All Urgency Levels"}</option>
                <option value="emergency">{isFrench ? "Urgence absolue (Danger)" : "Emergency (Danger)"}</option>
                <option value="high">{isFrench ? "Élevée (Urgent)" : "High (Urgent)"}</option>
                <option value="medium">{isFrench ? "Moyenne" : "Medium"}</option>
                <option value="low">{isFrench ? "Faible" : "Low"}</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 transition cursor-pointer"
              >
                <option value="all">{isFrench ? "Toutes les catégories" : "All Categories"}</option>
                <option value="plumbing">{isFrench ? "Plomberie & Fuites" : "Plumbing & Leaks"}</option>
                <option value="electrical">{isFrench ? "Électricité" : "Electrical"}</option>
                <option value="structural">{isFrench ? "Structure & Murs" : "Structure & Walls"}</option>
                <option value="appliances">{isFrench ? "Électroménager & Climatisation" : "Appliances & AC"}</option>
                <option value="carpentry_locks">{isFrench ? "Portes & Serrures" : "Doors & Locks"}</option>
                <option value="other">{isFrench ? "Autre Réparation" : "Other"}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets Grid */}
        {filteredRequests.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">
              {isFrench ? "Aucun Ticket d'Entretien Trouvé" : "No Maintenance Tickets Found"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {isFrench
                ? searchQuery || statusFilter !== "all" || urgencyFilter !== "all" || categoryFilter !== "all"
                  ? "Aucun ticket ne correspond à vos critères de filtrage. Essayez de réinitialiser les filtres."
                  : "Aucun locataire n'a signalé de problème pour le moment. Lorsqu'un locataire soumet une demande, elle apparaîtra ici avec photos, vidéos et notes vocales."
                : searchQuery || statusFilter !== "all" || urgencyFilter !== "all" || categoryFilter !== "all"
                ? "No tickets matched your filter criteria. Try resetting the filters."
                : "No tenant has reported any issues yet. When a tenant submits a repair request via their portal, it will show up here immediately with photos, videos, and voice recordings."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => {
              const statusMeta = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
              const urgencyMeta = URGENCY_LABELS[req.urgency] || URGENCY_LABELS.medium;
              const categoryMeta = CATEGORY_LABELS[req.category] || CATEGORY_LABELS.other;

              const cleanTenantPhone = formatWhatsAppPhoneNumber(req.tenant_phone);
              const tenantWhatsAppUrl = cleanTenantPhone
                ? buildLandlordReplyWhatsAppUrl(req, language).url
                : "#";

              const isSavingThis = savingRequestId === req.id;
              const isSavedJustNow = saveSuccessId === req.id;

              return (
                <div
                  key={req.id}
                  className={`bg-slate-900 border rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 transition ${
                    req.urgency === "emergency" && req.status !== "resolved"
                      ? "border-rose-500/40 bg-gradient-to-r from-rose-950/20 via-slate-900 to-slate-900"
                      : "border-slate-800 hover:border-slate-700/80"
                  }`}
                >
                  {/* Top Bar: Badges + Creation Date */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Urgency Badge */}
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${urgencyMeta.badgeClass}`}>
                        {isFrench ? urgencyMeta.fr : urgencyMeta.label}
                      </span>

                      {/* Category Badge */}
                      <span className="text-[10px] font-semibold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 flex items-center gap-1.5">
                        {req.category === "plumbing" && <Droplets className="w-3 h-3 text-cyan-400" />}
                        {req.category === "electrical" && <Zap className="w-3 h-3 text-amber-400" />}
                        {req.category === "structural" && <Home className="w-3 h-3 text-purple-400" />}
                        {req.category === "appliances" && <Wrench className="w-3 h-3 text-blue-400" />}
                        {req.category === "carpentry_locks" && <Wrench className="w-3 h-3 text-orange-400" />}
                        {req.category === "other" && <AlertTriangle className="w-3 h-3 text-slate-400" />}
                        <span>{isFrench ? categoryMeta.fr : categoryMeta.label}</span>
                      </span>

                      {/* Status Dropdown */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                          {isFrench ? "Statut :" : "Status:"}
                        </span>
                        <select
                          value={req.status}
                          disabled={isSavingThis}
                          onChange={(e) => handleStatusChange(req.id, e.target.value as MaintenanceStatus)}
                          className={`text-xs font-bold px-3 py-1 rounded-full border focus:outline-none cursor-pointer transition ${statusMeta.badgeClass}`}
                        >
                          <option value="pending" className="bg-slate-900 text-amber-400 font-semibold">
                            {isFrench ? "En Attente d'Examen" : "Pending Review"}
                          </option>
                          <option value="in_progress" className="bg-slate-900 text-blue-400 font-semibold">
                            {isFrench ? "En Cours (Intervention)" : "In Progress"}
                          </option>
                          <option value="resolved" className="bg-slate-900 text-emerald-400 font-semibold">
                            {isFrench ? "Résolu (Terminé)" : "Resolved"}
                          </option>
                          <option value="rejected" className="bg-slate-900 text-rose-400 font-semibold">
                            {isFrench ? "Rejeté / Fermé" : "Rejected / Closed"}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(req.created_at).toLocaleString(isFrench ? "fr-FR" : "en-US")}</span>
                    </div>
                  </div>

                  {/* Main Grid: Ticket Details (Left) + Tenant Reachout (Right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Left 2 Cols: Issue Content & Attachments */}
                    <div className="lg:col-span-2 space-y-3.5">
                      <div>
                        <h2 className="text-base font-bold text-white">{req.title}</h2>
                        {req.description && (
                          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                            {req.description}
                          </p>
                        )}
                      </div>

                      {/* Attachments (Photos, Videos, Voice Note) */}
                      {(req.photo_url || req.video_url || req.voice_url) && (
                        <div className="space-y-2.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            {isFrench ? "Preuves & Médias Joints :" : "Evidence & Media Attached:"}
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Photo */}
                            {req.photo_url && (
                              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={req.photo_url}
                                  alt="Tenant attachment"
                                  className="w-full h-40 object-cover cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setPreviewPhoto(req.photo_url || null)}
                                />
                                <div className="p-2 flex items-center justify-between text-[11px] text-slate-400 bg-slate-950 border-t border-slate-800">
                                  <span className="flex items-center gap-1.5">
                                    <Camera className="w-3.5 h-3.5 text-blue-400" />
                                    <span>{isFrench ? "Preuve Photo" : "Photo Evidence"}</span>
                                  </span>
                                  <button
                                    onClick={() => setPreviewPhoto(req.photo_url || null)}
                                    className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                                  >
                                    {isFrench ? "Agrandir" : "View Full Size"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Video */}
                            {req.video_url && (
                              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                                <video
                                  src={req.video_url}
                                  controls
                                  className="w-full h-40 object-cover bg-black"
                                />
                                <div className="p-2 flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950 border-t border-slate-800">
                                  <Video className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{isFrench ? "Vidéo Jointe" : "Video Clip Attached"}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Voice Note */}
                          {req.voice_url && (
                            <AudioPlayer
                              src={req.voice_url}
                              durationSeconds={req.voice_duration_seconds}
                              label={
                                isFrench
                                  ? `Message vocal de ${req.tenant_name}`
                                  : `Voice Message from ${req.tenant_name}`
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Col: Tenant Card & Direct Contact */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                          {isFrench ? "Locataire & Logement" : "Tenant & Location"}
                        </span>
                        <div className="font-bold text-white text-sm">{req.tenant_name}</div>
                        <div className="text-xs text-slate-400">
                          {isFrench ? "Logement : " : "Unit: "}{" "}
                          <strong className="text-blue-400">{req.unit_number}</strong> • {req.building_name}
                        </div>
                      </div>

                      {/* Direct Communication Buttons */}
                      <div className="space-y-2 pt-1 border-t border-slate-800">
                        {cleanTenantPhone && (
                          <a
                            href={tenantWhatsAppUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 fill-white" />
                            <span>{isFrench ? "WhatsApp Locataire" : "WhatsApp Tenant"}</span>
                          </a>
                        )}

                        {req.tenant_phone && (
                          <a
                            href={`tel:${req.tenant_phone}`}
                            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs border border-slate-800 transition"
                          >
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            <span>{isFrench ? "Appeler" : "Call"} ({req.tenant_phone})</span>
                          </a>
                        )}

                        {req.tenant_email && (
                          <a
                            href={`mailto:${req.tenant_email}`}
                            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs border border-slate-800 transition truncate"
                          >
                            <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="truncate">{req.tenant_email}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Landlord Response & Technician Notes */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          {isFrench
                            ? "Notes du Bailleur / Planning Intervention Technicien"
                            : "Landlord Intervention Notes / Technician Schedule"}
                        </span>
                      </label>

                      {isSavedJustNow && (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> {isFrench ? "Enregistré !" : "Saved!"}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        placeholder={
                          isFrench
                            ? "ex: Plombier M. Roger planifié mercredi à 10h00 (Tél: 671234567)..."
                            : "e.g. Plumber Mr. Roger scheduled for Wednesday at 10:00 AM (Tel: 671234567)..."
                        }
                        value={editingNotes[req.id] || ""}
                        onChange={(e) =>
                          setEditingNotes({
                            ...editingNotes,
                            [req.id]: e.target.value,
                          })
                        }
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                      />

                      <button
                        type="button"
                        onClick={() => handleSaveNotes(req.id)}
                        disabled={isSavingThis}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        {isSavingThis
                          ? isFrench
                            ? "Enregistrement..."
                            : "Saving..."
                          : isFrench
                          ? "Enregistrer Note"
                          : "Save Note"}
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-500">
                      {isFrench
                        ? "Les notes enregistrées ici sont immédiatement visibles par le locataire sur son portail."
                        : "Notes saved here are immediately visible to the tenant in their portal."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox Modal for Photo Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhoto}
              alt="Full preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
