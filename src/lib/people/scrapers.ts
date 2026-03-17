export interface ScrapedPerson {
  name: string;
  title: string;
  department: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  sourceUrl: string;
}

const USER_AGENT = 'CityClerk Dashboard/1.0 (city information aggregator)';

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * Scrape the elected officials listing page for council members and mayor.
 * Extracts name, title (district + role), email, phone, and photo from
 * the main listing at santafenm.gov/elected-officials.
 */
export async function scrapeElectedOfficials(): Promise<ScrapedPerson[]> {
  const sourceUrl = 'https://santafenm.gov/elected-officials';
  const html = await fetchPage(sourceUrl);
  const people: ScrapedPerson[] = [];

  // The page has sections for Mayor and City Council with structured data:
  //   Name, Title (Term ...), phone, email
  // We parse the markdown-like structure from the fetched content.

  // Match phone numbers in format 505-XXX-XXXX
  const phoneRe = /\b(505-\d{3}-\d{4})\b/g;
  // Match emails
  const emailRe = /\b([\w.+-]+@santafenm\.gov)\b/gi;

  // Parse mayor block
  const mayorMatch = html.match(
    /Mayor[^<]*?(?:Term[^)]*\))[^]*?(505-\d{3}-\d{4})[^]*?([\w.+-]+@santafenm\.gov)/i
  );

  // Parse individual council member blocks using the h5 + paragraph pattern
  // Each elected official appears as: ##### Name\n\nTitle (Term ...) phone email
  const blockRe = /#{3,5}\s+([^\n]+)\n+([^\n]*?(?:Mayor|District \d|Councilor|Judge)[^\n]*)/gi;
  let match;

  while ((match = blockRe.exec(html)) !== null) {
    const name = match[1].trim();
    const infoBlock = match[2];

    // Skip "Former Mayors" or other non-current entries
    if (name.toLowerCase().includes('former') || name.toLowerCase().includes('who is')) continue;

    // Extract title (everything before the term parenthetical)
    const titleMatch = infoBlock.match(/^(.*?)(?:\s*\(Term|\s*\[)/);
    const title = titleMatch ? titleMatch[1].trim() : infoBlock.split('(')[0].trim();

    if (!title) continue;

    // Extract phone
    const phones = infoBlock.match(phoneRe);
    const phone = phones ? phones[0] : null;

    // Extract email
    const emails = infoBlock.match(emailRe);
    const email = emails ? emails[0].toLowerCase() : null;

    // Determine department
    const department = title.toLowerCase().includes('judge')
      ? 'Municipal Court'
      : 'Governing Body';

    people.push({
      name,
      title,
      department,
      email,
      phone,
      photoUrl: null,
      sourceUrl,
    });
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return people.filter(p => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Try to scrape individual elected official pages for photos.
 * Returns a map of email -> photoUrl.
 */
export async function scrapeElectedOfficialPhotos(
  officials: ScrapedPerson[]
): Promise<Map<string, string>> {
  const photoMap = new Map<string, string>();

  for (const official of officials) {
    if (!official.sourceUrl || !official.email) continue;

    try {
      // Build the individual page URL from the name
      const slug = official.name
        .toLowerCase()
        .replace(/[^a-z\s-]/g, '')
        .replace(/\s+/g, '-');
      const role = official.title.toLowerCase().includes('mayor') ? 'mayor' : 'councilor';
      const pageUrl = `https://santafenm.gov/elected-officials/${role}-${slug}`;

      const html = await fetchPage(pageUrl);

      // Look for profile images
      const imgMatch = html.match(
        /(?:src|data-src)=["'](https?:\/\/[^"']*?(?:elected|official|council|mayor)[^"']*\.(?:jpg|jpeg|png|webp))["']/i
      ) || html.match(
        /(?:src|data-src)=["'](\/[^"']*?(?:elected|official|council|mayor)[^"']*\.(?:jpg|jpeg|png|webp))["']/i
      );

      if (imgMatch) {
        const photoUrl = imgMatch[1].startsWith('/')
          ? `https://santafenm.gov${imgMatch[1]}`
          : imgMatch[1];
        photoMap.set(official.email, photoUrl);
      }
    } catch {
      // Individual page fetch failures are non-fatal
    }
  }

  return photoMap;
}
