import { Resend } from "resend";
import { SITE_NAME } from "@/lib/branding";

let resend: Resend | null = null;

export function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || `${SITE_NAME} <noreply@resend.dev>`;
}

/**
 * Format a date string for display in emails. Anchored to America/Denver.
 * Pass `includeTime: false` to omit the hour/minute (used by transcript-ready).
 */
export function formatDate(d: string, { includeTime = true } = {}): string {
  const date = new Date(d);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Denver",
  };
  if (includeTime) {
    opts.hour = "numeric";
    opts.minute = "2-digit";
  }
  return date.toLocaleDateString("en-US", opts);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function followsUrl(appUrl: string): string {
  return `${appUrl}/?tab=following`;
}

export function alertsUrl(appUrl: string): string {
  return `${appUrl}/profile`;
}

export function footerLinksHtml(appUrl: string): string {
  return `<a href="${followsUrl(appUrl)}" style="color: #2563eb; text-decoration: none;">My follows</a>
                &nbsp;·&nbsp;
                <a href="${alertsUrl(appUrl)}" style="color: #2563eb; text-decoration: none;">Manage your alerts</a>`;
}

export function footerLinksText(appUrl: string): string {
  return `My follows: ${followsUrl(appUrl)} | Manage your alerts: ${alertsUrl(appUrl)}`;
}
