import { Resend } from "resend";
import { SITE_NAME } from "@/lib/branding";

// Initialize Resend lazily to avoid build-time errors when API key is not available
let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface SendMagicLinkParams {
  identifier: string; // email address
  url: string; // magic link URL
}

export async function sendMagicLinkEmail({ identifier, url }: SendMagicLinkParams) {
  const { error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM || `${SITE_NAME} <noreply@resend.dev>`,
    to: identifier,
    subject: `Sign in to ${SITE_NAME}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to ${SITE_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">
                ${SITE_NAME}
              </h1>
            </td>
          </tr>
          
          <!-- Main Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111827; text-align: center;">
                Sign in to your account
              </h2>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #6b7280; text-align: center;">
                Click the button below to sign in. This link will expire in 24 hours.
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${url}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Sign in
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 32px 0 0; font-size: 14px; line-height: 20px; color: #9ca3af; text-align: center;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; line-height: 18px; color: #6b7280; text-align: center; word-break: break-all;">
                ${url}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                If you didn't request this email, you can safely ignore it.
              </p>
              <p style="margin: 16px 0 0; font-size: 12px; color: #d1d5db;">
                ${SITE_NAME}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `Sign in to ${SITE_NAME}

Click this link to sign in: ${url}

This link will expire in 24 hours.

If you didn't request this email, you can safely ignore it.
`,
  });

  if (error) {
    throw new Error(`Failed to send magic link email: ${error.message}`);
  }
}
