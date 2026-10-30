"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  TenantPortalData,
  RentPayment,
} from "@/types/database";
import {
  getTenantPortalDataByToken,
  getTenantSession,
  clearTenantSession,
} from "@/lib/services/tenantService";
import {
  getPaymentsForUnit,
  getCurrentRentMonth,
  PAYMENT_METHOD_LABELS,
} from "@/lib/services/paymentService";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import PayRentModal from "@/components/PayRentModal";
import RentPaymentUnderWorkModal from "@/components/RentPaymentUnderWorkModal";
import TenantNav from "@/components/TenantNav";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  Receipt,
  ArrowLeft,
  Calendar,
  Building2,
  DollarSign,
  Download,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  ShieldCheck,
  AlertCircle,
  Eye,
  FileText,
  Lock,
} from "lucide-react";

function TenantReceiptsContent() {
  const { isFrench, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [tenantData, setTenantData] = useState<TenantPortalData | null>(null);
  const [payments, setPayments] = useState<RentPayment[]>([]);

  // Modals state
  const [selectedReceipt, setSelectedReceipt] = useState<RentPayment | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showUnderWorkModal, setShowUnderWorkModal] = useState(false);

  useEffect(() => {
    // Fast Stale-While-Revalidate: load immediately from local cache if offline or available
    try {
      if (typeof window !== "undefined") {
        const cachedPortal = localStorage.getItem("leaselink_cached_tenant_portal");
        if (cachedPortal) {
          const parsed = JSON.parse(cachedPortal);
          if (parsed.portalData) setTenantData(parsed.portalData);
        }
        const cachedReceipts =
          localStorage.getItem("leaselink_cached_tenant_receipts") ||
          localStorage.getItem("leaselink_cached_tenant_payments");
        if (cachedReceipts) {
          const parsedR = JSON.parse(cachedReceipts);
          if (Array.isArray(parsedR) && parsedR.length > 0) {
            setPayments(parsedR);
            setLoading(false);
          }
        }
      }
    } catch {
      // Storage unavailable fallback
    }

    async function init() {
      setLoading(true);
      let sessionData: TenantPortalData | null = null;

      if (tokenFromUrl) {
        const res = await getTenantPortalDataByToken(tokenFromUrl);
        if (res.success && res.data) {
          sessionData = res.data;
        }
      }

      if (!sessionData) {
        const stored = await getTenantSession();
        if (stored) {
          sessionData = stored.portalData;
        }
      }

      // Fallback to local cache if offline
      if (!sessionData && typeof window !== "undefined") {
        try {
          const cachedPortal = localStorage.getItem("leaselink_cached_tenant_portal");
          if (cachedPortal) {
            const parsed = JSON.parse(cachedPortal);
            if (parsed.portalData) sessionData = parsed.portalData;
          }
        } catch {
          // Ignore
        }
      }

      if (sessionData) {
        setTenantData(sessionData);
        const isExp = Boolean(
          sessionData.is_landlord_plan_expired ||
          (sessionData.landlord_plan_expires_at && new Date(sessionData.landlord_plan_expires_at).getTime() < Date.now()) ||
          sessionData.landlord_plan_status === "expired"
        );
        if (isExp) {
          router.replace("/tenant/portal");
          return;
        }
        try {
          const unitPayments = await getPaymentsForUnit(sessionData.unit_id);
          setPayments(unitPayments);
          try {
            if (typeof window !== "undefined" && Array.isArray(unitPayments)) {
              localStorage.setItem("leaselink_cached_tenant_receipts", JSON.stringify(unitPayments));
            }
          } catch {
            // Storage unavailable fallback
          }
        } catch (fetchErr) {
          console.warn("Could not fetch remote receipts, using local cache:", fetchErr);
        }
      }

      setLoading(false);
    }

    init();
  }, [tokenFromUrl, router]);

  const refreshPayments = async () => {
    if (tenantData) {
      try {
        const unitPayments = await getPaymentsForUnit(tenantData.unit_id);
        setPayments(unitPayments);
        try {
          if (typeof window !== "undefined" && Array.isArray(unitPayments)) {
            localStorage.setItem("leaselink_cached_tenant_receipts", JSON.stringify(unitPayments));
          }
        } catch {
          // Storage unavailable fallback
        }
      } catch (err) {
        console.warn("Could not refresh receipts:", err);
      }
    }
  };

  const handleOpenReceipt = (payment: RentPayment) => {
    setSelectedReceipt(payment);
    setShowReceiptModal(true);
  };

  const handlePaymentSuccess = async (newPayment: RentPayment) => {
    await refreshPayments();
    setSelectedReceipt(newPayment);
    setShowReceiptModal(true);
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("leaselink_cached_tenant_receipts");
      }
    } catch {
      // Storage unavailable fallback
    }
    await clearTenantSession();
    router.push("/tenant/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isFrench ? "Chargement de votre archive de quittances..." : "Loading your receipts archive..."}
          </p>
        </div>
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
              ? "Veuillez vous connecter à votre espace locataire ou utiliser votre lien direct pour consulter vos quittances de loyer."
              : "Please log into your tenant portal or use your direct magic link to view your payment receipts."}
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

  const currentMonth = getCurrentRentMonth();
  const monthlyRent = Number(tenantData.rent_amount || 0);

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
  const totalAllTimePaid = payments.reduce(
    (sum, p) => sum + Number(p.amount_paid || 0),
    0
  );

  const portalUrl = tokenFromUrl
    ? `/tenant/portal?token=${tokenFromUrl}`
    : `/tenant/portal`;

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Unified SaaS Tenant Navigation Bar (Desktop Segmented Tabs + Mobile Bottom Bar + Floating Notification) */}
      <TenantNav
        data={tenantData}
        paymentsCount={payments.length}
        tokenFromUrl={tokenFromUrl}
        onLogout={handleLogout}
        onPayRentClick={() => setShowUnderWorkModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 sm:space-y-8 pb-24 xl:pb-12">
        {/* Breadcrumb / Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href={portalUrl}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isFrench ? "Retour au Tableau de Bord" : "Back to Overview"}</span>
          </Link>
        </div>
        {/* Title & Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-emerald-50/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-6 sm:p-7 shadow-sm dark:shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 text-xs font-bold border border-emerald-300 dark:border-emerald-500/20">
                <Receipt className="w-3.5 h-3.5" />
                <span>
                  {isFrench ? "Archive Officielle des Quittances Numériques" : "Official Digital Receipts Archive"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {isFrench ? "Mes Quittances de Loyer" : "My Payment Receipts"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                {isFrench ? "Résidence :" : "Residence:"} <strong className="text-slate-900 dark:text-white">{tenantData.building_name}</strong> •{" "}
                {isFrench ? "Logement :" : "Unit:"}{" "}
                <strong className="text-emerald-600 dark:text-emerald-400">{tenantData.unit_number}</strong>
              </p>
            </div>

            <button
              onClick={() => setShowUnderWorkModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shadow-md transition cursor-pointer self-start sm:self-auto"
              title={isFrench ? "Paiement en ligne temporairement en travaux" : "Online payment under work"}
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>{isFrench ? "Payer le Loyer 🔒 (En travaux)" : "Pay Rent 🔒 (Work in Progress)"}</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold ml-1">
                {isFrench ? "En travaux" : "Under work"}
              </span>
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isFrench ? `Loyer Mensuel (${currentMonth})` : `Monthly Rent (${currentMonth})`}
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {monthlyRent.toLocaleString()} XAF
            </span>
            <span className="text-[10px] text-slate-500 block">
              {isFrench ? "Montant mensuel convenu" : "Agreed rental fee per month"}
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isFrench ? "Payé Ce Mois" : "Paid This Month"}
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {paidThisMonth.toLocaleString()} XAF
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400/80 font-medium block">
              {paidThisMonth >= monthlyRent
                ? isFrench
                  ? "Soldé à 100% pour ce mois"
                  : "100% Settled for this month"
                : isFrench
                ? `${((paidThisMonth / monthlyRent) * 100).toFixed(0)}% réglé`
                : `${((paidThisMonth / monthlyRent) * 100).toFixed(0)}% completed`}
            </span>
          </div>

          <div
            className={`border rounded-2xl p-4.5 space-y-1 shadow-sm ${
              balanceOwing > 0
                ? "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/30"
                : "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30"
            }`}
          >
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {isFrench ? "Reste à Payer (Solde)" : "Current Balance Owing"}
            </span>
            <span
              className={`text-xl font-black font-mono ${
                balanceOwing > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {balanceOwing.toLocaleString()} XAF
            </span>
            <span
              className={`text-[10px] font-medium block ${
                balanceOwing > 0 ? "text-amber-800 dark:text-amber-300/80" : "text-emerald-800 dark:text-emerald-400/80"
              }`}
            >
              {balanceOwing > 0
                ? isFrench
                  ? "Paiement partiel en attente"
                  : "Pending partial payment"
                : isFrench
                ? "À jour de tout paiement"
                : "All fees up to date"}
            </span>
          </div>
        </div>

        {/* Receipts List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isFrench
                    ? `Historique des Paiements & Quittances Téléchargeables (${payments.length})`
                    : `Payment History & Downloadable Receipts (${payments.length})`}
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {isFrench
                    ? "Cliquez sur une quittance pour afficher et télécharger votre reçu officiel tamponné"
                    : "Click any receipt to view and download your official stamped proof of payment"}
                </p>
              </div>
            </div>

            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono font-medium">
              {isFrench
                ? `Total Enregistré : ${totalAllTimePaid.toLocaleString()} XAF`
                : `Total Recorded: ${totalAllTimePaid.toLocaleString()} XAF`}
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isFrench ? "Aucune Quittance Trouvée" : "No Receipts Found Yet"}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                {isFrench
                  ? "Vous n'avez pas encore enregistré de paiement pour ce logement. Dès qu'un paiement de loyer est enregistré, votre quittance officielle sera téléchargeable ici."
                  : "You have not recorded any rent payments for this unit yet. Once a payment is recorded, your official receipt will be downloadable here."}
              </p>
              <button
                onClick={() => setShowUnderWorkModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 dark:bg-slate-800 text-white text-xs font-semibold border border-slate-700 shadow-md transition cursor-pointer"
                title={isFrench ? "Paiement en travaux" : "Payment under development"}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isFrench ? "Payer le Loyer 🔒 (En travaux)" : "Pay Rent 🔒 (Under Work)"}</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {payments.map((p) => {
                const methodMeta =
                  PAYMENT_METHOD_LABELS[p.payment_method] ||
                  PAYMENT_METHOD_LABELS.momo;

                const isFull = p.payment_type === "full";

                return (
                  <div
                    key={p.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:bg-slate-50 dark:hover:bg-slate-950/40 p-3 rounded-xl"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {p.receipt_number}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isFull
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30"
                              : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/30"
                          }`}
                        >
                          {isFull
                            ? isFrench
                              ? "Paiement Intégral"
                              : "Full Payment"
                            : isFrench
                            ? "Paiement Partiel"
                            : "Partial Payment"}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${methodMeta.badgeClass}`}
                        >
                          {isFrench ? (methodMeta.frShort || methodMeta.short) : methodMeta.short}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span>
                          {isFrench ? "Période :" : "Period:"} <strong className="text-slate-900 dark:text-white">{p.rent_month}</strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(p.created_at).toLocaleDateString(isFrench ? "fr-FR" : "en-US")}
                        </span>
                      </div>

                      {p.balance_remaining > 0 && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400/90 font-medium">
                          {isFrench
                            ? `Solde restant après cette opération : ${Number(p.balance_remaining).toLocaleString()} XAF`
                            : `Remaining balance after this transaction: ${Number(p.balance_remaining).toLocaleString()} XAF`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                          {isFrench ? "Montant Payé" : "Amount Paid"}
                        </span>
                        <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                          {Number(p.amount_paid).toLocaleString()} XAF
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenReceipt(p)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{isFrench ? "Voir & Télécharger" : "View & Download"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Pay Rent Modal */}
      <PayRentModal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        tenantData={tenantData}
        previouslyPaidInMonth={paidThisMonth}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Payment Receipt Modal */}
      <PaymentReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        payment={selectedReceipt}
        landlordPhone={tenantData.landlord_phone}
        landlordName={tenantData.landlord_name}
      />

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

export default function TenantReceiptsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <TenantReceiptsContent />
    </Suspense>
  );
}
