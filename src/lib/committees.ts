/**
 * Committee configuration
 * Maps URL slugs to CivicClerk category names
 */

export interface CommitteeConfig {
  slug: string;
  categoryName: string;
  displayName: string;
  description: string;
}

// Featured committees with dedicated pages
export const COMMITTEES: Record<string, CommitteeConfig> = {
  'governing-body': {
    slug: 'governing-body',
    categoryName: 'Governing Body',
    displayName: 'Governing Body',
    description: 'City Council meetings, resolutions, and official business',
  },
  // Add more committees here as needed:
  // 'public-works': {
  //   slug: 'public-works',
  //   categoryName: 'Public Works Committee',
  //   displayName: 'Public Works',
  //   description: 'Infrastructure, utilities, and public works projects',
  // },
  // 'finance': {
  //   slug: 'finance',
  //   categoryName: 'Finance Committee',
  //   displayName: 'Finance',
  //   description: 'Budget, fiscal policy, and financial oversight',
  // },
  // 'quality-of-life': {
  //   slug: 'quality-of-life',
  //   categoryName: 'Quality of Life Committee',
  //   displayName: 'Quality of Life',
  //   description: 'Parks, recreation, arts, and community programs',
  // },
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
