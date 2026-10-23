import { NextRequest, NextResponse } from "next/server";
import { processSubscriptionPayment } from "@/lib/services/subscriptionService";
import { SubscriptionPlanId } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log("Campay Webhook Notification Received:", payload);

    // Validate webhook secret key if configured
    const webhookKey = process.env.CAMPAY_WEBHOOK_KEY?.trim();
    if (webhookKey) {
      const authHeader = req.headers.get("x-campay-signature") || req.headers.get("authorization");
      // If header is provided, ensure it matches or contains the webhook key
      if (authHeader && !authHeader.includes(webhookKey)) {
        console.warn("Invalid Campay webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const {
      status,
      reference,
      external_reference,
      amount,
      operator,
      operator_reference,
    } = payload;

    if (status === "SUCCESSFUL" && external_reference) {
      // Parse external_reference: SUB-{timestamp}-{landlordId}-{planId}-{billingCycle}
      // Or look up pending subscription session
      console.log(`Campay Webhook: Transaction ${reference} approved for ${external_reference}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error processing webhook";
    console.error("Campay webhook exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
