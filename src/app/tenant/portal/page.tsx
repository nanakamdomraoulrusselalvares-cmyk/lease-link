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
  resolveMaintenanceRequestByTenant,
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
import RentPaymentUnderWorkModal from "@/components/RentPaymentUnderWorkModal";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import TenantNav from "@/components/TenantNav";
import SmartDataLoader from "@/components/SmartDataLoader";
import { uploadMediaToStorage } from "@/lib/services/storageService";
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
  ShieldAlert,
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
  Loader2,
  Lock,
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
  const [showUnderWorkModal, setShowUnderWorkModal] = useState(false);
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

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolvedSuccessId, setResolvedSuccessId] = useState<string | null>(null);

  const handleResolveRequest = async (requestId: string) => {
    setResolvingId(requestId);
    try {
      const activeToken = data?.access_token || tokenFromUrl || "";
      const res = await resolveMaintenanceRequestByTenant(requestId, activeToken);
      if (res.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: "resolved" } : r))
        );
        setResolvedSuccessId(requestId);
        setTimeout(() => setResolvedSuccessId(null), 4000);
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err: any) {
      console.error("Error resolving request:", err);
      alert(err?.message || "Failed to mark as resolved.");
    } finally {
      setResolvingId(null);
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
            await setTenantSession(res.data);
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

      // 2. Check secure HttpOnly cookie session
      const existingSession = await getTenantSession();
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

  const handleLogout = async () => {
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
      // Upload media files to Supabase Storage bucket if present
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
        photo_url: finalPhotoUrl,
        video_url: finalVideoUrl,
        voice_url: finalVoiceUrl,
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
        <SmartDataLoader
          label={isFrench ? "Chargement de votre espace sécurisé locataire..." : "Loading your secure tenant space..."}
          onRetry={() => {
            setLoading(true);
            if (tokenFromUrl) {
              getTenantPortalDataByToken(tokenFromUrl).then((res) => {
                if (res.data) setData(res.data);
                setLoading(false);
              });
            }
          }}
        />
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 text-slate-900 dark:text-white">
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

  // Check if the landlord's subscription days limit has been reached
  const isLandlordPlanExpired = Boolean(
    data.is_landlord_plan_expired ||
    (data.landlord_plan_expires_at && new Date(data.landlord_plan_expires_at).getTime() < Date.now()) ||
    data.landlord_plan_status === "expired"
  );

  if (isLandlordPlanExpired) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-purple-600 selection:text-white">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{isFrench ? "Accès Espace Locataire en Pause" : "Tenant Portal On Hold"}</span>
            </div>

            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {isFrench
                ? "Abonnement du Bailleur en Attente de Renouvellement"
                : "Landlord Plan Pending Renewal"}
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              {data.building_name} • Lot {data.unit_number}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-left text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-3">
            <p>
              {isFrench
                ? "Votre bailleur n'a pas encore procédé au renouvellement de son forfait LeaseLink."
                : "Your landlord has not yet renewed their LeaseLink platform subscription."}
            </p>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 text-xs font-medium flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                {isFrench
                  ? "Soyez pleinement rassuré(e) : l'ensemble de vos données locatives, quittances et historiques de paiement sont précieusement et en toute sécurité conservées. L'accès à votre espace sera automatiquement rétabli dès que votre bailleur aura régularisé son abonnement."
                  : "Rest assured: all your tenancy records, leases, receipts, and payment history are securely saved. Access will be automatically restored once your landlord renews their subscription."}
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {landlordWhatsAppUrl !== "#" && (
              <a
                href={`https://wa.me/${landlordCleanPhone}?text=${encodeURIComponent(
                  isFrench
                    ? `Bonjour ${data.landlord_name}, mon espace locataire LeaseLink (${data.building_name} Lot ${data.unit_number}) indique que votre abonnement est en attente de renouvellement. Merci de bien vouloir le régulariser pour réactiver nos accès.`
                    : `Hello ${data.landlord_name}, my LeaseLink tenant portal (${data.building_name} Unit ${data.unit_number}) indicates your subscription is pending renewal. Please renew to restore our portal access.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isFrench ? "Informer mon Bailleur via WhatsApp" : "Notify Landlord via WhatsApp"}</span>
              </a>
            )}

            <div className="flex items-center justify-center gap-4 text-xs pt-1">
              <button
                onClick={() => window.location.reload()}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isFrench ? "Actualiser" : "Refresh"}</span>
              </button>
              <button
                onClick={handleLogout}
                className="text-rose-500 hover:text-rose-600 inline-flex items-center gap-1 font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isFrench ? "Déconnexion" : "Sign Out"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Financial calculations for Rent Ledger and Metric Cards
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
  const pendingRequestsCount = requests.filter(
    (r) => r.status === "pending" || r.status === "in_progress"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Unified SaaS Tenant Navigation Bar (Desktop Segmented Tabs + Mobile Bottom Bar + Floating Notification) */}
      <TenantNav
        data={data}
        paymentsCount={payments.length}
        pendingRepairsCount={pendingRequestsCount}
        tokenFromUrl={tokenFromUrl}
        onLogout={handleLogout}
        onPayRentClick={() => setShowUnderWorkModal(true)}
        onRequestRepairClick={handleOpenModal}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 sm:space-y-8 pb-24 xl:pb-12">
        {/* Welcome Hero Banner (Styled as in Landlord Page) */}
        <div id="overview" className="bg-gradient-to-r from-blue-50 via-white to-indigo-50/40 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border border-blue-200 dark:border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-sm dark:shadow-xl relative overflow-hidden scroll-mt-24">
          <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
            <Sparkles className="w-48 h-48 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isFrench ? "Bail Actif • Espace Sécurisé" : "Active Tenancy • Secure Portal"}</span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {isFrench ? `Bienvenue chez vous, ${data.tenant_name} !` : `Welcome Home, ${data.tenant_name}!`}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  {isFrench ? "Résidence :" : "Residence:"}{" "}
                  <strong className="text-slate-900 dark:text-white font-semibold">{data.building_name}</strong>
                </span>
                <span>•</span>
                <span>
                  {isFrench ? "Logement :" : "Unit:"}{" "}
                  <strong className="text-blue-600 dark:text-blue-400 font-semibold">{data.unit_number}</strong>
                </span>
                <span>•</span>
                <span>
                  {isFrench ? "Loyer Mensuel :" : "Monthly Rent:"}{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                    {monthlyRent.toLocaleString()} XAF
                  </strong>
                </span>
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowUnderWorkModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-white text-xs font-bold border border-slate-700 dark:border-slate-700 shadow-md transition cursor-pointer"
                title={isFrench ? "Paiement en travaux (Cliquez pour en savoir plus)" : "Payment under work (Click to view details)"}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isFrench ? "Payer le Loyer 🔒" : "Pay Rent 🔒"}</span>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {isFrench ? "En travaux" : "Under work"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isFrench ? "Signaler une Réparation" : "Report Maintenance"}</span>
              </button>

              <Link
                href={tokenFromUrl ? `/tenant/receipts?token=${tokenFromUrl}` : `/tenant/receipts`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition shadow-xs"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{isFrench ? `Quittances (${payments.length})` : `Receipts (${payments.length})`}</span>
              </Link>

              {landlordCleanPhone && (
                <a
                  href={landlordWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30 transition cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-emerald-600 dark:fill-emerald-400" />
                  <span>{isFrench ? "WhatsApp Bailleur" : "WhatsApp Landlord"}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 4-Card Metric Highlights Strip (Organized exactly as in Landlord Dashboard) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Monthly Rent */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isFrench ? "Loyer Mensuel" : "Monthly Rent"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {monthlyRent.toLocaleString()} <span className="text-xs font-normal text-slate-500">XAF</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{isFrench ? "Échéance : 5 de chaque mois" : "Due on 5th monthly"}</span>
            </div>
          </div>

          {/* Metric 2: Rent Status for Current Cycle */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                {isFrench ? `Cycle : ${currentMonth}` : `Cycle: ${currentMonth}`}
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  isFullySettled
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                    : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                }`}
              >
                {isFullySettled ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </div>
            </div>
            <div
              className={`text-xl sm:text-2xl font-black font-mono truncate ${
                isFullySettled ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {isFullySettled
                ? isFrench
                  ? "Soldé à 100%"
                  : "Paid in Full"
                : isFrench
                ? `Reste ${balanceOwing.toLocaleString()} XAF`
                : `Owing ${balanceOwing.toLocaleString()} XAF`}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Receipt className="w-3 h-3 text-slate-400" />
              <span>
                {payments.length} {isFrench ? "quittances enregistrées" : "receipts recorded"}
              </span>
            </div>
          </div>

          {/* Metric 3: Assigned Unit Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isFrench ? "Logement Assigné" : "Assigned Unit"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
                <Home className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
              {data.unit_number}{" "}
              <span className="text-xs font-normal text-slate-500">({data.building_name})</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {data.parlors} {isFrench ? "Salon" : "Parlor"} • {data.rooms}{" "}
              {isFrench ? "Chambres" : "Rooms"} • {data.bathrooms}{" "}
              {isFrench ? "SDB" : "Baths"}
            </div>
          </div>

          {/* Metric 4: Technical Assistance & Repairs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isFrench ? "Assistance Technique" : "Maintenance Support"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-500/20">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {requests.length}{" "}
              <span className="text-xs font-normal text-slate-500">
                {isFrench ? "Demandes" : "Tickets"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {pendingRequestsCount > 0
                ? isFrench
                  ? `${pendingRequestsCount} en cours de traitement`
                  : `${pendingRequestsCount} under review`
                : isFrench
                ? "Aucune panne en attente"
                : "All tickets resolved"}
            </div>
          </div>
        </div>

        {/* 2-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left 2 Cols: Rent Ledger, Unit Specs, Repairs */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8">
            {/* CARD 1: Rent Ledger & Receipts (Core Financial Priority) */}
            <div id="rent" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 scroll-mt-24">
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
                      {isFrench ? `Période active : ${currentMonth}` : `Active Period: ${currentMonth}`}
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

              {/* Financial Breakdown Grid (Landlord Dashboard Style) */}
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
                      balanceOwing > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-emerald-700 dark:text-emerald-400"
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
                  type="button"
                  onClick={() => setShowUnderWorkModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shadow-md transition cursor-pointer"
                  title={isFrench ? "Paiement en ligne temporairement en travaux" : "Online payment under work"}
                >
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>
                    {isFrench
                      ? `Payer le Loyer 🔒 (En travaux)`
                      : `Pay Rent 🔒 (Work in Progress)`}
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold ml-1">
                    {isFrench ? "En travaux" : "Under work"}
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
                            type="button"
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

            {/* CARD 2: Unit Layout & Specs (Polished with Vibrant Landlord-Style Colored Pills) */}
            <div id="specs" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 scroll-mt-24">
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

                <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 font-bold">
                  {data.unit_number}
                </span>
              </div>

              {/* Layout Colored Cards (Matching Landlord Dashboard Quality) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-purple-50/70 dark:bg-purple-950/20 p-4 rounded-xl border-2 border-purple-200/80 dark:border-purple-500/20 text-center space-y-1">
                  <Sofa className="w-5 h-5 text-purple-600 dark:text-purple-400 mx-auto" />
                  <span className="text-xl font-black text-purple-950 dark:text-purple-200 block">{data.parlors}</span>
                  <span className="text-[10px] text-purple-800 dark:text-purple-300 font-bold uppercase tracking-wider block">
                    {isFrench ? "Salon(s)" : "Parlor(s)"}
                  </span>
                </div>

                <div className="bg-blue-50/70 dark:bg-blue-950/20 p-4 rounded-xl border-2 border-blue-200/80 dark:border-blue-500/20 text-center space-y-1">
                  <Bed className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto" />
                  <span className="text-xl font-black text-blue-950 dark:text-blue-200 block">{data.rooms}</span>
                  <span className="text-[10px] text-blue-800 dark:text-blue-300 font-bold uppercase tracking-wider block">
                    {isFrench ? "Chambre(s)" : "Bedroom(s)"}
                  </span>
                </div>

                <div className="bg-cyan-50/70 dark:bg-cyan-950/20 p-4 rounded-xl border-2 border-cyan-200/80 dark:border-cyan-500/20 text-center space-y-1">
                  <Bath className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mx-auto" />
                  <span className="text-xl font-black text-cyan-950 dark:text-cyan-200 block">{data.bathrooms}</span>
                  <span className="text-[10px] text-cyan-800 dark:text-cyan-300 font-bold uppercase tracking-wider block">
                    {isFrench ? "Salle(s) de bain" : "Bathroom(s)"}
                  </span>
                </div>

                <div className="bg-amber-50/70 dark:bg-amber-950/20 p-4 rounded-xl border-2 border-amber-200/80 dark:border-amber-500/20 text-center space-y-1">
                  <Utensils className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto" />
                  <span className="text-xl font-black text-amber-950 dark:text-amber-200 block">{data.kitchens}</span>
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wider block">
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

            {/* CARD 3: Reparation & Maintenance Requests */}
            <div id="maintenance" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 scroll-mt-24">
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

                        {/* Tenant Resolution Action Bar */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
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

                              <button
                                type="button"
                                disabled={resolvingId === req.id}
                                onClick={() => handleResolveRequest(req.id)}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer shrink-0 disabled:opacity-50"
                              >
                                {resolvingId === req.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>{isFrench ? "Validation..." : "Confirming..."}</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{isFrench ? "Marquer comme Résolu" : "Mark as Resolved"}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {resolvedSuccessId === req.id && (
                            <div className="mt-2 p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{isFrench ? "Statut mis à jour : Résolu avec succès !" : "Status updated: Resolved successfully!"}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Landlord Contact & Security Checklist */}
          <div className="space-y-6 sm:space-y-8">
            {/* Landlord Contact Card */}
            <div id="landlord" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 scroll-mt-24">
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

            {/* Tenancy Verification & Portal Security Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  {isFrench ? "Sécurité & Conformité du Bail" : "Tenancy Verification & Security"}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {isFrench ? "Bail Actif Enregistré" : "Active Tenancy Record"}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {isFrench
                        ? `Logement ${data.unit_number} certifié dans la résidence ${data.building_name}.`
                        : `Unit ${data.unit_number} verified in ${data.building_name}.`}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {isFrench ? "Quittances Chiffrées" : "Encrypted Digital Receipts"}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {isFrench
                        ? "Paiements vérifiés avec horodatage et quittances conformes."
                        : "Payments verified with cryptographic timestamps and audit log."}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block">
                      {isFrench ? "Assistance Dédiée 24/7" : "Direct Landlord Hotline"}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                      {isFrench
                        ? "Contact direct et notifications en temps réel des réparations."
                        : "Instant contact and real-time repair status updates."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: Submit Reparation Request */}
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
            <div
              className="relative w-full max-w-xl my-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] h-auto min-h-0 select-text"
            >
              {/* Modal Header */}
              <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 sticky top-0 z-10 backdrop-blur-md">
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
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(100dvh-8rem)] overscroll-contain">
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

      {/* Rent Payment Under Work Modal */}
      {data && (
        <RentPaymentUnderWorkModal
          isOpen={showUnderWorkModal}
          onClose={() => setShowUnderWorkModal(false)}
          landlordName={data.landlord_name}
          landlordPhone={data.landlord_phone}
          buildingName={data.building_name}
          unitNumber={data.unit_number}
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
