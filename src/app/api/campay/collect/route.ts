import { NextRequest, NextResponse } from "next/server";
import { requestCampayCollect } from "@/lib/services/campayService";
import {
  getSubscriptionPlanPricing,
  isPlanAlreadyActiveThisMonth,
} from "@/lib/services/subscriptionService";
import { createClient } from "@/lib/supabase/client";
import { SubscriptionPlanId, BillingCycle } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      landlordId,
      planId,
      billingCycle = "monthly",
      payerPhone,
      payerName,
    } = body;

    if (!landlordId || !planId || !payerPhone) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: landlordId, planId, or payerPhone" },
        { status: 400 }
      );
    }

    // Compute plan pricing securely on the server
    const pricing = getSubscriptionPlanPricing(
      planId as SubscriptionPlanId,
      billingCycle as BillingCycle
    );

    if (pricing.price <= 0) {
      return NextResponse.json(
        { success: false, error: "Free trials or zero-amount plans do not require payment processing." },
        { status: 400 }
      );
    }

    // Guard: Prevent paying twice for the exact same plan during the active month/period
    try {
      const supabase = createClient();
      const { data: landlordProfile } = await supabase
        .from("profiles")
        .select("plan, plan_status, subscription_status, plan_expires_at, subscription_expires_at")
        .eq("id", landlordId)
        .maybeSingle();

      if (landlordProfile) {
        const activeCheck = isPlanAlreadyActiveThisMonth(
          landlordProfile,
          planId as SubscriptionPlanId
        );
        if (activeCheck.isActiveThisMonth) {
          return NextResponse.json(
            {
              success: false,
              error: `Vous avez déjà souscrit à la formule ${pricing.plan.name} pour le mois en cours. Votre forfait est actif jusqu'au ${activeCheck.formattedExpiry}. Vous ne pouvez pas repayer pour le même forfait ce mois-ci. Pour augmenter vos logements immédiatement, veuillez choisir une formule supérieure.`,
            },
            { status: 400 }
          );
        }
      }
    } catch (checkErr) {
      console.warn("Notice checking landlord profile active plan:", checkErr);
    }

    const externalRef = `SUB-${Date.now()}-${landlordId.substring(0, 8)}`;
    const description = `LeaseLink - Plan ${pricing.plan.name} (${billingCycle === "annual" ? "Annuel" : "Mensuel"})`;

    const collectResult = await requestCampayCollect({
      amount: pricing.price,
      phone: payerPhone,
      description,
      externalReference: externalRef,
    });

    if (!collectResult.success) {
      return NextResponse.json(
        { success: false, error: collectResult.error || "Failed to initiate payment with Campay" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      reference: collectResult.reference,
      ussdCode: collectResult.ussdCode,
      operator: collectResult.operator,
      isSimulated: collectResult.isSimulated,
      amount: pricing.price,
      planName: pricing.plan.name,
      externalReference: externalRef,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
