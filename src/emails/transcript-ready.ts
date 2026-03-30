import { Resend } from "resend";
import { SITE_NAME } from "@/lib/branding";

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

export interface SendTranscriptReadyParams {
  to: string;
  eventName: string;
  eventId: number;
  summarySnippet?: string;
  appUrl: string;
}

function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  });
}

export async function sendTranscriptReadyEmail({
  to,
  eventName,
  eventId,
  summarySnippet,
  appUrl,
}: SendTranscriptReadyParams): Promise<{ id: string | null; error: unknown }> {
  const subject = `Transcript ready: ${eventName}`;
  const meetingUrl = `${appUrl}/meeting/${eventId}`;
  const myFollowUrl = `${appUrl}/?tab=following`;

  const summaryBlock = summarySnippet
    ? `<p style="margin: 0 0 20px; font-size: 14px; color: #374151; background-color: #f3f4f6; padding: 12px 16px; border-radius: 8px; border-left: 3px solid #6366f1;">${summarySnippet}</p>`
    : "";

  const summaryText = summarySnippet ? `\nSummary: ${summarySnippet}\n` : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 560px; width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #111827;">${SITE_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111827;">Transcript available</h2>
              <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #111827;">${eventName}</p>
              <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">The AI-generated transcript and summary for this meeting are now available.</p>
              ${summaryBlock}
              <p style="margin: 0 0 20px;">
                <a href="${meetingUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Read transcript</a>
              </p>
              <p style="margin: 0; font-size: 14px;">
                <a href="${myFollowUrl}" style="color: #2563eb; text-decoration: none;">My follows</a>
                &nbsp;·&nbsp;
                <a href="${appUrl}/profile" style="color: #2563eb; text-decoration: none;">Manage your alerts</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">${SITE_NAME}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = [
    "Transcript available",
    eventName,
    "The AI-generated transcript and summary for this meeting are now available.",
    summaryText,
    `Read transcript: ${meetingUrl}`,
    `My follows: ${myFollowUrl}`,
    `Manage your alerts: ${appUrl}/profile`,
  ].join("\n");

  const { data, error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM || `${SITE_NAME} <noreply@resend.dev>`,
    to,
    subject,
    html,
    text,
  });

  return { id: data?.id ?? null, error };
}
