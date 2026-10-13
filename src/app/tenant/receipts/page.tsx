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
} from "@/lib/services/tenantService";
import {
  getPaymentsForUnit,
  getCurrentRentMonth,
  PAYMENT_METHOD_LABELS,
} from "@/lib/services/paymentService";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import PayRentModal from "@/components/PayRentModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import NotificationBell from "@/components/NotificationBell";
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

  useEffect(() => {
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
        const stored = getTenantSession();
        if (stored) {
          sessionData = stored.portalData;
        }
      }

      if (sessionData) {
        setTenantData(sessionData);
        const unitPayments = await getPaymentsForUnit(sessionData.unit_id);
        setPayments(unitPayments);
      }

      setLoading(false);
    }

    init();
  }, [tokenFromUrl]);

  const refreshPayments = async () => {
    if (tenantData) {
      const unitPayments = await getPaymentsForUnit(tenantData.unit_id);
      setPayments(unitPayments);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
          <p className="text-sm text-slate-400">
            {isFrench ? "Chargement de votre archive de quittances..." : "Loading your receipts archive..."}
          </p>
        </div>
      </div>
    );
  }

  if (!tenantData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">
            {isFrench ? "Authentification Requise" : "Authentication Required"}
          </h2>
          <p className="text-xs text-slate-400">
            {isFrench
              ? "Veuillez vous connecter à votre espace locataire ou utiliser votre lien direct pour consulter vos quittances de loyer."
              : "Please log into your tenant portal or use your direct magic link to view your payment receipts."}
          </p>
          <Link
            href="/tenant/login"
            className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href={portalUrl}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isFrench ? "Retour à l'Espace Locataire" : "Return to Tenant Space"}</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
              {tenantData.tenant_name} • {isFrench ? "Logement" : "Unit"} {tenantData.unit_number}
            </span>

            <LanguageSwitcher variant="pill" />
            <ThemeSwitcher variant="pill" />

            <NotificationBell
              role="tenant"
              buildingId={tenantData.building_id}
              unitId={tenantData.unit_id}
              tenantName={tenantData.tenant_name}
            />

            <button
              onClick={() => setShowPayModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFrench ? "Payer le Loyer (Démo)" : "Pay Rent (Demo)"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Title & Banner */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-7 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                <Receipt className="w-3.5 h-3.5" />
                <span>
                  {isFrench ? "Archive Officielle des Quittances Numériques" : "Official Digital Receipts Archive"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {isFrench ? "Mes Quittances de Loyer" : "My Payment Receipts"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                {isFrench ? "Résidence :" : "Residence:"} <strong>{tenantData.building_name}</strong> •{" "}
                {isFrench ? "Logement :" : "Unit:"}{" "}
                <strong className="text-emerald-400">{tenantData.unit_number}</strong>
              </p>
            </div>

            <button
              onClick={() => setShowPayModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition cursor-pointer self-start sm:self-auto"
            >
              <DollarSign className="w-4 h-4" />
              <span>{isFrench ? "Effectuer un Paiement de Loyer" : "Make a Rent Payment"}</span>
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              {isFrench ? `Loyer Mensuel (${currentMonth})` : `Monthly Rent (${currentMonth})`}
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {monthlyRent.toLocaleString()} XAF
            </span>
            <span className="text-[10px] text-slate-500 block">
              {isFrench ? "Montant mensuel convenu" : "Agreed rental fee per month"}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              {isFrench ? "Payé Ce Mois" : "Paid This Month"}
            </span>
            <span className="text-xl font-bold text-emerald-400 font-mono">
              {paidThisMonth.toLocaleString()} XAF
            </span>
            <span className="text-[10px] text-emerald-400/80 block">
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
            className={`border rounded-2xl p-4.5 space-y-1 ${
              balanceOwing > 0
                ? "bg-amber-500/5 border-amber-500/30"
                : "bg-emerald-500/5 border-emerald-500/30"
            }`}
          >
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              {isFrench ? "Reste à Payer (Solde)" : "Current Balance Owing"}
            </span>
            <span
              className={`text-xl font-black font-mono ${
                balanceOwing > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {balanceOwing.toLocaleString()} XAF
            </span>
            <span
              className={`text-[10px] block ${
                balanceOwing > 0 ? "text-amber-300/80" : "text-emerald-400/80"
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  {isFrench
                    ? `Historique des Paiements & Quittances Téléchargeables (${payments.length})`
                    : `Payment History & Downloadable Receipts (${payments.length})`}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {isFrench
                    ? "Cliquez sur une quittance pour afficher et télécharger votre reçu officiel tamponné"
                    : "Click any receipt to view and download your official stamped proof of payment"}
                </p>
              </div>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              {isFrench
                ? `Total Enregistré : ${totalAllTimePaid.toLocaleString()} XAF`
                : `Total Recorded: ${totalAllTimePaid.toLocaleString()} XAF`}
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {isFrench ? "Aucune Quittance Trouvée" : "No Receipts Found Yet"}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isFrench
                  ? "Vous n'avez pas encore enregistré de paiement pour ce logement. Cliquez ci-dessous pour effectuer un paiement démo et générer votre première quittance."
                  : "You haven't recorded any rent payments for this unit yet. Click below to make a demo rent payment and generate your first receipt."}
              </p>
              <button
                onClick={() => setShowPayModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isFrench ? "Payer le Loyer (Mode Démo)" : "Pay Rent (Demo Mode)"}</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {payments.map((p) => {
                const methodMeta =
                  PAYMENT_METHOD_LABELS[p.payment_method] ||
                  PAYMENT_METHOD_LABELS.momo;

                const isFull = p.payment_type === "full";

                return (
                  <div
                    key={p.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:bg-slate-950/40 p-3 rounded-xl"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          {p.receipt_number}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isFull
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
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

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>
                          {isFrench ? "Période :" : "Period:"} <strong className="text-white">{p.rent_month}</strong>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(p.created_at).toLocaleDateString(isFrench ? "fr-FR" : "en-US")}
                        </span>
                      </div>

                      {p.balance_remaining > 0 && (
                        <p className="text-[11px] text-amber-400/90">
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
                        <span className="text-base font-extrabold text-white font-mono">
                          {Number(p.amount_paid).toLocaleString()} XAF
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenReceipt(p)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
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
    </div>
  );
}

export default function TenantReceiptsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <TenantReceiptsContent />
    </Suspense>
  );
}
