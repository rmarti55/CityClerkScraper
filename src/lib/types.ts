// Types based on actual CivicClerk API response structure
export interface CivicEvent {
  id: number;
  eventName: string;
  eventDescription: string;
  eventDate: string;
  startDateTime: string;
  agendaId: number | null;
  agendaName: string;
  categoryName: string;
  isPublished: string;
  // Location fields from venue
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  venueState?: string;
  venueZip?: string;
  // Computed fields
  fileCount?: number;
  fileNames?: string; // Concatenated file names for search
  // Cache metadata
  cachedAt?: string; // ISO timestamp of last sync from CivicClerk API
  // Search metadata (populated only in search results)
  matchingAgendaItem?: string; // Name of the matching agenda item, if the match came from agenda_items
  searchRank?: number; // Full-text search relevance score
}

export interface CivicFile {
  fileId: number;
  name: string;
  type: string; // "Agenda", "Agenda Packet", "Minutes", etc.
  url: string;
  publishOn: string;
  fileType: number;
}

export interface MeetingDetails {
  id: number;
  agendaPacketIsPublish: boolean;
  agendaIsPublish: boolean;
  publishedFiles: CivicFile[];
  items: MeetingItem[];
}

export interface ItemAttachment {
  id: number;
  agendaObjectItemId: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  isPublished: boolean;
  pdfVersionFullPath: string;
  mediaFullPath: string;
}

export interface MeetingItem {
  id: number;
  agendaObjectItemName: string;
  agendaObjectItemOutlineNumber: string;
  agendaObjectItemDescription: string | null;
  attachmentsList?: ItemAttachment[];
  childItems?: MeetingItem[];
}

/** One matching file from Civic Clerk Search (agendaFiles/attachments) with optional highlights */
export interface MatchingFile {
  fileId: number;
  name: string;
  type: string;
  url?: string;
  /** Highlighted name (HTML with <mark class="highlight">) from API, or plain name */
  highlightedName?: string;
  /** Snippets of matching content (HTML with <mark>) from API */
  snippets?: string[];
}

/** One matching agenda item from Civic Clerk Search */
export interface MatchingItem {
  id: number;
  name: string;
  description?: string | null;
  highlightedName?: string;
}

/** One event with its document-search matches */
export interface DocumentSearchResult {
  event: CivicEvent;
  matchingFiles: MatchingFile[];
  matchingItems: MatchingItem[];
  totalInEvent: number;
  /** All published files for this event (for "View Documents" in search results) */
  eventFiles?: MatchingFile[];
}
