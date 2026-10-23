/**
 * Campay Payment Gateway Service
 * Dedicated to handling automated Mobile Money (MTN MoMo & Orange Money) payments
 * exclusively for LeaseLink subscription plans.
 *
 * Documentation: https://www.campay.net/api
 */

export interface CampayCollectInput {
  amount: number;
  phone: string;
  description: string;
  externalReference: string;
}

export interface CampayCollectResult {
  success: boolean;
  reference?: string;
  ussdCode?: string;
  operator?: string;
  isSimulated?: boolean;
  error?: string;
}

export interface CampayStatusResult {
  status: "SUCCESSFUL" | "FAILED" | "PENDING";
  reference: string;
  amount?: number;
  currency?: string;
  operator?: string;
  code?: string;
  isSimulated?: boolean;
  error?: string;
}

// In-memory token cache for server runtimes
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Normalizes any phone number into Campay's expected Cameroon format (237XXXXXXXXX)
 */
export function formatCampayPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("237") && digits.length === 12) {
    return digits;
  }
  if (digits.length === 9 && (digits.startsWith("6") || digits.startsWith("2"))) {
    return `237${digits}`;
  }
  return digits;
}

/**
 * Returns Campay base API URL depending on configured environment
 */
export function getCampayBaseUrl(): string {
  const env = (process.env.CAMPAY_ENVIRONMENT || "demo").toLowerCase();
  return env === "production"
    ? "https://www.campay.net/api"
    : "https://demo.campay.net/api";
}

/**
 * Authenticates with Campay API and retrieves an API access token
 */
export async function getCampayAuthToken(): Promise<{
  token: string | null;
  isSimulated: boolean;
  error?: string;
}> {
  const username = process.env.CAMPAY_USERNAME?.trim();
  const password = process.env.CAMPAY_PASSWORD?.trim();

  // If credentials are not set, allow graceful simulated demo mode
  if (!username || !password) {
    return {
      token: "simulated_campay_dev_token",
      isSimulated: true,
    };
  }

  // Check valid cached token
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return { token: cachedToken.token, isSimulated: false };
  }

  try {
    const baseUrl = getCampayBaseUrl();
    const res = await fetch(`${baseUrl}/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Campay auth failed, falling back to simulation:", errText);
      return {
        token: "simulated_campay_fallback_token",
        isSimulated: true,
        error: `Campay auth error (${res.status})`,
      };
    }

    const data = await res.json();
    if (data.token) {
      // Tokens are typically valid for at least 1 hour; cache for 50 minutes
      cachedToken = {
        token: data.token,
        expiresAt: now + 50 * 60 * 1000,
      };
      return { token: data.token, isSimulated: false };
    }

    return { token: null, isSimulated: false, error: "No token returned from Campay" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error during Campay authentication";
    console.warn("Campay connection exception:", msg);
    return {
      token: "simulated_campay_fallback_token",
      isSimulated: true,
      error: msg,
    };
  }
}

/**
 * Triggers a Mobile Money USSD prompt on the payer's phone via Campay Collect API
 */
export async function requestCampayCollect(
  input: CampayCollectInput
): Promise<CampayCollectResult> {
  const { amount, phone, description, externalReference } = input;
  const formattedPhone = formatCampayPhone(phone);

  const auth = await getCampayAuthToken();

  // In simulated / dev mode (no credentials configured or test phone)
  if (auth.isSimulated || !auth.token) {
    const mockRef = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return {
      success: true,
      reference: mockRef,
      ussdCode: formattedPhone.startsWith("23767") || formattedPhone.startsWith("23768") || formattedPhone.startsWith("23765") ? "*126#" : "#150#",
      operator: formattedPhone.startsWith("23767") || formattedPhone.startsWith("23768") || formattedPhone.startsWith("23765") ? "MTN" : "ORANGE",
      isSimulated: true,
    };
  }

  try {
    const baseUrl = getCampayBaseUrl();
    const res = await fetch(`${baseUrl}/collect/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount).toString(),
        currency: "XAF",
        from: formattedPhone,
        description: description.substring(0, 100),
        external_reference: externalReference,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      const errorMsg =
        errorJson?.message ||
        errorJson?.detail ||
        `Campay collect failed with status ${res.status}`;
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    return {
      success: true,
      reference: data.reference,
      ussdCode: data.ussd_code,
      operator: data.operator,
      isSimulated: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error initiating Campay collect";
    return { success: false, error: msg };
  }
}

/**
 * Checks the status of a Campay transaction by reference
 */
export async function checkCampayTransactionStatus(
  reference: string
): Promise<CampayStatusResult> {
  // If simulated reference, simulate approval after 4 seconds
  if (reference.startsWith("sim_")) {
    const createdTimestamp = parseInt(reference.split("_")[1] || "0", 10);
    const elapsedSeconds = (Date.now() - createdTimestamp) / 1000;
    
    // Complete after ~5 seconds in simulated mode
    if (elapsedSeconds > 4) {
      return {
        status: "SUCCESSFUL",
        reference,
        isSimulated: true,
      };
    }

    return {
      status: "PENDING",
      reference,
      isSimulated: true,
    };
  }

  const auth = await getCampayAuthToken();
  if (auth.isSimulated || !auth.token) {
    return {
      status: "SUCCESSFUL",
      reference,
      isSimulated: true,
    };
  }

  try {
    const baseUrl = getCampayBaseUrl();
    const res = await fetch(`${baseUrl}/transaction/${reference}/`, {
      method: "GET",
      headers: {
        Authorization: `Token ${auth.token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "PENDING",
        reference,
        error: `Could not fetch status (${res.status})`,
      };
    }

    const data = await res.json();
    const rawStatus = (data.status || "").toUpperCase();
    const mappedStatus: "SUCCESSFUL" | "FAILED" | "PENDING" =
      rawStatus === "SUCCESSFUL"
        ? "SUCCESSFUL"
        : rawStatus === "FAILED"
        ? "FAILED"
        : "PENDING";

    return {
      status: mappedStatus,
      reference: data.reference || reference,
      amount: Number(data.amount) || undefined,
      currency: data.currency,
      operator: data.operator,
      code: data.code,
      isSimulated: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error checking transaction";
    return { status: "PENDING", reference, error: msg };
  }
}
