import { db, events, people } from '@/lib/db';
import { eq, gt, and, isNotNull, notInArray } from 'drizzle-orm';
import type { NewPerson } from '@/lib/db/schema';
import { scrapeElectedOfficials } from './scrapers';
import { getMeetingDetails } from '@/lib/civicclerk/api';
import { parseAgendaItem } from '@/lib/agenda-item-parser';
import type { MeetingItem } from '@/lib/types';
import seedData from './seed.json';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface PersonCandidate {
  name: string;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  sourceType: 'manual' | 'scraped' | 'agenda';
  sourceUrl: string | null;
}

const SOURCE_PRIORITY: Record<string, number> = { manual: 3, scraped: 2, agenda: 1 };

// ---------------------------------------------------------------------------
// Name cleaning
// ---------------------------------------------------------------------------

const LEADING_PREFIXES = [
  /^and\s+/i,
  /^&\s+/,
  /^Contact:\s*/i,
  /^Presenter:\s*/i,
  /^Vice\s+Chair\s+/i,
  /^Chair\s+/i,
  /^Councilor\s+/i,
  /^Deputy\s+Director\s+/i,
  /^Deputy\s+Chief\s+/i,
  /^Director\s+/i,
  /^Mayor\s+/i,
  /^Community\s+Gallery\s+Manager\s+/i,
  /^Administrative\s+Manager\s+/i,
  /^Judge\s+/i,
  /^Lt\.\s+/i,
  /^Commissioner\s+/i,
  /^Mateo\s+Frazier\s+EDD\s+—\s+/i,
];

const LEADING_PHONE_RE = /^[\d\s()-]{3,}[\s.—–-]+/;

function cleanSponsorName(raw: string, title?: string): string {
  let name = raw.trim();

  name = name.replace(LEADING_PHONE_RE, '');

  for (const re of LEADING_PREFIXES) {
    name = name.replace(re, '');
  }

  name = name.replace(/^[;,.\s—–-]+/, '').replace(/[;,.\s—–-]+$/, '').trim();

  // Collapse zero-width spaces and other unicode whitespace
  name = name.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();

  // Strip title echoed into name (e.g. "Kelly Bynon Administrative Manager")
  if (title && name.endsWith(title)) {
    name = name.slice(0, -title.length).trim();
  }

  // Strip "Alexa Hempel Case Manager" pattern where title appears after name
  if (title && name.includes(title)) {
    name = name.replace(title, '').replace(/\s{2,}/g, ' ').trim();
  }

  return name;
}

function cleanTitle(raw: string): string {
  let title = raw.trim();
  title = title.replace(/^City\s+of\s+Santa\s+Fe\s+/i, '');
  title = title.replace(/:\s*$/, '');
  title = title.replace(/\s*\|\s*$/, '');
  title = title.replace(/\s*;\s*\d{3}-\d{3}-\d{4}.*$/, '');
  return title;
}

// ---------------------------------------------------------------------------
// Email normalization — fix common santafenm.gov typos
// ---------------------------------------------------------------------------

const DOMAIN_TYPOS: Record<string, string> = {
  'santafennm.gov': 'santafenm.gov',
  'santafewnm.gov': 'santafenm.gov',
  'samtafem.gov': 'santafenm.gov',
  'sanafenm.gov': 'santafenm.gov',
  'sanatafenm.gov': 'santafenm.gov',
  'santatfenm.gov': 'santafenm.gov',
  'santafenmn.gov': 'santafenm.gov',
  'santafnem.gov': 'santafenm.gov',
  'sanatefnm.gov': 'santafenm.gov',
  'santafen.gov': 'santafenm.gov',
  'santafenm.com': 'santafenm.gov',
};

function normalizeEmail(raw: string): string {
  let email = raw.toLowerCase().trim().replace(/:$/, '');
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return email;
  const domain = email.slice(atIdx + 1);
  const fixed = DOMAIN_TYPOS[domain];
  if (fixed) {
    email = email.slice(0, atIdx + 1) + fixed;
  }
  return email;
}

// ---------------------------------------------------------------------------
// Department inference from event name
// ---------------------------------------------------------------------------

const DEPARTMENT_PATTERNS: [RegExp, string][] = [
  [/Public\s+Works/i, 'Public Works'],
  [/Public\s+Utilit/i, 'Public Utilities'],
  [/Governing\s+Body/i, 'Governing Body'],
  [/Finance\s+Committee/i, 'Finance'],
  [/Quality\s+of\s+Life/i, 'Community Services'],
  [/Community\s+Development/i, 'Community Development'],
  [/Land\s+Use/i, 'Land Use'],
  [/Planning\s+Commission/i, 'Land Use'],
  [/Arts?\s+(and|&)\s+Culture/i, 'Arts & Culture'],
  [/Economic\s+Development/i, 'Economic Development'],
  [/Affordable\s+Housing/i, 'Affordable Housing'],
  [/Metropolitan\s+Redevelopment/i, 'Metropolitan Redevelopment'],
  [/Tourism/i, 'Tourism'],
  [/Airport/i, 'Airport'],
  [/Transit/i, 'Transit'],
  [/Fire/i, 'Fire Department'],
  [/Police/i, 'Police Department'],
  [/Library/i, 'Library'],
  [/Parks?\s+(and|&)\s+Open\s+Space/i, 'Parks & Open Space'],
  [/Recreation/i, 'Recreation'],
  [/Human\s+Resources/i, 'Human Resources'],
  [/Buckman\s+Direct\s+Diversion|BDD/i, 'Buckman Direct Diversion'],
  [/River\s+Commission/i, 'River & Watershed'],
  [/Watershed/i, 'River & Watershed'],
  [/Water\s+Conservation/i, 'Water Conservation'],
  [/Youth\s+(and|&)\s+Family/i, 'Youth & Family Services'],
  [/Film/i, 'Film & Media'],
  [/Municipal\s+Court/i, 'Municipal Court'],
  [/Emergency\s+Management/i, 'Emergency Management'],
  [/Solid\s+Waste/i, 'Environmental Services'],
  [/Environmental\s+Services/i, 'Environmental Services'],
  [/Wastewater/i, 'Wastewater Management'],
];

function inferDepartment(eventName: string, email: string | null): string | null {
  for (const [re, dept] of DEPARTMENT_PATTERNS) {
    if (re.test(eventName)) return dept;
  }
  if (email) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && domain !== 'santafenm.gov' && domain !== 'santafecountynm.gov') {
      return 'Community';
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Flatten nested MeetingItem tree
// ---------------------------------------------------------------------------

function flattenItems(items: MeetingItem[]): MeetingItem[] {
  const result: MeetingItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.childItems?.length) {
      result.push(...flattenItems(item.childItems));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function pMap<T, R>(
  items: T[],
  fn: (item: T, idx: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// ---------------------------------------------------------------------------
// Scan all cached events for agenda sponsors
// ---------------------------------------------------------------------------

async function scanAgendaSponsors(): Promise<PersonCandidate[]> {
  const rows = await db
    .select({ id: events.id, agendaId: events.agendaId, eventName: events.eventName })
    .from(events)
    .where(and(isNotNull(events.agendaId), gt(events.agendaId, 0)));

  console.log(`[people-sync] Scanning ${rows.length} events for sponsors...`);

  const sponsorMap = new Map<string, PersonCandidate>();
  let processed = 0;

  await pMap(rows, async (row) => {
    try {
      const meeting = await getMeetingDetails(row.agendaId!);
      if (!meeting?.items?.length) return;

      const flat = flattenItems(meeting.items);
      for (const item of flat) {
        const parsed = parseAgendaItem(
          item.agendaObjectItemName,
          item.agendaObjectItemOutlineNumber,
          item.agendaObjectItemDescription,
        );
        for (const s of parsed.sponsors) {
          const cleanedName = cleanSponsorName(s.name, s.title);
          if (!cleanedName || cleanedName.length < 3) continue;
          // Skip entries that are just numbers/phone fragments
          if (/^\d+$/.test(cleanedName.replace(/[\s.-]/g, ''))) continue;

          const email = s.email ? normalizeEmail(s.email) : null;
          const cleanedTitle = s.title ? cleanTitle(s.title) : null;
          const key = email ?? cleanedName.toLowerCase();
          const dept = inferDepartment(row.eventName, email);

          const existing = sponsorMap.get(key);
          if (existing) {
            if (!existing.title && cleanedTitle) existing.title = cleanedTitle;
            if (!existing.department && dept) existing.department = dept;
            if (!existing.email && email) existing.email = email;
          } else {
            sponsorMap.set(key, {
              name: cleanedName,
              title: cleanedTitle,
              department: dept,
              email,
              phone: null,
              photoUrl: null,
              sourceType: 'agenda',
              sourceUrl: null,
            });
          }
        }
      }

      processed++;
      if (processed % 100 === 0) {
        console.log(`[people-sync] Processed ${processed}/${rows.length} events, ${sponsorMap.size} unique people`);
      }
    } catch {
      // Individual meeting fetch failures are non-fatal
    }
  }, 5);

  console.log(`[people-sync] Done scanning. ${processed} events processed, ${sponsorMap.size} unique people found.`);

  // Second pass: merge entries that share the same normalized name but have different email typos.
  // Normalize by stripping middle initials (e.g. "Michael J. Garcia" -> "michael garcia")
  function normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b[a-z]\.\s*/g, '') // strip single-letter initials like "J." or "K."
      .replace(/\s+/g, ' ')
      .trim();
  }

  const byName = new Map<string, string[]>();
  for (const [key, person] of sponsorMap) {
    const normName = normalizeName(person.name);
    const existing = byName.get(normName);
    if (existing) existing.push(key);
    else byName.set(normName, [key]);
  }

  for (const keys of byName.values()) {
    if (keys.length <= 1) continue;
    const sorted = keys.sort((a, b) => {
      const pa = sponsorMap.get(a)!;
      const pb = sponsorMap.get(b)!;
      const scoreA = (pa.email?.endsWith('@santafenm.gov') ? 10 : 0) + (pa.title ? 1 : 0);
      const scoreB = (pb.email?.endsWith('@santafenm.gov') ? 10 : 0) + (pb.title ? 1 : 0);
      return scoreB - scoreA;
    });
    const primary = sponsorMap.get(sorted[0])!;
    for (let i = 1; i < sorted.length; i++) {
      const dup = sponsorMap.get(sorted[i])!;
      // Prefer the longer (more complete) name variant
      if (dup.name.length > primary.name.length) primary.name = dup.name;
      if (!primary.title && dup.title) primary.title = dup.title;
      if (!primary.department && dup.department) primary.department = dup.department;
      if (!primary.email && dup.email) primary.email = dup.email;
      sponsorMap.delete(sorted[i]);
    }
  }

  console.log(`[people-sync] After dedup: ${sponsorMap.size} unique people.`);
  return [...sponsorMap.values()];
}

// ---------------------------------------------------------------------------
// Merge + upsert pipeline
// ---------------------------------------------------------------------------

function mergePersons(existing: PersonCandidate, incoming: PersonCandidate): PersonCandidate {
  const existingPriority = SOURCE_PRIORITY[existing.sourceType] ?? 0;
  const incomingPriority = SOURCE_PRIORITY[incoming.sourceType] ?? 0;

  const [base, overlay] = incomingPriority >= existingPriority
    ? [existing, incoming]
    : [incoming, existing];

  return {
    name: overlay.name || base.name,
    title: overlay.title || base.title,
    department: overlay.department || base.department,
    email: overlay.email || base.email,
    phone: overlay.phone || base.phone,
    photoUrl: overlay.photoUrl || base.photoUrl,
    sourceType: overlay.sourceType,
    sourceUrl: overlay.sourceUrl || base.sourceUrl,
  };
}

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  sources: { manual: number; scraped: number; agenda: number };
}

export async function syncPeople(): Promise<SyncResult> {
  const candidates = new Map<string, PersonCandidate>();

  // 1. Load agenda-sourced sponsors (lowest priority)
  try {
    const agendaPeople = await scanAgendaSponsors();
    for (const p of agendaPeople) {
      const key = p.email?.toLowerCase() ?? p.name.toLowerCase();
      const existing = candidates.get(key);
      candidates.set(key, existing ? mergePersons(existing, p) : p);
    }
    console.log(`[people-sync] Loaded ${agendaPeople.length} agenda-sourced candidates.`);
  } catch (err) {
    console.error('[people-sync] Failed to scan agenda sponsors:', err);
  }

  // 2. Load scraped elected officials
  try {
    const scraped = await scrapeElectedOfficials();
    for (const p of scraped) {
      const key = p.email?.toLowerCase() ?? p.name.toLowerCase();
      const candidate: PersonCandidate = { ...p, sourceType: 'scraped' };
      const existing = candidates.get(key);
      candidates.set(key, existing ? mergePersons(existing, candidate) : candidate);
    }
  } catch (err) {
    console.error('[people-sync] Failed to scrape elected officials:', err);
  }

  // 3. Load manual seed data (highest priority)
  for (const entry of seedData) {
    const key = entry.email?.toLowerCase() ?? entry.name.toLowerCase();
    const candidate: PersonCandidate = {
      name: entry.name,
      title: entry.title ?? null,
      department: entry.department ?? null,
      email: entry.email ?? null,
      phone: entry.phone ?? null,
      photoUrl: entry.photoUrl ?? null,
      sourceType: 'manual',
      sourceUrl: entry.sourceUrl ?? null,
    };
    const existing = candidates.get(key);
    candidates.set(key, existing ? mergePersons(existing, candidate) : candidate);
  }

  // 3b. Cross-source name-based dedup (catches "Michael Garcia" agenda vs "Michael J. Garcia" manual)
  function normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b[a-z]\.\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const nameToKeys = new Map<string, string[]>();
  for (const [key, person] of candidates) {
    const norm = normalizeName(person.name);
    const existing = nameToKeys.get(norm);
    if (existing) existing.push(key);
    else nameToKeys.set(norm, [key]);
  }

  for (const keys of nameToKeys.values()) {
    if (keys.length <= 1) continue;
    // Keep the highest-priority entry, merge others into it
    const sorted = keys.sort((a, b) => {
      const pa = candidates.get(a)!;
      const pb = candidates.get(b)!;
      const prioA = SOURCE_PRIORITY[pa.sourceType] ?? 0;
      const prioB = SOURCE_PRIORITY[pb.sourceType] ?? 0;
      if (prioB !== prioA) return prioB - prioA;
      return (pb.email ? 1 : 0) - (pa.email ? 1 : 0);
    });
    const primary = candidates.get(sorted[0])!;
    for (let i = 1; i < sorted.length; i++) {
      const dup = candidates.get(sorted[i])!;
      if (dup.name.length > primary.name.length) primary.name = dup.name;
      if (!primary.title && dup.title) primary.title = dup.title;
      if (!primary.department && dup.department) primary.department = dup.department;
      if (!primary.phone && dup.phone) primary.phone = dup.phone;
      if (!primary.photoUrl && dup.photoUrl) primary.photoUrl = dup.photoUrl;
      if (!primary.sourceUrl && dup.sourceUrl) primary.sourceUrl = dup.sourceUrl;
      candidates.delete(sorted[i]);
    }
  }

  console.log(`[people-sync] Total merged candidates: ${candidates.size}`);

  // 4. Upsert into database
  let created = 0;
  let updated = 0;
  const sources = { manual: 0, scraped: 0, agenda: 0 };
  const touchedIds: number[] = [];

  for (const person of candidates.values()) {
    sources[person.sourceType]++;
    const slug = slugify(person.name);
    const now = new Date();

    let existingRow = person.email
      ? (await db.select().from(people).where(eq(people.email, person.email)).limit(1))[0]
      : undefined;

    if (!existingRow) {
      existingRow = (await db.select().from(people).where(eq(people.slug, slug)).limit(1))[0];
    }

    // If slug already taken by a different person, append a numeric suffix
    let finalSlug = slug;
    if (!existingRow) {
      const slugConflict = (await db.select().from(people).where(eq(people.slug, slug)).limit(1))[0];
      if (slugConflict) {
        let suffix = 2;
        while (true) {
          const candidate = `${slug}-${suffix}`;
          const check = (await db.select().from(people).where(eq(people.slug, candidate)).limit(1))[0];
          if (!check) { finalSlug = candidate; break; }
          suffix++;
        }
      }
    }

    const values: NewPerson = {
      name: person.name,
      slug: existingRow ? existingRow.slug : finalSlug,
      title: person.title,
      department: person.department,
      email: person.email,
      phone: person.phone,
      photoUrl: person.photoUrl,
      sourceType: person.sourceType,
      sourceUrl: person.sourceUrl,
      isActive: 'true',
      updatedAt: now,
    };

    try {
      if (existingRow) {
        await db.update(people).set(values).where(eq(people.id, existingRow.id));
        touchedIds.push(existingRow.id);
        updated++;
      } else {
        values.createdAt = now;
        const [inserted] = await db.insert(people).values(values).returning({ id: people.id });
        if (inserted) touchedIds.push(inserted.id);
        created++;
      }
    } catch (err) {
      console.warn(`[people-sync] Failed to upsert ${person.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 5. Remove stale entries not touched by this sync
  if (touchedIds.length > 0) {
    await db.delete(people).where(notInArray(people.id, touchedIds));
    console.log(`[people-sync] Removed stale entries.`);
  }

  console.log(`[people-sync] Upsert complete: ${created} created, ${updated} updated.`);

  return {
    total: candidates.size,
    created,
    updated,
    sources,
  };
}
