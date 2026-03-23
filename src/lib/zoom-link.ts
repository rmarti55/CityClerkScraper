import { getPdfBuffer } from "./file-cache";
import { extractTextFromPdf } from "./document-text";
import { getDocumentProxy } from "unpdf";

const ZOOM_URL_RE = /https?:\/\/[\w-]+\.zoom\.us\/[jw]\/\d+[^\s"'<>)}\]]*/gi;
const TEAMS_URL_RE = /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>)}\]]*/gi;
const MEET_URL_RE = /https?:\/\/meet\.google\.com\/[\w-]+/gi;

/**
 * Extract virtual meeting URLs from plain text.
 * Returns the first Zoom link found, falling back to Teams then Google Meet.
 */
export function extractMeetingLink(text: string): string | null {
  const zoom = text.match(ZOOM_URL_RE);
  if (zoom?.[0]) return zoom[0];

  const teams = text.match(TEAMS_URL_RE);
  if (teams?.[0]) return teams[0];

  const meet = text.match(MEET_URL_RE);
  if (meet?.[0]) return meet[0];

  return null;
}

const MAX_PAGES_TO_SCAN = 3;

/**
 * Extract hyperlink annotations from the first few pages of a PDF.
 * City agendas often wrap Zoom URLs in Outlook SafeLinks or embed them
 * as clickable annotations that don't appear in the extracted text.
 */
async function extractAnnotationUrls(buffer: Buffer): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const urls: string[] = [];
  const pageCount = Math.min(pdf.numPages, MAX_PAGES_TO_SCAN);

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const annots = await page.getAnnotations();
    for (const a of annots) {
      if (a.url) {
        let url: string = a.url;
        const safeLink = decodeOutlookSafeLink(url);
        if (safeLink) url = safeLink;
        urls.push(url);
      }
    }
  }
  return urls;
}

function decodeOutlookSafeLink(url: string): string | null {
  if (!url.includes("safelinks.protection.outlook.com")) return null;
  try {
    const parsed = new URL(url);
    const inner = parsed.searchParams.get("url");
    return inner ? decodeURIComponent(inner) : null;
  } catch {
    return null;
  }
}

/**
 * Download a file's PDF, extract text + annotation URLs from the first
 * few pages, and return the first virtual meeting link found.
 */
export async function extractMeetingLinkFromFile(fileId: number): Promise<string | null> {
  const buffer = await getPdfBuffer(fileId);
  if (!buffer) return null;

  const annotUrls = await extractAnnotationUrls(buffer);
  const annotText = annotUrls.join("\n");
  const fromAnnots = extractMeetingLink(annotText);
  if (fromAnnots) return fromAnnots;

  const { pages } = await extractTextFromPdf(buffer);
  const subset = pages.slice(0, MAX_PAGES_TO_SCAN).join("\n");
  return extractMeetingLink(subset);
}
