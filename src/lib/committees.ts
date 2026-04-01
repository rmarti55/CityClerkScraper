/**
 * Committee configuration
 * Maps URL slugs to CivicClerk category names
 */

export interface CommitteeConfig {
  slug: string;
  categoryName: string;
  displayName: string;
  /** Short name for mobile tabs */
  shortName: string;
  description: string;
  /** Tailwind color token for the dot/accent (e.g. "indigo", "amber") */
  color: string;
  /** SVG icon path(s) for desktop tab display */
  iconPaths: string[];
}

// Featured committees with dedicated pages
export const COMMITTEES: Record<string, CommitteeConfig> = {
  'governing-body': {
    slug: 'governing-body',
    categoryName: 'Governing Body',
    displayName: 'Governing Body',
    shortName: 'Governing Body',
    description: 'City Council meetings, resolutions, and official business',
    color: 'indigo',
    iconPaths: [
      'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    ],
  },
  'public-works': {
    slug: 'public-works',
    categoryName: 'Public Works and Utilities Committee',
    displayName: 'Public Works and Utilities',
    shortName: 'Public Works',
    description: 'Infrastructure, utilities, and public works projects',
    color: 'amber',
    iconPaths: [
      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    ],
  },
  'planning-commission': {
    slug: 'planning-commission',
    categoryName: 'Planning Commission',
    displayName: 'Planning Commission',
    shortName: 'Planning',
    description: 'Land use, zoning, and development review',
    color: 'purple',
    iconPaths: [
      'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    ],
  },
  'bpac': {
    slug: 'bpac',
    categoryName: 'Bicycle and Pedestrians Advisory Committee',
    displayName: 'Bicycle & Pedestrian Advisory',
    shortName: 'BPAC',
    description: 'Bicycle and pedestrian infrastructure, safety, and policy',
    color: 'emerald',
    iconPaths: [
      'M13 10V3L4 14h7v7l9-11h-7z',
    ],
  },
  'finance': {
    slug: 'finance',
    categoryName: 'Finance Committee',
    displayName: 'Finance Committee',
    shortName: 'Finance',
    description: 'Budget, fiscal policy, and financial oversight',
    color: 'blue',
    iconPaths: [
      'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    ],
  },
} as const;

// Get committee by slug
export function getCommitteeBySlug(slug: string): CommitteeConfig | undefined {
  return COMMITTEES[slug];
}

// Get all committee slugs (for static generation)
export function getAllCommitteeSlugs(): string[] {
  return Object.keys(COMMITTEES);
}

// Get committee by category name (for reverse lookup)
export function getCommitteeByCategoryName(categoryName: string): CommitteeConfig | undefined {
  return Object.values(COMMITTEES).find(c => c.categoryName === categoryName);
}
