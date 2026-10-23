"use client";

import { useState } from "react";
import {
  PaymentMethod,
  RentPayment,
  TenantPortalData,
} from "@/types/database";
import {
  recordRentPayment,
  getCurrentRentMonth,
  getUpcomingRentMonths,
  PAYMENT_METHOD_LABELS,
} from "@/lib/services/paymentService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  X,
  DollarSign,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Building2,
  DoorOpen,
  ArrowRight,
  Sparkles,
  Calendar,
  Plus,
  Minus,
  Lock,
} from "lucide-react";

interface PayRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantData: TenantPortalData;
  previouslyPaidInMonth?: number;
  onPaymentSuccess: (payment: RentPayment) => void;
}

// Tenants are strictly limited to Mobile Money payment methods (MTN MoMo & Orange Money)
const REAL_TENANT_PAYMENT_METHODS: PaymentMethod[] = [
  "momo",
  "orange_money",
];

export default function PayRentModal({
  isOpen,
  onClose,
  tenantData,
  previouslyPaidInMonth = 0,
  onPaymentSuccess,
}: PayRentModalProps) {
  const { language, isFrench, t, formatCurrency } = useLanguage();
  const currentMonth = getCurrentRentMonth();
  const monthlyRent = Number(tenantData.rent_amount || 0);
  const remainingDue = Math.max(0, monthlyRent - previouslyPaidInMonth);

  // Form State
  // Multi-month option: by default pays 1 month, but can add 2, 3, 6, 12 months
  const [monthsCount, setMonthsCount] = useState<number>(1);
  const [amountInput, setAmountInput] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("momo");
  const [payerPhone, setPayerPhone] = useState(tenantData.tenant_phone || "");
  const [payerNotes, setPayerNotes] = useState("");

  // Simulation State
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulationStep, setSimulationStep] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate covered months
  const targetMonths = getUpcomingRentMonths(monthsCount);
  const totalPeriodDue =
    monthsCount === 1
      ? remainingDue > 0
        ? remainingDue
        : monthlyRent
      : remainingDue + (monthsCount - 1) * monthlyRent;

  const numericAmount = parseFloat(amountInput) || 0;
  const isAdvance = totalPeriodDue > 0 && numericAmount > totalPeriodDue;
  const isFull =
    totalPeriodDue > 0 ? numericAmount >= totalPeriodDue : numericAmount > 0;
  const balanceAfter = Math.max(0, totalPeriodDue - numericAmount);

  const periodLabel =
    monthsCount === 1
      ? targetMonths[0]
      : `${targetMonths[0]} – ${targetMonths[monthsCount - 1]} (${monthsCount} ${
          isFrench ? "Mois" : "Months"
        })`;

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanAmount = parseFloat(amountInput);
    if (!cleanAmount || isNaN(cleanAmount) || cleanAmount <= 0) {
      setErrorMsg(
        isFrench
          ? "Veuillez entrer un montant supérieur à 0 XAF."
          : "Please enter a payment amount greater than 0 XAF."
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Connecting to demo payment gateway
      setSimulationStep(
        isFrench
          ? `Connexion à la passerelle de paiement ${PAYMENT_METHOD_LABELS[paymentMethod].label}...`
          : `Initiating ${PAYMENT_METHOD_LABELS[paymentMethod].label} gateway...`
      );
      await new Promise((res) => setTimeout(res, 800));

      // Step 2: Simulating USSD prompt
      if (paymentMethod === "momo" || paymentMethod === "orange_money") {
        setSimulationStep(
          isFrench
            ? `Envoi de l'invite USSD vers le numéro ${payerPhone || tenantData.tenant_phone}...`
            : `Sending USSD prompt to ${payerPhone || tenantData.tenant_phone}...`
        );
        await new Promise((res) => setTimeout(res, 900));
      } else {
        setSimulationStep(
          isFrench
            ? "Autorisation sécurisée de la transaction..."
            : "Authorizing transaction securely..."
        );
        await new Promise((res) => setTimeout(res, 900));
      }

      // Step 3: Record Payment
      setSimulationStep(
        isFrench
          ? "Paiement approuvé ! Génération de la quittance officielle..."
          : "Payment approved! Generating official receipt..."
      );
      const result = await recordRentPayment({
        unit_id: tenantData.unit_id,
        building_id: tenantData.building_id,
        landlord_id: tenantData.landlord_id,
        landlord_name: tenantData.landlord_name || null,
        tenant_name: tenantData.tenant_name,
        tenant_phone: tenantData.tenant_phone,
        tenant_email: tenantData.tenant_email,
        unit_number: tenantData.unit_number,
        building_name: tenantData.building_name,
        rent_month: periodLabel,
        months_count: monthsCount,
        months_covered: targetMonths,
        monthly_rent_amount: monthlyRent,
        amount_paid: cleanAmount,
        payment_method: paymentMethod,
        payer_phone: payerPhone,
        notes: payerNotes || null,
      });

      if (!result.success || !result.payment) {
        throw new Error(
          result.error ||
            (isFrench
              ? "Échec de la finalisation de la transaction."
              : "Failed to finalize payment transaction.")
        );
      }

      await new Promise((res) => setTimeout(res, 500));
      setIsProcessing(false);
      onPaymentSuccess(result.payment);
      onClose();
    } catch (err: unknown) {
      setIsProcessing(false);
      const msg =
        err instanceof Error
          ? err.message
          : isFrench
          ? "Échec de la simulation de paiement."
          : "Payment simulation failed";
      setErrorMsg(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden select-text animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Fixed & Pinned */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 shrink-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm">
                {isFrench ? "Payer le Loyer (Passerelle Sécurisée)" : "Pay Rent (Digital Gateway)"}
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {isFrench
                  ? `Période : ${periodLabel} • Quittance avec sceau délivrée immédiatement`
                  : `Period: ${periodLabel} • Instant Stamped Receipt Issued`}
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Processing Simulation Screen */}
        {isProcessing ? (
          <div className="p-8 sm:p-10 text-center space-y-6 overflow-y-auto">
            <div className="relative w-20 h-20 mx-auto">
              <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Smartphone className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isFrench ? "Traitement du Paiement en cours..." : "Processing Rent Payment..."}
              </h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono animate-pulse">
                {simulationStep}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto pt-2">
                {isFrench ? (
                  <>
                    Simulation du paiement de{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {numericAmount.toLocaleString()} XAF
                    </strong>{" "}
                    via {PAYMENT_METHOD_LABELS[paymentMethod].label}.
                  </>
                ) : (
                  <>
                    Simulating payment of{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {numericAmount.toLocaleString()} XAF
                    </strong>{" "}
                    via {PAYMENT_METHOD_LABELS[paymentMethod].label}.
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          /* Payment Form - Scrollable */
          <form onSubmit={handleStartPayment} className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
            {/* Rent Overview Strip */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {isFrench ? "Loyer mensuel" : "Monthly Rent Rate"}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {monthlyRent.toLocaleString()} XAF / {isFrench ? "mois" : "month"}
                </span>
                {previouslyPaidInMonth > 0 && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                    {isFrench
                      ? `Payé plus tôt ce mois : ${previouslyPaidInMonth.toLocaleString()} XAF`
                      : `Paid earlier this month: ${previouslyPaidInMonth.toLocaleString()} XAF`}
                  </span>
                )}
              </div>

              <div className="text-right space-y-0.5">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {isFrench ? `Reste pour ${currentMonth}` : `Remaining for ${currentMonth}`}
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {remainingDue.toLocaleString()} XAF
                </span>
              </div>
            </div>

            {/* MULTI-MONTH SELECTOR (Default 1 Month, with option to add future months) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>
                      {isFrench
                        ? "Pour combien de mois payez-vous ?"
                        : "How many months are you paying for?"}
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isFrench
                      ? "Par défaut 1 mois. Vous pouvez avancer 2, 3 mois ou plus."
                      : "Default is 1 month. You can advance 2, 3, or more months."}
                  </p>
                </div>

                {/* Month Stepper */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 shadow-xs">
                  <button
                    type="button"
                    disabled={monthsCount <= 1}
                    onClick={() => setMonthsCount((prev) => Math.max(1, prev - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-white flex items-center justify-center transition cursor-pointer text-xs"
                    title={isFrench ? "Diminuer d'un mois" : "Decrease month"}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-2 font-mono font-bold text-xs text-blue-600 dark:text-blue-400 min-w-[55px] text-center">
                    {monthsCount} {monthsCount === 1 ? (isFrench ? "Mois" : "Month") : (isFrench ? "Mois" : "Months")}
                  </span>
                  <button
                    type="button"
                    disabled={monthsCount >= 12}
                    onClick={() => setMonthsCount((prev) => Math.min(12, prev + 1))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-white flex items-center justify-center transition cursor-pointer text-xs"
                    title={isFrench ? "Ajouter un mois" : "Add another month"}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Quick Preset Month Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {[1, 2, 3, 6, 12].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setMonthsCount(cnt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border ${
                      monthsCount === cnt
                        ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                        : "bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {cnt === 1
                      ? isFrench
                        ? "1 Mois (Actuel)"
                        : "1 Month (Current)"
                      : `${cnt} ${isFrench ? "Mois" : "Months"}`}
                  </button>
                ))}
              </div>

              {/* Months Breakdown Banner */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isFrench ? "Période sélectionnée :" : "Selected Period:"}
                  </span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {periodLabel}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isFrench ? "Total standard exigible :" : "Total Standard Due:"}
                  </span>
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {totalPeriodDue.toLocaleString()} XAF
                  </strong>
                </div>
                {monthsCount > 1 && (
                  <div className="pt-1 text-[10px] text-blue-700 dark:text-blue-300/90 border-t border-slate-200 dark:border-slate-800/60 leading-tight">
                    {isFrench ? "Mois :" : "Months:"} {targetMonths.join(" • ")}
                  </div>
                )}
              </div>
            </div>

            {/* Amount Input: Starts empty, no arrows, accepts any sum */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>
                    {isFrench
                      ? "Entrez le montant à payer (XAF) :"
                      : "Enter Amount to Pay (XAF):"}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">*</span>
                </label>
                {amountInput && (
                  <button
                    type="button"
                    onClick={() => setAmountInput("")}
                    className="text-[10px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition cursor-pointer"
                  >
                    {isFrench ? "Effacer" : "Clear"}
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-bold">
                  XAF
                </span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={amountInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith("-")) return;
                    setAmountInput(val);
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e" || e.key === "E") {
                      e.preventDefault();
                    }
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-13 pr-4 py-2.5 text-slate-900 dark:text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition shadow-sm"
                  placeholder={
                    isFrench
                      ? `ex. ${totalPeriodDue.toLocaleString()}...`
                      : `e.g. ${totalPeriodDue.toLocaleString()}...`
                  }
                  autoFocus
                  required
                />
              </div>

              {/* Quick Fill Shortcuts based on selected months */}
              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                <span className="text-[10px] text-slate-500 font-medium mr-1">
                  {isFrench ? "Raccourcis :" : "Quick Fill:"}
                </span>
                <button
                  type="button"
                  onClick={() => setAmountInput(String(totalPeriodDue))}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-500/30 transition cursor-pointer"
                >
                  {isFrench ? "Période Complète" : "Full Period"} ({totalPeriodDue.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAmountInput(String(Math.round(totalPeriodDue / 2)))
                  }
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium border border-amber-200 dark:border-amber-500/30 transition cursor-pointer"
                >
                  50% ({Math.round(totalPeriodDue / 2).toLocaleString()})
                </button>
                {monthsCount > 1 && (
                  <button
                    type="button"
                    onClick={() => setAmountInput(String(remainingDue))}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    {isFrench ? "1 Mois Seulement" : "1 Month Only"} ({remainingDue.toLocaleString()})
                  </button>
                )}
              </div>

              {/* Dynamic live calculation feedback */}
              <div className="pt-0.5 text-[11px]">
                {!amountInput ? (
                  <p className="text-slate-500 dark:text-slate-400">
                    {isFrench
                      ? "Entrez le montant que vous souhaitez payer. Vous pouvez solder la totalité ou faire une avance partielle."
                      : "Enter the amount you wish to pay. You can settle in full or make a partial advance payment."}
                  </p>
                ) : numericAmount > 0 ? (
                  isAdvance ? (
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-0.5">
                      <p className="font-bold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        {isFrench
                          ? `Avance de loyer : Solde ${monthsCount} mois + avance ${(numericAmount - totalPeriodDue).toLocaleString()} XAF de crédit !`
                          : `Advance Rent: Settles ${monthsCount} month(s) + advances ${(numericAmount - totalPeriodDue).toLocaleString()} XAF in credit!`}
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400/80">
                        {isFrench ? (
                          <>
                            Le statut devient directement :{" "}
                            <strong className="text-slate-900 dark:text-white">Complètement Soldé</strong>.
                          </>
                        ) : (
                          <>
                            Status directly marks as{" "}
                            <strong className="text-slate-900 dark:text-white">Completely Paid</strong>.
                          </>
                        )}
                      </p>
                    </div>
                  ) : isFull ? (
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                      <p className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isFrench
                          ? `Complètement Soldé (100%) : Les ${monthsCount} mois seront intégralement réglés !`
                          : `Completely Paid (100%): All ${monthsCount} month(s) will be fully settled!`}
                      </p>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-0.5">
                      <p className="font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {isFrench
                          ? `Paiement Partiel : Paiement de ${numericAmount.toLocaleString()} XAF maintenant.`
                          : `Partially Paid: Paying ${numericAmount.toLocaleString()} XAF now.`}
                      </p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-300/80">
                        {isFrench ? (
                          <>
                            Solde restant dû :{" "}
                            <strong className="text-slate-900 dark:text-amber-200">{balanceAfter.toLocaleString()} XAF</strong>.
                            Le statut devient directement :{" "}
                            <strong className="text-slate-900 dark:text-white">Partiellement Payé</strong>.
                          </>
                        ) : (
                          <>
                            Remaining balance owing:{" "}
                            <strong className="text-slate-900 dark:text-amber-200">{balanceAfter.toLocaleString()} XAF</strong>.
                            Status directly marks as{" "}
                            <strong className="text-slate-900 dark:text-white">Partially Paid</strong>.
                          </>
                        )}
                      </p>
                    </div>
                  )
                ) : null}
              </div>
            </div>

            {/* REAL PAYMENT METHODS ONLY (No Cash) - Polished with Icons */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isFrench
                  ? "Sélectionnez le mode de paiement (Pas d'espèces) :"
                  : "Select Payment Method (Digital / Non-Cash):"}
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {REAL_TENANT_PAYMENT_METHODS.map((method) => {
                  const isSelected = paymentMethod === method;
                  const getMethodDisplay = () => {
                    switch (method) {
                      case "momo":
                        return {
                          icon: <Smartphone className="w-4 h-4 text-amber-500" />,
                          label: "MTN MoMo",
                          sub: "MTN Mobile Money",
                        };
                      case "orange_money":
                        return {
                          icon: <Smartphone className="w-4 h-4 text-orange-500" />,
                          label: "Orange Money",
                          sub: "Orange Wallet",
                        };
                      default:
                        return {
                          icon: <Smartphone className="w-4 h-4 text-blue-500" />,
                          label: method,
                          sub: "",
                        };
                    }
                  };
                  const display = getMethodDisplay();

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? "bg-blue-50 dark:bg-slate-800 border-blue-500 text-blue-700 dark:text-white ring-2 ring-blue-500/40 shadow-sm"
                          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-900 shrink-0">
                        {display.icon}
                      </div>
                      <span className="text-[11px] font-bold leading-tight">{display.label}</span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 leading-none">
                        {display.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payer Phone */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                {isFrench
                  ? "Numéro Mobile / Compte téléphone :"
                  : "Mobile Number / Account Phone:"}
              </label>
              <input
                type="tel"
                value={payerPhone}
                onChange={(e) => setPayerPhone(e.target.value)}
                placeholder="e.g. 671234567"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 shadow-sm"
                required
              />
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>

              <button
                type="button"
                disabled
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-800 text-amber-300 border border-amber-500/30 cursor-not-allowed shadow-md"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>
                  {isFrench
                    ? "Paiement en ligne indisponible (En travaux)"
                    : "Online payment unavailable (Under work)"}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
