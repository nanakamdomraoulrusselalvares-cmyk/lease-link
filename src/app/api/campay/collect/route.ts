import { NextRequest, NextResponse } from "next/server";
import { requestCampayCollect } from "@/lib/services/campayService";
import { getSubscriptionPlanPricing } from "@/lib/services/subscriptionService";
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
