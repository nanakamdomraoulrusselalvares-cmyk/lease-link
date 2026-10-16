"use client";

import { useState } from "react";
import {
  SubscriptionPlanId,
  BillingCycle,
  AVAILABLE_PLANS,
  PaymentMethod,
  LandlordProfile,
} from "@/types/database";
import {
  processSubscriptionPayment,
  getSubscriptionPlanPricing,
  SubscriptionPaymentRecord,
} from "@/lib/services/subscriptionService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  Sparkles,
  CheckCircle2,
  X,
  ShieldCheck,
  Building2,
  Phone,
  Layers,
  ArrowRight,
  Check,
  Download,
  Receipt,
  Clock,
  Zap,
} from "lucide-react";

interface SubscriptionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: LandlordProfile | null;
  onSubscriptionUpdated?: (updatedRecord: SubscriptionPaymentRecord) => void;
}

export default function SubscriptionPaymentModal({
  isOpen,
  onClose,
  profile,
  onSubscriptionUpdated,
}: SubscriptionPaymentModalProps) {
  const { isFrench } = useLanguage();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>("tier_1_30");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("momo");
  const [payerPhone, setPayerPhone] = useState(profile?.phone || "");
  const [payerName, setPayerName] = useState(profile?.full_name || "");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successRecord, setSuccessRecord] = useState<SubscriptionPaymentRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPricing = getSubscriptionPlanPricing(selectedPlanId, billingCycle);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const result = await processSubscriptionPayment({
        landlordId: profile.id,
        landlordName: payerName.trim() || profile.full_name,
        landlordEmail: profile.email,
        landlordPhone: payerPhone.trim() || profile.phone,
        planId: selectedPlanId,
        billingCycle,
        paymentMethod,
        payerPhone: payerPhone.trim(),
        payerName: payerName.trim(),
        notes: notes.trim(),
      });

      if (result.success && result.record) {
        setSuccessRecord(result.record);
        if (onSubscriptionUpdated) {
          onSubscriptionUpdated(result.record);
        }
      } else {
        setErrorMsg(
          result.error ||
            (isFrench
              ? "Échec du traitement du paiement d'abonnement."
              : "Failed to process subscription payment.")
        );
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setErrorMsg(err?.message || "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessRecord(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative my-auto">
        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ========================================================================= */}
        {/* SUCCESS STATE                                                             */}
        {/* ========================================================================= */}
        {successRecord ? (
          <div className="space-y-6 text-center py-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                {isFrench ? "Paiement Validé avec Succès" : "Payment Successfully Verified"}
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white pt-2">
                {isFrench ? "Votre Abonnement est Actif !" : "Your Subscription is Active!"}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                {isFrench
                  ? `Votre compte bénéficie désormais du forfait ${successRecord.plan_name}. La capacité maximale de logements a été mise à niveau.`
                  : `Your account is now activated with ${successRecord.plan_name}. Your property allowance has been updated.`}
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-left space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">{isFrench ? "N° de Quittance" : "Receipt No."}</span>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {successRecord.receipt_number}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">{isFrench ? "Formule choisie" : "Selected Plan"}</span>
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {successRecord.plan_id.replace("tier_", "").replace("_", " to ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">{isFrench ? "Période" : "Cycle"}</span>
                  <span className="font-semibold text-slate-900 dark:text-white capitalize">
                    {successRecord.billing_cycle === "annual" ? (isFrench ? "Annuel (365 Jours)" : "Annual (365 Days)") : (isFrench ? "Mensuel (30 Jours)" : "Monthly (30 Days)")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">{isFrench ? "Montant Réglé" : "Amount Paid"}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {successRecord.amount_paid.toLocaleString()} FCFA
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">{isFrench ? "Valide Jusqu'au" : "Valid Until"}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {new Date(successRecord.expires_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isFrench ? "Imprimer la Quittance" : "Print Receipt"}</span>
              </button>
              <button
                onClick={handleResetAndClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 cursor-pointer"
              >
                {isFrench ? "Retourner au Tableau de Bord" : "Return to Dashboard"}
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* SUBSCRIPTION SELECTION & PAYMENT FORM                                     */
          /* ========================================================================= */
          <form onSubmit={handlePay} className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-500" />
                  {isFrench ? "Mise à Niveau du Forfait" : "Subscription Upgrade"}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                {isFrench ? "Choisir votre Forfait & Périodicité" : "Choose Your Plan & Term"}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {isFrench
                  ? "Bénéficiez d'une capacité étendue de logements et de fonctionnalités complètes de gestion locative."
                  : "Extend your property allowance and unlock the full power of LeaseLink."}
              </p>
            </div>

            {/* Data Preservation Reassurance Badge */}
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                {isFrench ? (
                  <>
                    <strong>Données 100% conservées :</strong> La mise à niveau n'efface aucune donnée. Vos immeubles, logements, locataires, baux et historiques de paiements restent strictement intacts.
                  </>
                ) : (
                  <>
                    <strong>100% Data Preservation:</strong> Upgrading your plan never deletes any records. All your buildings, units, tenants, leases, and payment history remain completely intact.
                  </>
                )}
              </span>
            </div>

            {/* 1. Monthly vs Annual Toggle */}
            <div className="bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl flex items-center border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  billingCycle === "monthly"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{isFrench ? "Paiement Mensuel (30 Jours)" : "Monthly Billing (30 Days)"}</span>
              </button>

              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 relative ${
                  billingCycle === "annual"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{isFrench ? "Paiement Annuel (365 Jours)" : "Annual Billing (365 Days)"}</span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs ${
                    billingCycle === "annual"
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {isFrench ? "Économisez" : "Save"}
                </span>
              </button>
            </div>

            {/* 2. Plan Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {AVAILABLE_PLANS.filter((p) => !p.isFreeTrial).map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const priceLabel =
                  billingCycle === "annual" ? plan.annualPriceDisplay : plan.monthlyPriceDisplay;
                const savingsLabel =
                  billingCycle === "annual"
                    ? isFrench && plan.annualSavingsFr
                      ? plan.annualSavingsFr
                      : plan.annualSavings
                    : null;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-4 rounded-2xl border-2 transition cursor-pointer text-left relative flex flex-col justify-between ${
                      isSelected
                        ? "bg-blue-50/70 dark:bg-blue-600/10 border-blue-600 dark:border-blue-500 shadow-md ring-2 ring-blue-500/20"
                        : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {isFrench && plan.nameFr ? plan.nameFr : plan.name}
                        </span>
                        {plan.badge && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30">
                            {isFrench && plan.badgeFr ? plan.badgeFr : plan.badge}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          {priceLabel}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {billingCycle === "annual" ? (isFrench ? "/ an" : "/ yr") : (isFrench ? "/ mois" : "/ mo")}
                        </span>
                      </div>

                      {savingsLabel && (
                        <div className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {savingsLabel}
                        </div>
                      )}

                      <div className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {isFrench ? plan.unitRangeFr : plan.unitRange}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        {isFrench ? plan.targetFr : plan.target}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        {billingCycle === "annual" ? (isFrench ? "365 Jours" : "365 Days") : (isFrench ? "30 Jours" : "30 Days")}
                      </span>
                      {isSelected ? (
                        <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> {isFrench ? "Sélectionné" : "Selected"}
                        </span>
                      ) : (
                        <span className="text-slate-400">{isFrench ? "Choisir" : "Select"}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3. Payment Method - Strictly MTN MoMo and Orange Money */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                {isFrench ? "Mode de Règlement (MoMo / Orange Money)" : "Payment Method (Mobile Money Only)"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: "momo", label: "MTN Mobile Money", badge: "MTN MoMo" },
                  { id: "orange_money", label: "Orange Money", badge: "OM Wallet" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-3 ${
                      paymentMethod === m.id
                        ? "bg-blue-50 dark:bg-blue-600/10 border-blue-500 text-blue-700 dark:text-blue-300 font-bold ring-2 ring-blue-500/20"
                        : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{m.label}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{m.badge}</span>
                    </div>
                    {paymentMethod === m.id && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Phone & Contact Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  {isFrench ? "Téléphone de paiement (MoMo / Orange)" : "Payment Phone Number"}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                    placeholder="+237 6XX XXX XXX"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  {isFrench ? "Nom du Titulaire / Bailleur" : "Payer / Landlord Name"}
                </label>
                <input
                  type="text"
                  required
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="Nom complet"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Summary & Submit Action */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[11px] text-slate-500 block">
                  {isFrench ? "Total à régler :" : "Total payable:"}
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {currentPricing.priceDisplay}
                </span>
                <span className="text-xs text-slate-500 ml-1">
                  ({billingCycle === "annual" ? (isFrench ? "Facturation Annuelle" : "Annual Term") : (isFrench ? "Facturation Mensuelle" : "Monthly Term")})
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {isFrench ? "Annuler" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-1/2 sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <span>{isFrench ? "Traitement..." : "Processing..."}</span>
                  ) : (
                    <>
                      <span>{isFrench ? "Confirmer & Payer" : "Confirm & Pay"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
