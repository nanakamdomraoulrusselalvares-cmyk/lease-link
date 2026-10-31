"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  TenantPortalData,
  MaintenanceRequest,
  MaintenanceCategory,
  MaintenanceUrgency,
  RentPayment,
} from "@/types/database";
import {
  getTenantPortalDataByToken,
  setTenantSession,
  getTenantSession,
  clearTenantSession,
  formatWhatsAppPhoneNumber,
} from "@/lib/services/tenantService";
import {
  submitMaintenanceRequest,
  getMaintenanceRequestsForUnit,
  resolveMaintenanceRequestByTenant,
  buildMaintenanceWhatsAppUrl,
  CATEGORY_LABELS,
  URGENCY_LABELS,
  STATUS_LABELS,
} from "@/lib/services/maintenanceService";
import { getPaymentsForUnit } from "@/lib/services/paymentService";
import { uploadMediaToStorage } from "@/lib/services/storageService";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";
import RentPaymentUnderWorkModal from "@/components/RentPaymentUnderWorkModal";
import TenantNav from "@/components/TenantNav";
import SmartDataLoader from "@/components/SmartDataLoader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  Wrench,
  ArrowLeft,
  Plus,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Droplets,
  Zap,
  Home,
  Utensils,
  Camera,
  Image as ImageIcon,
  Video,
  Info,
  ShieldCheck,
  MessageCircle,
  Sparkles,
  Loader2,
} from "lucide-react";

function TenantRepairsContent() {
  const { isFrench } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [tenantData, setTenantData] = useState<TenantPortalData | null>(null);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & search state
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "in_progress" | "resolved"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showUnderWorkModal, setShowUnderWorkModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmittedRequest, setLastSubmittedRequest] =
    useState<MaintenanceRequest | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Resolution state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvedSuccessId, setResolvedSuccessId] = useState<string | null>(
    null
  );

  // New Repair Form State
  const [formCategory, setFormCategory] =
    useState<MaintenanceCategory>("plumbing");
  const [formUrgency, setFormUrgency] = useState<MaintenanceUrgency>("medium");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const [formVideo, setFormVideo] = useState<string | null>(null);
  const [formVoice, setFormVoice] = useState<string | null>(null);
  const [formVoiceDuration, setFormVoiceDuration] = useState<number | null>(
    null
  );

  const fileInputPhotoRef = useRef<HTMLInputElement | null>(null);
  const fileInputVideoRef = useRef<HTMLInputElement | null>(null);

  const loadRequests = async (unitId: string) => {
    setLoadingRequests(true);
    try {
      const list = await getMaintenanceRequestsForUnit(unitId);
      setRequests(list);
      try {
        if (typeof window !== "undefined" && Array.isArray(list)) {
          localStorage.setItem(
            "leaselink_cached_tenant_requests",
            JSON.stringify(list)
          );
        }
      } catch {
        // Storage unavailable fallback
      }
    } catch (err) {
      console.warn("Could not load maintenance requests:", err);
      try {
        if (typeof window !== "undefined") {
          const cachedR = localStorage.getItem(
            "leaselink_cached_tenant_requests"
          );
          if (cachedR) setRequests(JSON.parse(cachedR));
        }
      } catch {
        // Storage unavailable fallback
      }
    } finally {
      setLoadingRequests(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Fast Stale-While-Revalidate: load immediately from local cache if offline or available
    try {
      if (typeof window !== "undefined") {
        const cachedPortal = localStorage.getItem(
          "leaselink_cached_tenant_portal"
        );
        if (cachedPortal) {
          const parsed = JSON.parse(cachedPortal);
          if (parsed.portalData) {
            setTenantData(parsed.portalData);
            setLoading(false);
          }
        }
        const cachedRequests = localStorage.getItem(
          "leaselink_cached_tenant_requests"
        );
        if (cachedRequests) {
          const parsedR = JSON.parse(cachedRequests);
          if (Array.isArray(parsedR)) {
            setRequests(parsedR);
          }
        }
        const cachedPayments =
          localStorage.getItem("leaselink_cached_tenant_payments") ||
          localStorage.getItem("leaselink_cached_tenant_receipts");
        if (cachedPayments) {
          const parsedP = JSON.parse(cachedPayments);
          if (Array.isArray(parsedP)) {
            setPayments(parsedP);
          }
        }
      }
    } catch {
      // Storage unavailable fallback
    }

    async function init() {
      let sessionData: TenantPortalData | null = null;

      if (tokenFromUrl) {
        try {
          const res = await getTenantPortalDataByToken(tokenFromUrl);
          if (res.success && res.data) {
            sessionData = res.data;
            await setTenantSession(res.data);
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(
                  "leaselink_cached_tenant_portal",
                  JSON.stringify({
                    portalData: res.data,
                    cachedAt: Date.now(),
                  })
                );
              } catch {
                // ignore
              }
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname
              );
            }
          }
        } catch (err) {
          console.warn("Token verification warning on repairs page:", err);
        }
      }

      if (!sessionData) {
        const stored = await getTenantSession();
        if (stored && stored.portalData) {
          sessionData = stored.portalData;
        }
      }

      // Offline cache fallback
      if (!sessionData && typeof window !== "undefined") {
        try {
          const cachedPortal = localStorage.getItem(
            "leaselink_cached_tenant_portal"
          );
          if (cachedPortal) {
            const parsed = JSON.parse(cachedPortal);
            if (parsed.portalData) sessionData = parsed.portalData;
          }
        } catch {
          // ignore
        }
      }

      if (!sessionData) {
        setLoading(false);
        router.push("/tenant/login");
        return;
      }

      setTenantData(sessionData);

      const isExp = Boolean(
        sessionData.is_landlord_plan_expired ||
          (sessionData.landlord_plan_expires_at &&
            new Date(sessionData.landlord_plan_expires_at).getTime() <
              Date.now()) ||
          sessionData.landlord_plan_status === "expired"
      );
      if (isExp) {
        router.replace("/tenant/portal");
        return;
      }

      setLoading(false);

      // Load unit repairs and payments count in parallel
      loadRequests(sessionData.unit_id);
      getPaymentsForUnit(sessionData.unit_id)
        .then((unitPayments) => {
          setPayments(unitPayments);
          try {
            if (typeof window !== "undefined" && Array.isArray(unitPayments)) {
              localStorage.setItem(
                "leaselink_cached_tenant_payments",
                JSON.stringify(unitPayments)
              );
            }
          } catch {
            // ignore
          }
        })
        .catch(() => {});
    }

    init();
  }, [tokenFromUrl, router]);

  // Lock body scroll when modal or lightbox is open
  useEffect(() => {
    if (showRequestModal || previewImage || showUnderWorkModal) {
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
    } else {
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
    };
  }, [showRequestModal, previewImage, showUnderWorkModal]);

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("leaselink_cached_tenant_portal");
        localStorage.removeItem("leaselink_cached_tenant_payments");
        localStorage.removeItem("leaselink_cached_tenant_receipts");
        localStorage.removeItem("leaselink_cached_tenant_requests");
      }
    } catch {
      // Storage unavailable fallback
    }
    await clearTenantSession();
    router.push("/tenant/login?loggedOut=true");
  };

  const handleOpenModal = () => {
    setSubmitError(null);
    setLastSubmittedRequest(null);
    setFormCategory("plumbing");
    setFormUrgency("medium");
    setFormTitle("");
    setFormDescription("");
    setFormPhoto(null);
    setFormVideo(null);
    setFormVoice(null);
    setFormVoiceDuration(null);
    setShowRequestModal(true);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setSubmitError(
        isFrench
          ? "La taille de la photo doit être inférieure à 10 Mo."
          : "Photo size must be less than 10MB."
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setSubmitError(
        isFrench
          ? "La taille de la vidéo doit être inférieure à 25 Mo."
          : "Video size must be less than 25MB."
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormVideo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantData) return;

    if (!formTitle.trim()) {
      setSubmitError(
        isFrench
          ? "Veuillez saisir un titre court pour le problème."
          : "Please enter a short title for the problem."
      );
      return;
    }

    setSubmittingRequest(true);
    setSubmitError(null);

    try {
      let finalPhotoUrl = formPhoto;
      let finalVideoUrl = formVideo;
      let finalVoiceUrl = formVoice;

      if (formPhoto) {
        const photoUpload = await uploadMediaToStorage(formPhoto, "photos");
        if (photoUpload.error && !photoUpload.url) {
          setSubmitError(photoUpload.error);
          setSubmittingRequest(false);
          return;
        }
        if (photoUpload.url) finalPhotoUrl = photoUpload.url;
      }

      if (formVideo) {
        const videoUpload = await uploadMediaToStorage(formVideo, "videos");
        if (videoUpload.error && !videoUpload.url) {
          setSubmitError(videoUpload.error);
          setSubmittingRequest(false);
          return;
        }
        if (videoUpload.url) finalVideoUrl = videoUpload.url;
      }

      if (formVoice) {
        const voiceUpload = await uploadMediaToStorage(formVoice, "voices");
        if (voiceUpload.error && !voiceUpload.url) {
          setSubmitError(voiceUpload.error);
          setSubmittingRequest(false);
          return;
        }
        if (voiceUpload.url) finalVoiceUrl = voiceUpload.url;
      }

      const res = await submitMaintenanceRequest({
        unit_id: tenantData.unit_id,
        building_id: tenantData.building_id,
        landlord_id: tenantData.landlord_id,
        tenant_name: tenantData.tenant_name,
        tenant_phone: tenantData.tenant_phone,
        tenant_email: tenantData.tenant_email,
        unit_number: tenantData.unit_number,
        building_name: tenantData.building_name,
        category: formCategory,
        urgency: formUrgency,
        title: formTitle.trim(),
        description: formDescription.trim(),
        photo_url: finalPhotoUrl,
        video_url: finalVideoUrl,
        voice_url: finalVoiceUrl,
        voice_duration_seconds: formVoiceDuration,
      });

      if (!res.success || !res.request) {
        setSubmitError(
          res.error ||
            (isFrench
              ? "Échec de l'envoi de la demande. Veuillez réessayer."
              : "Failed to submit request. Please try again.")
        );
        setSubmittingRequest(false);
        return;
      }

      setLastSubmittedRequest(res.request);
      await loadRequests(tenantData.unit_id);
      setSubmittingRequest(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : isFrench
          ? "Erreur lors de l'envoi de la demande."
          : "Error submitting request.";
      setSubmitError(msg);
      setSubmittingRequest(false);
    }
  };

  const handleResolveRequest = async (requestId: string) => {
    setResolvingId(requestId);
    try {
      const activeToken = tenantData?.access_token || tokenFromUrl || "";
      const res = await resolveMaintenanceRequestByTenant(
        requestId,
        activeToken
      );
      if (res.success) {
        setRequests((prev) => {
          const updated = prev.map((r) =>
            r.id === requestId ? { ...r, status: "resolved" as const } : r
          );
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem(
                "leaselink_cached_tenant_requests",
                JSON.stringify(updated)
              );
            }
          } catch {
            // ignore
          }
          return updated;
        });
        setResolvedSuccessId(requestId);
        setTimeout(() => setResolvedSuccessId(null), 4000);
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to mark as resolved.";
      alert(msg);
    } finally {
      setResolvingId(null);
    }
  };

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );
  const inProgressCount = useMemo(
    () => requests.filter((r) => r.status === "in_progress").length,
    [requests]
  );
  const resolvedCount = useMemo(
    () => requests.filter((r) => r.status === "resolved").length,
    [requests]
  );
  const activeRepairsBadgeCount = pendingCount + inProgressCount;

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const catMeta = CATEGORY_LABELS[r.category];
        const hay = [
          r.title,
          r.description,
          r.landlord_notes,
          catMeta?.label,
          catMeta?.fr,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
        <SmartDataLoader
          label={
            isFrench
              ? "Chargement de vos demandes de réparations..."
              : "Loading your repair requests..."
          }
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!tenantData) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 text-slate-900 dark:text-white">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <AlertCircle className="w-10 h-10 text-rose-600 dark:text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isFrench ? "Authentification Requise" : "Authentication Required"}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isFrench
              ? "Veuillez vous connecter à votre espace locataire pour consulter ou soumettre vos demandes de réparations."
              : "Please log into your tenant portal to view or submit repair requests."}
          </p>
          <Link
            href="/tenant/login"
            className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-md"
          >
            {isFrench ? "Connexion Locataire" : "Go to Tenant Login"}
          </Link>
        </div>
      </div>
    );
  }

  const landlordCleanPhone = formatWhatsAppPhoneNumber(
    tenantData.landlord_phone
  );
  const portalUrl = tokenFromUrl
    ? `/tenant/portal?token=${tokenFromUrl}`
    : `/tenant/portal`;

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-amber-500 selection:text-white">
      {/* Unified Tenant Navigation Bar (Desktop Tabs + Mobile Phone Bottom Bar) */}
      <TenantNav
        data={tenantData}
        paymentsCount={payments.length}
        pendingRepairsCount={activeRepairsBadgeCount}
        tokenFromUrl={tokenFromUrl}
        onLogout={handleLogout}
        onPayRentClick={() => setShowUnderWorkModal(true)}
        onRequestRepairClick={handleOpenModal}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 pb-24 xl:pb-12">
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href={portalUrl}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>
              {isFrench ? "Retour à l'Accueil" : "Back to Overview"}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              loadRequests(tenantData.unit_id);
            }}
            disabled={refreshing || loadingRequests}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                refreshing || loadingRequests
                  ? "animate-spin text-amber-600 dark:text-amber-400"
                  : ""
              }`}
            />
            <span>{isFrench ? "Actualiser" : "Refresh"}</span>
          </button>
        </div>

        {/* Dedicated Repairs Hero Banner */}
        <div className="bg-gradient-to-r from-amber-50 via-white to-orange-50/40 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-5 sm:p-7 shadow-sm dark:shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-300 dark:border-amber-500/30">
                <Wrench className="w-3.5 h-3.5" />
                <span>
                  {isFrench
                    ? "Espace Dédié aux Réparations & Interventions"
                    : "Dedicated Repairs & Maintenance Center"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {isFrench
                  ? "Mes Demandes de Réparations"
                  : "My Repair Requests"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {isFrench ? "Résidence :" : "Residence:"}{" "}
                <strong className="text-slate-900 dark:text-white">
                  {tenantData.building_name}
                </strong>{" "}
                • {isFrench ? "Logement :" : "Unit:"}{" "}
                <strong className="text-amber-600 dark:text-amber-400">
                  {tenantData.unit_number}
                </strong>
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-amber-600/25 transition cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isFrench
                  ? "Nouvelle Réparation"
                  : "Request New Repair"}
              </span>
            </button>
          </div>
        </div>

        {/* 4-Card Repair KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                {isFrench ? "Total Demandes" : "Total Requests"}
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {requests.length}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                {isFrench ? "En Attente" : "Pending"}
              </span>
              <span className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">
                {pendingCount}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                {isFrench ? "En Cours" : "In Progress"}
              </span>
              <span className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">
                {inProgressCount}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                {isFrench ? "Résolues" : "Resolved"}
              </span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                {resolvedCount}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              {
                id: "all" as const,
                label: isFrench
                  ? `Toutes (${requests.length})`
                  : `All (${requests.length})`,
              },
              {
                id: "pending" as const,
                label: isFrench
                  ? `En attente (${pendingCount})`
                  : `Pending (${pendingCount})`,
              },
              {
                id: "in_progress" as const,
                label: isFrench
                  ? `En cours (${inProgressCount})`
                  : `In Progress (${inProgressCount})`,
              },
              {
                id: "resolved" as const,
                label: isFrench
                  ? `Résolues (${resolvedCount})`
                  : `Resolved (${resolvedCount})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isFrench
                  ? "Rechercher une réparation..."
                  : "Search your repair requests..."
              }
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* Reparations List Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          {loadingRequests && requests.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              <span>
                {isFrench
                  ? "Chargement de l'historique de vos réparations..."
                  : "Loading your repair requests history..."}
              </span>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isFrench
                  ? "Aucune Demande de Réparation Enregistrée"
                  : "No Repair Requests Submitted Yet"}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {isFrench
                  ? "En cas de fuite de plomberie, panne d'électricité, serrure ou autre dégât dans votre logement, cliquez ci-dessous pour envoyer une demande avec photo, vidéo ou note vocale à votre bailleur."
                  : "If you experience a plumbing leak, electrical outage, lock issue, or other defect in your apartment, tap below to send a request with photo, video, or voice note to your landlord."}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {isFrench
                      ? "Demander une Réparation"
                      : "Submit Your First Repair Request"}
                  </span>
                </button>
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {isFrench
                  ? "Aucune demande ne correspond à ce filtre."
                  : "No repair requests match your current filter."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                {isFrench ? "Réinitialiser les filtres" : "Reset filters"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((req) => {
                const statusMeta =
                  STATUS_LABELS[req.status] || STATUS_LABELS.pending;
                const categoryMeta =
                  CATEGORY_LABELS[req.category] || CATEGORY_LABELS.other;
                const urgencyMeta =
                  URGENCY_LABELS[req.urgency] || URGENCY_LABELS.medium;

                return (
                  <div
                    key={req.id}
                    className="bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 transition hover:border-slate-300 dark:hover:border-slate-700/90"
                  >
                    {/* Header: Title + Status & Urgency Badges */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.badgeClass}`}
                          >
                            {isFrench ? statusMeta.fr : statusMeta.label}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${urgencyMeta.badgeClass}`}
                          >
                            {isFrench ? urgencyMeta.fr : urgencyMeta.label}
                          </span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 font-medium">
                            {isFrench ? categoryMeta.fr : categoryMeta.label}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          {req.title}
                        </h3>
                      </div>

                      <span className="text-[11px] text-slate-500 flex items-center gap-1 shrink-0 font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(req.created_at).toLocaleDateString(
                          isFrench ? "fr-FR" : "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </span>
                    </div>

                    {/* Description */}
                    {req.description && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60">
                        {req.description}
                      </p>
                    )}

                    {/* Attachments (Photo, Video, Voice) */}
                    {(req.photo_url || req.video_url || req.voice_url) && (
                      <div className="pt-1 space-y-2.5">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          {isFrench ? "Pièces Jointes :" : "Attached Media:"}
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {req.photo_url && (
                            <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 max-h-48">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={req.photo_url}
                                alt="Issue attachment"
                                className="w-full h-36 object-cover cursor-pointer hover:opacity-90 transition"
                                onClick={() =>
                                  setPreviewImage(req.photo_url || null)
                                }
                              />
                              <div className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-[10px] text-slate-700 dark:text-slate-300 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                                <span className="flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                                  <span>
                                    {isFrench
                                      ? "Photo jointe"
                                      : "Photo attached"}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage(req.photo_url || null)
                                  }
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold cursor-pointer"
                                >
                                  {isFrench ? "Agrandir" : "Zoom"}
                                </button>
                              </div>
                            </div>
                          )}

                          {req.video_url && (
                            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                              <video
                                src={req.video_url}
                                controls
                                className="w-full h-36 object-cover bg-black"
                              />
                              <div className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-[10px] text-slate-700 dark:text-slate-300 flex items-center gap-1 border-t border-slate-200 dark:border-slate-800">
                                <Video className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                <span>
                                  {isFrench ? "Vidéo jointe" : "Video attached"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {req.voice_url && (
                          <AudioPlayer
                            src={req.voice_url}
                            durationSeconds={req.voice_duration_seconds}
                            label={
                              isFrench
                                ? "Message Vocal du Locataire"
                                : "Tenant Voice Message"
                            }
                          />
                        )}
                      </div>
                    )}

                    {/* Landlord / Technician Update Notes */}
                    {req.landlord_notes && (
                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                        <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>
                            {isFrench
                              ? "Mise à jour du Bailleur / Technicien :"
                              : "Landlord / Technician Update:"}
                          </span>
                        </span>
                        <p className="text-slate-700 dark:text-slate-200 italic pl-5">
                          {req.landlord_notes}
                        </p>
                      </div>
                    )}

                    {/* Tenant Resolution & WhatsApp Follow-Up Bar */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2.5">
                      {req.status === "resolved" ? (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {isFrench
                              ? "Cette réparation a été confirmée comme résolue par vous."
                              : "This repair has been confirmed as resolved by you."}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>
                                {isFrench
                                  ? "Le problème est-il réglé ?"
                                  : "Has the issue been fixed?"}
                              </span>
                            </span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                              {isFrench
                                ? "Vous êtes le seul habilité à valider la fin des travaux dans votre logement."
                                : "You are the only person who can confirm that repairs in your unit are complete."}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {landlordCleanPhone && (
                              <a
                                href={
                                  buildMaintenanceWhatsAppUrl(
                                    req,
                                    tenantData.landlord_phone,
                                    isFrench ? "fr" : "en"
                                  ).url
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 text-xs font-semibold transition cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            )}

                            <button
                              type="button"
                              disabled={resolvingId === req.id}
                              onClick={() => handleResolveRequest(req.id)}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                            >
                              {resolvingId === req.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>
                                    {isFrench
                                      ? "Validation..."
                                      : "Confirming..."}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>
                                    {isFrench
                                      ? "Marquer comme Résolu"
                                      : "Mark as Resolved"}
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {resolvedSuccessId === req.id && (
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {isFrench
                              ? "Statut mis à jour : Résolu avec succès !"
                              : "Status updated: Resolved successfully!"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: Submit New Reparation Request */}
      {showRequestModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingRequest) {
              setShowRequestModal(false);
            }
          }}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
            <div className="relative w-full max-w-xl my-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] h-auto min-h-0 select-text">
              {/* Modal Header */}
              <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-600/20 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {isFrench
                        ? "Signaler une Réparation / Panne"
                        : "Submit Repair Request"}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {isFrench ? "Logement :" : "Apartment:"}{" "}
                      <strong className="text-slate-900 dark:text-slate-200">
                        {tenantData.unit_number}
                      </strong>{" "}
                      • {tenantData.building_name}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  disabled={submittingRequest}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title={isFrench ? "Fermer" : "Close"}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Post-Submit Confirmation View */}
              {lastSubmittedRequest ? (
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(100dvh-8rem)] overscroll-contain">
                  <div className="text-center space-y-2 p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-500/30">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {isFrench
                        ? "Demande Envoyée avec Succès !"
                        : "Request Sent Successfully!"}
                    </h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                      {isFrench
                        ? `Votre demande de réparation pour "${lastSubmittedRequest.title}" a bien été enregistrée et ajoutée à votre liste.`
                        : `Your repair request for "${lastSubmittedRequest.title}" has been recorded and added to your list.`}
                    </p>
                  </div>

                  {landlordCleanPhone && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {isFrench
                              ? "Accélérer l'intervention via WhatsApp"
                              : "Speed Up Intervention via WhatsApp"}
                          </span>
                          <span className="text-slate-600 dark:text-slate-400">
                            {isFrench
                              ? "Transmettez un récapitulatif pré-rempli directement à votre bailleur sur WhatsApp."
                              : "Send a pre-filled summary directly to your landlord on WhatsApp."}
                          </span>
                        </div>
                      </div>

                      <a
                        href={
                          buildMaintenanceWhatsAppUrl(
                            lastSubmittedRequest,
                            tenantData.landlord_phone,
                            isFrench ? "fr" : "en"
                          ).url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 fill-white" />
                        <span>
                          {isFrench
                            ? "Aviser le Bailleur sur WhatsApp"
                            : "Notify Landlord on WhatsApp"}
                        </span>
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleOpenModal}
                      className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                    >
                      {isFrench
                        ? "Faire une autre demande"
                        : "Submit Another Repair"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRequestModal(false)}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-white transition cursor-pointer"
                    >
                      {isFrench ? "Voir mes réparations" : "View My Repairs"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Repair Request Form */
                <form
                  onSubmit={handleSubmitMaintenance}
                  className="flex flex-col flex-1 min-h-0 overflow-hidden"
                >
                  <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
                    {submitError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    {/* 1. Category Picker */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        {isFrench
                          ? "Catégorie du Problème"
                          : "Problem Category"}{" "}
                        <span className="text-rose-500 dark:text-rose-400">
                          *
                        </span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(
                          Object.keys(CATEGORY_LABELS) as MaintenanceCategory[]
                        ).map((cat) => {
                          const meta = CATEGORY_LABELS[cat];
                          const isSelected = formCategory === cat;
                          return (
                            <button
                              type="button"
                              key={cat}
                              onClick={() => setFormCategory(cat)}
                              className={`p-2.5 rounded-xl text-left border transition text-xs flex items-center gap-2 cursor-pointer ${
                                isSelected
                                  ? "bg-amber-500/20 border-amber-500 text-amber-900 dark:text-white font-bold"
                                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                              }`}
                            >
                              <span className="text-amber-500 dark:text-amber-400 shrink-0">
                                {cat === "plumbing" && (
                                  <Droplets className="w-4 h-4" />
                                )}
                                {cat === "electrical" && (
                                  <Zap className="w-4 h-4" />
                                )}
                                {cat === "structural" && (
                                  <Home className="w-4 h-4" />
                                )}
                                {cat === "appliances" && (
                                  <Utensils className="w-4 h-4" />
                                )}
                                {cat === "carpentry_locks" && (
                                  <Wrench className="w-4 h-4" />
                                )}
                                {cat === "other" && (
                                  <AlertCircle className="w-4 h-4" />
                                )}
                              </span>
                              <span className="truncate">
                                {isFrench ? meta.fr : meta.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Urgency Selector */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        {isFrench ? "Niveau d'Urgence" : "Urgency Level"}{" "}
                        <span className="text-rose-500 dark:text-rose-400">
                          *
                        </span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(
                          Object.keys(URGENCY_LABELS) as MaintenanceUrgency[]
                        ).map((urg) => {
                          const meta = URGENCY_LABELS[urg];
                          const isSelected = formUrgency === urg;
                          return (
                            <button
                              type="button"
                              key={urg}
                              onClick={() => setFormUrgency(urg)}
                              className={`p-2 rounded-xl text-center border transition text-xs font-semibold cursor-pointer ${
                                isSelected
                                  ? `${meta.badgeClass} ring-2 ring-amber-500/50`
                                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                              }`}
                            >
                              {isFrench ? meta.fr : meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Title */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        {isFrench
                          ? "Titre / Objet Court du Problème"
                          : "Issue Summary / Short Title"}{" "}
                        <span className="text-rose-500 dark:text-rose-400">
                          *
                        </span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={
                          isFrench
                            ? "ex. Fuite d'eau sous l'évier, Disjoncteur qui saute..."
                            : "e.g. Water leak under sink, Breaker tripping..."
                        }
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                      />
                    </div>

                    {/* 4. Description */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        {isFrench
                          ? "Description Détaillée du Problème"
                          : "Detailed Description"}
                      </label>
                      <textarea
                        rows={3}
                        placeholder={
                          isFrench
                            ? "Décrivez quand le problème a commencé, où il se situe et ce qu'il empêche d'utiliser..."
                            : "Describe when the issue started, where it is located, and how it impacts your apartment..."
                        }
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                      />
                    </div>

                    {/* 5. Voice Recording Module */}
                    <VoiceRecorder
                      onAudioReady={(dataUrl, duration) => {
                        setFormVoice(dataUrl);
                        setFormVoiceDuration(duration);
                      }}
                      onAudioCleared={() => {
                        setFormVoice(null);
                        setFormVoiceDuration(null);
                      }}
                      existingAudioUrl={formVoice}
                      existingDuration={formVoiceDuration}
                    />

                    {/* 6. Media Uploads (Photo & Video) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>
                              {isFrench ? "Joindre une Photo" : "Attach Photo"}
                            </span>
                          </span>
                          {formPhoto && (
                            <button
                              type="button"
                              onClick={() => setFormPhoto(null)}
                              className="text-[10px] text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              {isFrench ? "Supprimer" : "Remove"}
                            </button>
                          )}
                        </div>

                        {formPhoto ? (
                          <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={formPhoto}
                              alt="Preview"
                              className="w-full h-24 object-cover"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputPhotoRef.current?.click()}
                            className="w-full py-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700/80 hover:border-blue-500/50 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <ImageIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            <span>
                              {isFrench
                                ? "Prendre une photo ou importer"
                                : "Take Photo or Upload"}
                            </span>
                          </button>
                        )}

                        <input
                          ref={fileInputPhotoRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoFileChange}
                        />
                      </div>

                      <div className="bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              {isFrench
                                ? "Joindre une Vidéo"
                                : "Attach Video Clip"}
                            </span>
                          </span>
                          {formVideo && (
                            <button
                              type="button"
                              onClick={() => setFormVideo(null)}
                              className="text-[10px] text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              {isFrench ? "Supprimer" : "Remove"}
                            </button>
                          )}
                        </div>

                        {formVideo ? (
                          <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                            <video
                              src={formVideo}
                              controls
                              className="w-full h-24 object-cover bg-black"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputVideoRef.current?.click()}
                            className="w-full py-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700/80 hover:border-emerald-500/50 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <Video className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <span>
                              {isFrench
                                ? "Filmer ou importer une vidéo"
                                : "Record or Upload Video"}
                            </span>
                          </button>
                        )}

                        <input
                          ref={fileInputVideoRef}
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={handleVideoFileChange}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-3.5 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-50/95 dark:bg-slate-900/95 sticky bottom-0 z-10 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setShowRequestModal(false)}
                      disabled={submittingRequest}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                    >
                      {isFrench ? "Annuler" : "Cancel"}
                    </button>

                    <button
                      type="submit"
                      disabled={submittingRequest}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/30 transition disabled:opacity-50 cursor-pointer"
                    >
                      {submittingRequest ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            {isFrench
                              ? "Envoi en cours..."
                              : "Sending Request..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <Wrench className="w-3.5 h-3.5" />
                          <span>
                            {isFrench
                              ? "Soumettre la Demande"
                              : "Submit Repair Request"}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Photo Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Full preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Rent Payment Under Work Modal */}
      <RentPaymentUnderWorkModal
        isOpen={showUnderWorkModal}
        onClose={() => setShowUnderWorkModal(false)}
        landlordName={tenantData.landlord_name}
        landlordPhone={tenantData.landlord_phone}
        buildingName={tenantData.building_name}
        unitNumber={tenantData.unit_number}
      />
    </div>
  );
}

export default function TenantRepairsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <TenantRepairsContent />
    </Suspense>
  );
}

