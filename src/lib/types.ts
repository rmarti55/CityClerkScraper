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

export interface MeetingItem {
  id: number;
  agendaObjectItemName: string;
  agendaObjectItemOutlineNumber: string;
  agendaObjectItemDescription: string | null;
}
