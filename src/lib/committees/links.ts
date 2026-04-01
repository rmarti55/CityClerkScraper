export interface CommitteeLink {
  label: string;
  url: string;
}

// Static links per committee slug
// Add more committees here as they get dedicated pages
const COMMITTEE_LINKS: Record<string, CommitteeLink[]> = {
  'governing-body': [
    {
      label: 'Procedural Rules',
      url: '/governing-body/procedural-rules',
    },
    {
      label: 'Governing Body Appointments',
      url: 'https://santafenm.gov/boards-commissions-and-committees/city-council-committees/governing-body-appointments',
    },
    {
      label: 'Meetings, Minutes & Agendas',
      url: 'https://santafenm.gov/your-government/meetings-minutes-and-agendas',
    },
    {
      label: 'Elected Officials',
      url: 'https://santafenm.gov/elected-officials',
    },
    {
      label: 'Watch a Public Meeting',
      url: 'https://santafenm.gov/your-government/watch-a-public-meeting',
    },
  ],
  'planning-commission': [
    {
      label: 'Planning Commission',
      url: 'https://santafenm.gov/boards-commissions-and-committees/planning-commission',
    },
    {
      label: 'Meetings, Minutes & Agendas',
      url: 'https://santafenm.gov/your-government/meetings-minutes-and-agendas',
    },
  ],
  'historic-design-review': [
    {
      label: 'Historic Design Review Board',
      url: 'https://santafenm.gov/boards-commissions-and-committees/historic-design-review-board',
    },
    {
      label: 'Meetings, Minutes & Agendas',
      url: 'https://santafenm.gov/your-government/meetings-minutes-and-agendas',
    },
  ],
  'bpac': [
    {
      label: 'Bicycle & Pedestrian Advisory Committee',
      url: 'https://santafenm.gov/boards-commissions-and-committees/bicycle-and-pedestrians-advisory-committee',
    },
    {
      label: 'Meetings, Minutes & Agendas',
      url: 'https://santafenm.gov/your-government/meetings-minutes-and-agendas',
    },
  ],
  'finance': [
    {
      label: 'Finance Committee',
      url: 'https://santafenm.gov/boards-commissions-and-committees/city-council-committees/finance-committee',
    },
    {
      label: 'Meetings, Minutes & Agendas',
      url: 'https://santafenm.gov/your-government/meetings-minutes-and-agendas',
    },
  ],
};

export function getCommitteeLinks(slug: string): CommitteeLink[] {
  return COMMITTEE_LINKS[slug] ?? [];
}
