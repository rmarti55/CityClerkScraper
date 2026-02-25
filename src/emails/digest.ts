import { Resend } from "resend";

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

export interface DigestMeeting {
  id: number;
  eventName: string;
  startDateTime: string;
  categoryName: string;
}

export interface SendDigestParams {
  to: string;
  categoryMeetings: { categoryName: string; meetings: DigestMeeting[] }[];
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

export async function sendDigestEmail({ to, categoryMeetings, appUrl }: SendDigestParams) {
  const totalMeetings = categoryMeetings.reduce((sum, c) => sum + c.meetings.length, 0);
  if (totalMeetings === 0) return { id: null, error: null };

  const subject = `Santa Fe Meetings: ${totalMeetings} upcoming meeting${totalMeetings === 1 ? "" : "s"} in your followed categories`;

  const sections = categoryMeetings
    .filter((c) => c.meetings.length > 0)
    .map(
      (c) => `
        <tr><td style="padding: 16px 0 8px; font-weight: 600; color: #111827;">${c.categoryName}</td></tr>
        ${c.meetings
          .map(
            (m) => `
          <tr>
            <td style="padding: 4px 0 12px 20px; border-left: 3px solid #e5e7eb;">
              <a href="${appUrl}/meeting/${m.id}" style="color: #2563eb; text-decoration: none;">${m.eventName}</a>
              <br/><span style="font-size: 13px; color: #6b7280;">${formatDate(m.startDateTime)}</span>
            </td>
          </tr>
        `
          )
          .join("")}
      `
    )
    .join("");

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
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #111827;">Santa Fe City Meetings</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #111827;">Upcoming meetings</h2>
              <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">Here are upcoming meetings in the categories you follow (next 7 days).</p>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                ${sections}
              </table>
              <p style="margin: 24px 0 0; font-size: 14px;">
                <a href="${appUrl}/my-follows" style="color: #2563eb; text-decoration: none;">Manage your follows</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Santa Fe Civic Dashboard</p>
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
    "Santa Fe City Meetings - Upcoming meetings",
    "",
    ...categoryMeetings.flatMap((c) =>
      c.meetings.length === 0
        ? []
        : [
            c.categoryName,
            ...c.meetings.map(
              (m) => `  - ${m.eventName} (${formatDate(m.startDateTime)}) ${appUrl}/meeting/${m.id}`
            ),
            "",
          ]
    ),
    `Manage your follows: ${appUrl}/my-follows`,
  ].join("\n");

  const { data, error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM || "Santa Fe Meetings <noreply@resend.dev>",
    to,
    subject,
    html,
    text,
  });

  return { id: data?.id ?? null, error };
}
