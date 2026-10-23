import { NextRequest, NextResponse } from "next/server";
import { checkCampayTransactionStatus } from "@/lib/services/campayService";
import { processSubscriptionPayment } from "@/lib/services/subscriptionService";
import { SubscriptionPlanId, BillingCycle } from "@/types/database";

// In-memory idempotency cache to prevent duplicate subscription activations during rapid polling
const completedActivations = new Map<string, any>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get("reference");
    const landlordId = searchParams.get("landlordId");
    const planId = searchParams.get("planId") as SubscriptionPlanId | null;
    const billingCycle = (searchParams.get("billingCycle") || "monthly") as BillingCycle;
    const payerPhone = searchParams.get("payerPhone") || "";
    const payerName = searchParams.get("payerName") || "";

    if (!reference) {
      return NextResponse.json(
        { success: false, error: "Missing transaction reference" },
        { status: 400 }
      );
    }

    // Fast idempotency check
    if (completedActivations.has(reference)) {
      return NextResponse.json({
        success: true,
        status: "SUCCESSFUL",
        reference,
        record: completedActivations.get(reference),
        isCached: true,
      });
    }

    const statusResult = await checkCampayTransactionStatus(reference);

    // If transaction successfully confirmed by Campay and landlordId is provided, activate subscription
    if (statusResult.status === "SUCCESSFUL" && landlordId && planId) {
      // Check again to avoid race conditions
      if (completedActivations.has(reference)) {
        return NextResponse.json({
          success: true,
          status: "SUCCESSFUL",
          reference,
          record: completedActivations.get(reference),
          isCached: true,
        });
      }

      const activation = await processSubscriptionPayment({
        landlordId,
        landlordName: payerName || "Landlord",
        planId,
        billingCycle,
        paymentMethod: "momo",
        payerPhone,
        payerName,
        notes: `Campay Transaction Ref: ${reference}`,
      });

      if (activation.record) {
        completedActivations.set(reference, activation.record);
      }

      return NextResponse.json({
        success: true,
        status: "SUCCESSFUL",
        reference,
        record: activation.record,
        isSimulated: statusResult.isSimulated,
      });
    }

    return NextResponse.json({
      success: true,
      status: statusResult.status,
      reference,
      operator: statusResult.operator,
      isSimulated: statusResult.isSimulated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error checking transaction status";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
