"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  TenantPortalData,
  TenantSession,
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
  buildMaintenanceWhatsAppUrl,
  CATEGORY_LABELS,
  URGENCY_LABELS,
  STATUS_LABELS,
} from "@/lib/services/maintenanceService";
import {
  getPaymentsForUnit,
  getCurrentRentMonth,
  PAYMENT_METHOD_LABELS,
} from "@/lib/services/paymentService";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";
import PayRentModal from "@/components/PayRentModal";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import NotificationBell from "@/components/NotificationBell";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  Building2,
  Home,
  LogOut,
  Phone,
  Mail,
  User,
  Calendar,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sofa,
  Bed,
  Bath,
  Utensils,
  MessageCircle,
  Receipt,
  Wrench,
  Sparkles,
  RefreshCw,
  MapPin,
  ExternalLink,
  Plus,
  X,
  Droplets,
  Zap,
  Flame,
  AlertOctagon,
  Image as ImageIcon,
  Video,
  Mic,
  Camera,
  Trash2,
  Clock,
  Eye,
  Check,
  Info,
} from "lucide-react";

function TenantPortalContent() {
  const { isFrench, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TenantPortalData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Maintenance Requests State
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<MaintenanceRequest | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState<MaintenanceCategory>("plumbing");
  const [formUrgency, setFormUrgency] = useState<MaintenanceUrgency>("medium");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const [formVideo, setFormVideo] = useState<string | null>(null);
  const [formVoice, setFormVoice] = useState<string | null>(null);
  const [formVoiceDuration, setFormVoiceDuration] = useState<number | null>(null);

  const fileInputPhotoRef = useRef<HTMLInputElement | null>(null);
  const fileInputVideoRef = useRef<HTMLInputElement | null>(null);

  // Rent Payments State
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<RentPayment | null>(null);

  const loadRequests = async (unitId: string) => {
    setLoadingRequests(true);
    try {
      const list = await getMaintenanceRequestsForUnit(unitId);
      setRequests(list);
    } catch (err) {
      console.warn("Could not load maintenance requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadPayments = async (unitId: string) => {
    try {
      const list = await getPaymentsForUnit(unitId);
      setPayments(list);
    } catch (err) {
      console.warn("Could not load rent payments:", err);
    }
  };

  useEffect(() => {
    async function initSession() {
      setLoading(true);
      setErrorMsg(null);

      // 1. If direct magic link token is provided in URL
      if (tokenFromUrl) {
        try {
          const res = await getTenantPortalDataByToken(tokenFromUrl);
          if (res.success && res.data) {
            setData(res.data);
            setTenantSession(res.data);
            loadRequests(res.data.unit_id);
            loadPayments(res.data.unit_id);
            // Clean token from URL quietly for aesthetics
            if (typeof window !== "undefined") {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            setLoading(false);
            return;
          } else {
            setErrorMsg(res.error || "Invalid or expired access token.");
          }
        } catch (err) {
          console.error("Token verification error:", err);
          setErrorMsg("Failed to verify access link.");
        }
      }

      // 2. Check local stored session
      const existingSession = getTenantSession();
      if (existingSession && existingSession.portalData) {
        setData(existingSession.portalData);
        loadRequests(existingSession.portalData.unit_id);
        loadPayments(existingSession.portalData.unit_id);
        setLoading(false);
        return;
      }

      // 3. Not authenticated -> Redirect to tenant login
      router.push("/tenant/login");
    }

    initSession();
  }, [tokenFromUrl, router]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showRequestModal || previewImage || showPayModal || showReceiptModal) {
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
  }, [showRequestModal, previewImage, showPayModal, showReceiptModal]);

  const handleLogout = () => {
    clearTenantSession();
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
      setSubmitError("Photo size must be less than 10MB");
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
      setSubmitError("Video size must be less than 25MB");
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
    if (!data) return;

    if (!formTitle.trim()) {
      setSubmitError("Please enter a short title for the problem.");
      return;
    }

    setSubmittingRequest(true);
    setSubmitError(null);

    try {
      const res = await submitMaintenanceRequest({
        unit_id: data.unit_id,
        building_id: data.building_id,
        landlord_id: data.landlord_id,
        tenant_name: data.tenant_name,
        tenant_phone: data.tenant_phone,
        tenant_email: data.tenant_email,
        unit_number: data.unit_number,
        building_name: data.building_name,
        category: formCategory,
        urgency: formUrgency,
        title: formTitle.trim(),
        description: formDescription.trim(),
        photo_url: formPhoto,
        video_url: formVideo,
        voice_url: formVoice,
        voice_duration_seconds: formVoiceDuration,
      });

      if (!res.success || !res.request) {
        setSubmitError(res.error || "Failed to submit request. Please try again.");
        setSubmittingRequest(false);
        return;
      }

      setLastSubmittedRequest(res.request);
      await loadRequests(data.unit_id);
      setSubmittingRequest(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error submitting request";
      setSubmitError(msg);
      setSubmittingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-9 h-9 animate-spin text-blue-600 dark:text-blue-500 mx-auto" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {isFrench ? "Chargement de votre espace sécurisé locataire..." : "Loading your secure tenant space..."}
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 text-slate-900 dark:text-white">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-5 shadow-xl dark:shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-500/20">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isFrench ? "Authentification Requise" : "Authentication Required"}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              {errorMsg || (isFrench ? "Votre lien d'accès a expiré ou vous n'êtes pas connecté." : "Your access link has expired or you are not currently logged in.")}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href="/tenant/login"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white transition text-center shadow-md"
            >
              {isFrench ? "Se Connecter avec vos Identifiants" : "Sign In with Your Credentials"}
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 font-semibold transition text-center border border-slate-200 dark:border-slate-700"
            >
              {isFrench ? "Retour à l'Accueil" : "Return Home"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const landlordCleanPhone = formatWhatsAppPhoneNumber(data.landlord_phone);
  const landlordWhatsAppUrl = landlordCleanPhone
    ? `https://wa.me/${landlordCleanPhone}?text=${encodeURIComponent(
        isFrench
          ? `Bonjour, c'est ${data.tenant_name} de l'appartement ${data.unit_number} (${data.building_name}).`
          : `Hello, this is ${data.tenant_name} from unit ${data.unit_number} (${data.building_name}).`
      )}`
    : "#";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                Lease<span className="text-blue-600 dark:text-blue-500">Link</span>
              </span>
              <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold ml-2 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/20">
                {isFrench ? "Espace Locataire" : "Tenant Space"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher variant="pill" />
            <ThemeSwitcher variant="pill" />
            <NotificationBell
              role="tenant"
              buildingId={data.building_id}
              unitId={data.unit_id}
              tenantName={data.tenant_name}
            />

            <Link
              href={tokenFromUrl ? `/tenant/receipts?token=${tokenFromUrl}` : `/tenant/receipts`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition shadow-xs"
              title={isFrench ? "Consulter toutes les quittances" : "View all receipts"}
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isFrench ? `Quittances (${payments.length})` : `Receipts (${payments.length})`}</span>
            </Link>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[150px]">
                {data.tenant_name}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isFrench ? "Déconnexion" : "Sign Out"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50/50 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-6 sm:p-7 shadow-sm dark:shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 text-xs font-bold border border-emerald-300 dark:border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isFrench ? "Bail Actif • Espace Sécurisé" : "Active Tenancy • Secure Portal"}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {isFrench ? `Bienvenue chez vous, ${data.tenant_name} !` : `Welcome Home, ${data.tenant_name}!`}
              </h1>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                {isFrench ? "Résidence :" : "Residence:"} <strong className="text-slate-900 dark:text-white">{data.building_name}</strong> •{" "}
                {isFrench ? "Logement :" : "Unit:"} <strong className="text-blue-600 dark:text-blue-400">{data.unit_number}</strong>
              </p>
            </div>

            <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:text-right shrink-0 shadow-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-semibold">
                {isFrench ? "Loyer Mensuel" : "Monthly Rent"}
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {Number(data.rent_amount || 0).toLocaleString()} XAF
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Unit Specs, Living Details & Maintenance */}
          <div className="lg:col-span-2 space-y-6">
            {/* Unit Details Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {isFrench ? "Configuration & Caractéristiques" : "Your Unit Layout & Specs"}
                    </h2>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {isFrench ? "Description physique de votre logement" : "Physical breakdown of your apartment"}
                    </p>
                  </div>
                </div>

                <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                  {data.unit_number}
                </span>
              </div>

              {/* Layout Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
                  <Sofa className="w-5 h-5 text-purple-600 dark:text-purple-400 mx-auto" />
                  <span className="text-lg font-black text-slate-900 dark:text-white block">{data.parlors}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider block">
                    {isFrench ? "Salon(s)" : "Parlor(s)"}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
                  <Bed className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto" />
                  <span className="text-lg font-black text-slate-900 dark:text-white block">{data.rooms}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider block">
                    {isFrench ? "Chambre(s)" : "Bedroom(s)"}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
                  <Bath className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mx-auto" />
                  <span className="text-lg font-black text-slate-900 dark:text-white block">{data.bathrooms}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider block">
                    {isFrench ? "Salle(s) de bain" : "Bathroom(s)"}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-1">
                  <Utensils className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto" />
                  <span className="text-lg font-black text-slate-900 dark:text-white block">{data.kitchens}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider block">
                    {isFrench ? "Cuisine(s)" : "Kitchen(s)"}
                  </span>
                </div>
              </div>

              {/* Property Location */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <MapPin className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                    {isFrench ? "Emplacement du Bien" : "Property Location"}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">{data.building_name}</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                    {data.building_address}
                    {data.building_city ? `, ${data.building_city}` : ""}
                  </p>
                </div>
              </div>

              {data.notes && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                    {isFrench ? "Notes & Remarques sur le Logement" : "Apartment Notes & Features"}
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 italic">{data.notes}</p>
                </div>
              )}
            </div>

            {/* SECTION: Reparation & Maintenance Requests */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{isFrench ? "Demandes de Réparations & Travaux" : "Repairs & Maintenance Requests"}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                        {requests.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {isFrench
                        ? "Signalez les pannes de plomberie, électricité ou structure directement à votre bailleur"
                        : "Report plumbing, electrical, or structural issues directly to your landlord"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isFrench ? "Demander une Réparation" : "Request Reparation"}</span>
                </button>
              </div>

              {/* Requests List */}
              {loadingRequests ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>{isFrench ? "Chargement des tickets d'intervention..." : "Loading reparation tickets..."}</span>
                </div>
              ) : requests.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {isFrench ? "Aucun Problème Signalé" : "No Maintenance Issues Reported"}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                    {isFrench
                      ? "Tout est en ordre ! En cas de fuite, panne d'électricité ou dégât, cliquez sur le bouton ci-dessus pour avertir votre bailleur avec photo, vidéo ou message vocal."
                      : "Everything is in order! If a pipe leaks, a light fails, or something breaks, click the button above to alert your landlord with a photo, video, or voice message."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {requests.map((req) => {
                    const statusMeta = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
                    const categoryMeta = CATEGORY_LABELS[req.category] || CATEGORY_LABELS.other;
                    const urgencyMeta = URGENCY_LABELS[req.urgency] || URGENCY_LABELS.medium;

                    return (
                      <div
                        key={req.id}
                        className="bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 transition hover:border-slate-300 dark:hover:border-slate-700/90"
                      >
                        {/* Header: Title + Badges */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.badgeClass}`}
                              >
                                {isFrench ? statusMeta.fr : statusMeta.label}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgencyMeta.badgeClass}`}
                              >
                                {isFrench ? urgencyMeta.fr : urgencyMeta.label}
                              </span>
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800">
                                {isFrench ? categoryMeta.fr : categoryMeta.label}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{req.title}</h3>
                          </div>

                          <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(req.created_at).toLocaleDateString(isFrench ? "fr-FR" : "en-US")}
                          </span>
                        </div>

                        {/* Description */}
                        {req.description && (
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/60">
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
                              {/* Attached Photo */}
                              {req.photo_url && (
                                <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 max-h-48">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={req.photo_url}
                                    alt="Issue attachment"
                                    className="w-full h-36 object-cover cursor-pointer hover:opacity-90 transition"
                                    onClick={() => setPreviewImage(req.photo_url || null)}
                                  />
                                  <div className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-[10px] text-slate-700 dark:text-slate-300 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                                    <span className="flex items-center gap-1">
                                      <ImageIcon className="w-3 h-3 text-blue-500 dark:text-blue-400" />{" "}
                                      {isFrench ? "Photo jointe" : "Photo attached"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage(req.photo_url || null)}
                                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold"
                                    >
                                      {isFrench ? "Agrandir" : "Zoom"}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Attached Video */}
                              {req.video_url && (
                                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                                  <video
                                    src={req.video_url}
                                    controls
                                    className="w-full h-36 object-cover bg-black"
                                  />
                                  <div className="p-1.5 bg-white/90 dark:bg-slate-900/90 text-[10px] text-slate-700 dark:text-slate-300 flex items-center gap-1 border-t border-slate-200 dark:border-slate-800">
                                    <Video className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />{" "}
                                    {isFrench ? "Vidéo jointe" : "Video attached"}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Attached Voice Note */}
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

                        {/* Landlord Response Notes */}
                        {req.landlord_notes && (
                          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                            <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>{isFrench ? "Mise à jour du Bailleur / Technicien :" : "Landlord / Technician Update:"}</span>
                            </span>
                            <p className="text-slate-700 dark:text-slate-200 italic pl-5">{req.landlord_notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rent & Payments Ledger Card */}
            {(() => {
              const currentMonth = getCurrentRentMonth();
              const monthlyRent = Number(data.rent_amount || 0);
              const currentMonthPayments = payments.filter((p) => {
                const pMonth = p.rent_month.toLowerCase();
                const cMonth = currentMonth.toLowerCase();
                if (pMonth === cMonth || pMonth.includes(cMonth)) return true;
                if (
                  p.months_covered &&
                  p.months_covered.some((m) => m.toLowerCase() === cMonth)
                )
                  return true;
                return false;
              });
              const paidThisMonth = currentMonthPayments.reduce(
                (sum, p) => sum + Number(p.amount_paid || 0),
                0
              );
              const balanceOwing = Math.max(0, monthlyRent - paidThisMonth);
              const isFullySettled = paidThisMonth >= monthlyRent;
              const advanceMonths = Array.from(
                new Set(
                  payments.flatMap((p) =>
                    (p.months_covered || []).filter(
                      (m) => m.toLowerCase() !== currentMonth.toLowerCase()
                    )
                  )
                )
              );

              return (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          {isFrench ? "État des Loyers & Quittances" : "Rent Ledger & Receipts"}
                        </h2>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          {isFrench ? `Période : ${currentMonth}` : `Period: ${currentMonth}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                          isFullySettled
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                            : paidThisMonth > 0
                            ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                            : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
                        }`}
                      >
                        {isFullySettled
                          ? isFrench
                            ? "Statut : Soldé à 100%"
                            : "Status: Paid in Full (100%)"
                          : paidThisMonth > 0
                          ? isFrench
                            ? `Paiement Partiel • Reste ${balanceOwing.toLocaleString()} XAF`
                            : `Partial Payment • Owing ${balanceOwing.toLocaleString()} XAF`
                          : isFrench
                          ? "Statut : Impayé pour ce cycle"
                          : "Status: Unpaid for this cycle"}
                      </span>
                    </div>
                  </div>

                  {advanceMonths.length > 0 && (
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>
                        {isFrench ? "Loyer d'avance déjà réglé pour : " : "Advance rent already covered for: "}
                        <strong>{advanceMonths.join(", ")}</strong>
                      </span>
                    </div>
                  )}

                  {/* Financial Breakdown Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                        {isFrench ? "Loyer Convenu" : "Agreed Rent"}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {monthlyRent.toLocaleString()} XAF
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                        {isFrench ? "Payé Ce Mois" : "Paid This Month"}
                      </span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {paidThisMonth.toLocaleString()} XAF
                      </span>
                    </div>

                    <div
                      className={`p-3.5 rounded-xl border ${
                        balanceOwing > 0
                          ? "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/30"
                          : "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30"
                      }`}
                    >
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 uppercase font-semibold block">
                        {isFrench ? "Reste à Payer" : "Amount Owing"}
                      </span>
                      <span
                        className={`text-sm font-black font-mono ${
                          balanceOwing > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {balanceOwing > 0
                          ? `${balanceOwing.toLocaleString()} XAF`
                          : isFrench
                          ? "0 XAF (Soldé)"
                          : "0 XAF (Settled)"}
                      </span>
                    </div>
                  </div>

                  {/* Primary Rent Pay Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <button
                      onClick={() => setShowPayModal(true)}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>
                        {balanceOwing > 0
                          ? isFrench
                            ? `Payer le Loyer (Intégral ou Partiel : ${balanceOwing.toLocaleString()} XAF)`
                            : `Pay Rent (Full or Partial: ${balanceOwing.toLocaleString()} XAF)`
                          : isFrench
                          ? "Faire une Avance de Loyer"
                          : "Make an Advance Rent Payment"}
                      </span>
                    </button>

                    <Link
                      href={tokenFromUrl ? `/tenant/receipts?token=${tokenFromUrl}` : `/tenant/receipts`}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-xs font-semibold border border-slate-200 dark:border-slate-700 transition"
                    >
                      <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>
                        {isFrench
                          ? `Page Dédiée des Quittances (${payments.length})`
                          : `Dedicated Receipts Page (${payments.length})`}{" "}
                        &rarr;
                      </span>
                    </Link>
                  </div>

                  {/* Recent Receipts List */}
                  {payments.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2.5">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        {isFrench ? "Quittances Numériques Récentes :" : "Recent Digital Receipts:"}
                      </span>
                      <div className="space-y-2">
                        {payments.slice(0, 3).map((p) => (
                          <div
                            key={p.id}
                            className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  {p.receipt_number}
                                </span>
                                <span className="text-[10px] text-slate-600 dark:text-slate-400">
                                  ({p.rent_month})
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-500 block">
                                {isFrench
                                  ? `Payé par ${PAYMENT_METHOD_LABELS[p.payment_method]?.frShort || PAYMENT_METHOD_LABELS[p.payment_method]?.short || p.payment_method} le ${new Date(p.created_at).toLocaleDateString("fr-FR")}`
                                  : `Paid via ${PAYMENT_METHOD_LABELS[p.payment_method]?.short || p.payment_method} on ${new Date(p.created_at).toLocaleDateString()}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-900 dark:text-white font-mono">
                                {Number(p.amount_paid).toLocaleString()} XAF
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedReceipt(p);
                                  setShowReceiptModal(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              >
                                {isFrench ? "Voir Quittance" : "View Receipt"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right Col: Landlord Contact & Actions */}
          <div className="space-y-6">
            {/* Landlord Contact Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isFrench ? "Contact de Votre Bailleur" : "Your Landlord Contact"}
                  </h2>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {isFrench ? "Gestion du logement & assistance" : "Property management reachout"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">
                    {isFrench ? "Nom du Bailleur" : "Landlord Name"}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{data.landlord_name}</span>
                </div>

                {data.landlord_phone && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">
                        {isFrench ? "Numéro de Téléphone" : "Phone Number"}
                      </span>
                      <span className="font-mono text-slate-900 dark:text-white font-medium">{data.landlord_phone}</span>
                    </div>
                    <a
                      href={`tel:${data.landlord_phone}`}
                      className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-600/30 transition border border-blue-200 dark:border-transparent"
                      title={isFrench ? "Appeler le bailleur" : "Call Landlord"}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                )}

                {data.landlord_email && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase tracking-wider font-semibold">
                        {isFrench ? "E-mail" : "E-mail"}
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[170px]">{data.landlord_email}</span>
                    </div>
                    <a
                      href={`mailto:${data.landlord_email}`}
                      className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-600/30 transition border border-blue-200 dark:border-transparent"
                      title={isFrench ? "Envoyer un e-mail" : "Email Landlord"}
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>

              {/* Direct Actions */}
              <div className="pt-2 flex flex-col gap-2.5">
                {landlordCleanPhone && (
                  <a
                    href={landlordWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>{isFrench ? "WhatsApp Bailleur" : "WhatsApp Landlord"}</span>
                  </a>
                )}

                {data.landlord_phone && (
                  <a
                    href={`tel:${data.landlord_phone}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-xs text-slate-800 hover:text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{isFrench ? "Appel Téléphonique Direct" : "Direct Phone Call"}</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-600/20 dark:hover:bg-amber-600/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-semibold text-xs transition cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{isFrench ? "Signaler une Réparation" : "Report Maintenance Issue"}</span>
                </button>
              </div>
            </div>

            {/* Security Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-xs text-slate-600 dark:text-slate-400 space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{isFrench ? "Espace Sécurisé & Chiffré" : "Encrypted Session"}</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                {isFrench
                  ? "Vous pouvez accéder à cet espace à tout moment avec vos identifiants ou via votre lien direct reçu sur WhatsApp."
                  : "You can access this space at any moment using your email and password, or by bookmarking your direct WhatsApp access link."}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: Submit Reparation Request */}
      {showRequestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingRequest) {
              setShowRequestModal(false);
            }
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] h-auto min-h-0 select-text"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-600/20 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isFrench ? "Signaler une Réparation / Panne" : "Send Reparation Request"}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {isFrench ? "Logement :" : "Apartment:"} <strong className="text-slate-900 dark:text-slate-200">{data.unit_number}</strong> • {data.building_name}
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

            {/* Success State */}
            {lastSubmittedRequest ? (
              <div className="p-6 space-y-5 overflow-y-auto">
                <div className="text-center space-y-2 p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {isFrench ? "Demande Envoyée avec Succès !" : "Request Sent Successfully!"}
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                    {isFrench
                      ? `Votre ticket de réparation pour "${lastSubmittedRequest.title}" a bien été enregistré. Votre bailleur a été notifié.`
                      : `Your reparation ticket for "${lastSubmittedRequest.title}" has been logged. Your landlord has been notified.`}
                  </p>
                </div>

                {/* WhatsApp Direct Share Button */}
                {landlordCleanPhone && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white block">
                          {isFrench ? "Accélérer l'intervention via WhatsApp" : "Speed Up Intervention via WhatsApp"}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {isFrench
                            ? "Cliquez ci-dessous pour transmettre un récapitulatif pré-rempli directement à votre bailleur sur WhatsApp."
                            : "Click below to send a pre-filled summary directly to your landlord on WhatsApp."}
                        </span>
                      </div>
                    </div>

                    <a
                      href={buildMaintenanceWhatsAppUrl(lastSubmittedRequest, data.landlord_phone, isFrench ? "fr" : "en").url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 fill-white" />
                      <span>{isFrench ? "Aviser le Bailleur sur WhatsApp" : "Notify Landlord on WhatsApp"}</span>
                    </a>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 transition"
                  >
                    {isFrench ? "Fermer la Fenêtre" : "Close Window"}
                  </button>
                </div>
              </div>
            ) : (
              /* Request Form */
              <form onSubmit={handleSubmitMaintenance} className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
                      {isFrench ? "Catégorie du Problème" : "Problem Category"} <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(Object.keys(CATEGORY_LABELS) as MaintenanceCategory[]).map((cat) => {
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
                              {cat === "plumbing" && <Droplets className="w-4 h-4" />}
                              {cat === "electrical" && <Zap className="w-4 h-4" />}
                              {cat === "structural" && <Home className="w-4 h-4" />}
                              {cat === "appliances" && <Utensils className="w-4 h-4" />}
                              {cat === "carpentry_locks" && <Wrench className="w-4 h-4" />}
                              {cat === "other" && <AlertCircle className="w-4 h-4" />}
                            </span>
                            <span className="truncate">{isFrench ? meta.fr : meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Urgency Selector */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      {isFrench ? "Niveau d'Urgence" : "Urgency Level"} <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.keys(URGENCY_LABELS) as MaintenanceUrgency[]).map((urg) => {
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
                      {isFrench ? "Titre / Objet Court du Problème" : "Issue Summary / Short Title"}{" "}
                      <span className="text-rose-500 dark:text-rose-400">*</span>
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
                      {isFrench ? "Description Détaillée du Problème" : "Detailed Description"}
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
                    {/* Photo Upload */}
                    <div className="bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{isFrench ? "Joindre une Photo" : "Attach Photo"}</span>
                        </span>
                        {formPhoto && (
                          <button
                            type="button"
                            onClick={() => setFormPhoto(null)}
                            className="text-[10px] text-rose-500 dark:text-rose-400 hover:underline"
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
                          <span>{isFrench ? "Prendre une photo ou importer" : "Take Photo or Upload"}</span>
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

                    {/* Video Upload */}
                    <div className="bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{isFrench ? "Joindre une Vidéo" : "Attach Video Clip"}</span>
                        </span>
                        {formVideo && (
                          <button
                            type="button"
                            onClick={() => setFormVideo(null)}
                            className="text-[10px] text-rose-500 dark:text-rose-400 hover:underline"
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
                          <span>{isFrench ? "Filmer ou importer une vidéo" : "Record or Upload Video"}</span>
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
                <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-50/95 dark:bg-slate-900/95">
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
                        <span>{isFrench ? "Envoi en cours..." : "Sending Request..."}</span>
                      </>
                    ) : (
                      <>
                        <Wrench className="w-3.5 h-3.5" />
                        <span>{isFrench ? "Soumettre la Demande" : "Submit Reparation Request"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
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
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pay Rent Modal */}
      {data && (
        <PayRentModal
          isOpen={showPayModal}
          onClose={() => setShowPayModal(false)}
          tenantData={data}
          previouslyPaidInMonth={payments
            .filter(
              (p) =>
                p.rent_month.toLowerCase() ===
                getCurrentRentMonth().toLowerCase()
            )
            .reduce((s, p) => s + Number(p.amount_paid || 0), 0)}
          onPaymentSuccess={async (newPayment) => {
            await loadPayments(data.unit_id);
            setSelectedReceipt(newPayment);
            setShowReceiptModal(true);
          }}
        />
      )}

      {/* Payment Receipt Modal */}
      {data && (
        <PaymentReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          payment={selectedReceipt}
          landlordPhone={data.landlord_phone}
          landlordName={data.landlord_name}
        />
      )}
    </div>
  );
}

export default function TenantPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <TenantPortalContent />
    </Suspense>
  );
}
