"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  TenantPortalData,
  MaintenanceRequest,
  RentPayment,
} from "@/types/database";
import {
  getTenantPortalDataByToken,
  setTenantSession,
  getTenantSession,
  clearTenantSession,
  formatWhatsAppPhoneNumber,
} from "@/lib/services/tenantService";
import { getMaintenanceRequestsForUnit } from "@/lib/services/maintenanceService";
import {
  getPaymentsForUnit,
  getCurrentRentMonth,
  PAYMENT_METHOD_LABELS,
} from "@/lib/services/paymentService";
import PayRentModal from "@/components/PayRentModal";
import RentPaymentUnderWorkModal from "@/components/RentPaymentUnderWorkModal";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import TenantNav from "@/components/TenantNav";
import SmartDataLoader from "@/components/SmartDataLoader";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
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
  Sparkles,
  RefreshCw,
  MapPin,
  Clock,
  Lock,
} from "lucide-react";

function TenantPortalContent() {
  const { isFrench } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TenantPortalData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Maintenance Requests State (kept solely for navbar pending badge count)
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);

  // Rent Payments State
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showUnderWorkModal, setShowUnderWorkModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<RentPayment | null>(null);

  const loadRequests = async (unitId: string) => {
    try {
      const list = await getMaintenanceRequestsForUnit(unitId);
      setRequests(list);
      try {
        if (typeof window !== "undefined" && Array.isArray(list)) {
          localStorage.setItem("leaselink_cached_tenant_requests", JSON.stringify(list));
        }
      } catch {
        // Storage unavailable fallback
      }
    } catch (err) {
      console.warn("Could not load maintenance requests:", err);
      try {
        if (typeof window !== "undefined") {
          const cachedR = localStorage.getItem("leaselink_cached_tenant_requests");
          if (cachedR) setRequests(JSON.parse(cachedR));
        }
      } catch {
        // Storage unavailable fallback
      }
    }
  };

  const loadPayments = async (unitId: string) => {
    try {
      const list = await getPaymentsForUnit(unitId);
      setPayments(list);
      try {
        if (typeof window !== "undefined" && Array.isArray(list)) {
          localStorage.setItem("leaselink_cached_tenant_payments", JSON.stringify(list));
        }
      } catch {
        // Storage unavailable fallback
      }
    } catch (err) {
      console.warn("Could not load rent payments:", err);
      try {
        if (typeof window !== "undefined") {
          const cachedP = localStorage.getItem("leaselink_cached_tenant_payments");
          if (cachedP) setPayments(JSON.parse(cachedP));
        }
      } catch {
        // Storage unavailable fallback
      }
    }
  };

  useEffect(() => {
    // Fast Stale-While-Revalidate: load immediately from local cache if offline or available
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("leaselink_cached_tenant_portal");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.portalData) {
            setData(parsed.portalData);
            setLoading(false);
            const cachedP = localStorage.getItem("leaselink_cached_tenant_payments");
            if (cachedP) setPayments(JSON.parse(cachedP));
            const cachedR = localStorage.getItem("leaselink_cached_tenant_requests");
            if (cachedR) setRequests(JSON.parse(cachedR));
          }
        }
      }
    } catch {
      // Storage unavailable fallback
    }

    async function initSession() {
      setLoading(true);
      setErrorMsg(null);

      // 1. If direct magic link token is provided in URL
      if (tokenFromUrl) {
        try {
          const res = await getTenantPortalDataByToken(tokenFromUrl);
          if (res.success && res.data) {
            setData(res.data);
            try {
              if (typeof window !== "undefined") {
                localStorage.setItem(
                  "leaselink_cached_tenant_portal",
                  JSON.stringify({ portalData: res.data, cachedAt: Date.now() })
                );
              }
            } catch {
              // Storage unavailable fallback
            }
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
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "leaselink_cached_tenant_portal",
              JSON.stringify({ portalData: existingSession.portalData, cachedAt: Date.now() })
            );
          }
        } catch {
          // Storage unavailable fallback
        }
        loadRequests(existingSession.portalData.unit_id);
        loadPayments(existingSession.portalData.unit_id);
        setLoading(false);
        return;
      }

      // 3. Not authenticated -> Redirect to tenant login only if not offline with cached data
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const hasCached = typeof window !== "undefined" && localStorage.getItem("leaselink_cached_tenant_portal");
        if (hasCached) {
          setLoading(false);
          return;
        }
      }

      router.push("/tenant/login");
    }

    initSession();
  }, [tokenFromUrl, router]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showPayModal || showReceiptModal) {
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
  }, [showPayModal, showReceiptModal]);

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("leaselink_cached_tenant_portal");
        localStorage.removeItem("leaselink_cached_tenant_payments");
        localStorage.removeItem("leaselink_cached_tenant_requests");
      }
    } catch {
      // Storage unavailable fallback
    }
    await clearTenantSession();
    router.push("/tenant/login?loggedOut=true");
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
  const totalPaidAllTime = payments.reduce(
    (sum, p) => sum + Number(p.amount_paid || 0),
    0
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
                title={isFrench ? "Paiement en ligne temporairement en travaux" : "Online payment under work"}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isFrench ? "Payer le Loyer 🔒" : "Pay Rent 🔒"}</span>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {isFrench ? "En travaux" : "Under work"}
                </span>
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

          {/* Metric 4: Cumulative Rent Paid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isFrench ? "Total Réglé" : "Total Paid"}
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono truncate">
              {totalPaidAllTime.toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-500">XAF</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {payments.length > 0
                ? isFrench
                  ? `${payments.length} quittance${payments.length > 1 ? "s" : ""} officielle${payments.length > 1 ? "s" : ""}`
                  : `${payments.length} official receipt${payments.length > 1 ? "s" : ""}`
                : isFrench
                ? "Aucun paiement enregistré"
                : "No payments recorded yet"}
            </div>
          </div>
        </div>

        {/* 2-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left 2 Cols: Rent Ledger & Unit Specs */}
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
                        ? "Ligne directe WhatsApp et téléphone avec votre bailleur."
                        : "Direct WhatsApp and phone communication with your landlord."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

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
