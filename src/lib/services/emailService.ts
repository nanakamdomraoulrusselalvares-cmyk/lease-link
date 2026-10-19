import { Resend } from "resend";

// Initialize Resend client if API key is provided
const resendApiKey = process.env.RESEND_API_KEY || "";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Sender address - default to Resend test sender onboarding@resend.dev or custom
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "LeaseLink <onboarding@resend.dev>";

export interface SendVerificationResult {
  success: boolean;
  messageId?: string;
  isDevBypass?: boolean;
  devCode?: string;
  error?: string;
}

/**
 * Generates an HTML email for the 6-digit LeaseLink confirmation code.
 */
function renderOtpEmailHtml(params: {
  code: string;
  expiresInMinutes: number;
}): string {
  const { code, expiresInMinutes } = params;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre code de vérification LeaseLink</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0; overflow: hidden;">
          
          <!-- Header Banner with Logo / Branding -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 36px 32px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #ffffff; width: 48px; height: 48px; border-radius: 14px; line-height: 48px; text-align: center; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      <span style="font-size: 26px; vertical-align: middle;">🏢</span>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">LeaseLink</h1>
                    <p style="margin: 4px 0 0 0; color: #bfdbfe; font-size: 13px; font-weight: 500;">Plateforme de Gestion Immobilière Intelligente</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 700; text-align: center;">
                Vérification de votre compte
              </h2>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6; text-align: center;">
                Bienvenue sur <strong>LeaseLink</strong> ! Pour finaliser la création de votre compte bailleur ou sécuriser votre accès, veuillez saisir le code de vérification à 6 chiffres ci-dessous :
              </p>

              <!-- 6-Digit Code Highlight Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 16px; padding: 20px 24px; display: inline-block;">
                      <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; display: block; margin-left: 10px;">
                        ${code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Security Notice -->
              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="vertical-align: top; width: 22px; padding-top: 1px;">
                      <span style="font-size: 15px;">⏱️</span>
                    </td>
                    <td style="color: #475569; font-size: 12px; line-height: 1.5; padding-left: 8px;">
                      Ce code est valable pendant <strong>${expiresInMinutes} minutes</strong>. Ne partagez jamais ce code avec qui que ce soit.
                    </td>
                  </tr>
                </table>
              </div>

              <!-- English Summary -->
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; line-height: 1.5; text-align: center; font-style: italic;">
                <strong>English:</strong> Your 6-digit confirmation code is <strong>${code}</strong>. Valid for ${expiresInMinutes} minutes.
              </p>

              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.5; text-align: center;">
                Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
                <br />
                © ${new Date().getFullYear()} LeaseLink. Tous droits réservés.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Sends a 6-digit OTP verification email to the user.
 * - If RESEND_API_KEY is configured, sends a real branded HTML email via Resend API.
 * - If RESEND_API_KEY is missing, logs code to server console and provides
 *   dev bypass payload so local development is uninterrupted.
 */
export async function sendVerificationOtpEmail(
  email: string,
  code: string,
  expiresInMinutes = 10
): Promise<SendVerificationResult> {
  const cleanEmail = email.trim().toLowerCase();
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "LeaseLink <onboarding@resend.dev>";

  // If no Resend API key is configured, log code for seamless local testing
  if (!apiKey || apiKey === "re_your_api_key_here") {
    console.log(
      `\n========================================================\n` +
      `[LeaseLink DEV OTP] Email verification code for: ${cleanEmail}\n` +
      `>> 6-DIGIT CODE: ${code} << (Valid for ${expiresInMinutes} min)\n` +
      `[Notice] RESEND_API_KEY is not set in .env.local.\n` +
      `To deliver real emails to inboxes, add: RESEND_API_KEY=re_...\n` +
      `========================================================\n`
    );

    return {
      success: true,
      isDevBypass: true,
      devCode: code,
      error: "RESEND_API_KEY is not configured in .env.local (Running in Dev Mode)",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const html = renderOtpEmailHtml({ code, expiresInMinutes });
    const subject = `${code} est votre code de vérification LeaseLink`;

    const response = await resend.emails.send({
      from: fromEmail,
      to: cleanEmail,
      subject,
      html,
      text: `Votre code de confirmation LeaseLink est : ${code}. Valide pendant ${expiresInMinutes} minutes.`,
    });

    if (response.error) {
      console.error("[LeaseLink Email] Resend API error:", response.error);

      // In case of domain verification restriction on free tier (only can send to account owner),
      // fallback gracefully to dev bypass mode with clean log
      return {
        success: false,
        error: response.error.message,
        isDevBypass: true,
        devCode: code,
      };
    }

    console.log(`[LeaseLink Email] OTP sent via Resend to ${cleanEmail}. Message ID: ${response.data?.id}`);

    return {
      success: true,
      messageId: response.data?.id,
      isDevBypass: false,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to send email";
    console.error("[LeaseLink Email] Unexpected sending failure:", errorMsg);

    return {
      success: false,
      error: errorMsg,
      isDevBypass: true,
      devCode: code,
    };
  }
}
