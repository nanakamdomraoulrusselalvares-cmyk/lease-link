import { createClient } from "@/lib/supabase/client";
import {
  SubscriptionPlanId,
  BillingCycle,
  PlanConfig,
  AVAILABLE_PLANS,
  PaymentMethod,
} from "@/types/database";

const LOCAL_STORAGE_PROFILES_KEY = "leaselink_local_profiles";
const LOCAL_STORAGE_SUBSCRIPTIONS_KEY = "leaselink_local_subscriptions";

export interface SubscriptionPaymentRecord {
  id: string;
  receipt_number: string;
  landlord_id: string;
  landlord_name: string;
  landlord_email: string;
  landlord_phone: string;
  plan_id: SubscriptionPlanId;
  plan_name: string;
  billing_cycle: BillingCycle;
  amount_paid: number;
  payment_method: PaymentMethod;
  transaction_ref: string;
  duration_days: number;
  starts_at: string;
  expires_at: string;
  status: "completed" | "pending";
  payer_phone?: string;
  notes?: string;
  created_at: string;
}

export interface ProcessSubscriptionInput {
  landlordId: string;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  planId: SubscriptionPlanId;
  billingCycle: BillingCycle;
  paymentMethod: PaymentMethod;
  payerPhone?: string;
  payerName?: string;
  notes?: string;
}

/**
 * Get pricing and duration calculations for a plan and billing cycle
 */
export function getSubscriptionPlanPricing(
  planId: SubscriptionPlanId,
  billingCycle: BillingCycle = "monthly"
): {
  plan: PlanConfig;
  price: number;
  priceDisplay: string;
  durationDays: number;
  savingsDisplay: string | null;
  savingsDisplayFr: string | null;
} {
  const plan =
    AVAILABLE_PLANS.find((p) => p.id === planId) || AVAILABLE_PLANS[1]; // default to starter

  if (plan.id === "free") {
    return {
      plan,
      price: 0,
      priceDisplay: "0 FCFA",
      durationDays: 30,
      savingsDisplay: null,
      savingsDisplayFr: null,
    };
  }

  if (billingCycle === "annual") {
    const price = plan.annualPrice || plan.monthlyPrice * 12;
    return {
      plan,
      price,
      priceDisplay: plan.annualPriceDisplay,
      durationDays: 365,
      savingsDisplay: plan.annualSavings || null,
      savingsDisplayFr: plan.annualSavingsFr || null,
    };
  }

  return {
    plan,
    price: plan.monthlyPrice,
    priceDisplay: plan.monthlyPriceDisplay,
    durationDays: 30,
    savingsDisplay: null,
    savingsDisplayFr: null,
  };
}

/**
 * Helper to get local stored subscription payments
 */
export function getLocalSubscriptionRecords(): SubscriptionPaymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SUBSCRIPTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSubscriptionRecord(record: SubscriptionPaymentRecord) {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalSubscriptionRecords();
    list.unshift(record);
    localStorage.setItem(
      LOCAL_STORAGE_SUBSCRIPTIONS_KEY,
      JSON.stringify(list.slice(0, 50))
    );
  } catch (err) {
    console.warn("Could not cache subscription record:", err);
  }
}

/**
 * Process a subscription payment (Monthly or Annual)
 * Upgrades landlord profile, updates plan expiration, records receipt & sends notifications
 */
export async function processSubscriptionPayment(
  input: ProcessSubscriptionInput
): Promise<{
  success: boolean;
  record?: SubscriptionPaymentRecord;
  error?: string;
}> {
  try {
    const {
      landlordId,
      landlordName,
      landlordEmail,
      landlordPhone,
      planId,
      billingCycle,
      paymentMethod,
      payerPhone,
      notes,
    } = input;

    const pricing = getSubscriptionPlanPricing(planId, billingCycle);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + pricing.durationDays * 24 * 60 * 60 * 1000
    );

    const receiptNumber = `SUB-RCP-${now.getFullYear()}-${Math.floor(
      100000 + Math.random() * 900000
    )}`;
    const transactionRef = `TXN-SUB-${paymentMethod.toUpperCase()}-${Math.random()
      .toString(36)
      .substring(2, 9)
      .toUpperCase()}`;

    const cycleLabelFr = billingCycle === "annual" ? "Annuel" : "Mensuel";
    const cycleLabelEn = billingCycle === "annual" ? "Annual" : "Monthly";
    const formattedPlanName = `${pricing.plan.name} (${cycleLabelFr} - ${pricing.priceDisplay})`;

    const record: SubscriptionPaymentRecord = {
      id: "sub_pay_" + Math.random().toString(36).substring(2, 11),
      receipt_number: receiptNumber,
      landlord_id: landlordId,
      landlord_name: landlordName,
      landlord_email: landlordEmail,
      landlord_phone: landlordPhone,
      plan_id: planId,
      plan_name: formattedPlanName,
      billing_cycle: billingCycle,
      amount_paid: pricing.price,
      payment_method: paymentMethod,
      transaction_ref: transactionRef,
      duration_days: pricing.durationDays,
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "completed",
      payer_phone: payerPhone || landlordPhone,
      notes: notes || undefined,
      created_at: now.toISOString(),
    };

    // 1. Update Supabase Profile
    const supabase = createClient();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const isMock = !url || url.includes("your-project-ref");

    if (!isMock && landlordId) {
      try {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({
            plan: planId,
            plan_name: formattedPlanName,
            plan_unit_limit: pricing.plan.maxUnits,
            plan_duration_days: pricing.durationDays,
            plan_status: "active",
            plan_starts_at: now.toISOString(),
            plan_expires_at: expiresAt.toISOString(),
            billing_cycle: billingCycle,
            updated_at: now.toISOString(),
          })
          .eq("id", landlordId);

        if (profileErr) {
          console.warn("Supabase profile plan update error:", profileErr);
        }

        // Also record a notification for the landlord
        await supabase.from("notifications").insert([
          {
            type: "system",
            title: `Abonnement ${pricing.plan.name} Activé`,
            title_fr: `Abonnement ${pricing.plan.name} Activé`,
            message: `Votre abonnement ${pricing.plan.name} (${cycleLabelFr}) est désormais actif jusqu'au ${expiresAt.toLocaleDateString()}. Capacité : ${pricing.plan.maxUnits} logements. Quittance : ${receiptNumber}`,
            message_fr: `Votre abonnement ${pricing.plan.name} (${cycleLabelFr}) est désormais actif jusqu'au ${expiresAt.toLocaleDateString()}. Capacité : ${pricing.plan.maxUnits} logements. Quittance : ${receiptNumber}`,
            recipient_role: "landlord",
            landlord_id: landlordId,
            receipt_number: receiptNumber,
            metadata: {
              plan_id: planId,
              billing_cycle: billingCycle,
              amount: pricing.price,
              receipt_number: receiptNumber,
            },
          },
        ]);
      } catch (dbErr) {
        console.warn("Error persisting subscription to Supabase:", dbErr);
      }
    }

    // 2. Cache in localStorage for instant responsiveness
    saveLocalSubscriptionRecord(record);

    if (typeof window !== "undefined") {
      try {
        const rawProfiles = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
        if (rawProfiles) {
          const profiles = JSON.parse(rawProfiles);
          const index = profiles.findIndex((p: any) => p.id === landlordId);
          if (index >= 0) {
            profiles[index] = {
              ...profiles[index],
              plan: planId,
              plan_name: formattedPlanName,
              billing_cycle: billingCycle,
              plan_unit_limit: pricing.plan.maxUnits,
              plan_duration_days: pricing.durationDays,
              plan_status: "active",
              plan_starts_at: now.toISOString(),
              plan_expires_at: expiresAt.toISOString(),
              updated_at: now.toISOString(),
            };
            localStorage.setItem(
              LOCAL_STORAGE_PROFILES_KEY,
              JSON.stringify(profiles)
            );
          }
        }
      } catch (lsErr) {
        console.warn("Could not update local storage profile:", lsErr);
      }
    }

    return {
      success: true,
      record,
    };
  } catch (err: any) {
    console.error("Subscription payment error:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred during subscription processing",
    };
  }
}
