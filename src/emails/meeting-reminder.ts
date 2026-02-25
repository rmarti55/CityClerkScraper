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

export interface SendMeetingReminderParams {
  to: string;
  eventName: string;
  startDateTime: string; // ISO string
  eventId: number;
  appUrl: string;
}

function formatDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Sends a meeting reminder (e.g. 1 hour before the meeting).
 */
export async function sendMeetingReminderEmail({
  to,
  eventName,
  startDateTime,
  eventId,
  appUrl,
}: SendMeetingReminderParams): Promise<{ id: string | null; error: unknown }> {
  const subject = `Reminder: ${eventName} — ${formatDate(startDateTime)}`;
  const meetingUrl = `${appUrl}/meeting/${eventId}`;
  const myFollowUrl = `${appUrl}/my-follows`;

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
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111827;">Meeting reminder</h2>
              <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #111827;">${eventName}</p>
              <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">${formatDate(startDateTime)}</p>
              <p style="margin: 0; font-size: 14px;">
                <a href="${meetingUrl}" style="color: #2563eb; text-decoration: none;">View meeting</a>
                &nbsp;·&nbsp;
                <a href="${myFollowUrl}" style="color: #2563eb; text-decoration: none;">My Follow</a>
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
    "Meeting reminder",
    eventName,
    formatDate(startDateTime),
    "",
    `View meeting: ${meetingUrl}`,
    `My Follow: ${myFollowUrl}`,
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
