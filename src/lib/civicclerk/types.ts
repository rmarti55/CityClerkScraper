import type { CivicEvent } from '../types';

/** OData response wrapper from GET /v1/Events */
export interface EventsResponse {
  "@odata.context": string;
  "@odata.count"?: number;
  value: RawApiEvent[];
}

/** Raw Event API response includes publishedFiles; we use it only for February merge. */
export interface EventApiResponse {
  publishedFiles?: Array<{
    fileId: number;
    name: string;
    type: string;
    url: string;
    publishOn: string;
    fileType: number;
  }>;
}

/** API returns location in eventLocation (address1, address2, city, state, zipCode); flat venue fields are not sent. */
export interface RawEventLocation {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

/** Raw event from CivicClerk API (list or single). May have eventLocation instead of flat venue fields. */
export type RawApiEvent = Omit<CivicEvent, 'venueName' | 'venueAddress' | 'venueCity' | 'venueState' | 'venueZip'> & {
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  venueState?: string;
  venueZip?: string;
  eventLocation?: RawEventLocation | null;
};

/** Civic Clerk Search API raw response shapes */
export interface SearchEventModel {
  id: number;
  name: string;
  meetingDate?: string;
  categoryName?: string;
  publishedFiles?: Array<{ fileId?: number; id?: number; name: string; type: string; url?: string }>;
  eventLocation?: { address1?: string; address2?: string; city?: string; state?: string; zipCode?: string };
}

export interface SearchFileModel {
  id?: number;
  fileId?: number;
  name: string;
  type?: string;
  fileContent?: string[];
}

export interface SearchItemModel {
  id?: number;
  name?: string;
  agendaObjectItemName?: string;
  agendaObjectItemDescription?: string | null;
}

export interface PublicSearchResultRaw {
  event: SearchEventModel;
  agendaFiles?: SearchFileModel[];
  attachments?: SearchFileModel[];
  items?: SearchItemModel[];
}
