import { createClient } from "@/lib/supabase/client";
import {
  SubscriptionPlanId,
  BillingCycle,
  PlanConfig,
  AVAILABLE_PLANS,
  PaymentMethod,
  resolvePlanConfig,
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
  landlordEmail?: string;
  landlordPhone?: string;
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
  const plan = resolvePlanConfig(planId);

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
 * Upgrades landlord profile, updates plan expiration, records receipt in DB & sends notifications
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

    // Security check: verify that managers cannot upgrade subscription plans
    const supabase = createClient();
    const { data: profileCheck } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", landlordId)
      .maybeSingle();

    if (profileCheck?.role === "manager") {
      return {
        success: false,
        error: "Managers are not authorized to upgrade subscription plans. Only the landlord can manage subscriptions.",
      };
    }

    const pricing = getSubscriptionPlanPricing(planId, billingCycle);
    const resolvedPlanId = pricing.plan.id;
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
      landlord_email: landlordEmail || "",
      landlord_phone: landlordPhone || payerPhone || "",
      plan_id: resolvedPlanId,
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

    // 1. Update Supabase Profile & Subscriptions Database
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const isMock = !url || url.includes("your-project-ref");

    if (!isMock && landlordId) {
      try {
        // A. Update public.profiles with new plan, capacity, status, and expiration
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({
            plan: resolvedPlanId,
            plan_name: formattedPlanName,
            plan_unit_limit: pricing.plan.maxUnits,
            unit_limit: pricing.plan.maxUnits,
            plan_duration_days: pricing.durationDays,
            plan_status: "active",
            subscription_status: "active",
            has_used_free_trial: true,
            has_used_trial: true,
            plan_starts_at: now.toISOString(),
            plan_expires_at: expiresAt.toISOString(),
            subscription_expires_at: expiresAt.toISOString(),
            billing_cycle: billingCycle,
            updated_at: now.toISOString(),
          })
          .eq("id", landlordId);

        if (profileErr) {
          console.warn("Supabase profile plan update error:", profileErr);
        }

        // B. Insert into public.subscriptions table for complete audit trail
        try {
          const { error: subErr } = await supabase.from("subscriptions").insert([
            {
              receipt_number: receiptNumber,
              landlord_id: landlordId,
              landlord_name: landlordName,
              landlord_email: landlordEmail,
              landlord_phone: landlordPhone,
              plan_id: resolvedPlanId,
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
              notes: notes || null,
              created_at: now.toISOString(),
            },
          ]);

          if (subErr) {
            console.warn("Supabase subscriptions table insert warning:", subErr);
          }
        } catch (subInsertErr) {
          console.warn("Could not insert subscription record:", subInsertErr);
        }

        // C. Update Supabase Auth user_metadata so auth session immediately reflects new plan
        try {
          await supabase.auth.updateUser({
            data: {
              plan: resolvedPlanId,
              plan_name: pricing.plan.name,
              plan_unit_limit: pricing.plan.maxUnits,
              unit_limit: pricing.plan.maxUnits,
              billing_cycle: billingCycle,
            },
          });
        } catch (authMetaErr) {
          console.warn("Supabase auth user metadata sync warning:", authMetaErr);
        }

        // D. Record notification for the landlord
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
              plan_id: resolvedPlanId,
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

    // 2. Cache in localStorage for instant responsiveness across all platform views
    saveLocalSubscriptionRecord(record);

    if (typeof window !== "undefined") {
      try {
        // Sync local profiles array
        const rawProfiles = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
        if (rawProfiles) {
          const profiles = JSON.parse(rawProfiles);
          const index = profiles.findIndex((p: any) => p.id === landlordId);
          if (index >= 0) {
            profiles[index] = {
              ...profiles[index],
              plan: resolvedPlanId,
              plan_name: formattedPlanName,
              billing_cycle: billingCycle,
              plan_unit_limit: pricing.plan.maxUnits,
              unit_limit: pricing.plan.maxUnits,
              plan_duration_days: pricing.durationDays,
              plan_status: "active",
              subscription_status: "active",
              has_used_free_trial: true,
              has_used_trial: true,
              plan_starts_at: now.toISOString(),
              plan_expires_at: expiresAt.toISOString(),
              subscription_expires_at: expiresAt.toISOString(),
              updated_at: now.toISOString(),
            };
            localStorage.setItem(
              LOCAL_STORAGE_PROFILES_KEY,
              JSON.stringify(profiles)
            );
          }
        }

        // Sync mock profiles store
        const rawMockProfiles = localStorage.getItem("leaselink_mock_profiles");
        if (rawMockProfiles) {
          const mockProfiles = JSON.parse(rawMockProfiles);
          const mIndex = mockProfiles.findIndex((p: any) => p.id === landlordId);
          if (mIndex >= 0) {
            mockProfiles[mIndex] = {
              ...mockProfiles[mIndex],
              plan: resolvedPlanId,
              plan_name: formattedPlanName,
              billing_cycle: billingCycle,
              plan_unit_limit: pricing.plan.maxUnits,
              unit_limit: pricing.plan.maxUnits,
              plan_status: "active",
              subscription_status: "active",
              plan_expires_at: expiresAt.toISOString(),
              subscription_expires_at: expiresAt.toISOString(),
            };
            localStorage.setItem(
              "leaselink_mock_profiles",
              JSON.stringify(mockProfiles)
            );
          }
        }

        // Sync cached dashboard state so dashboard reflects instantly on back-navigation
        const rawDashboard = localStorage.getItem("leaselink_cached_dashboard");
        if (rawDashboard) {
          try {
            const parsedDash = JSON.parse(rawDashboard);
            if (parsedDash.profile && parsedDash.profile.id === landlordId) {
              parsedDash.profile = {
                ...parsedDash.profile,
                plan: resolvedPlanId,
                plan_name: formattedPlanName,
                billing_cycle: billingCycle,
                plan_unit_limit: pricing.plan.maxUnits,
                unit_limit: pricing.plan.maxUnits,
                plan_status: "active",
                subscription_status: "active",
                plan_starts_at: now.toISOString(),
                plan_expires_at: expiresAt.toISOString(),
                subscription_expires_at: expiresAt.toISOString(),
                updated_at: now.toISOString(),
              };
              localStorage.setItem("leaselink_cached_dashboard", JSON.stringify(parsedDash));
            }
          } catch (_) {}
        }

        // Broadcast subscription upgrade across all open tabs/views
        window.dispatchEvent(
          new CustomEvent("leaselink:subscription_updated", {
            detail: {
              record,
              planId: resolvedPlanId,
              planConfig: pricing.plan,
              unitLimit: pricing.plan.maxUnits,
              billingCycle,
              expiresAt: expiresAt.toISOString(),
            },
          })
        );
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
