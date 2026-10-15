import { Unit, RentPayment } from "@/types/database";
import { formatWhatsAppPhoneNumber } from "@/lib/services/tenantService";
import { createNotification } from "@/lib/services/notificationService";

export interface RentDueStatus {
  dueDay: number;
  leaseStartDate: string | null;
  formattedLeaseStart: string | null;
  currentDueDate: Date;
  formattedDueDate: string;
  isPaidCurrentMonth: boolean;
  status: "paid" | "due_soon" | "overdue" | "normal";
  statusLabelFr: string;
  statusLabelEn: string;
  badgeClass: string;
  daysDiff: number; // Positive = days overdue, Negative = days remaining
}

/**
 * Calculates real-time rent due date, upcoming warnings, and overdue status for a unit
 */
export function calculateRentDueStatus(
  unit: Unit,
  payments: RentPayment[] = []
): RentDueStatus {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const todayDate = now.getDate();

  // 1. Resolve rent due day of the month (defaults to day of lease start, or 5)
  let leaseStart = unit.lease_start_date ? new Date(unit.lease_start_date) : null;
  if (!leaseStart && unit.tenant_assigned_at) {
    leaseStart = new Date(unit.tenant_assigned_at);
  }

  const dueDay = Math.min(
    28,
    Math.max(1, Number(unit.rent_due_day) || (leaseStart ? leaseStart.getDate() : 5))
  );

  const currentDueDate = new Date(currentYear, currentMonth, dueDay);

  // Format current month label (e.g., "October 2026")
  const currentMonthName = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Check if current month is paid
  const isPaidCurrentMonth = payments.some((p) => {
    if (p.unit_id !== unit.id) return false;
    const pMonth = (p.rent_month || "").toLowerCase();
    const target = currentMonthName.toLowerCase();
    const coversTarget =
      p.months_covered &&
      p.months_covered.some((m) => m.toLowerCase().includes(target));

    return (
      (pMonth.includes(target) || coversTarget) &&
      p.status === "completed" &&
      p.balance_remaining <= 0
    );
  });

  const formattedDueDate = currentDueDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedLeaseStart = leaseStart
    ? leaseStart.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  if (isPaidCurrentMonth) {
    return {
      dueDay,
      leaseStartDate: unit.lease_start_date || null,
      formattedLeaseStart,
      currentDueDate,
      formattedDueDate,
      isPaidCurrentMonth: true,
      status: "paid",
      statusLabelFr: "Loyer à jour",
      statusLabelEn: "Rent up to date",
      badgeClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30",
      daysDiff: 0,
    };
  }

  // Calculate day difference relative to due day
  const daysDiff = todayDate - dueDay;

  // Case A: Overdue (today > dueDay)
  if (daysDiff > 0) {
    return {
      dueDay,
      leaseStartDate: unit.lease_start_date || null,
      formattedLeaseStart,
      currentDueDate,
      formattedDueDate,
      isPaidCurrentMonth: false,
      status: "overdue",
      statusLabelFr: `En retard (${daysDiff} j)`,
      statusLabelEn: `Overdue (${daysDiff} d)`,
      badgeClass: "bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30",
      daysDiff,
    };
  }

  // Case B: Due soon (within 5 days before due day)
  if (daysDiff >= -5 && daysDiff <= 0) {
    const daysRemaining = Math.abs(daysDiff);
    const labelFr =
      daysRemaining === 0 ? "Échéance aujourd'hui !" : `Échéance dans ${daysRemaining} j`;
    const labelEn =
      daysRemaining === 0 ? "Due today!" : `Due in ${daysRemaining} d`;

    return {
      dueDay,
      leaseStartDate: unit.lease_start_date || null,
      formattedLeaseStart,
      currentDueDate,
      formattedDueDate,
      isPaidCurrentMonth: false,
      status: "due_soon",
      statusLabelFr: labelFr,
      statusLabelEn: labelEn,
      badgeClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30",
      daysDiff,
    };
  }

  // Case C: Normal upcoming
  const daysLeft = Math.abs(daysDiff);
  return {
    dueDay,
    leaseStartDate: unit.lease_start_date || null,
    formattedLeaseStart,
    currentDueDate,
    formattedDueDate,
    isPaidCurrentMonth: false,
    status: "normal",
    statusLabelFr: `Échéance le ${dueDay} du mois`,
    statusLabelEn: `Due on ${dueDay}th`,
    badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    daysDiff: -daysLeft,
  };
}

/**
 * Builds a direct, professional WhatsApp URL to remind tenant before or after rent due day
 */
export function buildRentDueWhatsAppReminderUrl(options: {
  tenantPhone: string;
  tenantName: string;
  unitNumber: string;
  buildingName: string;
  rentAmount: number;
  dueDay: number;
  dueDateStr: string;
  isOverdue: boolean;
  daysDiff: number;
  landlordName?: string;
}): string {
  const cleanPhone = formatWhatsAppPhoneNumber(options.tenantPhone);
  const amountStr = Number(options.rentAmount || 0).toLocaleString();
  const landlord = options.landlordName || "La Gestion Immobilière";

  let message = "";
  if (options.isOverdue) {
    const daysLate = Math.max(1, options.daysDiff);
    message =
      `*AVIS D'ÉCHÉANCE ET RETARD DE LOYER - LEASELINK*\n\n` +
      `Bonjour *${options.tenantName}*,\n\n` +
      `Sauf erreur de notre part, le loyer de votre logement *${options.unitNumber}* (${options.buildingName}) d'un montant de *${amountStr} FCFA* était dû le *${options.dueDateStr}* et accuse à ce jour un retard de *${daysLate} jour(s)*.\n\n` +
      `Nous vous prions de bien vouloir procéder à la régularisation de votre loyer dès que possible (via MTN Mobile Money, Orange Money ou Espèces contre quittance certifiée).\n\n` +
      `Si votre règlement a déjà été effectué dans les dernières 24 heures, merci de ne pas tenir compte de ce message.\n\n` +
      `Cordialement,\n` +
      `*${landlord}* (LeaseLink)`;
  } else {
    message =
      `*RAPPEL D'ÉCHÉANCE DE LOYER - LEASELINK*\n\n` +
      `Bonjour *${options.tenantName}*,\n\n` +
      `Ceci est un rappel amical concernant votre logement *${options.unitNumber}* (${options.buildingName}).\n\n` +
      `Votre loyer mensuel de *${amountStr} FCFA* arrive à échéance le *${options.dueDateStr}* (le ${options.dueDay} du mois).\n\n` +
      `Merci de prévoir votre règlement à temps afin d'obtenir immédiatement votre quittance certifiée conforme.\n\n` +
      `Bien cordialement,\n` +
      `*${landlord}* (LeaseLink)`;
  }

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Automatically dispatches due date notifications to the tenant and management before and after due date
 */
export async function dispatchRentDueNotification(options: {
  landlordId: string;
  buildingId: string;
  buildingName: string;
  unitId: string;
  unitNumber: string;
  tenantName: string;
  tenantPhone: string;
  rentAmount: number;
  dueDay: number;
  isOverdue: boolean;
  daysDiff: number;
}): Promise<void> {
  const amountStr = Number(options.rentAmount || 0).toLocaleString();

  if (options.isOverdue) {
    const daysLate = Math.max(1, options.daysDiff);
    await createNotification({
      type: "rent_overdue",
      recipient_role: "management",
      landlord_id: options.landlordId,
      building_id: options.buildingId,
      building_name: options.buildingName,
      unit_id: options.unitId,
      unit_number: options.unitNumber,
      tenant_name: options.tenantName,
      amount: options.rentAmount,
      title: `Rent Overdue: ${options.tenantName} (${daysLate} days late)`,
      title_fr: `Loyer en retard : ${options.tenantName} (${daysLate} j de retard)`,
      message: `Rent for Unit ${options.unitNumber} (${options.buildingName}) of ${amountStr} XAF was due on day ${options.dueDay} and is ${daysLate} day(s) overdue.`,
      message_fr: `Le loyer du logement ${options.unitNumber} (${options.buildingName}) de ${amountStr} XAF était dû le ${options.dueDay} du mois et accuse ${daysLate} jour(s) de retard.`,
      metadata: {
        isOverdue: true,
        daysOverdue: daysLate,
        dueDay: options.dueDay,
      },
    });
  } else {
    const daysRemaining = Math.abs(options.daysDiff);
    await createNotification({
      type: "rent_due_reminder",
      recipient_role: "management",
      landlord_id: options.landlordId,
      building_id: options.buildingId,
      building_name: options.buildingName,
      unit_id: options.unitId,
      unit_number: options.unitNumber,
      tenant_name: options.tenantName,
      amount: options.rentAmount,
      title: `Rent Due Reminder: Unit ${options.unitNumber}`,
      title_fr: `Rappel d'échéance : Logement ${options.unitNumber}`,
      message: `Rent of ${amountStr} XAF for ${options.tenantName} in Unit ${options.unitNumber} (${options.buildingName}) is due on day ${options.dueDay} (in ${daysRemaining} days).`,
      message_fr: `Le loyer de ${amountStr} XAF de ${options.tenantName} pour le logement ${options.unitNumber} (${options.buildingName}) arrive à échéance le ${options.dueDay} du mois (dans ${daysRemaining} jours).`,
      metadata: {
        isOverdue: false,
        daysRemaining,
        dueDay: options.dueDay,
      },
    });
  }
}
