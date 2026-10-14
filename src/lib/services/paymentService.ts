import { createClient } from "@/lib/supabase/client";
import {
  RentPayment,
  CreateRentPaymentInput,
  PaymentType,
  PaymentMethod,
  TenantRentStatus,
  Building,
} from "@/types/database";
import { formatWhatsAppPhoneNumber } from "./tenantService";
import { notifyPaymentReceived } from "./notificationService";

const LOCAL_STORAGE_KEY_PAYMENTS = "leaselink_local_payments";

// Helper to access localStorage safely in browser
function getLocalPayments(): RentPayment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PAYMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalPayments(payments: RentPayment[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PAYMENTS, JSON.stringify(payments));
  } catch (err) {
    console.error("Error saving local payments:", err);
  }
}

/**
 * Get standard rent month label (e.g., "October 2026")
 */
export function getCurrentRentMonth(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Return an array of sequential rent month strings starting from current or baseDate
 * e.g. count=3 -> ["October 2026", "November 2026", "December 2026"]
 */
export function getUpcomingRentMonths(count: number = 1, baseDate: Date = new Date()): string[] {
  const list: string[] = [];
  const safeCount = Math.max(1, Math.min(24, count));
  for (let i = 0; i < safeCount; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
    list.push(d.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
  }
  return list;
}

/**
 * Format payment method into human-readable label
 */
export const PAYMENT_METHOD_LABELS: Record<
  PaymentMethod,
  { label: string; short: string; badgeClass: string; fr: string; frShort: string }
> = {
  momo: {
    label: "MTN Mobile Money",
    short: "MTN MoMo",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    fr: "MTN Mobile Money",
    frShort: "MTN MoMo",
  },
  orange_money: {
    label: "Orange Money",
    short: "Orange Money",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    fr: "Orange Money",
    frShort: "Orange Money",
  },
  card: {
    label: "Debit / Credit Card",
    short: "Card (Visa/Mastercard)",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    fr: "Carte Bancaire (Visa/Mastercard)",
    frShort: "Carte Bancaire",
  },
  bank_transfer: {
    label: "Bank Wire Transfer",
    short: "Bank Transfer",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    fr: "Virement Bancaire",
    frShort: "Virement Bancaire",
  },
  cash: {
    label: "Cash (Direct Handover)",
    short: "Cash",
    badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    fr: "Espèces (Remise Directe)",
    frShort: "Espèces",
  },
};

// In-memory flag to prevent spamming 404 network requests if remote Supabase migration is pending
let isRemotePaymentsTableMissing = false;

function handleTableMissing(error: any) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = String(error.code || "");
  const status = Number(error.status || error.statusCode || 0);

  const isMissing =
    status === 404 ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST200" ||
    msg.includes("does not exist") ||
    msg.includes("not found");

  if (isMissing && !isRemotePaymentsTableMissing) {
    isRemotePaymentsTableMissing = true;
    console.info(
      "💡 [LeaseLink Demo Mode]: Supabase table 'rent_payments' is not created yet in your database. Using local demo storage seamlessly until Section 15 of supabase/schema.sql is executed."
    );
  }
  return isMissing;
}

/**
 * Record a new rent payment in Demo mode (persisted to Supabase and LocalStorage)
 */
export async function recordRentPayment(
  input: CreateRentPaymentInput
): Promise<{ success: boolean; payment?: RentPayment; error?: string }> {
  try {
    const cleanAmount = Math.max(1, Number(input.amount_paid) || 0);
    const monthlyRent = Math.max(0, Number(input.monthly_rent_amount) || 0);

    // Multi-month support: identify all months targeted by this payment
    const targetMonths: string[] =
      input.months_covered && input.months_covered.length > 0
        ? input.months_covered
        : input.months_count && input.months_count > 1
        ? getUpcomingRentMonths(input.months_count)
        : [input.rent_month || getCurrentRentMonth()];

    const monthsCount = targetMonths.length;
    const rentMonthLabel =
      monthsCount > 1
        ? `${targetMonths[0]} – ${targetMonths[monthsCount - 1]} (${monthsCount} Months)`
        : targetMonths[0];

    // 1. Calculate previous payments for this unit in the specified rent month(s)
    const existingPayments = await getPaymentsForUnit(input.unit_id);
    const paymentsInTargetMonths = existingPayments.filter((p) => {
      const pMonth = p.rent_month.toLowerCase();
      return targetMonths.some(
        (m) =>
          pMonth === m.toLowerCase() ||
          pMonth.includes(m.toLowerCase()) ||
          (p.months_covered &&
            p.months_covered.some((mc) => mc.toLowerCase() === m.toLowerCase()))
      );
    });

    const previouslyPaid = paymentsInTargetMonths.reduce(
      (sum, p) => sum + Number(p.amount_paid || 0),
      0
    );

    const totalPeriodExpected = monthlyRent * monthsCount;
    const totalPaidInPeriod = previouslyPaid + cleanAmount;
    const balanceRemaining = Math.max(0, totalPeriodExpected - totalPaidInPeriod);
    const paymentType: PaymentType =
      balanceRemaining === 0 ? "full" : "partial";

    const now = new Date();
    const receiptNumber = `RCP-${now.getFullYear()}-${Math.floor(
      100000 + Math.random() * 900000
    )}`;
    const transactionRef = `TXN-${input.payment_method.toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 9)
      .toUpperCase()}`;

    const newPayment: RentPayment = {
      id: "pay_" + Math.random().toString(36).substring(2, 11),
      receipt_number: receiptNumber,
      unit_id: input.unit_id,
      building_id: input.building_id,
      landlord_id: input.landlord_id,
      landlord_name: input.landlord_name?.trim() || null,
      tenant_name: input.tenant_name.trim(),
      tenant_phone: input.tenant_phone.trim(),
      tenant_email: input.tenant_email?.trim() || null,
      unit_number: input.unit_number.trim(),
      building_name: input.building_name.trim(),
      rent_month: rentMonthLabel,
      months_count: monthsCount,
      months_covered: targetMonths,
      monthly_rent_amount: monthlyRent,
      amount_paid: cleanAmount,
      balance_remaining: balanceRemaining,
      payment_type: paymentType,
      payment_method: input.payment_method,
      transaction_ref: transactionRef,
      status: "completed",
      payer_phone: input.payer_phone?.trim() || input.tenant_phone.trim(),
      notes: input.notes?.trim() || null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    // 2. Try Supabase insertion if remote table exists
    const supabase = createClient();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const isMock = !url || url.includes("your-project-ref");

    if (!isMock && !isRemotePaymentsTableMissing) {
      try {
        const { error } = await supabase.from("rent_payments").insert([
          {
            receipt_number: newPayment.receipt_number,
            unit_id: newPayment.unit_id,
            building_id: newPayment.building_id,
            landlord_id: newPayment.landlord_id,
            landlord_name: newPayment.landlord_name,
            tenant_name: newPayment.tenant_name,
            tenant_phone: newPayment.tenant_phone,
            tenant_email: newPayment.tenant_email,
            unit_number: newPayment.unit_number,
            building_name: newPayment.building_name,
            rent_month: newPayment.rent_month,
            months_count: newPayment.months_count,
            months_covered: newPayment.months_covered,
            monthly_rent_amount: newPayment.monthly_rent_amount,
            amount_paid: newPayment.amount_paid,
            balance_remaining: newPayment.balance_remaining,
            payment_type: newPayment.payment_type,
            payment_method: newPayment.payment_method,
            transaction_ref: newPayment.transaction_ref,
            status: newPayment.status,
            payer_phone: newPayment.payer_phone,
            notes: newPayment.notes,
          },
        ]);

        if (error) {
          if (!handleTableMissing(error)) {
            console.warn("Supabase insert rent_payments warning:", error.message);
          }
        }
      } catch (sbErr: any) {
        if (!handleTableMissing(sbErr)) {
          console.warn("Supabase rent_payments insert exception:", sbErr);
        }
      }
    }

    // 3. Always update localStorage for resilience & instant demo updates
    const local = getLocalPayments();
    setLocalPayments([newPayment, ...local]);

    // 4. Notify landlord of payment made across platform
    try {
      await notifyPaymentReceived({
        landlordId: newPayment.landlord_id,
        buildingId: newPayment.building_id,
        buildingName: newPayment.building_name,
        unitId: newPayment.unit_id,
        unitNumber: newPayment.unit_number,
        tenantName: newPayment.tenant_name,
        amount: newPayment.amount_paid,
        paymentMethod: newPayment.payment_method,
        receiptNumber: newPayment.receipt_number,
        rentMonth: newPayment.rent_month,
        isPartial: newPayment.payment_type === "partial",
      });
    } catch (notifErr) {
      console.warn("Could not dispatch payment notification:", notifErr);
    }

    return {
      success: true,
      payment: newPayment,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to record rent payment";
    return { success: false, error: msg };
  }
}

/**
 * Fetch all payments for a specific unit
 */
export async function getPaymentsForUnit(
  unitId: string
): Promise<RentPayment[]> {
  if (!unitId) return [];

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMock = !url || url.includes("your-project-ref");

  const local = getLocalPayments().filter((p) => p.unit_id === unitId);

  if (!isMock && !isRemotePaymentsTableMissing) {
    try {
      const { data, error } = await supabase
        .from("rent_payments")
        .select("*")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false });

      if (error) {
        handleTableMissing(error);
      } else if (data && data.length > 0) {
        // Merge with local to ensure demo payments are reflected immediately
        const map = new Map<string, RentPayment>();
        (data as RentPayment[]).forEach((p) => map.set(p.receipt_number, p));
        local.forEach((p) => map.set(p.receipt_number, p));
        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    } catch (err: any) {
      handleTableMissing(err);
    }
  }

  return local.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Fetch all payments for all units belonging to a landlord
 */
export async function getPaymentsForLandlord(
  landlordId: string
): Promise<RentPayment[]> {
  if (!landlordId) return [];

  const supabase = createClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const isMock = !url || url.includes("your-project-ref");

  const local = getLocalPayments().filter((p) => p.landlord_id === landlordId);

  if (!isMock && !isRemotePaymentsTableMissing) {
    try {
      const { data, error } = await supabase
        .from("rent_payments")
        .select("*")
        .eq("landlord_id", landlordId)
        .order("created_at", { ascending: false });

      if (error) {
        handleTableMissing(error);
      } else if (data && data.length > 0) {
        const map = new Map<string, RentPayment>();
        (data as RentPayment[]).forEach((p) => map.set(p.receipt_number, p));
        local.forEach((p) => map.set(p.receipt_number, p));
        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    } catch (err: any) {
      handleTableMissing(err);
    }
  }

  return local.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Compute the Rent Status Summary for all occupied units of a landlord
 */
export async function getTenantRentStatusSummary(
  landlordId: string,
  buildings: Building[]
): Promise<TenantRentStatus[]> {
  const currentMonth = getCurrentRentMonth();
  const allPayments = await getPaymentsForLandlord(landlordId);

  const statuses: TenantRentStatus[] = [];
  const today = new Date();
  const dueDayOfMonth = 5; // Standard rent due day (5th of each month)
  const isPastDueDate = today.getDate() > dueDayOfMonth;
  const daysLate = isPastDueDate ? today.getDate() - dueDayOfMonth : 0;

  buildings.forEach((b) => {
    (b.units || []).forEach((u) => {
      const isOccupied =
        u.status === "occupied" || Boolean(u.tenant_name?.trim());
      if (!isOccupied) return;

      const unitPayments = allPayments.filter((p) => p.unit_id === u.id);
      const currentMonthPayments = unitPayments.filter((p) => {
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

      const monthlyRent = Number(u.rent_amount || 0);
      const amountPaidCurrentMonth = currentMonthPayments.reduce(
        (sum, p) => sum + Number(p.amount_paid || 0),
        0
      );
      const balanceOwingCurrentMonth = Math.max(
        0,
        monthlyRent - amountPaidCurrentMonth
      );
      const isOwing = balanceOwingCurrentMonth > 0;

      // Collect any future advance months paid for this unit
      const advanceMonths = new Set<string>();
      unitPayments.forEach((p) => {
        if (p.months_covered && p.months_covered.length > 1) {
          p.months_covered.forEach((m) => {
            if (m.toLowerCase() !== currentMonth.toLowerCase()) {
              advanceMonths.add(m);
            }
          });
        }
      });

      let status: "paid" | "partial" | "unpaid" | "overdue" = "unpaid";
      if (amountPaidCurrentMonth >= monthlyRent) {
        status = "paid";
      } else if (amountPaidCurrentMonth > 0) {
        status = "partial";
      } else if (isPastDueDate) {
        status = "overdue";
      } else {
        status = "unpaid";
      }

      const latestPayment = unitPayments[0] || null;

      statuses.push({
        unit_id: u.id,
        unit_number: u.unit_number,
        building_id: b.id,
        building_name: b.name,
        tenant_name: u.tenant_name || "Valued Tenant",
        tenant_phone: u.tenant_phone || "",
        tenant_email: u.tenant_email || null,
        monthly_rent: monthlyRent,
        current_month: currentMonth,
        amount_paid_current_month: amountPaidCurrentMonth,
        balance_owing_current_month: balanceOwingCurrentMonth,
        is_owing: isOwing,
        is_late: isPastDueDate && isOwing,
        days_late: isOwing && isPastDueDate ? daysLate : 0,
        status,
        advance_months_paid: Array.from(advanceMonths),
        last_payment_date: latestPayment?.created_at || null,
        last_receipt_number: latestPayment?.receipt_number || null,
        payments: unitPayments,
      });
    });
  });

  return statuses;
}

/**
 * Generate a WhatsApp payment confirmation message to dispatch to the landlord or tenant
 */
export function buildPaymentConfirmationWhatsAppUrl(params: {
  recipientPhone: string;
  recipientName: string;
  senderRole: "tenant" | "landlord";
  tenantName: string;
  unitNumber: string;
  buildingName: string;
  amountPaid: number;
  rentMonth: string;
  receiptNumber: string;
  balanceRemaining: number;
  paymentMethod: PaymentMethod;
  language?: "en" | "fr";
}): { url: string; cleanPhone: string; message: string } {
  const cleanPhone = formatWhatsAppPhoneNumber(params.recipientPhone);
  const formattedPaid = Number(params.amountPaid || 0).toLocaleString();
  const formattedBalance = Number(
    params.balanceRemaining || 0
  ).toLocaleString();
  const methodLabel =
    PAYMENT_METHOD_LABELS[params.paymentMethod]?.label || params.paymentMethod;

  const lang = params.language || "fr";
  let message = "";

  if (lang === "en") {
    if (params.senderRole === "tenant") {
      message = `Hello ${params.recipientName}! 👋
I have just completed my rent payment on *LeaseLink*.

📋 *Payment Details:*
• Property: ${params.buildingName}
• Unit: ${params.unitNumber}
• Period: ${params.rentMonth}
• Amount Paid: *${formattedPaid} XAF*
• Payment Method: ${methodLabel}
• Receipt N°: *${params.receiptNumber}*
${
  params.balanceRemaining > 0
    ? `• Remaining Balance Due: *${formattedBalance} XAF*`
    : `• Status: *Paid in Full (100% Settled)* ✅`
}

Please confirm receipt. Thank you!`;
    } else {
      const isCash = params.paymentMethod === "cash";
      message = `Hello ${params.recipientName}! 👋
We confirm receipt of your rent payment on *LeaseLink*${
        isCash ? " paid in *PHYSICAL CASH (Handed over directly to landlord)* 💵" : ""
      }.

🧾 *Official Certified Receipt:*
• Receipt N°: *${params.receiptNumber}*
• Unit: ${params.unitNumber} (${params.buildingName})
• Period: ${params.rentMonth}
• Amount Received: *${formattedPaid} XAF*
• Payment Method: ${methodLabel}
${
  params.balanceRemaining > 0
    ? `• Remaining Balance for this cycle: *${formattedBalance} XAF*`
    : `• Status: *Paid in Full (100% Settled)* ✅`
}

Your official stamped receipt is available for download in your LeaseLink tenant portal. Thank you!`;
    }
  } else {
    if (params.senderRole === "tenant") {
      message = `Bonjour ${params.recipientName} ! 👋
Je viens d'effectuer le paiement de mon loyer sur *LeaseLink*.

📋 *Détails du Paiement :*
• Résidence : ${params.buildingName}
• Logement : ${params.unitNumber}
• Période : ${params.rentMonth}
• Montant payé : *${formattedPaid} XAF*
• Mode de paiement : ${methodLabel}
• Reçu N° : *${params.receiptNumber}*
${
  params.balanceRemaining > 0
    ? `• Solde restant à régler : *${formattedBalance} XAF*`
    : `• Statut : *Totalement réglé (Soldé à 100%)* ✅`
}

Merci de confirmer la bonne réception !`;
    } else {
      const isCash = params.paymentMethod === "cash";
      message = `Bonjour ${params.recipientName} ! 👋
Nous confirmons la bonne réception de votre paiement de loyer sur *LeaseLink*${
        isCash ? " réglé en *ESPÈCES (Remis en main propre au bailleur)* 💵" : ""
      }.

🧾 *Reçu Officiel Certifié :*
• Reçu N° : *${params.receiptNumber}*
• Logement : ${params.unitNumber} (${params.buildingName})
• Période : ${params.rentMonth}
• Montant reçu : *${formattedPaid} XAF*
• Mode de paiement : ${methodLabel}
${
  params.balanceRemaining > 0
    ? `• Solde restant pour cette période : *${formattedBalance} XAF*`
    : `• Statut : *Totalement réglé (Soldé à 100%)* ✅`
}

Votre reçu officiel avec cachet unique est disponible en téléchargement dans votre espace locataire LeaseLink. Merci !`;
    }
  }

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  return { url, cleanPhone, message };
}

/**
 * Generate a WhatsApp payment reminder message for unpaid / overdue rents
 */
export function buildPaymentReminderWhatsAppUrl(params: {
  tenantPhone: string;
  tenantName: string;
  buildingName: string;
  unitNumber: string;
  balanceOwing: number;
  rentMonth: string;
  daysLate?: number;
  managerName?: string;
  language?: "en" | "fr";
}): { url: string; cleanPhone: string; message: string } {
  const cleanPhone = formatWhatsAppPhoneNumber(params.tenantPhone);
  const formattedOwing = Number(params.balanceOwing || 0).toLocaleString();
  const lang = params.language || "fr";

  let message = "";
  if (lang === "en") {
    message = `Hello ${params.tenantName}! 👋
This is a friendly reminder regarding your rent for unit ${params.unitNumber} (${params.buildingName}).

📋 *Rent Status Summary:*
• Period: *${params.rentMonth}*
• Outstanding Balance: *${formattedOwing} XAF*
${params.daysLate && params.daysLate > 0 ? `• Overdue by: *${params.daysLate} day(s)* ⚠️\n` : ""}
Please settle your balance promptly via your LeaseLink tenant portal or in cash with management.

Thank you!
${params.managerName ? `— ${params.managerName} (Property Management)` : "— Property Management"}`;
  } else {
    message = `Bonjour ${params.tenantName} ! 👋
Nous vous contactons concernant le règlement de votre loyer pour le logement ${params.unitNumber} (${params.buildingName}).

📋 *Rappel d'Échéance de Loyer :*
• Période concernée : *${params.rentMonth}*
• Montant restant dû : *${formattedOwing} XAF*
${params.daysLate && params.daysLate > 0 ? `• Retard constaté : *${params.daysLate} jour(s)* ⚠️\n` : ""}
Merci de bien vouloir procéder au règlement dans les meilleurs délais via votre espace locataire LeaseLink ou directement auprès de la gestion.

Cordialement,
${params.managerName ? `— ${params.managerName} (Gestion Immobilière)` : "— Gestion Immobilière"}`;
  }

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  return { url, cleanPhone, message };
}
