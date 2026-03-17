export interface Sponsor {
  name: string;
  title?: string;
  email?: string;
}

export interface CommitteeDate {
  committee: string;
  date: string;
  note?: string;
}

export interface ParsedAgendaItem {
  outlineNumber: string;
  title: string;
  description: string | null;
  sponsors: Sponsor[];
  committeeReview: CommitteeDate[];
}

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w{2,}/;
const COMMITTEE_REVIEW_RE = /\n?\s*Committee\s+Review\s*:\s*/i;

/** Decode common HTML entities and normalize non-breaking spaces to regular spaces. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\u00a0/g, " ");
}

/**
 * Extract "(Name, Title; email)" sponsor blocks from text.
 * Returns the cleaned text (with sponsor blocks removed) and the parsed sponsors.
 *
 * Sponsor blocks use a consistent pattern from CivicClerk:
 *   (Name1, Title1; email1, Name2, Title2; email2)
 * Each sponsor's entry ends with their email address. We split on the email
 * boundaries to separate individual sponsors.
 */
function extractSponsors(text: string): { text: string; sponsors: Sponsor[] } {
  const sponsors: Sponsor[] = [];

  const cleaned = text.replace(/\(([^)]*?[\w.+-]+@[\w.-]+\.\w{2,}[^)]*)\)/g, (_match, inner: string) => {
    // Split on email boundaries: each email terminates one sponsor entry.
    // "Name1, Title1; email1, Name2, Title2; email2" →
    //   ["Name1, Title1; email1", ", Name2, Title2; email2"]
    const emailGlobal = /[\w.+-]+@[\w.-]+\.\w{2,}/g;
    const emails: { email: string; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = emailGlobal.exec(inner)) !== null) {
      emails.push({ email: m[0], end: m.index + m[0].length });
    }

    let cursor = 0;
    for (const { email, end } of emails) {
      const chunk = inner.slice(cursor, end);
      cursor = end;

      const withoutEmail = chunk.replace(EMAIL_RE, "").replace(/[;,\s]+$/, "").replace(/^[;,\s]+/, "").trim();
      const parts = withoutEmail.split(",").map((s) => s.trim()).filter(Boolean);
      // Remove the semicolon that sometimes precedes the email in "Title; email"
      const cleanedParts = parts.map((p) => p.replace(/;\s*$/, "").trim()).filter(Boolean);

      if (cleanedParts.length >= 2) {
        sponsors.push({ name: cleanedParts[0], title: cleanedParts.slice(1).join(", "), email });
      } else if (cleanedParts.length === 1) {
        sponsors.push({ name: cleanedParts[0], email });
      }
    }
    return "";
  });

  return { text: cleaned, sponsors };
}

/**
 * Extract "Committee Review:" schedule block from text.
 * Returns the text before the block and the parsed committee dates.
 */
function extractCommitteeReview(text: string): { text: string; committeeReview: CommitteeDate[] } {
  const committeeReview: CommitteeDate[] = [];
  const splitIdx = text.search(COMMITTEE_REVIEW_RE);
  if (splitIdx === -1) return { text, committeeReview };

  const before = text.slice(0, splitIdx);
  const after = text.slice(splitIdx).replace(COMMITTEE_REVIEW_RE, "");

  // Each line: "Committee Name: MM/DD/YYYY" or "Committee Name (note): MM/DD/YYYY"
  // Some lines may have trailing notes like "MEETING HAS BEEN CANCELED"
  const lines = after.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(
      /^(.+?)(?:\s*\(([^)]+)\))?\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*(.*)?$/
    );
    if (m) {
      const committee = m[1].trim();
      const parenNote = m[2]?.trim();
      const date = m[3];
      const trailingNote = m[4]?.trim();
      const note = [parenNote, trailingNote].filter(Boolean).join(" — ") || undefined;
      committeeReview.push({ committee, date, note });
    }
  }

  return { text: before, committeeReview };
}

/**
 * Split the remaining text into a concise title and a longer description.
 *
 * Heuristics:
 * - For "CONSIDERATION OF BILL/RESOLUTION" items, the first line (up to the
 *   bill number + period marker) is the title; everything after is description.
 * - For "Request for Approval of..." items, the first sentence is the title.
 * - Otherwise, if the text is short (< 200 chars) it's all title.
 * - For longer text, split at the first newline or first sentence boundary.
 */
function splitTitleDescription(text: string): { title: string; description: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { title: "", description: null };

  // CONSIDERATION OF BILL / RESOLUTION: title is the first line
  if (/^CONSIDERATION\s+OF\s+(BILL|RESOLUTION)/i.test(trimmed)) {
    const nlIdx = trimmed.indexOf("\n");
    if (nlIdx > 0) {
      const title = trimmed.slice(0, nlIdx).trim();
      const desc = trimmed.slice(nlIdx).trim();
      return { title, description: desc || null };
    }
    return { title: trimmed, description: null };
  }

  // Short text — all title
  if (trimmed.length < 200 && !trimmed.includes("\n")) {
    return { title: trimmed, description: null };
  }

  // Try splitting at first newline
  const nlIdx = trimmed.indexOf("\n");
  if (nlIdx > 0 && nlIdx < 300) {
    const title = trimmed.slice(0, nlIdx).trim();
    const desc = trimmed.slice(nlIdx).trim();
    return { title, description: desc || null };
  }

  // Try splitting at first sentence boundary (period followed by space + uppercase)
  const sentenceEnd = trimmed.match(/\.\s+(?=[A-Z(])/);
  if (sentenceEnd && sentenceEnd.index != null && sentenceEnd.index < 300) {
    const title = trimmed.slice(0, sentenceEnd.index + 1).trim();
    const desc = trimmed.slice(sentenceEnd.index + 1).trim();
    return { title, description: desc || null };
  }

  return { title: trimmed, description: null };
}

/**
 * Parse a raw MeetingItem into structured sections for display.
 */
export function parseAgendaItem(
  agendaObjectItemName: string,
  agendaObjectItemOutlineNumber: string,
  agendaObjectItemDescription?: string | null,
): ParsedAgendaItem {
  let text = agendaObjectItemName ?? "";

  // Convert <br> to newlines first, then strip remaining HTML tags, then decode entities
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeHtmlEntities(text);

  // 1. Extract committee review schedule
  const cr = extractCommitteeReview(text);
  text = cr.text;

  // 2. Extract sponsors
  const sp = extractSponsors(text);
  text = sp.text;

  // Clean up artifacts left after removing sponsor/committee blocks
  text = text
    .replace(/\.[\s.]+$/gm, ".")   // collapse trailing ".. " or ". ." into single period
    .replace(/\s{2,}/g, " ")
    .replace(/\n\s*\n/g, "\n")     // collapse blank lines
    .trim();

  // 3. Split title / description
  const { title, description: parsedDescription } = splitTitleDescription(text);

  // Merge in the API's agendaObjectItemDescription if we didn't parse one out
  const description = parsedDescription || agendaObjectItemDescription || null;

  return {
    outlineNumber: agendaObjectItemOutlineNumber ?? "",
    title,
    description,
    sponsors: sp.sponsors,
    committeeReview: cr.committeeReview,
  };
}
