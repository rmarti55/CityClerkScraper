import { SITE_NAME } from "@/lib/branding";
import { getResend, emailFrom, formatDate, escapeHtml, footerLinksHtml, footerLinksText } from "@/emails/shared";

export interface TranscriptEmailSummary {
  executiveSummary: string;
  keyDecisions: string[];
  actionItems: string[];
  publicCommentsSummary: string;
  motionsAndVotes: string[];
}

export interface TranscriptEmailTopic {
  topic: string;
  keywords: string[];
  relevanceScore: number;
}

export interface SendTranscriptReadyParams {
  to: string;
  eventName: string;
  eventId: number;
  startDateTime?: string;
  categoryName?: string;
  summary?: TranscriptEmailSummary;
  topics?: TranscriptEmailTopic[];
  reason: string;
  appUrl: string;
}

// ---------------------------------------------------------------------------
// HTML list helpers
// ---------------------------------------------------------------------------

function htmlSection(title: string, body: string): string {
  return `
              <tr>
                <td style="padding-top: 24px;">
                  <h3 style="margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.03em;">${title}</h3>
                  ${body}
                </td>
              </tr>`;
}

function htmlCheckList(items: string[]): string {
  return `<table role="presentation" style="width: 100%; border-collapse: collapse;">${items
    .map(
      (item) =>
        `<tr><td style="padding: 4px 0; font-size: 14px; color: #374151; line-height: 1.5; vertical-align: top; width: 22px;">&#10003;</td><td style="padding: 4px 0; font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(item)}</td></tr>`
    )
    .join("")}</table>`;
}

function htmlBulletList(items: string[]): string {
  return `<table role="presentation" style="width: 100%; border-collapse: collapse;">${items
    .map(
      (item) =>
        `<tr><td style="padding: 4px 0; font-size: 14px; color: #374151; line-height: 1.5; vertical-align: top; width: 22px;">&#9679;</td><td style="padding: 4px 0; font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(item)}</td></tr>`
    )
    .join("")}</table>`;
}

function htmlArrowList(items: string[]): string {
  return `<table role="presentation" style="width: 100%; border-collapse: collapse;">${items
    .map(
      (item) =>
        `<tr><td style="padding: 4px 0; font-size: 14px; color: #374151; line-height: 1.5; vertical-align: top; width: 22px;">&#9656;</td><td style="padding: 4px 0; font-size: 14px; color: #374151; line-height: 1.5;">${escapeHtml(item)}</td></tr>`
    )
    .join("")}</table>`;
}

function htmlTopicPills(topics: TranscriptEmailTopic[]): string {
  return topics
    .map(
      (t) =>
        `<span style="display: inline-block; margin: 0 6px 6px 0; padding: 4px 10px; font-size: 12px; font-weight: 500; color: #4338ca; background-color: #eef2ff; border-radius: 9999px;">${escapeHtml(t.topic)}</span>`
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Plain-text list helpers
// ---------------------------------------------------------------------------

function textCheckList(items: string[]): string {
  return items.map((item) => `  ✓ ${item}`).join("\n");
}

function textBulletList(items: string[]): string {
  return items.map((item) => `  • ${item}`).join("\n");
}

function textArrowList(items: string[]): string {
  return items.map((item) => `  ▸ ${item}`).join("\n");
}

// ---------------------------------------------------------------------------
// Email sender
// ---------------------------------------------------------------------------

export async function sendTranscriptReadyEmail({
  to,
  eventName,
  eventId,
  startDateTime,
  categoryName,
  summary,
  topics,
  reason,
  appUrl,
}: SendTranscriptReadyParams): Promise<{ id: string | null; error: unknown }> {
  const subject = `Transcript ready: ${eventName}`;
  const meetingUrl = `${appUrl}/meeting/${eventId}`;

  const dateHtml = startDateTime
    ? `<p style="margin: 4px 0 0; font-size: 14px; color: #6b7280;">${escapeHtml(formatDate(startDateTime))}</p>`
    : "";
  const categoryHtml = categoryName
    ? `<p style="margin: 4px 0 0; font-size: 13px; color: #9ca3af;">${escapeHtml(categoryName)}</p>`
    : "";

  // Build summary sections (only if data exists)
  let summarySectionsHtml = "";
  if (summary) {
    if (summary.executiveSummary) {
      summarySectionsHtml += htmlSection(
        "Executive Summary",
        `<p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(summary.executiveSummary)}</p>`
      );
    }
    if (topics && topics.length > 0) {
      summarySectionsHtml += htmlSection("Topics Discussed", htmlTopicPills(topics));
    }
    if (summary.keyDecisions.length > 0) {
      summarySectionsHtml += htmlSection("Key Decisions", htmlCheckList(summary.keyDecisions));
    }
    if (summary.motionsAndVotes.length > 0) {
      summarySectionsHtml += htmlSection("Motions &amp; Votes", htmlBulletList(summary.motionsAndVotes));
    }
    if (summary.actionItems.length > 0) {
      summarySectionsHtml += htmlSection("Action Items", htmlArrowList(summary.actionItems));
    }
    if (summary.publicCommentsSummary) {
      summarySectionsHtml += htmlSection(
        "Public Comments",
        `<p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${escapeHtml(summary.publicCommentsSummary)}</p>`
      );
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 800px; width: 100%; border-collapse: collapse;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #111827;">${SITE_NAME}</h1>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 28px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">

                <!-- Meeting header -->
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.05em;">Transcript available</p>
                    <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(eventName)}</h2>
                    ${dateHtml}
                    ${categoryHtml}
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 20px 0 0;">
                    <div style="border-top: 1px solid #e5e7eb;"></div>
                  </td>
                </tr>

                ${summarySectionsHtml}

                <!-- CTA button -->
                <tr>
                  <td style="padding-top: 28px;">
                    <a href="${meetingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Read full transcript</a>
                  </td>
                </tr>

                <!-- Footer links -->
                <tr>
                  <td style="padding-top: 20px;">
                    <p style="margin: 0; font-size: 14px;">
                      ${footerLinksHtml(appUrl)}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Reason + branding footer -->
          <tr>
            <td style="padding-top: 20px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af;">${escapeHtml(reason)}</p>
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

  // ---- Plain-text version ----
  const lines: string[] = [
    "TRANSCRIPT AVAILABLE",
    "",
    eventName,
  ];
  if (startDateTime) lines.push(formatDate(startDateTime));
  if (categoryName) lines.push(categoryName);
  lines.push("", "---", "");

  if (summary) {
    if (summary.executiveSummary) {
      lines.push("EXECUTIVE SUMMARY", "", summary.executiveSummary, "");
    }
    if (topics && topics.length > 0) {
      lines.push("TOPICS DISCUSSED", "", topics.map((t) => t.topic).join(", "), "");
    }
    if (summary.keyDecisions.length > 0) {
      lines.push("KEY DECISIONS", "", textCheckList(summary.keyDecisions), "");
    }
    if (summary.motionsAndVotes.length > 0) {
      lines.push("MOTIONS & VOTES", "", textBulletList(summary.motionsAndVotes), "");
    }
    if (summary.actionItems.length > 0) {
      lines.push("ACTION ITEMS", "", textArrowList(summary.actionItems), "");
    }
    if (summary.publicCommentsSummary) {
      lines.push("PUBLIC COMMENTS", "", summary.publicCommentsSummary, "");
    }
  }

  lines.push(
    "---",
    "",
    `Read full transcript: ${meetingUrl}`,
    "",
    footerLinksText(appUrl),
    "",
    reason,
  );

  const text = lines.join("\n");

  const { data, error } = await getResend().emails.send({
    from: emailFrom(),
    to,
    subject,
    html,
    text,
  });

  return { id: data?.id ?? null, error };
}
