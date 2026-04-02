import { SITE_NAME } from "@/lib/branding";
import { getResend, emailFrom, formatDate, footerLinksHtml, footerLinksText } from "@/emails/shared";

export interface SendMeetingReminderParams {
  to: string;
  eventName: string;
  startDateTime: string; // ISO string
  eventId: number;
  appUrl: string;
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
                ${footerLinksHtml(appUrl)}
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
    footerLinksText(appUrl),
  ].join("\n");

  const { data, error } = await getResend().emails.send({
    from: emailFrom(),
    to,
    subject,
    html,
    text,
  });

  return { id: data?.id ?? null, error };
}
